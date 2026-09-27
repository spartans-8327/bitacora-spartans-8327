-- Bitácora SPARTANS 8327 — Fase 4, Bloque A: área responsable + registros
-- especializados.
-- Tabla nueva: specialized_records.
-- Columnas nuevas en sessions: area, start_time, end_time.
-- Requiere haber aplicado 0001, 0002, 0003 y 0004 antes.
--
-- NO modifica categories, session_categories ni evidence: la clasificación
-- histórica de área (multi-selección) sigue viviendo exactamente igual que
-- hoy. Esta migración es puramente aditiva — ninguna sesión existente
-- pierde datos ni deja de mostrarse como hasta ahora.

-- ── Tipos ────────────────────────────────────────────────────────────────

-- Área responsable ÚNICA de la sesión (Fase 4, §1 y §2). Sustituye, solo
-- para sesiones NUEVAS, a la selección múltiple que hoy ofrece
-- session_categories (kind='area'). Las sesiones existentes NO se migran a
-- este enum — quedan con area = NULL a propósito (ver comentario en la
-- columna, más abajo).
--
-- 'team' es una categoría transversal para actividades colectivas (armar
-- cancha, montaje de stand, reuniones generales...), NO una quinta área
-- técnica: nunca tendrá fila en specialized_records (ver trigger abajo).
create type public.session_area as enum (
  'design',
  'mechanical',
  'programming',
  'marketing',
  'team'
);

-- Estado del trabajo especializado (Fase 4, §3-§6). Aplica por igual a
-- las cuatro áreas especializadas — Diseño, Mecánica, Programación y
-- Marketing (p. ej. un patrocinio, una campaña o un evento también pueden
-- estar en progreso, terminados o bloqueados). Ninguna de las cuatro
-- tiene un tratamiento distinto a nivel de base de datos.
create type public.specialization_status as enum (
  'in_progress',
  'completed',
  'blocked'
);

-- ── sessions: área responsable + horario opcional ───────────────────────

alter table public.sessions
  add column area public.session_area,
  add column start_time time,
  add column end_time time;

comment on column public.sessions.area is
  'Área responsable única de la sesión (Fase 4). NULL en toda sesión '
  'creada antes de esta migración, a propósito: esas sesiones podían tener '
  '0, 1 o varias áreas bajo el modelo anterior y no existe una forma no '
  'arbitraria de elegir "la" área principal retroactivamente. Su '
  'clasificación histórica sigue viviendo, sin cambios, en '
  'session_categories.';

comment on column public.sessions.start_time is
  'Hora de inicio, opcional (Fase 4, §2). La duración NUNCA se guarda '
  'como columna: se calcula en la aplicación a partir de start_time y '
  'end_time para no duplicar un dato derivable.';

alter table public.sessions
  add constraint sessions_end_time_after_start
  check (
    start_time is null or end_time is null or end_time >= start_time
  );

-- ── specialized_records ─────────────────────────────────────────────────

create table public.specialized_records (
  id uuid primary key default gen_random_uuid(),

  -- unique: una sesión tiene como máximo un registro especializado, porque
  -- solo tiene una área responsable (Fase 4, §2: "la colaboración entre
  -- áreas se representa mediante los participantes, no mediante múltiples
  -- áreas responsables").
  session_id uuid not null unique references public.sessions (id) on delete cascade,

  -- Clasificador principal de la especialización (p. ej. 'bug_fix', 'cad',
  -- 'assembly', 'social_media_content'). El vocabulario válido depende del
  -- área de la sesión y se valida con Zod en la aplicación, no aquí:
  -- mantenerlo fuera de la base de datos permite ajustar/agregar tipos de
  -- trabajo sin una migración, igual que ya ocurre con categories.label.
  work_type text not null,

  -- Qué se trabajó (elemento/entregable en Diseño, mecanismo en Mecánica,
  -- sistema/componente en Programación, producto/actividad en Marketing).
  -- Un solo campo compartido en vez de 4 columnas casi idénticas.
  subject text not null,

  -- Estado del trabajo especializado: aplica por igual a las cuatro áreas
  -- (Diseño, Mecánica, Programación y Marketing). NULL solo es válido en
  -- el sentido de "todavía no se definió un estado", no como una columna
  -- que Marketing deba dejar sin usar.
  status public.specialization_status,
  blocked_reason text,
  blocked_needs text,

  -- Todo lo demás: específico de cada área, opcional, sin necesidad de
  -- filtrarse/analizarse de forma transversal en esta fase (la validación
  -- estructurada por área vive en Zod, no en columnas). Ejemplos: método
  -- de fabricación, pruebas mecánicas, referencia técnica de código,
  -- estructura de patrocinios/eventos/recaudación de Marketing.
  details jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- blocked_reason/blocked_needs son condicionales a status='blocked'
  -- (Fase 4, §4): este CHECK impide que queden datos de bloqueo
  -- "colgados" si alguien cambia status sin limpiarlos.
  check (
    status = 'blocked' or (blocked_reason is null and blocked_needs is null)
  )
);

comment on table public.specialized_records is
  'Especialización opcional de una sesión, según su área responsable '
  '(Diseño/Mecánica/Programación/Marketing). No existe fila para sesiones '
  'con area = team ni area IS NULL — ver el trigger '
  'specialized_records_require_technical_area.';

create trigger specialized_records_set_updated_at
  before update on public.specialized_records
  for each row
  execute function public.set_updated_at();

-- Defensa en profundidad (Fase 4, §11: "no confiar únicamente en
-- validaciones del cliente"): nunca debe poder existir un registro
-- especializado para una sesión sin área técnica, sin importar si la
-- petición viene del wizard, de la edición, o de una llamada directa a la
-- API. No valida work_type contra el vocabulario de cada área a propósito
-- (ver comentario en la columna work_type). No necesita SECURITY DEFINER:
-- solo lee sessions, y cualquier miembro activo ya puede leer cualquier
-- sesión bajo la RLS existente (sessions_select_members).
create or replace function public.require_technical_area_for_specialized_record()
returns trigger
language plpgsql
as $$
declare
  v_area public.session_area;
begin
  select area into v_area from public.sessions where id = new.session_id;

  if v_area is null or v_area = 'team' then
    raise exception
      'Solo sesiones con área técnica (Diseño, Mecánica, Programación o Marketing) pueden tener un registro especializado.';
  end if;

  return new;
end;
$$;

create trigger specialized_records_require_technical_area
  before insert or update on public.specialized_records
  for each row
  execute function public.require_technical_area_for_specialized_record();

-- Refuerza a nivel de base de datos la decisión aprobada de Fase 4 (§3):
-- si el área de una sesión cambia, la información especializada anterior
-- se descarta, nunca se intenta transformar de un área a otra. Esto
-- convierte la advertencia de la UI en una garantía real: aunque la
-- aplicación tuviera un error y cambiara area sin borrar antes el
-- registro especializado, la base de datos nunca queda en un estado
-- inconsistente. No necesita SECURITY DEFINER: quien puede editar
-- sessions.area (dueño de la sesión o admin, por RLS) es exactamente
-- quien también puede borrar su specialized_records bajo la RLS de esa
-- tabla (misma condición de dueño-o-admin).
create or replace function public.discard_specialized_record_on_area_change()
returns trigger
language plpgsql
as $$
begin
  if new.area is distinct from old.area then
    delete from public.specialized_records where session_id = old.id;
  end if;
  return new;
end;
$$;

create trigger sessions_discard_specialized_record_on_area_change
  before update on public.sessions
  for each row
  execute function public.discard_specialized_record_on_area_change();

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table public.specialized_records enable row level security;

-- Mismo patrón que session_categories/session_participants: la sesión
-- dueña define quién puede escribir. Cualquier miembro activo lee todo
-- (misma transparencia interna que el resto de la app).
create policy "specialized_records_select_members" on public.specialized_records
  for select using (public.is_active_member());

create policy "specialized_records_write_owner_or_admin" on public.specialized_records
  for all
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and (s.created_by = public.current_team_member_id() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = session_id
        and (s.created_by = public.current_team_member_id() or public.is_admin())
    )
  );

-- Sin backfill: todas las sesiones existentes quedan con area = NULL,
-- start_time = NULL, end_time = NULL automáticamente (columnas nuevas
-- nullable), exactamente el mismo comportamiento que tienen hoy.
