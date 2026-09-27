-- ============================================================
-- SPARTANS 8327 — Fase 4, Bloque A
-- VERIFICADOR FUNCIONAL
-- ============================================================
--
-- Este verificador:
-- 1. Comprueba la estructura.
-- 2. Ejecuta pruebas funcionales.
-- 3. Registra cada PASS/FAIL.
-- 4. Muestra una tabla final en Results.
-- 5. Limpia todos los datos DEMO creados.
--
-- NO modifica categories, session_categories ni evidence.
-- ============================================================


drop table if exists pg_temp.fase4_bloquea_verification_results;

create temporary table fase4_bloquea_verification_results (
  orden integer,
  prueba text,
  resultado text,
  detalle text
);


do $$
declare
  v_failure_count integer := 0;

  v_session_design uuid;
  v_session_team uuid;
  v_session_no_area uuid;
  v_session_marketing uuid;
  v_record uuid;
  v_record_marketing uuid;

  v_member_1 uuid;
  v_season uuid;

  v_count integer;
  v_exists boolean;
  v_rls_enabled boolean;
  v_operation_succeeded boolean;
  v_error_detail text;

  v_test integer := 0;

begin

  -- ==========================================================
  -- DATOS BASE
  -- ==========================================================

  select id
  into v_season
  from public.seasons
  where is_active = true
  order by start_date desc
  limit 1;

  select id
  into v_member_1
  from public.team_members
  where active = true
  order by id
  limit 1;


  if v_season is null then
    raise exception 'No existe una temporada activa.';
  end if;

  if v_member_1 is null then
    raise exception 'Se necesita al menos un miembro activo.';
  end if;


  -- ==========================================================
  -- A — ESTRUCTURA
  -- ==========================================================

  -- A1
  v_test := v_test + 1;

  select count(*)
  into v_count
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  where t.typname = 'session_area';

  if v_count = 5 then
    insert into fase4_bloquea_verification_results
    values (v_test, 'A1 — enum session_area (5 valores)', 'PASS', 'Existen los 5 valores.');
  else
    insert into fase4_bloquea_verification_results
    values (v_test, 'A1 — enum session_area (5 valores)', 'FAIL', 'Se encontraron ' || v_count || ' de 5.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A2
  v_test := v_test + 1;

  select count(*)
  into v_count
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  where t.typname = 'specialization_status';

  if v_count = 3 then
    insert into fase4_bloquea_verification_results
    values (v_test, 'A2 — enum specialization_status (3 valores)', 'PASS', 'Existen los 3 valores.');
  else
    insert into fase4_bloquea_verification_results
    values (v_test, 'A2 — enum specialization_status (3 valores)', 'FAIL', 'Se encontraron ' || v_count || ' de 3.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A3
  v_test := v_test + 1;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'sessions'
    and column_name in ('area', 'start_time', 'end_time');

  if v_count = 3 then
    insert into fase4_bloquea_verification_results
    values (v_test, 'A3 — columnas sessions', 'PASS', 'area, start_time y end_time existen.');
  else
    insert into fase4_bloquea_verification_results
    values (v_test, 'A3 — columnas sessions', 'FAIL', 'Faltan columnas.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A4
  v_test := v_test + 1;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'specialized_records'
  )
  into v_exists;

  if v_exists then
    insert into fase4_bloquea_verification_results
    values (v_test, 'A4 — specialized_records existe', 'PASS', 'La tabla existe.');
  else
    insert into fase4_bloquea_verification_results
    values (v_test, 'A4 — specialized_records existe', 'FAIL', 'La tabla no existe.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A5
  v_test := v_test + 1;

  select exists (
    select 1
    from pg_constraint
    where conrelid = 'public.specialized_records'::regclass
      and contype = 'u'
  )
  into v_exists;

  if v_exists then
    insert into fase4_bloquea_verification_results
    values (v_test, 'A5 — unique(session_id)', 'PASS', 'Existe una constraint UNIQUE.');
  else
    insert into fase4_bloquea_verification_results
    values (v_test, 'A5 — unique(session_id)', 'FAIL', 'No existe constraint UNIQUE.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A6
  v_test := v_test + 1;

  select relrowsecurity
  into v_rls_enabled
  from pg_class
  where oid = 'public.specialized_records'::regclass;

  if v_rls_enabled then
    insert into fase4_bloquea_verification_results
    values (v_test, 'A6 — RLS specialized_records', 'PASS', 'RLS está habilitado.');
  else
    insert into fase4_bloquea_verification_results
    values (v_test, 'A6 — RLS specialized_records', 'FAIL', 'RLS no está habilitado.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A7
  v_test := v_test + 1;

  select exists (
    select 1
    from pg_constraint
    where conname = 'sessions_end_time_after_start'
      and conrelid = 'public.sessions'::regclass
  )
  into v_exists;

  if v_exists then
    insert into fase4_bloquea_verification_results
    values (v_test, 'A7 — CHECK horario sessions', 'PASS', 'La constraint existe.');
  else
    insert into fase4_bloquea_verification_results
    values (v_test, 'A7 — CHECK horario sessions', 'FAIL', 'No existe la constraint.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A8
  v_test := v_test + 1;

  select count(*)
  into v_count
  from pg_constraint
  where conrelid = 'public.specialized_records'::regclass
    and contype = 'c';

  if v_count >= 1 then
    insert into fase4_bloquea_verification_results
    values (v_test, 'A8 — CHECK bloqueo condicional', 'PASS', 'Existe al menos un CHECK.');
  else
    insert into fase4_bloquea_verification_results
    values (v_test, 'A8 — CHECK bloqueo condicional', 'FAIL', 'No existe ningún CHECK.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A9
  v_test := v_test + 1;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'evidence'
    and column_name in ('area', 'work_type', 'specialized_record_id');

  if v_count = 0 then
    insert into fase4_bloquea_verification_results
    values (v_test, 'A9 — evidence sin columnas nuevas', 'PASS', 'Evidence no fue modificada.');
  else
    insert into fase4_bloquea_verification_results
    values (v_test, 'A9 — evidence sin columnas nuevas', 'FAIL', 'Evidence tiene columnas nuevas.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- ==========================================================
  -- B — SESIÓN CON ÁREA TÉCNICA + REGISTRO ESPECIALIZADO
  -- ==========================================================

  begin

    insert into public.sessions (
      season_id, created_by, session_date, objective, what_happened,
      had_problem, area
    )
    values (
      v_season, v_member_1, current_date,
      'DEMO Fase4 BloqueA sesión diseño.', 'Sesión temporal.', false,
      'design'
    )
    returning id into v_session_design;

    insert into public.specialized_records (
      session_id, work_type, subject, status, details
    )
    values (
      v_session_design, 'cad', 'DEMO chasis', 'in_progress', '{"note": "demo"}'::jsonb
    )
    returning id into v_record;

    v_test := v_test + 1;

    insert into fase4_bloquea_verification_results
    values (v_test, 'B1 — crear registro especializado válido', 'PASS', 'Se creó correctamente.');

  exception
    when others then

      v_test := v_test + 1;

      insert into fase4_bloquea_verification_results
      values (v_test, 'B1 — crear registro especializado válido', 'FAIL', sqlerrm);

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- C — IMPEDIR REGISTRO PARA ÁREA 'team'
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    insert into public.sessions (
      season_id, created_by, session_date, objective, what_happened,
      had_problem, area
    )
    values (
      v_season, v_member_1, current_date,
      'DEMO Fase4 BloqueA sesión equipo.', 'Sesión temporal.', false,
      'team'
    )
    returning id into v_session_team;

    insert into public.specialized_records (session_id, work_type, subject)
    values (v_session_team, 'other', 'DEMO no debería crearse');

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase4_bloquea_verification_results
    values (v_test, 'C1 — impedir registro con area=team', 'FAIL', 'La operación fue permitida.');

    v_failure_count := v_failure_count + 1;

  else

    insert into fase4_bloquea_verification_results
    values (v_test, 'C1 — impedir registro con area=team', 'PASS', 'El trigger rechazó la operación. ' || v_error_detail);

  end if;


  -- ==========================================================
  -- D — IMPEDIR REGISTRO PARA ÁREA NULL
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    insert into public.sessions (
      season_id, created_by, session_date, objective, what_happened, had_problem
    )
    values (
      v_season, v_member_1, current_date,
      'DEMO Fase4 BloqueA sesión sin área.', 'Sesión temporal.', false
    )
    returning id into v_session_no_area;

    insert into public.specialized_records (session_id, work_type, subject)
    values (v_session_no_area, 'other', 'DEMO no debería crearse');

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase4_bloquea_verification_results
    values (v_test, 'D1 — impedir registro con area NULL', 'FAIL', 'La operación fue permitida.');

    v_failure_count := v_failure_count + 1;

  else

    insert into fase4_bloquea_verification_results
    values (v_test, 'D1 — impedir registro con area NULL', 'PASS', 'El trigger rechazó la operación. ' || v_error_detail);

  end if;


  -- ==========================================================
  -- E — IMPEDIR SEGUNDO REGISTRO PARA LA MISMA SESIÓN
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    insert into public.specialized_records (session_id, work_type, subject)
    values (v_session_design, '3d_modeling', 'DEMO segundo registro');

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase4_bloquea_verification_results
    values (v_test, 'E1 — impedir segundo registro por sesión', 'FAIL', 'La operación fue permitida.');

    v_failure_count := v_failure_count + 1;

  else

    insert into fase4_bloquea_verification_results
    values (v_test, 'E1 — impedir segundo registro por sesión', 'PASS', 'UNIQUE rechazó la operación. ' || v_error_detail);

  end if;


  -- ==========================================================
  -- F — BLOQUEADO SIN MOTIVO/NECESIDAD DEBE FALLAR
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    update public.specialized_records
    set status = 'blocked'
    where id = v_record;

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase4_bloquea_verification_results
    values (v_test, 'F1 — blocked sin motivo/necesidad', 'FAIL', 'Se permitió sin blocked_reason/blocked_needs.');

    v_failure_count := v_failure_count + 1;

  else

    insert into fase4_bloquea_verification_results
    values (v_test, 'F1 — blocked sin motivo/necesidad', 'PASS', 'El CHECK rechazó la operación. ' || v_error_detail);

  end if;


  -- ==========================================================
  -- F2 — BLOQUEADO CON MOTIVO Y NECESIDAD DEBE PASAR
  -- ==========================================================

  begin

    update public.specialized_records
    set status = 'blocked',
        blocked_reason = 'DEMO falta material',
        blocked_needs = 'DEMO pedir material'
    where id = v_record;

    v_test := v_test + 1;

    insert into fase4_bloquea_verification_results
    values (v_test, 'F2 — blocked con motivo y necesidad', 'PASS', 'Se actualizó correctamente.');

  exception
    when others then

      v_test := v_test + 1;

      insert into fase4_bloquea_verification_results
      values (v_test, 'F2 — blocked con motivo y necesidad', 'FAIL', sqlerrm);

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- G — VOLVER A in_progress DEBE LIMPIAR EL BLOQUEO
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    update public.specialized_records
    set status = 'in_progress'
    where id = v_record;
    -- blocked_reason/blocked_needs siguen con valor DEMO: el CHECK debe
    -- rechazar esto porque ya no es 'blocked'.

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase4_bloquea_verification_results
    values (v_test, 'G1 — impedir motivo/necesidad fuera de blocked', 'FAIL', 'Se permitió sin limpiar blocked_reason/blocked_needs.');

    v_failure_count := v_failure_count + 1;

  else

    insert into fase4_bloquea_verification_results
    values (v_test, 'G1 — impedir motivo/necesidad fuera de blocked', 'PASS', 'El CHECK rechazó la operación. ' || v_error_detail);

  end if;


  -- Deja el registro en un estado limpio para las siguientes pruebas.
  update public.specialized_records
  set status = 'in_progress', blocked_reason = null, blocked_needs = null
  where id = v_record;


  -- ==========================================================
  -- H — HORARIO: end_time ANTES DE start_time DEBE FALLAR
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    update public.sessions
    set start_time = '10:00', end_time = '09:00'
    where id = v_session_design;

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase4_bloquea_verification_results
    values (v_test, 'H1 — impedir end_time antes de start_time', 'FAIL', 'Se permitió la operación.');

    v_failure_count := v_failure_count + 1;

  else

    insert into fase4_bloquea_verification_results
    values (v_test, 'H1 — impedir end_time antes de start_time', 'PASS', 'El CHECK rechazó la operación. ' || v_error_detail);

  end if;


  -- ==========================================================
  -- H2 — HORARIO VÁLIDO DEBE PASAR
  -- ==========================================================

  begin

    update public.sessions
    set start_time = '09:00', end_time = '10:30'
    where id = v_session_design;

    v_test := v_test + 1;

    insert into fase4_bloquea_verification_results
    values (v_test, 'H2 — permitir horario válido', 'PASS', 'Se actualizó correctamente.');

  exception
    when others then

      v_test := v_test + 1;

      insert into fase4_bloquea_verification_results
      values (v_test, 'H2 — permitir horario válido', 'FAIL', sqlerrm);

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- I — CAMBIAR ÁREA DESCARTA EL REGISTRO ESPECIALIZADO
  -- ==========================================================

  begin

    update public.sessions
    set area = 'mechanical'
    where id = v_session_design;

    select count(*)
    into v_count
    from public.specialized_records
    where session_id = v_session_design;

    v_test := v_test + 1;

    if v_count = 0 then

      insert into fase4_bloquea_verification_results
      values (v_test, 'I1 — cambiar área descarta registro anterior', 'PASS', 'El registro especializado fue eliminado automáticamente.');

    else

      insert into fase4_bloquea_verification_results
      values (v_test, 'I1 — cambiar área descarta registro anterior', 'FAIL', 'El registro anterior seguía existiendo.');

      v_failure_count := v_failure_count + 1;

    end if;

  exception
    when others then

      v_test := v_test + 1;

      insert into fase4_bloquea_verification_results
      values (v_test, 'I1 — cambiar área descarta registro anterior', 'FAIL', sqlerrm);

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- J — ELIMINAR SESIÓN ELIMINA SU REGISTRO ESPECIALIZADO
  -- ==========================================================

  begin

    insert into public.specialized_records (session_id, work_type, subject)
    values (v_session_design, 'assembly', 'DEMO para cascada');

    delete from public.sessions where id = v_session_design;

    select count(*)
    into v_count
    from public.specialized_records
    where session_id = v_session_design;

    v_test := v_test + 1;

    if v_count = 0 then

      insert into fase4_bloquea_verification_results
      values (v_test, 'J1 — eliminar sesión elimina registro (cascade)', 'PASS', 'El registro fue eliminado en cascada.');

    else

      insert into fase4_bloquea_verification_results
      values (v_test, 'J1 — eliminar sesión elimina registro (cascade)', 'FAIL', 'El registro sobrevivió a la sesión.');

      v_failure_count := v_failure_count + 1;

    end if;

  exception
    when others then

      v_test := v_test + 1;

      insert into fase4_bloquea_verification_results
      values (v_test, 'J1 — eliminar sesión elimina registro (cascade)', 'FAIL', sqlerrm);

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- K — MARKETING: CREAR REGISTRO ESPECIALIZADO (in_progress)
  -- ==========================================================
  --
  -- Marketing debe comportarse exactamente igual que Diseño/Mecánica/
  -- Programación en cuanto a status/blocked_reason/blocked_needs — no es
  -- un caso especial ni una columna que deba dejar en NULL.

  begin

    insert into public.sessions (
      season_id, created_by, session_date, objective, what_happened,
      had_problem, area
    )
    values (
      v_season, v_member_1, current_date,
      'DEMO Fase4 BloqueA sesión marketing.', 'Sesión temporal.', false,
      'marketing'
    )
    returning id into v_session_marketing;

    insert into public.specialized_records (
      session_id, work_type, subject, status, details
    )
    values (
      v_session_marketing, 'sponsorships', 'DEMO patrocinio con proveedor local',
      'in_progress', '{"sponsorship": {"organization": "DEMO"}}'::jsonb
    )
    returning id into v_record_marketing;

    v_test := v_test + 1;

    insert into fase4_bloquea_verification_results
    values (v_test, 'K1 — Marketing: crear registro (in_progress)', 'PASS', 'Se creó correctamente.');

  exception
    when others then

      v_test := v_test + 1;

      insert into fase4_bloquea_verification_results
      values (v_test, 'K1 — Marketing: crear registro (in_progress)', 'FAIL', sqlerrm);

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- L — MARKETING: CAMBIAR A completed
  -- ==========================================================

  begin

    update public.specialized_records
    set status = 'completed'
    where id = v_record_marketing;

    v_test := v_test + 1;

    insert into fase4_bloquea_verification_results
    values (v_test, 'L1 — Marketing: status completed', 'PASS', 'Se actualizó correctamente.');

  exception
    when others then

      v_test := v_test + 1;

      insert into fase4_bloquea_verification_results
      values (v_test, 'L1 — Marketing: status completed', 'FAIL', sqlerrm);

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- M — MARKETING: blocked SIN MOTIVO/NECESIDAD DEBE FALLAR
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    update public.specialized_records
    set status = 'blocked'
    where id = v_record_marketing;

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase4_bloquea_verification_results
    values (v_test, 'M1 — Marketing: blocked sin motivo/necesidad', 'FAIL', 'Se permitió sin blocked_reason/blocked_needs.');

    v_failure_count := v_failure_count + 1;

  else

    insert into fase4_bloquea_verification_results
    values (v_test, 'M1 — Marketing: blocked sin motivo/necesidad', 'PASS', 'El CHECK rechazó la operación. ' || v_error_detail);

  end if;


  -- ==========================================================
  -- N — MARKETING: blocked CON MOTIVO Y NECESIDAD DEBE PASAR
  -- ==========================================================

  begin

    update public.specialized_records
    set status = 'blocked',
        blocked_reason = 'DEMO el proveedor no ha confirmado',
        blocked_needs = 'DEMO respuesta del proveedor'
    where id = v_record_marketing;

    v_test := v_test + 1;

    insert into fase4_bloquea_verification_results
    values (v_test, 'N1 — Marketing: blocked con motivo y necesidad', 'PASS', 'Se actualizó correctamente — Marketing usa blocked_reason/blocked_needs igual que las demás áreas.');

  exception
    when others then

      v_test := v_test + 1;

      insert into fase4_bloquea_verification_results
      values (v_test, 'N1 — Marketing: blocked con motivo y necesidad', 'FAIL', sqlerrm);

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- LIMPIEZA
  -- ==========================================================

  delete from public.specialized_records
  where session_id in (
    select id from public.sessions where objective like 'DEMO Fase4 BloqueA%'
  );

  delete from public.sessions
  where objective like 'DEMO Fase4 BloqueA%';


  -- ==========================================================
  -- CLEANUP CHECK
  -- ==========================================================

  select count(*)
  into v_count
  from public.sessions
  where objective like 'DEMO Fase4 BloqueA%';


  v_test := v_test + 1;

  if v_count = 0 then

    insert into fase4_bloquea_verification_results
    values (v_test, 'CLEANUP — datos DEMO', 'PASS', 'No quedaron sesiones DEMO.');

  else

    insert into fase4_bloquea_verification_results
    values (v_test, 'CLEANUP — datos DEMO', 'FAIL', 'Quedaron ' || v_count || ' sesiones DEMO.');

    v_failure_count := v_failure_count + 1;

  end if;


  -- ==========================================================
  -- RESUMEN
  -- ==========================================================

  insert into fase4_bloquea_verification_results
  values (
    v_test + 1,
    'RESULTADO FINAL',
    case
      when v_failure_count = 0 then 'PASS'
      else 'FAIL'
    end,
    v_failure_count || ' fallo(s).'
  );


-- No lanzar excepción aquí para poder visualizar todos los resultados.
-- La validación se revisará manualmente en SQL Editor.

end;
$$;


-- ============================================================
-- RESULTADO VISIBLE
-- ============================================================

select
  orden,
  prueba,
  resultado,
  detalle
from fase4_bloquea_verification_results
order by orden;
