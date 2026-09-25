"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DictationTextarea } from "@/components/session-wizard/dictation-textarea";
import {
  ITERATION_STATUSES,
  ITERATION_STATUS_LABELS,
  getNextIterationSequence,
  type IterationStatus,
} from "@/lib/queries/project-iterations";
import { iterationSchema } from "@/lib/validation/project";

export type IterationFormState = {
  name: string;
  objective: string;
  hypothesis: string;
  change_made: string;
  test_method: string;
  result: string;
  decision: string;
  learning: string;
  next_step: string;
  status: IterationStatus;
  started_at: string;
  completed_at: string;
};

function emptyState(): IterationFormState {
  return {
    name: "",
    objective: "",
    hypothesis: "",
    change_made: "",
    test_method: "",
    result: "",
    decision: "",
    learning: "",
    next_step: "",
    status: "in_progress",
    started_at: new Date().toISOString().slice(0, 10),
    completed_at: "",
  };
}

// Único campo con enum en este formulario sin mensaje propio en el
// schema: se traduce aquí en vez de tocar iterationSchema.
function labelForFieldError(key: keyof IterationFormState, fallback: string) {
  if (key === "status") return "Elige un estado.";
  return fallback;
}

// Crear y editar comparten exactamente los mismos campos/layout (igual
// que ProjectForm) — un solo componente, bifurcando solo el envío.
type IterationFormProps =
  | {
      mode: "create";
      projectId: string;
      teamMemberId: string;
      nextSequenceHint: number;
    }
  | {
      mode: "edit";
      projectId: string;
      iterationId: string;
      initialValues: IterationFormState;
    };

export function IterationForm(props: IterationFormProps) {
  const router = useRouter();
  const [state, setState] = useState<IterationFormState>(
    props.mode === "edit" ? props.initialValues : emptyState()
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof IterationFormState, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof IterationFormState>(
    key: K,
    value: IterationFormState[K]
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const parsed = iterationSchema.safeParse({
      name: state.name.trim() || undefined,
      objective: state.objective,
      hypothesis: state.hypothesis.trim() || undefined,
      change_made: state.change_made.trim() || undefined,
      test_method: state.test_method.trim() || undefined,
      result: state.result.trim() || undefined,
      decision: state.decision.trim() || undefined,
      learning: state.learning.trim() || undefined,
      next_step: state.next_step.trim() || undefined,
      status: state.status,
      started_at: state.started_at,
      completed_at: state.completed_at || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof IterationFormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof IterationFormState;
        if (!fieldErrors[key]) {
          fieldErrors[key] = labelForFieldError(key, issue.message);
        }
      }
      setErrors(fieldErrors);
      toast.error("Revisa los campos marcados antes de guardar.");
      return;
    }

    setErrors({});
    setSubmitting(true);
    const supabase = createClient();

    try {
      if (props.mode === "create") {
        // Se recalcula justo antes de guardar (no se usa el número que se
        // mostró al cargar la página) para reducir la ventana de una
        // condición de carrera con otra persona registrando al mismo
        // tiempo. El UNIQUE(project_id, sequence) de la base de datos es
        // la protección final si aun así coinciden.
        const sequence = await getNextIterationSequence(
          supabase,
          props.projectId
        );

        const { data: iteration, error } = await supabase
          .from("project_iterations")
          .insert({
            project_id: props.projectId,
            sequence,
            name: parsed.data.name ?? null,
            objective: parsed.data.objective,
            hypothesis: parsed.data.hypothesis ?? null,
            change_made: parsed.data.change_made ?? null,
            test_method: parsed.data.test_method ?? null,
            result: parsed.data.result ?? null,
            decision: parsed.data.decision ?? null,
            learning: parsed.data.learning ?? null,
            next_step: parsed.data.next_step ?? null,
            status: parsed.data.status,
            started_at: parsed.data.started_at,
            completed_at: parsed.data.completed_at ?? null,
            created_by: props.teamMemberId,
          })
          .select("id")
          .single();

        if (error) {
          if (error.code === "23505") {
            throw new Error(
              "Alguien más registró una iteración al mismo tiempo. Intenta guardar de nuevo."
            );
          }
          throw error;
        }
        if (!iteration) {
          throw new Error(
            "No se pudo crear la iteración: no se recibió confirmación de Supabase."
          );
        }

        toast.success("Iteración registrada.");
        router.push(`/proyectos/${props.projectId}/iteraciones/${iteration.id}`);
        router.refresh();
        return;
      }

      // mode === "edit" — solo se actualizan los campos editables. NUNCA
      // se envían sequence, project_id, created_by ni id en el payload.
      // Igual que en proyectos/sesiones: RLS puede bloquear el UPDATE sin
      // lanzar error (solo afecta 0 filas), así que se comprueban las
      // filas devueltas. project_id se exige junto con id, por la misma
      // razón que getIterationById lo hace.
      const { data: updatedRows, error } = await supabase
        .from("project_iterations")
        .update({
          name: parsed.data.name ?? null,
          objective: parsed.data.objective,
          hypothesis: parsed.data.hypothesis ?? null,
          change_made: parsed.data.change_made ?? null,
          test_method: parsed.data.test_method ?? null,
          result: parsed.data.result ?? null,
          decision: parsed.data.decision ?? null,
          learning: parsed.data.learning ?? null,
          next_step: parsed.data.next_step ?? null,
          status: parsed.data.status,
          started_at: parsed.data.started_at,
          completed_at: parsed.data.completed_at ?? null,
        })
        .eq("id", props.iterationId)
        .eq("project_id", props.projectId)
        .select("id");

      if (error) throw error;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          "No se pudo actualizar la iteración: ya no tienes permiso o dejó de existir."
        );
      }

      toast.success("Cambios guardados.");
      router.push(
        `/proyectos/${props.projectId}/iteraciones/${props.iterationId}`
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la iteración. Intenta de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-6"
          noValidate
        >
          {props.mode === "create" && (
            <p className="font-data text-sm text-muted-foreground">
              Se registrará como Iteración {props.nextSequenceHint}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="iteration-name">Nombre</Label>
            <Input
              id="iteration-name"
              value={state.name}
              onChange={(e) => update("name", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Opcional. Por ejemplo, &quot;Cambio de llantas&quot;.
            </p>
          </div>

          <DictationTextarea
            id="iteration-objective"
            label="Objetivo"
            hint="¿Qué vamos a intentar en esta iteración?"
            value={state.objective}
            onChange={(value) => update("objective", value)}
            required
            error={errors.objective}
          />

          <DictationTextarea
            id="iteration-hypothesis"
            label="Hipótesis"
            hint="Opcional. ¿Qué esperamos que pase?"
            value={state.hypothesis}
            onChange={(value) => update("hypothesis", value)}
          />

          <DictationTextarea
            id="iteration-change-made"
            label="Cambio realizado"
            hint="Opcional."
            value={state.change_made}
            onChange={(value) => update("change_made", value)}
          />

          <DictationTextarea
            id="iteration-test-method"
            label="Método de prueba"
            hint="Opcional. ¿Cómo lo probamos?"
            value={state.test_method}
            onChange={(value) => update("test_method", value)}
          />

          <DictationTextarea
            id="iteration-result"
            label="Resultado"
            hint="Opcional."
            value={state.result}
            onChange={(value) => update("result", value)}
          />

          <DictationTextarea
            id="iteration-decision"
            label="Decisión"
            hint="Opcional."
            value={state.decision}
            onChange={(value) => update("decision", value)}
          />

          <DictationTextarea
            id="iteration-learning"
            label="Aprendizaje"
            hint="Opcional."
            value={state.learning}
            onChange={(value) => update("learning", value)}
          />

          <DictationTextarea
            id="iteration-next-step"
            label="Siguiente paso"
            hint="Opcional."
            value={state.next_step}
            onChange={(value) => update("next_step", value)}
          />

          <div className="flex flex-col gap-2 sm:w-64">
            <Label htmlFor="iteration-status">Estado</Label>
            <Select
              value={state.status}
              onValueChange={(value) =>
                update("status", value as IterationStatus)
              }
            >
              <SelectTrigger id="iteration-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITERATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {ITERATION_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="iteration-started-at">
                Fecha de inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="iteration-started-at"
                type="date"
                value={state.started_at}
                onChange={(e) => update("started_at", e.target.value)}
                aria-invalid={!!errors.started_at}
              />
              {errors.started_at && (
                <p className="text-sm text-destructive">{errors.started_at}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="iteration-completed-at">
                Fecha de finalización
              </Label>
              <Input
                id="iteration-completed-at"
                type="date"
                value={state.completed_at}
                onChange={(e) => update("completed_at", e.target.value)}
                aria-invalid={!!errors.completed_at}
              />
              <p className="text-xs text-muted-foreground">Opcional.</p>
              {errors.completed_at && (
                <p className="text-sm text-destructive">
                  {errors.completed_at}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-border pt-6">
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Guardando…"
                : props.mode === "edit"
                  ? "Guardar cambios"
                  : "Registrar iteración"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
