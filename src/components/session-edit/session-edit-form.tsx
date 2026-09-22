"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { TeamMember } from "@/lib/queries/roster";
import type { Category } from "@/lib/queries/categories";
import type { WizardState } from "@/components/session-wizard/types";
import { MemberPicker } from "@/components/session-wizard/member-picker";
import { ChipPicker } from "@/components/session-wizard/chip-picker";
import { DictationTextarea } from "@/components/session-wizard/dictation-textarea";
import { sessionWizardSchema } from "@/lib/validation/session";

type EditableFields = Omit<WizardState, "evidence">;

export function SessionEditForm({
  sessionId,
  roster,
  areas,
  activityTypes,
  initialValues,
}: {
  sessionId: string;
  roster: TeamMember[];
  areas: Category[];
  activityTypes: Category[];
  initialValues: EditableFields;
}) {
  const router = useRouter();
  const [state, setState] = useState<EditableFields>(initialValues);
  const [errors, setErrors] = useState<
    Partial<Record<keyof EditableFields, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof EditableFields>(
    key: K,
    value: EditableFields[K]
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = sessionWizardSchema.safeParse(state);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof EditableFields, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof EditableFields;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Revisa los campos marcados antes de guardar.");
      return;
    }
    setErrors({});
    setSubmitting(true);
    const supabase = createClient();

    try {
      // OJO: si una política de RLS bloquea este UPDATE, Postgres no lanza
      // un error — simplemente afecta 0 filas y PostgREST responde éxito
      // igual. Por eso pedimos las filas afectadas con `.select("id")` y
      // tratamos "0 filas" como un fallo explícito (p. ej. si el permiso
      // cambió entre que se cargó la página y que se guardó).
      const { data: updatedRows, error: updateError } = await supabase
        .from("sessions")
        .update({
          session_date: state.sessionDate,
          objective: state.objective.trim(),
          what_happened: state.whatHappened.trim(),
          had_problem: !!state.hadProblem,
          problem_description: state.hadProblem
            ? state.problemDescription.trim()
            : null,
          decision: state.decision.trim() || null,
          learning: state.learning.trim() || null,
          next_step: state.nextStep.trim() || null,
        })
        .eq("id", sessionId)
        .select("id");
      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          "No se pudo actualizar la sesión: ya no tienes permiso o dejó de existir."
        );
      }

      const { error: deleteParticipantsError } = await supabase
        .from("session_participants")
        .delete()
        .eq("session_id", sessionId);
      if (deleteParticipantsError) throw deleteParticipantsError;

      if (state.participantIds.length > 0) {
        const { error } = await supabase.from("session_participants").insert(
          state.participantIds.map((team_member_id) => ({
            session_id: sessionId,
            team_member_id,
          }))
        );
        if (error) throw error;
      }

      const { error: deleteCategoriesError } = await supabase
        .from("session_categories")
        .delete()
        .eq("session_id", sessionId);
      if (deleteCategoriesError) throw deleteCategoriesError;

      const categoryIds = [
        ...state.areaIds,
        ...(state.activityTypeId ? [state.activityTypeId] : []),
      ];
      if (categoryIds.length > 0) {
        const { error } = await supabase.from("session_categories").insert(
          categoryIds.map((category_id) => ({
            session_id: sessionId,
            category_id,
          }))
        );
        if (error) throw error;
      }

      toast.success("Cambios guardados.");
      router.push(`/sesiones/${sessionId}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron guardar los cambios. Intenta de nuevo."
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
          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold">
              ¿Quién participó?
            </h2>
            <MemberPicker
              members={roster}
              selectedIds={state.participantIds}
              onChange={(ids) => update("participantIds", ids)}
            />
            {errors.participantIds && (
              <p className="text-sm text-destructive">
                {errors.participantIds}
              </p>
            )}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4 sm:w-64">
              <Label htmlFor="edit-session-date">Fecha de la sesión</Label>
              <Input
                id="edit-session-date"
                type="date"
                value={state.sessionDate}
                onChange={(e) => update("sessionDate", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="font-heading text-lg font-semibold">
              ¿Qué área trabajaron?
            </h2>
            <ChipPicker
              options={areas.map((a) => ({ id: a.id, label: a.label }))}
              selectedIds={state.areaIds}
              onToggle={(id) =>
                update(
                  "areaIds",
                  state.areaIds.includes(id)
                    ? state.areaIds.filter((existing) => existing !== id)
                    : [...state.areaIds, id]
                )
              }
            />
            {errors.areaIds && (
              <p className="text-sm text-destructive">{errors.areaIds}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="font-heading text-lg font-semibold">
              Tipo de actividad
            </h2>
            <ChipPicker
              options={activityTypes.map((a) => ({ id: a.id, label: a.label }))}
              selectedIds={state.activityTypeId ? [state.activityTypeId] : []}
              onToggle={(id) =>
                update("activityTypeId", state.activityTypeId === id ? null : id)
              }
            />
            {errors.activityTypeId && (
              <p className="text-sm text-destructive">
                {errors.activityTypeId}
              </p>
            )}
          </div>

          <div className="border-t border-border pt-6">
            <DictationTextarea
              id="edit-objective"
              label="Objetivo"
              hint="¿Qué queríamos conseguir?"
              value={state.objective}
              onChange={(value) => update("objective", value)}
              required
              error={errors.objective}
            />
          </div>

          <div className="border-t border-border pt-6">
            <DictationTextarea
              id="edit-what-happened"
              label="¿Qué ocurrió?"
              value={state.whatHappened}
              onChange={(value) => update("whatHappened", value)}
              required
              minRows={4}
              error={errors.whatHappened}
            />
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-6">
            <h2 className="font-heading text-lg font-semibold">
              ¿Hubo algún problema?
            </h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={state.hadProblem === true ? "default" : "outline"}
                onClick={() => update("hadProblem", true)}
              >
                Sí
              </Button>
              <Button
                type="button"
                variant={state.hadProblem === false ? "default" : "outline"}
                onClick={() => {
                  update("hadProblem", false);
                  update("problemDescription", "");
                }}
              >
                No
              </Button>
            </div>
            {state.hadProblem === true && (
              <DictationTextarea
                id="edit-problem-description"
                label="¿Qué problema encontramos?"
                value={state.problemDescription}
                onChange={(value) => update("problemDescription", value)}
                required
                error={errors.problemDescription}
              />
            )}
          </div>

          <div className="border-t border-border pt-6">
            <DictationTextarea
              id="edit-decision"
              label="Decisión o solución"
              hint="Opcional."
              value={state.decision}
              onChange={(value) => update("decision", value)}
            />
          </div>

          <div className="border-t border-border pt-6">
            <DictationTextarea
              id="edit-learning"
              label="Aprendizaje"
              hint="Opcional."
              value={state.learning}
              onChange={(value) => update("learning", value)}
            />
          </div>

          <div className="border-t border-border pt-6">
            <DictationTextarea
              id="edit-next-step"
              label="Siguiente paso"
              hint="Opcional."
              value={state.nextStep}
              onChange={(value) => update("nextStep", value)}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-6">
            <Button asChild variant="ghost" className="gap-1.5">
              <Link href={`/sesiones/${sessionId}`}>
                <ArrowLeft className="size-4" aria-hidden />
                Cancelar
              </Link>
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
