-- Bitácora SPARTANS 8327 — Fase 1: esquema base
-- Tablas: seasons, team_members, categories (+ RLS)
-- NO incluye todavía: sessions, projects, specialized_records, evidence,
-- metrics, milestones, portfolio_flags (Fase 2+).

create extension if not exists "pgcrypto";

-- ── Tipos ────────────────────────────────────────────────────────────────

create type public.team_role as enum ('member', 'admin');
create type public.category_kind as enum ('area', 'activity_type');

-- ── seasons ──────────────────────────────────────────────────────────────

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  game_name text,
  start_date date not null,
  end_date date,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.seasons is
  'Temporadas FTC del equipo. Solo una puede estar activa a la vez.';

-- Solo una temporada activa a la vez.
create unique index seasons_single_active
  on public.seasons (is_active)
  where is_active;

-- ── team_members ─────────────────────────────────────────────────────────

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  nickname text,
  role public.team_role not null default 'member',
  active boolean not null default true,
  avatar_url text,
  joined_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.team_members is
  'Roster del equipo. auth_user_id se vincula manualmente desde /admin cuando '
  'el miembro crea su cuenta — no se asigna admin automáticamente.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger team_members_set_updated_at
  before update on public.team_members
  for each row
  execute function public.set_updated_at();

-- ── categories (áreas, tipos de actividad — extensible sin migraciones) ──

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  kind public.category_kind not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kind, label)
);

comment on table public.categories is
  'Listas administrables (áreas, tipos de actividad) para no requerir '
  'migraciones cada vez que el equipo quiera agregar una opción.';

-- ── Funciones de apoyo para RLS ─────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where auth_user_id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where auth_user_id = auth.uid() and active
  );
$$;

-- Evita que un miembro se auto-promueva a admin o se auto-reactive/desactive
-- cambiando su propia fila. Solo un admin puede tocar role/active/auth_user_id.
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Solo un administrador puede cambiar el rol de un miembro.';
    end if;
    if new.active is distinct from old.active then
      raise exception 'Solo un administrador puede activar/desactivar un miembro.';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'No se puede modificar la cuenta vinculada a este miembro.';
    end if;
  end if;
  return new;
end;
$$;

create trigger team_members_prevent_privilege_escalation
  before update on public.team_members
  for each row
  execute function public.prevent_self_privilege_escalation();

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table public.seasons enable row level security;
alter table public.team_members enable row level security;
alter table public.categories enable row level security;

-- seasons: lectura pública, escritura solo admin
create policy "seasons_select_public" on public.seasons
  for select using (true);

create policy "seasons_write_admin" on public.seasons
  for all using (public.is_admin()) with check (public.is_admin());

-- categories: lectura pública, escritura solo admin
create policy "categories_select_public" on public.categories
  for select using (true);

create policy "categories_write_admin" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- team_members:
--  - público: ve miembros activos (roster público del sitio)
--  - admin: ve todos, incluidos inactivos
--  - update: cada quien su propia fila (sin poder tocar role/active/auth_user_id,
--    ver trigger arriba) o un admin cualquier fila
--  - insert/delete: solo admin
create policy "team_members_select_public" on public.team_members
  for select using (active);

create policy "team_members_select_admin_all" on public.team_members
  for select using (public.is_admin());

create policy "team_members_update_self_or_admin" on public.team_members
  for update
  using (auth_user_id = auth.uid() or public.is_admin())
  with check (auth_user_id = auth.uid() or public.is_admin());

create policy "team_members_insert_admin" on public.team_members
  for insert with check (public.is_admin());

create policy "team_members_delete_admin" on public.team_members
  for delete using (public.is_admin());
