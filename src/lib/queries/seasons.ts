import type { SupabaseClient } from "@supabase/supabase-js";

export type Season = {
  id: string;
  name: string;
  game_name: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
};

export async function getActiveSeason(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("seasons")
    .select("id, name, game_name, start_date, end_date, is_active")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data as Season | null;
}
