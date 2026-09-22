"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { TeamMember } from "@/lib/queries/roster";
import type { Category } from "@/lib/queries/categories";
import { MemberPicker } from "./member-picker";
import { ChipPicker } from "./chip-picker";
import { DictationTextarea } from "./dictation-textarea";
import { EvidenceStep } from "./evidence-step";
import { StepIndicator } from "./step-indicator";
import { emptyWizardState, type WizardState } from "./types";

const TOTAL_STEPS = 10;
const STEP_TITLES = [
  "¿Quién participó?",
  "¿Qué área trabajaron?",
  "Tipo de actividad",
  "Objetivo",
  "¿Qué ocurrió?",
  "¿Hubo algún problema?",
  "¿Qué decisión o solución tomamos?",
  "¿Qué aprendimos?",
  "¿Qué sigue?",
  "Evidencia",
];

function draftKey(teamMemberId: string) {
  return `session-wizard-draft-${teamMemberId}`;
}

export function SessionWizard({
  teamMember,
  roster,
  areas,
  activityTypes,
  seasonId,
}: {
  teamMember: TeamMember;
  roster: TeamMember[];
  areas: Category[];
  activityTypes: Category[];
  seasonId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(emptyWizardState);
  const [submitting, setSubmitting] = useState(false);

  // Restaura un borrador guardado en este dispositivo (§28: formulario
  // abandonado no debe perder el trabajo). Los archivos adjuntos no se
  // pueden persistir en localStorage, así que solo se restauran los campos
  // de texto/selección.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey(teamMember.id));
      if (!raw) return;
      const draft = JSON.parse(raw) as Omit<WizardState, "evidence">;
      // Restauración única de un borrador externo (localStorage) hacia
      // estado editable local: no hay forma de "calcular esto durante el
      // render" porque después el usuario sigue mutando `state` libremente.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState((current) => ({ ...current, ...draft, evidence: [] }));
      toast.info("Recuperamos un borrador sin terminar de esta sesión.");
    } catch {
      // Borrador corrupto o localStorage no disponible: se ignora.
    }
    // Solo debe intentarse una vez, al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const persistable: Partial<WizardState> = { ...state };
      delete persistable.evidence;
      window.localStorage.setItem(
        draftKey(teamMember.id),
        JSON.stringify(persistable)
      );
    } catch {
      // localStorage no disponible (modo privado, cuota, etc.): no bloquea.
    }
  }, [state, teamMember.id]);

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey(teamMember.id));
    } catch {
      // Ignorable.
    }
  }

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  const stepIsValid = (() => {
    switch (step) {
      case 0:
        return state.participantIds.length > 0;
      case 1:
        return state.areaIds.length > 0;
      case 2:
        return !!state.activityTypeId;
      case 3:
        return state.objective.trim().length >= 3;
      case 4:
        return state.whatHappened.trim().length >= 3;
      case 5:
        return (
          state.hadProblem !== null &&
          (!state.hadProblem || state.problemDescription.trim().length >= 3)
        );
      default:
        return true;
    }
  })();

  async function handleSubmit() {
    setSubmitting(true);
    const supabase = createClient();

    try {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          season_id: seasonId,
          created_by: teamMember.id,
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
        .select("id")
        .single();

      if (sessionError) throw sessionError;
      const sessionId = session.id as string;

      if (state.participantIds.length > 0) {
        const { error } = await supabase.from("session_participants").insert(
          state.participantIds.map((team_member_id) => ({
            session_id: sessionId,
            team_member_id,
          }))
        );
        if (error) throw error;
      }

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

      for (const item of state.evidence) {
        if (item.kind === "link") {
          const { error } = await supabase.from("evidence").insert({
            kind: "link",
            external_url: item.url,
            title: item.title,
            session_id: sessionId,
            uploaded_by: teamMember.id,
          });
          if (error) throw error;
          continue;
        }

        if (!item.file) continue;
        const path = `${seasonId}/session/${sessionId}/${crypto.randomUUID()}-${item.file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("evidence")
          .upload(path, item.file);
        if (uploadError) throw uploadError;

        const { error } = await supabase.from("evidence").insert({
          kind: item.kind,
          storage_path: path,
          title: item.title,
          session_id: sessionId,
          uploaded_by: teamMember.id,
        });
        if (error) throw error;
      }

      clearDraft();
      toast.success("Sesión guardada.");
      router.push(`/sesiones/${sessionId}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la sesión. Intenta de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6">
        <StepIndicator step={step} total={TOTAL_STEPS} title={STEP_TITLES[step]} />

        {step === 0 && (
          <div className="flex flex-col gap-3">
            <MemberPicker
              members={roster}
              selectedIds={state.participantIds}
              onChange={(ids) => update("participantIds", ids)}
            />
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-4 sm:w-64">
              <Label htmlFor="session-date">Fecha de la sesión</Label>
              <Input
                id="session-date"
                type="date"
                value={state.sessionDate}
                onChange={(e) => update("sessionDate", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Solo cámbiala si estás registrando una sesión pasada.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
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
        )}

        {step === 2 && (
          <ChipPicker
            options={activityTypes.map((a) => ({ id: a.id, label: a.label }))}
            selectedIds={state.activityTypeId ? [state.activityTypeId] : []}
            onToggle={(id) =>
              update(
                "activityTypeId",
                state.activityTypeId === id ? null : id
              )
            }
          />
        )}

        {step === 3 && (
          <DictationTextarea
            id="objective"
            label="Objetivo"
            hint="¿Qué queríamos conseguir hoy?"
            value={state.objective}
            onChange={(value) => update("objective", value)}
            required
          />
        )}

        {step === 4 && (
          <DictationTextarea
            id="what-happened"
            label="¿Qué ocurrió?"
            value={state.whatHappened}
            onChange={(value) => update("whatHappened", value)}
            required
            minRows={4}
          />
        )}

        {step === 5 && (
          <div className="flex flex-col gap-4">
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
                id="problem-description"
                label="¿Qué problema encontramos?"
                value={state.problemDescription}
                onChange={(value) => update("problemDescription", value)}
                required
              />
            )}
          </div>
        )}

        {step === 6 && (
          <DictationTextarea
            id="decision"
            label="Decisión o solución"
            hint="Opcional."
            value={state.decision}
            onChange={(value) => update("decision", value)}
          />
        )}

        {step === 7 && (
          <DictationTextarea
            id="learning"
            label="Aprendizaje"
            hint="Opcional."
            value={state.learning}
            onChange={(value) => update("learning", value)}
          />
        )}

        {step === 8 && (
          <DictationTextarea
            id="next-step"
            label="Siguiente paso"
            hint="Opcional."
            value={state.nextStep}
            onChange={(value) => update("nextStep", value)}
          />
        )}

        {step === 9 && (
          <EvidenceStep
            items={state.evidence}
            onChange={(items) => update("evidence", items)}
          />
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || submitting}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Atrás
          </Button>

          {step < TOTAL_STEPS - 1 ? (
            <Button
              type="button"
              disabled={!stepIsValid}
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
              className="gap-1.5"
            >
              Siguiente
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button type="button" disabled={submitting} onClick={handleSubmit}>
              {submitting ? "Guardando…" : "Guardar sesión"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
