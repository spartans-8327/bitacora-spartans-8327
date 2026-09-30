import type { SupabaseClient } from "@supabase/supabase-js";

import type { SpecializedRecord } from "@/lib/validation/specialized-record";

type SpecializedRecordRow = {
  id: string;
  session_id: string;
  work_type: string;
  subject: string;
  status: "in_progress" | "completed" | "blocked";
  blocked_reason: string | null;
  blocked_needs: string | null;
  details: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type SpecializedRecordInsert = {
  session_id: string;
  work_type: string;
  subject: string;
  status: "in_progress" | "completed" | "blocked";
  blocked_reason: string | null;
  blocked_needs: string | null;
  details: Record<string, unknown>;
};

type SpecializedRecordUpdate = Omit<
  SpecializedRecordInsert,
  "session_id"
>;

type Supabase = SupabaseClient;

export async function getSpecializedRecord(
  supabase: Supabase,
  sessionId: string
): Promise<SpecializedRecordRow | null> {
  const { data, error } = await supabase
    .from("specialized_records")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo obtener el registro especializado: ${error.message}`
    );
  }

  return data as SpecializedRecordRow | null;
}

export async function createSpecializedRecord(
  supabase: Supabase,
  sessionId: string,
  record: SpecializedRecord
): Promise<SpecializedRecordRow> {
  const payload: SpecializedRecordInsert = {
    session_id: sessionId,
    work_type: record.workType,
    subject: record.subject,
    status: record.status,
    blocked_reason: record.blockedReason ?? null,
    blocked_needs: record.blockedNeeds ?? null,
    details: record.details,
  };

  const { data, error } = await supabase
    .from("specialized_records")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `No se pudo crear el registro especializado: ${error.message}`
    );
  }

  return data as SpecializedRecordRow;
}

export async function updateSpecializedRecord(
  supabase: Supabase,
  sessionId: string,
  record: SpecializedRecord
): Promise<SpecializedRecordRow> {
  const payload: SpecializedRecordUpdate = {
    work_type: record.workType,
    subject: record.subject,
    status: record.status,
    blocked_reason: record.blockedReason ?? null,
    blocked_needs: record.blockedNeeds ?? null,
    details: record.details,
  };

  const { data, error } = await supabase
    .from("specialized_records")
    .update(payload)
    .eq("session_id", sessionId)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `No se pudo actualizar el registro especializado: ${error.message}`
    );
  }

  return data as SpecializedRecordRow;
}

export async function deleteSpecializedRecord(
  supabase: Supabase,
  sessionId: string
): Promise<void> {
  const { error } = await supabase
    .from("specialized_records")
    .delete()
    .eq("session_id", sessionId);

  if (error) {
    throw new Error(
      `No se pudo eliminar el registro especializado: ${error.message}`
    );
  }
}