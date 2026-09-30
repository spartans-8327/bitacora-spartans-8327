import { z } from "zod";

export const specializationAreaSchema = z.enum([
  "design",
  "mechanical",
  "programming",
  "marketing",
]);

export const specializationStatusSchema = z.enum([
  "in_progress",
  "completed",
  "blocked",
]);

export const specializedRecordBaseSchema = z
  .object({
    area: specializationAreaSchema,

    workType: z
      .string()
      .trim()
      .min(1, "Selecciona el tipo de trabajo."),

    subject: z
      .string()
      .trim()
      .min(3, "Indica sobre qué trabajaron."),

    status: specializationStatusSchema,

    blockedReason: z.string().trim().optional(),

    blockedNeeds: z.string().trim().optional(),

    details: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((values, ctx) => {
    if (values.status === "blocked") {
      if (!values.blockedReason) {
        ctx.addIssue({
          code: "custom",
          message: "Indica por qué quedó bloqueado.",
          path: ["blockedReason"],
        });
      }

      if (!values.blockedNeeds) {
        ctx.addIssue({
          code: "custom",
          message: "Indica qué necesitan para continuar.",
          path: ["blockedNeeds"],
        });
      }
    }

    if (values.status !== "blocked") {
      if (values.blockedReason) {
        ctx.addIssue({
          code: "custom",
          message:
            "El motivo de bloqueo solo aplica cuando el estado es bloqueado.",
          path: ["blockedReason"],
        });
      }

      if (values.blockedNeeds) {
        ctx.addIssue({
          code: "custom",
          message:
            "Lo que necesitan para continuar solo aplica cuando el estado es bloqueado.",
          path: ["blockedNeeds"],
        });
      }
    }
  });

export type SpecializationArea = z.infer<
  typeof specializationAreaSchema
>;

export type SpecializationStatus = z.infer<
  typeof specializationStatusSchema
>;

export type SpecializedRecordBase = z.infer<
  typeof specializedRecordBaseSchema
>;
export const designWorkTypes = [
  "Diseño CAD",
  "Modelado 3D",
  "Impresión 3D",
  "Prototipado",
  "Diseño gráfico / visual",
  "Documentación técnica",
  "Modificación / reparación",
  "Otro",
] as const;

export const mechanicalWorkTypes = [
  "Construcción / fabricación",
  "Ensamble",
  "Modificación",
  "Reparación",
  "Mantenimiento",
  "Ajuste",
  "Prototipado",
  "Otro",
] as const;

export const programmingWorkTypes = [
  "Desarrollo de código",
  "Corrección de error",
  "Control del robot",
  "Sensores",
  "Automatización",
  "Pruebas",
  "Integración",
  "Optimización",
  "Documentación técnica",
  "Otro",
] as const;

export const marketingWorkTypes = [
  "Redes sociales / contenido",
  "Diseño de material promocional",
  "Difusión / comunicación",
  "Patrocinios",
  "Recaudación de fondos",
  "Organización de evento",
  "Relaciones externas",
  "Fotografía / video",
  "Documentación / presentación",
  "Otro",
] as const;
export const designDetailsSchema = z.object({
  deliverable: z.string().trim().optional(),

  designDecision: z.string().trim().optional(),

  reason: z.string().trim().optional(),

  alternativesConsidered: z.string().trim().optional(),

  validation: z
    .object({
      type: z
        .enum([
          "functional",
          "fit_compatibility",
          "dimensional",
          "comparative",
          "prototype",
          "other",
        ])
        .optional(),

      result: z
        .enum(["successful", "partial", "failed"])
        .optional(),

      observations: z.string().trim().optional(),

      metricValue: z.string().trim().optional(),

      metricUnit: z.string().trim().optional(),
    })
    .optional(),
});

export const mechanicalDetailsSchema = z.object({
  element: z.string().trim().optional(),

  materialsComponents: z.string().trim().optional(),

  fabrication: z
    .object({
      method: z
        .enum([
          "3d_print",
          "cut",
          "drill",
          "cnc",
          "laser",
          "manual",
          "other",
        ])
        .optional(),

      result: z.string().trim().optional(),
    })
    .optional(),

  adjustments: z.string().trim().optional(),

  mechanicalTest: z
    .object({
      type: z
        .enum([
          "movement",
          "resistance",
          "fit",
          "compatibility",
          "load",
          "repeatability",
          "function",
          "comparative",
          "other",
        ])
        .optional(),

      result: z
        .enum(["successful", "partial", "failed"])
        .optional(),

      observations: z.string().trim().optional(),

      metricValue: z.string().trim().optional(),

      metricUnit: z.string().trim().optional(),
    })
    .optional(),

  safetyRisks: z
    .object({
      description: z.string().trim().optional(),

      mitigation: z.string().trim().optional(),
    })
    .optional(),
});

export const programmingDetailsSchema = z.object({
  systemComponent: z.string().trim().optional(),

  technicalReference: z
    .object({
      file: z.string().trim().optional(),

      functionModule: z.string().trim().optional(),

      commit: z.string().trim().optional(),

      branch: z.string().trim().optional(),

      pullRequest: z.string().trim().optional(),
    })
    .optional(),

  problemType: z
    .enum([
      "compile",
      "runtime",
      "unexpected_behavior",
      "sensor",
      "communication",
      "movement",
      "logic",
      "performance",
      "integration",
      "other",
    ])
    .optional(),

  test: z
    .object({
      type: z.string().trim().optional(),

      result: z
        .enum(["successful", "partial", "failed"])
        .optional(),

      observations: z.string().trim().optional(),

      metricValue: z.string().trim().optional(),

      metricUnit: z.string().trim().optional(),
    })
    .optional(),

  sensors: z
    .object({
      type: z.string().trim().optional(),

      action: z.string().trim().optional(),

      result: z.string().trim().optional(),
    })
    .optional(),

  controlMovement: z
    .object({
      system: z.string().trim().optional(),

      evaluated: z.string().trim().optional(),

      result: z.string().trim().optional(),
    })
    .optional(),
});

export const marketingDetailsSchema = z.object({
  communicationObjective: z.string().trim().optional(),

  audience: z.string().trim().optional(),

  channel: z.string().trim().optional(),

  contentLink: z.string().url().optional().or(z.literal("")),

  reachMetrics: z
    .object({
      reach: z.number().nonnegative().optional(),

      views: z.number().nonnegative().optional(),

      interactions: z.number().nonnegative().optional(),

      followers: z.number().nonnegative().optional(),

      clicks: z.number().nonnegative().optional(),

      visits: z.number().nonnegative().optional(),

      attendees: z.number().nonnegative().optional(),

      otherValue: z.number().nonnegative().optional(),

      otherLabel: z.string().trim().optional(),
    })
    .optional(),

  sponsorship: z
    .object({
      managementType: z.string().trim().optional(),

      organization: z.string().trim().optional(),

      status: z.string().trim().optional(),

      result: z.string().trim().optional(),

      nextAction: z.string().trim().optional(),
    })
    .optional(),

  fundraising: z
    .object({
      type: z
        .enum([
          "sale",
          "event",
          "stand",
          "campaign",
          "donation",
          "other",
        ])
        .optional(),

      whatWasDone: z.string().trim().optional(),

      result: z.string().trim().optional(),

      evidence: z.string().trim().optional(),
    })
    .optional(),

  event: z
    .object({
      type: z.string().trim().optional(),

      attendees: z.number().nonnegative().optional(),

      result: z.string().trim().optional(),

      evidence: z.string().trim().optional(),
    })
    .optional(),

  externalRelation: z
    .object({
      contactType: z.string().trim().optional(),

      purpose: z.string().trim().optional(),

      result: z.string().trim().optional(),
    })
    .optional(),
});
export const designSpecializedRecordSchema =
  specializedRecordBaseSchema.safeExtend({
    area: z.literal("design"),
    workType: z.enum(designWorkTypes),
    details: designDetailsSchema,
  });

export const mechanicalSpecializedRecordSchema =
  specializedRecordBaseSchema.safeExtend({
    area: z.literal("mechanical"),
    workType: z.enum(mechanicalWorkTypes),
    details: mechanicalDetailsSchema,
  });

export const programmingSpecializedRecordSchema =
  specializedRecordBaseSchema.safeExtend({
    area: z.literal("programming"),
    workType: z.enum(programmingWorkTypes),
    details: programmingDetailsSchema,
  });

export const marketingSpecializedRecordSchema =
  specializedRecordBaseSchema.safeExtend({
    area: z.literal("marketing"),
    workType: z.enum(marketingWorkTypes),
    details: marketingDetailsSchema,
  });

export const specializedRecordSchema = z.discriminatedUnion("area", [
  designSpecializedRecordSchema,
  mechanicalSpecializedRecordSchema,
  programmingSpecializedRecordSchema,
  marketingSpecializedRecordSchema,
]);

export type DesignSpecializedRecord = z.infer<
  typeof designSpecializedRecordSchema
>;

export type MechanicalSpecializedRecord = z.infer<
  typeof mechanicalSpecializedRecordSchema
>;

export type ProgrammingSpecializedRecord = z.infer<
  typeof programmingSpecializedRecordSchema
>;

export type MarketingSpecializedRecord = z.infer<
  typeof marketingSpecializedRecordSchema
>;

export type SpecializedRecord = z.infer<
  typeof specializedRecordSchema
>;