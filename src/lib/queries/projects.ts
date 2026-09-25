import type { SupabaseClient } from "@supabase/supabase-js";

export const PROJECT_TYPES = [
  "engineering",
  "software",
  "research",
  "outreach",
  "education",
  "competition",
  "organization",
  "other",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_STATUSES = [
  "planned",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// Etiquetas en español para mostrar en la UI. El enum de Postgres se
// queda en inglés (ver 0004_projects_and_iterations.sql) — no se toca.
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  engineering: "Ingeniería",
  software: "Software",
  research: "Investigación",
  outreach: "Outreach",
  education: "Educación",
  competition: "Competencia",
  organization: "Organización",
  other: "Otro",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planeado",
  in_progress: "En progreso",
  paused: "Pausado",
  completed: "Completado",
  cancelled: "Cancelado",
};

export type Project = {
  id: string;
  season_id: string | null;
  name: string;
  description: string | null;
  objective: string;
  project_type: ProjectType;
  status: ProjectStatus;
  start_date: string;
  end_date: string | null;
  final_result: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ProjectMember = {
  team_member_id: string;
  full_name: string;
  nickname: string | null;
};

const PROJECT_COLUMNS =
  "id, season_id, name, description, objective, project_type, status, start_date, end_date, final_result, created_by, created_at, updated_at";

/**
 * Proyectos visibles para el usuario actual (RLS ya filtra a miembros
 * activos; no se aplica ningún filtro adicional aquí). Ordenados por
 * última actividad.
 */
export async function getVisibleProjects(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .order("updated_at", { ascending: false })
    .returns<Project[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getProjectById(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", projectId)
    .maybeSingle<Project>();

  if (error) throw error;
  return data;
}

type ProjectMemberRow = {
  team_member_id: string;
  team_members: { full_name: string; nickname: string | null } | null;
};

export async function getProjectMembers(
  supabase: SupabaseClient,
  projectId: string
): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from("project_members")
    .select("team_member_id, team_members(full_name, nickname)")
    .eq("project_id", projectId)
    .returns<ProjectMemberRow[]>();

  if (error) throw error;

  return (data ?? [])
    .filter((row) => row.team_members !== null)
    .map((row) => ({
      team_member_id: row.team_member_id,
      full_name: row.team_members!.full_name,
      nickname: row.team_members!.nickname,
    }));
}
