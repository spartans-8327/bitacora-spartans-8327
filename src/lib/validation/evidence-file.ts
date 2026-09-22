export const MAX_EVIDENCE_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export type EvidenceFileKind = "photo" | "video" | "file";

export function validateEvidenceFile(
  file: File,
  kind: EvidenceFileKind
): { ok: true } | { ok: false; message: string } {
  if (file.size > MAX_EVIDENCE_FILE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      message: `"${file.name}" pesa ${sizeMb} MB. El límite es 50 MB por archivo.`,
    };
  }

  if (kind === "photo" && !file.type.startsWith("image/")) {
    return {
      ok: false,
      message: `"${file.name}" no es una imagen válida.`,
    };
  }

  if (kind === "video" && !file.type.startsWith("video/")) {
    return {
      ok: false,
      message: `"${file.name}" no es un video válido.`,
    };
  }

  return { ok: true };
}
