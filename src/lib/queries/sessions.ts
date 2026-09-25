import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionSummary = {
  id: string;
  session_date: string;
  objective: string;
  had_problem: boolean;
};

const SESSION_SUMMARY_COLUMNS = "id, session_date, objective, had_problem";

/**
 * Sesiones "directas" de un proyecto: project_id = projectId y
 * iteration_id NULL. No incluye sesiones que ya pertenecen a alguna
 * iteración del proyecto (esas se listan con getSessionsByIteration).
 */
export async function getDirectSessionsByProject(
  supabase: SupabaseClient,
  projectId: string
) {
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_SUMMARY_COLUMNS)
    .eq("project_id", projectId)
    .is("iteration_id", null)
    .order("session_date", { ascending: false })
    .returns<SessionSummary[]>();

  if (error) throw error;
  return data ?? [];
}

/**
 * Exige iteration_id Y project_id en el mismo WHERE — mismo patrón de
 * seguridad que getIterationById: nunca se listan sesiones de una
 * iteración confiando solo en su id.
 */
export async function getSessionsByIteration(
  supabase: SupabaseClient,
  iterationId: string,
  projectId: string
) {
  const { data, error } = await supabase
    .from("sessions")
    .select(SESSION_SUMMARY_COLUMNS)
    .eq("iteration_id", iterationId)
    .eq("project_id", projectId)
    .order("session_date", { ascending: false })
    .returns<SessionSummary[]>();

  if (error) throw error;
  return data ?? [];
}
