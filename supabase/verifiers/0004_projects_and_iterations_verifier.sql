-- ============================================================
-- SPARTANS 8327 — Fase 3, Bloque A
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
-- NO modifica evidence.
-- ============================================================


drop table if exists pg_temp.fase3_verification_results;

create temporary table fase3_verification_results (
  orden integer,
  prueba text,
  resultado text,
  detalle text
);


do $$
declare
  v_failure_count integer := 0;

  v_project_1 uuid;
  v_project_2 uuid;
  v_iteration_1 uuid;
  v_iteration_2 uuid;
  v_session uuid;

  v_member_1 uuid;
  v_member_2 uuid;
  v_season uuid;

  v_count integer;
  v_policy_count integer;
  v_rls_enabled boolean;
  v_exists boolean;
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

  select id
  into v_member_2
  from public.team_members
  where active = true
    and id <> v_member_1
  order by id
  limit 1;


  if v_season is null then
    raise exception 'No existe una temporada activa.';
  end if;

  if v_member_1 is null or v_member_2 is null then
    raise exception 'Se necesitan al menos dos miembros activos.';
  end if;


  -- ==========================================================
  -- A — ESTRUCTURA
  -- ==========================================================

  -- A1
  v_test := v_test + 1;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'projects'
  )
  into v_exists;

  if v_exists then
    insert into fase3_verification_results
    values (v_test, 'A1 — projects existe', 'PASS', 'La tabla existe.');
  else
    insert into fase3_verification_results
    values (v_test, 'A1 — projects existe', 'FAIL', 'La tabla no existe.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A2
  v_test := v_test + 1;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'project_members'
  )
  into v_exists;

  if v_exists then
    insert into fase3_verification_results
    values (v_test, 'A2 — project_members existe', 'PASS', 'La tabla existe.');
  else
    insert into fase3_verification_results
    values (v_test, 'A2 — project_members existe', 'FAIL', 'La tabla no existe.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A3
  v_test := v_test + 1;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'project_iterations'
  )
  into v_exists;

  if v_exists then
    insert into fase3_verification_results
    values (v_test, 'A3 — project_iterations existe', 'PASS', 'La tabla existe.');
  else
    insert into fase3_verification_results
    values (v_test, 'A3 — project_iterations existe', 'FAIL', 'La tabla no existe.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A4
  v_test := v_test + 1;

  select count(*)
  into v_count
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname in (
      'project_type',
      'project_status',
      'iteration_status'
    );

  if v_count = 3 then
    insert into fase3_verification_results
    values (v_test, 'A4 — enums', 'PASS', 'Existen los 3 enums.');
  else
    insert into fase3_verification_results
    values (v_test, 'A4 — enums', 'FAIL', 'Se encontraron ' || v_count || ' de 3.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A5
  v_test := v_test + 1;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'sessions'
    and column_name in ('project_id', 'iteration_id');

  if v_count = 2 then
    insert into fase3_verification_results
    values (v_test, 'A5 — columnas sessions', 'PASS', 'project_id e iteration_id existen.');
  else
    insert into fase3_verification_results
    values (v_test, 'A5 — columnas sessions', 'FAIL', 'Faltan columnas.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A6
  v_test := v_test + 1;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'evidence'
    and column_name in ('project_id', 'iteration_id');

  if v_count = 0 then
    insert into fase3_verification_results
    values (v_test, 'A6 — evidence sin columnas nuevas', 'PASS', 'Evidence no fue modificada.');
  else
    insert into fase3_verification_results
    values (v_test, 'A6 — evidence sin columnas nuevas', 'FAIL', 'Evidence tiene columnas nuevas.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A7
  v_test := v_test + 1;

  select exists (
    select 1
    from pg_constraint
    where conname = 'sessions_iteration_matches_project'
      and conrelid = 'public.sessions'::regclass
  )
  into v_exists;

  if v_exists then
    insert into fase3_verification_results
    values (v_test, 'A7 — FK proyecto/iteración', 'PASS', 'La FK compuesta existe.');
  else
    insert into fase3_verification_results
    values (v_test, 'A7 — FK proyecto/iteración', 'FAIL', 'No existe la FK.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A8
  v_test := v_test + 1;

  select relrowsecurity
  into v_rls_enabled
  from pg_class
  where oid = 'public.projects'::regclass;

  if v_rls_enabled then
    insert into fase3_verification_results
    values (v_test, 'A8 — RLS projects', 'PASS', 'RLS está habilitado.');
  else
    insert into fase3_verification_results
    values (v_test, 'A8 — RLS projects', 'FAIL', 'RLS no está habilitado.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A9
  v_test := v_test + 1;

  select relrowsecurity
  into v_rls_enabled
  from pg_class
  where oid = 'public.project_members'::regclass;

  if v_rls_enabled then
    insert into fase3_verification_results
    values (v_test, 'A9 — RLS project_members', 'PASS', 'RLS está habilitado.');
  else
    insert into fase3_verification_results
    values (v_test, 'A9 — RLS project_members', 'FAIL', 'RLS no está habilitado.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- A10
  v_test := v_test + 1;

  select relrowsecurity
  into v_rls_enabled
  from pg_class
  where oid = 'public.project_iterations'::regclass;

  if v_rls_enabled then
    insert into fase3_verification_results
    values (v_test, 'A10 — RLS project_iterations', 'PASS', 'RLS está habilitado.');
  else
    insert into fase3_verification_results
    values (v_test, 'A10 — RLS project_iterations', 'FAIL', 'RLS no está habilitado.');
    v_failure_count := v_failure_count + 1;
  end if;


  -- ==========================================================
  -- B — CREAR PROYECTOS
  -- ==========================================================

  begin

    insert into public.projects (
      season_id,
      name,
      description,
      objective,
      project_type,
      status,
      start_date,
      created_by
    )
    values (
      v_season,
      'DEMO Fase3 BloqueA Proyecto 1',
      'Proyecto temporal.',
      'Probar relaciones de Fase 3.',
      'engineering',
      'in_progress',
      current_date,
      v_member_1
    )
    returning id into v_project_1;


    insert into public.projects (
      season_id,
      name,
      description,
      objective,
      project_type,
      status,
      start_date,
      created_by
    )
    values (
      v_season,
      'DEMO Fase3 BloqueA Proyecto 2',
      'Proyecto temporal.',
      'Probar integridad.',
      'software',
      'in_progress',
      current_date,
      v_member_1
    )
    returning id into v_project_2;


    v_test := v_test + 1;

    insert into fase3_verification_results
    values (
      v_test,
      'B1 — crear proyectos',
      'PASS',
      'Se crearon dos proyectos DEMO.'
    );

  exception
    when others then

      v_test := v_test + 1;

      insert into fase3_verification_results
      values (
        v_test,
        'B1 — crear proyectos',
        'FAIL',
        sqlerrm
      );

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- C — PROJECT MEMBERS
  -- ==========================================================

  begin

    insert into public.project_members (
      project_id,
      team_member_id
    )
    values
      (v_project_1, v_member_1),
      (v_project_2, v_member_1);


    v_test := v_test + 1;

    insert into fase3_verification_results
    values (
      v_test,
      'C1 — project_members',
      'PASS',
      'El creador fue agregado a ambos proyectos.'
    );

  exception
    when others then

      v_test := v_test + 1;

      insert into fase3_verification_results
      values (
        v_test,
        'C1 — project_members',
        'FAIL',
        sqlerrm
      );

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- D — CREAR ITERACIONES
  -- ==========================================================

  begin

    insert into public.project_iterations (
      project_id,
      sequence,
      name,
      objective,
      status,
      started_at,
      created_by
    )
    values (
      v_project_1,
      1,
      'DEMO Iteración 1',
      'Probar iteración.',
      'in_progress',
      current_date,
      v_member_1
    )
    returning id into v_iteration_1;


    insert into public.project_iterations (
      project_id,
      sequence,
      name,
      objective,
      status,
      started_at,
      created_by
    )
    values (
      v_project_2,
      1,
      'DEMO Iteración Proyecto 2',
      'Probar integridad.',
      'in_progress',
      current_date,
      v_member_1
    )
    returning id into v_iteration_2;


    v_test := v_test + 1;

    insert into fase3_verification_results
    values (
      v_test,
      'D1 — crear iteraciones',
      'PASS',
      'Se crearon iteraciones en ambos proyectos.'
    );

  exception
    when others then

      v_test := v_test + 1;

      insert into fase3_verification_results
      values (
        v_test,
        'D1 — crear iteraciones',
        'FAIL',
        sqlerrm
      );

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- E — SESIÓN VINCULADA
  -- ==========================================================

  begin

    insert into public.sessions (
      season_id,
      created_by,
      session_date,
      objective,
      what_happened,
      had_problem,
      problem_description,
      decision,
      learning,
      next_step,
      project_id,
      iteration_id
    )
    values (
      v_season,
      v_member_1,
      current_date,
      'DEMO Fase3 BloqueA sesión vinculada.',
      'Sesión temporal.',
      false,
      null,
      'Mantener vínculo.',
      'Proyecto e iteración funcionan.',
      'Continuar pruebas.',
      v_project_1,
      v_iteration_1
    )
    returning id into v_session;


    v_test := v_test + 1;

    insert into fase3_verification_results
    values (
      v_test,
      'E1 — sesión proyecto + iteración',
      'PASS',
      'La sesión fue vinculada correctamente.'
    );

  exception
    when others then

      v_test := v_test + 1;

      insert into fase3_verification_results
      values (
        v_test,
        'E1 — sesión proyecto + iteración',
        'FAIL',
        sqlerrm
      );

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- F — CROSS PROJECT
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    update public.sessions
    set project_id = v_project_1,
        iteration_id = v_iteration_2
    where id = v_session;

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase3_verification_results
    values (
      v_test,
      'F1 — impedir iteración de otro proyecto',
      'FAIL',
      'La operación fue permitida.'
    );

    v_failure_count := v_failure_count + 1;

  else

    insert into fase3_verification_results
    values (
      v_test,
      'F1 — impedir iteración de otro proyecto',
      'PASS',
      'PostgreSQL rechazó correctamente la combinación. ' || v_error_detail
    );

  end if;


  -- ==========================================================
  -- G — ELIMINAR ITERACIÓN
  -- ==========================================================

  begin

    delete from public.project_iterations
    where id = v_iteration_1;


    select count(*)
    into v_count
    from public.sessions
    where id = v_session
      and project_id = v_project_1
      and iteration_id is null;


    v_test := v_test + 1;

    if v_count = 1 then

      insert into fase3_verification_results
      values (
        v_test,
        'G1 — eliminar iteración conserva sesión',
        'PASS',
        'La sesión sobrevivió y conservó project_id.'
      );

    else

      insert into fase3_verification_results
      values (
        v_test,
        'G1 — eliminar iteración conserva sesión',
        'FAIL',
        'La sesión no quedó como se esperaba.'
      );

      v_failure_count := v_failure_count + 1;

    end if;

  exception
    when others then

      v_test := v_test + 1;

      insert into fase3_verification_results
      values (
        v_test,
        'G1 — eliminar iteración conserva sesión',
        'FAIL',
        sqlerrm
      );

      v_failure_count := v_failure_count + 1;

  end;


  -- ==========================================================
  -- H0 — PREPARAR DEPENDENCIA
  -- ==========================================================

  begin

    insert into public.project_iterations (
      project_id,
      sequence,
      name,
      objective,
      status,
      started_at,
      created_by
    )
    values (
      v_project_1,
      2,
      'DEMO Iteración dependencia',
      'Probar dependencia.',
      'in_progress',
      current_date,
      v_member_1
    )
    returning id into v_iteration_1;


    update public.sessions
    set iteration_id = v_iteration_1
    where id = v_session;

  exception
    when others then
      null;
  end;


  -- ==========================================================
  -- H — NO BORRAR PROYECTO CON DEPENDENCIAS
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    delete from public.projects
    where id = v_project_1;

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase3_verification_results
    values (
      v_test,
      'H1 — proteger proyecto con dependencias',
      'FAIL',
      'Se permitió eliminar el proyecto.'
    );

    v_failure_count := v_failure_count + 1;

  else

    insert into fase3_verification_results
    values (
      v_test,
      'H1 — proteger proyecto con dependencias',
      'PASS',
      'PostgreSQL rechazó el borrado. ' || v_error_detail
    );

  end if;


  -- ==========================================================
  -- I — PROTEGER created_by
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    update public.projects
    set created_by = v_member_2
    where id = v_project_1;

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase3_verification_results
    values (
      v_test,
      'I1 — proteger created_by',
      'FAIL',
      'Se permitió modificar el creador.'
    );

    v_failure_count := v_failure_count + 1;

  else

    insert into fase3_verification_results
    values (
      v_test,
      'I1 — proteger created_by',
      'PASS',
      'El trigger rechazó el cambio. ' || v_error_detail
    );

  end if;


  -- ==========================================================
  -- J1 — SEQUENCE
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    insert into public.project_iterations (
      project_id,
      sequence,
      objective,
      status,
      started_at,
      created_by
    )
    values (
      v_project_1,
      0,
      'DEMO invalid sequence',
      'in_progress',
      current_date,
      v_member_1
    );

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase3_verification_results
    values (
      v_test,
      'J1 — sequence > 0',
      'FAIL',
      'Se permitió sequence = 0.'
    );

    v_failure_count := v_failure_count + 1;

  else

    insert into fase3_verification_results
    values (
      v_test,
      'J1 — sequence > 0',
      'PASS',
      'El CHECK rechazó sequence = 0. ' || v_error_detail
    );

  end if;


  -- ==========================================================
  -- J2 — FECHAS PROJECT
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    insert into public.projects (
      season_id,
      name,
      description,
      objective,
      project_type,
      status,
      start_date,
      end_date,
      created_by
    )
    values (
      v_season,
      'DEMO invalid dates',
      'Temporal.',
      'Debe fallar.',
      'other',
      'planned',
      current_date,
      current_date - 1,
      v_member_1
    );

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase3_verification_results
    values (
      v_test,
      'J2 — fechas de proyecto',
      'FAIL',
      'Se permitió end_date < start_date.'
    );

    v_failure_count := v_failure_count + 1;

  else

    insert into fase3_verification_results
    values (
      v_test,
      'J2 — fechas de proyecto',
      'PASS',
      'El CHECK rechazó las fechas inválidas. ' || v_error_detail
    );

  end if;


  -- ==========================================================
  -- J3 — FECHAS ITERACIÓN
  -- ==========================================================

  v_operation_succeeded := false;
  v_error_detail := null;

  begin

    insert into public.project_iterations (
      project_id,
      sequence,
      objective,
      status,
      started_at,
      completed_at,
      created_by
    )
    values (
      v_project_1,
      999,
      'DEMO invalid completed date',
      'completed',
      current_date,
      current_date - 1,
      v_member_1
    );

    v_operation_succeeded := true;

  exception
    when others then
      v_error_detail := sqlerrm;
  end;


  v_test := v_test + 1;

  if v_operation_succeeded then

    insert into fase3_verification_results
    values (
      v_test,
      'J3 — fechas de iteración',
      'FAIL',
      'Se permitió completed_at < started_at.'
    );

    v_failure_count := v_failure_count + 1;

  else

    insert into fase3_verification_results
    values (
      v_test,
      'J3 — fechas de iteración',
      'PASS',
      'El CHECK rechazó las fechas inválidas. ' || v_error_detail
    );

  end if;


  -- ==========================================================
  -- LIMPIEZA
  -- ==========================================================

  delete from public.sessions
  where objective = 'DEMO Fase3 BloqueA sesión vinculada.';


  delete from public.project_iterations
  where name like 'DEMO%';


  delete from public.project_members
  where project_id in (
    select id
    from public.projects
    where name like 'DEMO Fase3 BloqueA%'
  );


  delete from public.projects
  where name like 'DEMO Fase3 BloqueA%'
     or name = 'DEMO invalid dates';


  -- ==========================================================
  -- CLEANUP CHECK
  -- ==========================================================

  select count(*)
  into v_count
  from public.projects
  where name like 'DEMO Fase3 BloqueA%'
     or name = 'DEMO invalid dates';


  v_test := v_test + 1;

  if v_count = 0 then

    insert into fase3_verification_results
    values (
      v_test,
      'CLEANUP — datos DEMO',
      'PASS',
      'No quedaron proyectos DEMO.'
    );

  else

    insert into fase3_verification_results
    values (
      v_test,
      'CLEANUP — datos DEMO',
      'FAIL',
      'Quedaron ' || v_count || ' proyectos DEMO.'
    );

    v_failure_count := v_failure_count + 1;

  end if;


  -- ==========================================================
  -- RESUMEN
  -- ==========================================================

  insert into fase3_verification_results
  values (
    v_test + 1,
    'RESULTADO FINAL',
    case
      when v_failure_count = 0 then 'PASS'
      else 'FAIL'
    end,
    v_failure_count || ' fallo(s).'
  );


  if v_failure_count > 0 then
    raise exception
      'BLOQUE A: % prueba(s) fallaron.',
      v_failure_count;
  end if;

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
from fase3_verification_results
order by orden;