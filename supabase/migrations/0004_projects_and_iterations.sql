-- Bitácora SPARTANS 8327 — Fase 3, Bloque A: Projects + Iterations
-- Tablas: projects, project_members, project_iterations
-- Columnas nuevas en sessions: project_id, iteration_id
-- Requiere haber aplicado 0001, 0002 y 0003 antes.
-- NO modifica la tabla evidence (la evidencia sigue perteneciendo
-- únicamente a sessions, sin cambios).

-- ── Tipos ────────────────────────────────────────────────────────────────

-- Valores en inglés/neutrales, igual que team_role y category_kind: la
-- etiqueta en español ("Ingeniería", "Investigación", ...) se resuelve en
-- la capa de aplicación, no se guarda texto en español dentro del enum.
create type public.project_type as enum (
  'engineering',
  'software',
  'research',
  'outreach',
  'education',
  'competition',
  'organization',
  'other'
);

create type public.project_status as enum (
  'planned',
  'in_progress',
  'paused',
  'completed',
  'cancelled'
);

-- Sin valor "planned"/"planificada" en esta fase: crear una iteración ya
-- implica que se está intentando algo, no que se está solo planeando.
-- "abandoned" (no "failed") porque un intento que no funcionó sigue
-- siendo información valiosa, no un registro inútil.
create type public.iteration_status as enum (
  'in_progress',
  'completed',
  'abandoned'
);

-- ── projects ─────────────────────────────────────────────────────────────

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  -- Nullable a propósito: un proyecto puede ser transversal a temporadas
  -- (p. ej. la propia Bitácora Digital). No se valida contra la temporada
  -- de sus sesiones — cada sesión conserva su propia season_id real.
  season_id uuid references public.seasons (id),
  name text not null,
  -- Campo único (no se separa de "context"): "¿Qué es este proyecto y
  -- por qué existe?" — la ayuda visual correspondiente se agrega en la UI
  -- (Bloque B), no aquí.
  description text,
  objective text not null,
  project_type public.project_type not null,
  status public.project_status not null default 'planned',
  start_date date not null default current_date,
  end_date date,
  -- Opcional. Resumen de cierre; sin lógica de Portfolio todavía.
  final_result text,
  created_by uuid not null references public.team_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

comment on table public.projects is
  'Proyectos con evolución durante la temporada (ingeniería, software, '
  'outreach, etc.). season_id es opcional: un proyecto puede cruzar '
  'temporadas aunque cada sesión conserve la suya.';

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

-- Hace que projects.created_by sea inmutable después de la creación, sin
-- excepción (ni siquiera un admin puede cambiarlo desde la app). Esto
-- cierra el hueco donde un project_member podría, dentro del mismo
-- UPDATE que sí tiene permitido hacer, intentar reescribir created_by a
-- sí mismo y apropiarse del proyecto — el WITH CHECK de la política de
-- UPDATE evalúa la fila NUEVA, así que por sí solo no bastaba para
-- impedirlo.
create or replace function public.prevent_project_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'No se puede modificar el creador de un proyecto.';
  end if;
  return new;
end;
$$;

create trigger projects_prevent_owner_change
  before update on public.projects
  for each row
  execute function public.prevent_project_owner_change();

-- ── project_members (roster del proyecto, independiente de asistencia) ──

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  team_member_id uuid not null references public.team_members (id),
  primary key (project_id, team_member_id)
);

comment on table public.project_members is
  'Quién está asignado al proyecto. NO se deriva de session_participants: '
  'representan hechos distintos (asignación al proyecto vs. asistencia a '
  'una sesión puntual). La PK compuesta impide duplicados.';

-- ── project_iterations ───────────────────────────────────────────────────

create table public.project_iterations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  -- Calculado por la aplicación (MAX(sequence)+1 del proyecto), no por la
  -- base de datos. El UNIQUE de abajo previene números duplicados por una
  -- condición de carrera entre dos personas creando iteraciones a la vez.
  sequence integer not null,
  name text,
  objective text not null,
  hypothesis text,
  change_made text,
  test_method text,
  result text,
  decision text,
  learning text,
  next_step text,
  status public.iteration_status not null default 'in_progress',
  started_at date not null default current_date,
  completed_at date,
  created_by uuid not null references public.team_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, sequence),
  -- Soporta la FK compuesta de sessions (ver más abajo): garantiza que el
  -- par (id, project_id) sea localizable de forma única.
  unique (id, project_id),
  check (sequence > 0),
  check (completed_at is null or completed_at >= started_at)
);

comment on table public.project_iterations is
  'Iteraciones dentro de un proyecto (diseño→construcción→pruebas→... o '
  'idea→prototipo→pruebas→presentación, etc.). Siempre pertenecen a un '
  'proyecto. status usa "abandoned", no "failed": un intento que no '
  'funcionó sigue siendo información valiosa, no se trata como inútil.';

create trigger project_iterations_set_updated_at
  before update on public.project_iterations
  for each row
  execute function public.set_updated_at();

-- Si se elimina una iteración, las sesiones que la referenciaban NO se
-- eliminan ni pierden su proyecto: solo se limpia iteration_id, project_id
-- se conserva intacto. Este trigger corre ANTES de que Postgres evalúe la
-- FK compuesta de sessions, así que para cuando esa FK se revisa ya no
-- queda ninguna sesión apuntando a la iteración borrada.
--
-- SECURITY DEFINER es necesario: sin esto, la actualización interna de
-- `sessions` quedaría sujeta a la RLS de sessions con los permisos de
-- quien borra la iteración, y fallaría silenciosamente en sesiones creadas
-- por OTROS miembros del equipo bajo la misma iteración.
create or replace function public.detach_sessions_from_deleted_iteration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
  set iteration_id = null
  where iteration_id = old.id;
  return old;
end;
$$;

-- Endurecimiento: al ser SECURITY DEFINER, esta función corre con
-- privilegios elevados. Se revoca su ejecución directa vía SQL para que
-- SOLO el propio trigger pueda invocarla — nadie puede llamarla a mano
-- para forzar una limpieza arbitraria de sessions. La invocación desde un
-- trigger no pasa por el chequeo de privilegio EXECUTE de un rol, así que
-- el trigger sigue funcionando exactamente igual después de esto.
revoke execute on function public.detach_sessions_from_deleted_iteration() from public;
revoke execute on function public.detach_sessions_from_deleted_iteration() from authenticated;

create trigger project_iterations_detach_sessions
  before delete on public.project_iterations
  for each row
  execute function public.detach_sessions_from_deleted_iteration();

-- ── sessions: vínculo opcional a proyecto/iteración ─────────────────────

alter table public.sessions
  add column project_id uuid references public.projects (id),
  add column iteration_id uuid;

-- Regla 1: si iteration_id existe, project_id también debe existir.
alter table public.sessions
  add constraint sessions_iteration_requires_project
  check (iteration_id is null or project_id is not null);

-- Regla 2: si iteration_id existe, su proyecto real (project_iterations.
-- project_id) debe coincidir exactamente con sessions.project_id. Postgres
-- usa MATCH SIMPLE en FKs compuestas: si iteration_id es NULL, esta FK no
-- se evalúa (sesión directa a un proyecto, o sesión sin proyecto). La
-- Regla 1 de arriba cubre el hueco que MATCH SIMPLE deja (iteration_id
-- presente pero project_id nulo).
alter table public.sessions
  add constraint sessions_iteration_matches_project
  foreign key (iteration_id, project_id)
  references public.project_iterations (id, project_id);

-- Sin backfill necesario: todas las sesiones existentes quedan con
-- project_id = NULL e iteration_id = NULL automáticamente (columnas
-- nuevas nullable), exactamente el mismo comportamiento que tienen hoy.

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_iterations enable row level security;

-- projects: cualquier miembro activo ve todo (misma transparencia interna
-- que sessions/evidence). Crear: cualquier miembro activo, como sí mismo.
-- Editar: el creador, cualquier project_member actual, o un admin — más
-- permisivo que el patrón "solo dueño" del resto de la app porque un
-- proyecto es trabajo compartido, no un registro personal (created_by en
-- sí queda protegido de todas formas por el trigger de inmutabilidad de
-- arriba, no por esta política). Eliminar: solo admin, y sin botón en la
-- UI de esta fase (la protección real contra borrados con dependencias la
-- da el FK RESTRICT por defecto en project_iterations.project_id y
-- sessions.project_id, no esta política).
create policy "projects_select_members" on public.projects
  for select using (public.is_active_member());

create policy "projects_insert_members" on public.projects
  for insert with check (
    public.is_active_member()
    and created_by = public.current_team_member_id()
  );

create policy "projects_update_creator_member_or_admin" on public.projects
  for update
  using (
    created_by = public.current_team_member_id()
    or public.is_admin()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id
        and pm.team_member_id = public.current_team_member_id()
    )
  )
  with check (
    created_by = public.current_team_member_id()
    or public.is_admin()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id
        and pm.team_member_id = public.current_team_member_id()
    )
  );

create policy "projects_delete_admin" on public.projects
  for delete using (public.is_admin());

-- project_members: lectura abierta a miembros activos (transparencia).
-- Agregar/quitar integrantes: SOLO el creador del proyecto o un admin —
-- un project_member normal no puede modificar la lista de integrantes,
-- tal como se definió explícitamente.
create policy "project_members_select_members" on public.project_members
  for select using (public.is_active_member());

create policy "project_members_write_creator_or_admin" on public.project_members
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.created_by = public.current_team_member_id() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.created_by = public.current_team_member_id() or public.is_admin())
    )
  );

-- project_iterations: mismo patrón que sessions — cualquier miembro activo
-- puede crear una iteración en cualquier proyecto (sin exigir ser
-- project_member, igual de abierto que crear una sesión hoy); solo quien
-- la creó o un admin puede editarla/eliminarla.
create policy "project_iterations_select_members" on public.project_iterations
  for select using (public.is_active_member());

create policy "project_iterations_insert_members" on public.project_iterations
  for insert with check (
    public.is_active_member()
    and created_by = public.current_team_member_id()
  );

create policy "project_iterations_update_owner_or_admin" on public.project_iterations
  for update
  using (created_by = public.current_team_member_id() or public.is_admin())
  with check (created_by = public.current_team_member_id() or public.is_admin());

create policy "project_iterations_delete_owner_or_admin" on public.project_iterations
  for delete
  using (created_by = public.current_team_member_id() or public.is_admin());
