-- Bitácora SPARTANS 8327 — datos iniciales reales (NO son datos DEMO)
-- Ejecutar después de 0001_core_schema.sql.
-- No asigna ningún rol admin: todos quedan como 'member' hasta que el
-- administrador se defina manualmente (ver README de /supabase).

-- ── Temporada activa ────────────────────────────────────────────────────

insert into public.seasons (name, game_name, start_date, is_active)
values ('2026-2027', null, '2026-09-01', true);

-- ── Roster real (15 miembros, sin cuenta vinculada todavía) ────────────

insert into public.team_members (full_name, role, active) values
  ('Joshua', 'member', true),
  ('Fátima', 'member', true),
  ('Fabian', 'member', true),
  ('Armando', 'member', true),
  ('Iván', 'member', true),
  ('Jaziel', 'member', true),
  ('Yael', 'member', true),
  ('Yaotl', 'member', true),
  ('Donaji', 'member', true),
  ('Jair', 'member', true),
  ('Lucero', 'member', true),
  ('Melisa', 'member', true),
  ('Lucio', 'member', true),
  ('Sabine', 'member', true),
  ('Guillermo', 'member', true);

-- ── Categorías iniciales (áreas y tipos de actividad, §4) ───────────────

insert into public.categories (kind, label, sort_order) values
  ('area', 'Mecánica', 1),
  ('area', 'Programación', 2),
  ('area', 'Marketing', 3),
  ('area', 'Diseño', 4);

insert into public.categories (kind, label, sort_order) values
  ('activity_type', 'Construcción', 1),
  ('activity_type', 'Prueba', 2),
  ('activity_type', 'Programación', 3),
  ('activity_type', 'Investigación', 4),
  ('activity_type', 'Capacitación', 5),
  ('activity_type', 'Outreach', 6),
  ('activity_type', 'Competencia', 7);
