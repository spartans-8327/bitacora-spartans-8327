import type { SessionArea } from "@/lib/queries/sessions";
import type { SpecializationStatus } from "@/lib/validation/specialized-record";

export type EvidenceUploadStatus = "pending" | "uploading" | "done" | "error";

export type EvidenceDraft = {
  clientId: string;
  kind: "photo" | "video" | "file" | "link";
  file?: File;
  url?: string;
  title: string;
  status: EvidenceUploadStatus;
  errorMessage?: string;
  /** Solo para fotos: URL de objeto local para mostrar una miniatura. */
  previewUrl?: string;
};

// ── Fase 4: estado compartido por creación Y edición de sesiones ───────
//
// SessionWizardState es el único modelo de estado para sesiones: área
// única en sessions.area + registro especializado opcional. El modelo
// legacy (WizardState: área multi-selección vía categories +
// session_categories) se retiró junto con sessionWizardSchema — las
// sesiones existentes eran solo datos de prueba, sin información real de
// temporada que preservar bajo el modelo antiguo.

export type SpecializationDraft = {
  workType: string;
  subject: string;
  status: SpecializationStatus | null;
  blockedReason: string;
  blockedNeeds: string;
};

export const emptySpecializationDraft = (): SpecializationDraft => ({
  workType: "",
  subject: "",
  status: null,
  blockedReason: "",
  blockedNeeds: "",
});

export type SessionWizardState = {
  sessionDate: string;
  participantIds: string[];
  area: SessionArea | null;
  // "HH:MM" o "" (vacío) — nunca se guarda una duración, se calcula al
  // mostrarla a partir de estos dos valores.
  startTime: string;
  endTime: string;
  // Solo relevante cuando area === "team" (Fase 4, §4). Para las áreas
  // técnicas esta clasificación general se sustituye por el tipo de
  // trabajo dentro de `specialization`.
  activityTypeId: string | null;
  projectId: string | null;
  iterationId: string | null;
  objective: string;
  whatHappened: string;
  hadProblem: boolean | null;
  problemDescription: string;
  decision: string;
  learning: string;
  nextStep: string;
  evidence: EvidenceDraft[];
  // Solo relevante cuando area es una de las 4 áreas técnicas.
  specialization: SpecializationDraft;
};

export const emptySessionWizardState = (): SessionWizardState => ({
  sessionDate: new Date().toISOString().slice(0, 10),
  participantIds: [],
  area: null,
  startTime: "",
  endTime: "",
  activityTypeId: null,
  projectId: null,
  iterationId: null,
  objective: "",
  whatHappened: "",
  hadProblem: null,
  problemDescription: "",
  decision: "",
  learning: "",
  nextStep: "",
  evidence: [],
  specialization: emptySpecializationDraft(),
});
