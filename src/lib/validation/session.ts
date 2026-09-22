import { z } from "zod";

export const sessionWizardSchema = z
  .object({
    sessionDate: z.string().min(1, "Elige una fecha."),
    participantIds: z
      .array(z.string().uuid())
      .min(1, "Selecciona al menos un participante."),
    areaIds: z.array(z.string().uuid()).min(1, "Selecciona al menos un área."),
    activityTypeId: z.string().uuid("Elige el tipo de actividad."),
    objective: z
      .string()
      .trim()
      .min(3, "Cuéntanos qué querían conseguir hoy."),
    whatHappened: z.string().trim().min(3, "Cuéntanos qué ocurrió."),
    hadProblem: z.boolean(),
    problemDescription: z.string().trim().optional(),
    decision: z.string().trim().optional(),
    learning: z.string().trim().optional(),
    nextStep: z.string().trim().optional(),
  })
  .refine(
    (values) =>
      !values.hadProblem ||
      (values.problemDescription?.length ?? 0) >= 3,
    {
      message: "Describe brevemente el problema que encontraron.",
      path: ["problemDescription"],
    }
  );

export type SessionWizardValues = z.infer<typeof sessionWizardSchema>;

export const evidenceLinkSchema = z.object({
  url: z.string().url("Pega un enlace válido (https://...)."),
  title: z.string().trim().optional(),
});
