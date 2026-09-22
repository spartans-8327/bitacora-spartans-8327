export type EvidenceDraft = {
  clientId: string;
  kind: "photo" | "video" | "file" | "link";
  file?: File;
  url?: string;
  title: string;
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
});
