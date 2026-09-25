import { z } from "zod";
import { PROJECT_TYPES, PROJECT_STATUSES } from "@/lib/queries/projects";
import { ITERATION_STATUSES } from "@/lib/queries/project-iterations";

// Compara fechas ISO (YYYY-MM-DD, el formato que entrega <input type="date">)
// como texto: el orden lexicográfico coincide con el cronológico para ese
// formato. Se reutiliza para los dos pares fecha-inicio/fecha-fin de abajo
// en vez de repetir la misma expresión dos veces.
function isOnOrAfter(laterDate: string | undefined, earlierDate: string) {
  return !laterDate || laterDate >= earlierDate;
}

export const projectSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio."),
    description: z.string().trim().optional(),
    objective: z.string().trim().min(3, "Cuéntanos el objetivo del proyecto."),
    project_type: z.enum(PROJECT_TYPES),
    status: z.enum(PROJECT_STATUSES),
    start_date: z.string().min(1, "La fecha de inicio es obligatoria."),
    end_date: z.string().optional(),
    final_result: z.string().trim().optional(),
  })
  .refine((values) => isOnOrAfter(values.end_date, values.start_date), {
    message: "La fecha de fin no puede ser anterior a la fecha de inicio.",
    path: ["end_date"],
  });

export type ProjectFormValues = z.infer<typeof projectSchema>;

export const iterationSchema = z
  .object({
    name: z.string().trim().optional(),
    objective: z.string().trim().min(3, "Cuéntanos el objetivo de esta iteración."),
    hypothesis: z.string().trim().optional(),
    change_made: z.string().trim().optional(),
    test_method: z.string().trim().optional(),
    result: z.string().trim().optional(),
    decision: z.string().trim().optional(),
    learning: z.string().trim().optional(),
    next_step: z.string().trim().optional(),
    status: z.enum(ITERATION_STATUSES),
    started_at: z.string().min(1, "La fecha de inicio es obligatoria."),
    completed_at: z.string().optional(),
  })
  .refine((values) => isOnOrAfter(values.completed_at, values.started_at), {
    message: "La fecha de finalización no puede ser anterior a la de inicio.",
    path: ["completed_at"],
  });

export type IterationFormValues = z.infer<typeof iterationSchema>;
