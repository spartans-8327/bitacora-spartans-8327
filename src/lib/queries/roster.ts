import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamMember = {
  id: string;
  full_name: string;
  nickname: string | null;
  role: "member" | "admin";
};

export async function getActiveRoster(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, full_name, nickname, role")
    .eq("active", true)
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TeamMember[];
}

export async function getCurrentTeamMember(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("team_members")
    .select("id, full_name, nickname, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as TeamMember | null;
}
