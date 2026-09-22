-- Bitácora SPARTANS 8327 — Fase 2: registro rápido de sesiones (Nivel 1)
-- Tablas: sessions, session_participants, session_categories, evidence
-- + bucket de Storage "evidence" (privado) y sus políticas.
-- Requiere haber aplicado 0001_core_schema.sql antes.

-- ── Función de apoyo: id de team_member del usuario autenticado ────────

create or replace function public.current_team_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.team_members
  where auth_user_id = auth.uid() and active
  limit 1;
$$;

-- ── sessions (registro rápido / "daily entry") ──────────────────────────

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id),
  created_by uuid not null references public.team_members (id),
  -- Fecha de la sesión documentada (editable si se registra algo pasado).
  session_date date not null default current_date,
  -- Momento real de captura del registro (nunca se sobreescribe).
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  objective text not null,
  what_happened text not null,
  had_problem boolean not null default false,
  problem_description text,
  decision text,
  learning text,
  next_step text
);

comment on table public.sessions is
  'Registro rápido de sesión (Nivel 1, §4 del plan). session_date es la '
  'fecha documentada; created_at es la fecha/hora real de captura.';

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row
  execute function public.set_updated_at();

-- ── session_participants (miembros presentes) ───────────────────────────

create table public.session_participants (
  session_id uuid not null references public.sessions (id) on delete cascade,
  team_member_id uuid not null references public.team_members (id),
  primary key (session_id, team_member_id)
);

-- ── session_categories (áreas trabajadas + tipo de actividad) ──────────

create table public.session_categories (
  session_id uuid not null references public.sessions (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  primary key (session_id, category_id)
);

-- ── evidence ─────────────────────────────────────────────────────────

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in ('photo', 'video', 'file', 'link', 'document', 'code_commit', 'other')
  ),
  -- Exactamente una de las dos: archivo en Supabase Storage o URL externa.
  storage_path text,
  external_url text,
  title text,
  description text,
  uploaded_by uuid not null references public.team_members (id),
  created_at timestamptz not null default now(),
  -- Vínculos a la entidad que documenta. Por ahora solo "session"; se
  -- agregarán project_id/iteration_id/record_id en migraciones futuras
  -- (Fase 3/4) junto con un CHECK ampliado.
  session_id uuid references public.sessions (id) on delete cascade,
  constraint evidence_one_storage_ref check (
    (storage_path is not null)::int + (external_url is not null)::int = 1
  ),
  constraint evidence_one_entity_ref check (session_id is not null)
);

comment on table public.evidence is
  'Evidencia (foto/video/archivo/enlace/...). Los binarios grandes viven en '
  'Supabase Storage (bucket "evidence"), nunca en esta tabla.';

-- ── RLS ──────────────────────────────────────────────────────────────

alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_categories enable row level security;
alter table public.evidence enable row level security;

-- sessions: cualquier miembro activo lee todo (transparencia interna);
-- crear/editar/borrar solo quien la creó, o un admin.
create policy "sessions_select_members" on public.sessions
  for select using (public.is_active_member());

create policy "sessions_insert_members" on public.sessions
  for insert with check (
    public.is_active_member()
    and created_by = public.current_team_member_id()
  );

create policy "sessions_update_owner_or_admin" on public.sessions
  for update
  using (created_by = public.current_team_member_id() or public.is_admin())
  with check (created_by = public.current_team_member_id() or public.is_admin());

create policy "sessions_delete_owner_or_admin" on public.sessions
  for delete
  using (created_by = public.current_team_member_id() or public.is_admin());

-- session_participants / session_categories: siguen el mismo dueño que la
-- sesión a la que pertenecen.
create policy "session_participants_select_members" on public.session_participants
  for select using (public.is_active_member());

create policy "session_participants_write_owner_or_admin" on public.session_participants
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

create policy "session_categories_select_members" on public.session_categories
  for select using (public.is_active_member());

create policy "session_categories_write_owner_or_admin" on public.session_categories
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

-- evidence: cualquier miembro activo lee y puede agregar evidencia (aunque
-- no haya creado la sesión: alguien más pudo tomar la foto); solo quien la
-- subió o un admin puede editarla/borrarla.
create policy "evidence_select_members" on public.evidence
  for select using (public.is_active_member());

create policy "evidence_insert_members" on public.evidence
  for insert with check (
    public.is_active_member()
    and uploaded_by = public.current_team_member_id()
  );

create policy "evidence_update_owner_or_admin" on public.evidence
  for update
  using (uploaded_by = public.current_team_member_id() or public.is_admin())
  with check (uploaded_by = public.current_team_member_id() or public.is_admin());

create policy "evidence_delete_owner_or_admin" on public.evidence
  for delete
  using (uploaded_by = public.current_team_member_id() or public.is_admin());

-- ── Storage: bucket privado de evidencia ────────────────────────────────

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

create policy "evidence_bucket_select_members" on storage.objects
  for select using (bucket_id = 'evidence' and public.is_active_member());

create policy "evidence_bucket_insert_members" on storage.objects
  for insert with check (bucket_id = 'evidence' and public.is_active_member());

create policy "evidence_bucket_delete_owner_or_admin" on storage.objects
  for delete using (
    bucket_id = 'evidence' and (owner = auth.uid() or public.is_admin())
  );
