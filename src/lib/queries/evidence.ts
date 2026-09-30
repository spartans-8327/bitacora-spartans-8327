import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateEvidenceFile,
  type EvidenceFileKind,
} from "@/lib/validation/evidence-file";

// Fase 5: módulo único para leer/subir/eliminar evidencia. Antes esta
// lógica vivía duplicada e inline en session-wizard.tsx (subida) y en
// sesiones/[id]/page.tsx (lectura con signed URLs) — se centraliza aquí
// para que el editor (y cualquier otro consumidor futuro) la reutilice
// sin reimplementarla.

export type EvidenceKind =
  | "photo"
  | "video"
  | "file"
  | "link"
  | "document"
  | "code_commit"
  | "other";

export type EvidenceRecord = {
  id: string;
  kind: EvidenceKind;
  storage_path: string | null;
  external_url: string | null;
  title: string | null;
  uploaded_by: string;
  created_at: string;
};

export type EvidenceWithUrl = EvidenceRecord & { href: string | null };

const EVIDENCE_COLUMNS =
  "id, kind, storage_path, external_url, title, uploaded_by, created_at";

/**
 * URL firmada temporal (1 hora) para un archivo del bucket privado
 * "evidence". El bucket no es público — nunca se expone una URL
 * permanente.
 */
export async function createEvidenceSignedUrl(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  const { data } = await supabase.storage
    .from("evidence")
    .createSignedUrl(storagePath, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function getEvidenceForSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<EvidenceWithUrl[]> {
  const { data, error } = await supabase
    .from("evidence")
    .select(EVIDENCE_COLUMNS)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .returns<EvidenceRecord[]>();

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (item) => ({
      ...item,
      href: item.storage_path
        ? await createEvidenceSignedUrl(supabase, item.storage_path)
        : item.external_url,
    }))
  );
}

/**
 * Sube un archivo al bucket "evidence" y crea su fila. Misma convención
 * de ruta y mismo límite/validación que ya usa session-wizard.tsx — no
 * se inventa un esquema nuevo.
 */
export async function uploadEvidenceFile(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    seasonId: string;
    uploadedBy: string;
    kind: EvidenceFileKind;
    file: File;
    title: string;
  }
): Promise<EvidenceRecord> {
  const validation = validateEvidenceFile(params.file, params.kind);
  if (!validation.ok) throw new Error(validation.message);

  const path = `${params.seasonId}/session/${params.sessionId}/${crypto.randomUUID()}-${params.file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("evidence")
    .upload(path, params.file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("evidence")
    .insert({
      kind: params.kind,
      storage_path: path,
      title: params.title,
      session_id: params.sessionId,
      uploaded_by: params.uploadedBy,
    })
    .select(EVIDENCE_COLUMNS)
    .single();
  if (error) throw error;
  return data as EvidenceRecord;
}

export async function insertEvidenceLink(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    uploadedBy: string;
    url: string;
    title: string;
  }
): Promise<EvidenceRecord> {
  const { data, error } = await supabase
    .from("evidence")
    .insert({
      kind: "link",
      external_url: params.url,
      title: params.title,
      session_id: params.sessionId,
      uploaded_by: params.uploadedBy,
    })
    .select(EVIDENCE_COLUMNS)
    .single();
  if (error) throw error;
  return data as EvidenceRecord;
}

/**
 * Orden obligatorio (Fase 5, Parte A3): primero el objeto físico en
 * Storage, después la fila en Postgres. Si el borrado de Storage falla,
 * se lanza el error ANTES de tocar la fila — nunca queda una fila
 * borrada con un archivo huérfano, y el fallo nunca se oculta.
 */
export async function deleteEvidence(
  supabase: SupabaseClient,
  evidence: { id: string; storage_path: string | null }
): Promise<void> {
  if (evidence.storage_path) {
    const { data: removedFiles, error: storageError } = await supabase.storage
      .from("evidence")
      .remove([evidence.storage_path]);
    if (storageError) {
      throw new Error(
        `No se pudo eliminar el archivo de Storage: ${storageError.message}`
      );
    }
    // Storage puede "responder éxito" sin haber borrado nada si una
    // política de RLS lo bloqueó (mismo patrón silencioso que ya
    // conocemos de Postgres) — `data` lista los archivos realmente
    // eliminados, así que una lista vacía se trata como fallo explícito
    // en vez de asumir que el archivo desapareció.
    if (!removedFiles || removedFiles.length === 0) {
      throw new Error(
        "No se pudo eliminar el archivo de Storage: no tienes permiso o ya no existe."
      );
    }
  }

  // Mismo patrón que el resto de la app: RLS bloquea un DELETE afectando
  // 0 filas sin lanzar error, así que se pide `.select("id")` para
  // distinguir un borrado real de un bloqueo silencioso de permisos.
  const { data: deletedRows, error } = await supabase
    .from("evidence")
    .delete()
    .eq("id", evidence.id)
    .select("id");
  if (error) throw error;
  if (!deletedRows || deletedRows.length === 0) {
    throw new Error(
      "No se pudo eliminar el registro: ya no tienes permiso o ya no existe."
    );
  }
}
