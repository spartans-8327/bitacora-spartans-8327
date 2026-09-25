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

export type WizardState = {
  sessionDate: string;
  participantIds: string[];
  areaIds: string[];
  activityTypeId: string | null;
  objective: string;
  whatHappened: string;
  hadProblem: boolean | null;
  problemDescription: string;
  decision: string;
  learning: string;
  nextStep: string;
  evidence: EvidenceDraft[];
  // Contexto opcional de Proyecto/Iteración (Fase 3, Bloque 5C). En el
  // wizard de creación llegan de la URL, nunca de un selector nuevo. En
  // la edición sí pueden cambiarse desde session-edit-form.tsx.
  projectId: string | null;
  iterationId: string | null;
};

export const emptyWizardState = (): WizardState => ({
  sessionDate: new Date().toISOString().slice(0, 10),
  participantIds: [],
  areaIds: [],
  activityTypeId: null,
  objective: "",
  whatHappened: "",
  hadProblem: null,
  problemDescription: "",
  decision: "",
  learning: "",
  nextStep: "",
  evidence: [],
  projectId: null,
  iterationId: null,
});
