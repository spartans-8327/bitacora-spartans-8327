import type { SupabaseClient } from "@supabase/supabase-js";
import { specializationAreaSchema } from "@/lib/validation/specialized-record";

// Las 4 áreas técnicas vienen de specialized-record.ts (fuente única de
// verdad, Fase 4) — aquí solo se agrega 'team', que nunca tiene
// specialized_record (es transversal, no una quinta área técnica).
export const TECHNICAL_SESSION_AREAS = specializationAreaSchema.options;
export const SESSION_AREAS = [...TECHNICAL_SESSION_AREAS, "team"] as const;
export type SessionArea = (typeof SESSION_AREAS)[number];

export const SESSION_AREA_LABELS: Record<SessionArea, string> = {
  design: "Diseño",
  mechanical: "Mecánica",
  programming: "Programación",
  marketing: "Marketing",
  team: "Equipo",
};

export type SessionSummary = {
  id: string;
  session_date: string;
  objective: string;
  had_problem: boolean;
};

const SESSION_SUMMARY_COLUMNS = "id, session_date, objective, had_problem";

// ── Fase 5: listado de /sesiones con filtro real por área ───────────────

export type SessionListItem = {
  id: string;
  session_date: string;
  objective: string;
  had_problem: boolean;
  area: SessionArea | null;
  session_participants: { team_members: { full_name: string; nickname: string | null } }[];
  // PostgREST puede devolver una relación "a lo mucho una" (hay un
  // unique(session_id) en specialized_records) como objeto único o como
  // arreglo de 0/1 según la versión — se maneja de forma defensiva donde
  // se lee, no se asume una forma fija aquí.
  specialized_records: { work_type: string }[] | { work_type: string } | null;
  // Solo relevante cuando area = 'team': la actividad general de Equipo
  // sigue viviendo en session_categories (Fase 4, regla 4) — no tiene
  // specialized_record.
  session_categories: { categories: { label: string } }[];
  projects: { id: string; name: string } | null;
  project_iterations: { id: string; sequence: number; name: string | null } | null;
  evidence: { count: number }[] | null;
};

const SESSION_LIST_COLUMNS = `
  id, session_date, objective, had_problem, area,
  session_participants(team_members(full_name, nickname)),
  specialized_records(work_type),
  session_categories(categories(label)),
  projects(id, name),
  project_iterations(id, sequence, name),
  evidence(count)
`;

/**
 * Extrae el primer elemento sin importar si PostgREST devolvió un objeto
 * único o un arreglo para una relación "a lo mucho una" — evita asumir
 * una forma específica que no se puede verificar sin una base real.
 */
export function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Sesiones para /sesiones, con filtro real en Supabase (no en memoria)
 * cuando se pasa un área válida — ver Fase 5, Parte D.
 */
export async function getSessionsList(
  supabase: SupabaseClient,
  filters?: { area?: SessionArea }
) {
  let query = supabase
    .from("sessions")
    .select(SESSION_LIST_COLUMNS)
    .order("session_date", { ascending: false });

  if (filters?.area) {
    query = query.eq("area", filters.area);
  }

  const { data, error } = await query.returns<SessionListItem[]>();
  if (error) throw error;
  return data ?? [];
}

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
