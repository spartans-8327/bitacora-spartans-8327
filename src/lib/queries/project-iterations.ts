import type { SupabaseClient } from "@supabase/supabase-js";

export const ITERATION_STATUSES = ["in_progress", "completed", "abandoned"] as const;
export type IterationStatus = (typeof ITERATION_STATUSES)[number];

// "abandoned", no "failed": un intento que no funcionó sigue siendo
// información valiosa, no se trata como inútil (ver 0004...sql).
export const ITERATION_STATUS_LABELS: Record<IterationStatus, string> = {
  in_progress: "En progreso",
  completed: "Completada",
  abandoned: "Abandonada",
};

export type ProjectIteration = {
  id: string;
  project_id: string;
  sequence: number;
  name: string | null;
  objective: string;
  hypothesis: string | null;
  change_made: string | null;
  test_method: string | null;
  result: string | null;
  decision: string | null;
  learning: string | null;
  next_step: string | null;
  status: IterationStatus;
  started_at: string;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const ITERATION_COLUMNS =
  "id, project_id, sequence, name, objective, hypothesis, change_made, " +
  "test_method, result, decision, learning, next_step, status, started_at, " +
  "completed_at, created_by, created_at, updated_at";

export async function getIterationsByProject(
  supabase: SupabaseClient,
  projectId: string
) {
  const { data, error } = await supabase
    .from("project_iterations")
    .select(ITERATION_COLUMNS)
    .eq("project_id", projectId)
    .order("sequence", { ascending: true })
    .returns<ProjectIteration[]>();

  if (error) throw error;
  return data ?? [];
}

/**
 * Exige id Y project_id en la misma consulta (mismo WHERE, no una
 * comparación posterior en JavaScript): una iteración que pertenezca a
 * otro proyecto nunca se devuelve, sin importar qué projectId venga en la
 * URL. Esto es lo que hace imposible mostrar /proyectos/A/iteraciones/
 * <id-de-una-iteración-de-B> como si perteneciera a A.
 */
export async function getIterationById(
  supabase: SupabaseClient,
  iterationId: string,
  projectId: string
) {
  const { data, error } = await supabase
    .from("project_iterations")
    .select(ITERATION_COLUMNS)
    .eq("id", iterationId)
    .eq("project_id", projectId)
    .maybeSingle<ProjectIteration>();

  if (error) throw error;
  return data;
}

/**
 * Calculado por la aplicación (MAX(sequence)+1 del proyecto), tal como se
 * documentó en 0004_projects_and_iterations.sql — la base de datos solo
 * garantiza unicidad (project_id, sequence) como red de seguridad contra
 * una condición de carrera, no calcula el valor por sí misma.
 */
export async function getNextIterationSequence(
  supabase: SupabaseClient,
  projectId: string
) {
  const { data, error } = await supabase
    .from("project_iterations")
    .select("sequence")
    .eq("project_id", projectId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle<{ sequence: number }>();

  if (error) throw error;
  return (data?.sequence ?? 0) + 1;
}
