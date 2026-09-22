import type { SupabaseClient } from "@supabase/supabase-js";

export type Category = {
  id: string;
  kind: "area" | "activity_type";
  label: string;
  sort_order: number;
};

export async function getActiveCategories(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, kind, label, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  const categories = (data ?? []) as Category[];
  return {
    areas: categories.filter((c) => c.kind === "area"),
    activityTypes: categories.filter((c) => c.kind === "activity_type"),
  };
}
