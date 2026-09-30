"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { SESSION_AREA_LABELS, type SessionArea } from "@/lib/queries/sessions";
import { specializedRecordSchema } from "@/lib/validation/specialized-record";
import { createSpecializedRecord } from "@/lib/queries/specialized-records";
import { uploadEvidenceFile, insertEvidenceLink } from "@/lib/queries/evidence";
import { MemberPicker } from "./member-picker";
import { AreaPicker } from "./area-picker";
import { ChipPicker } from "./chip-picker";
import { SpecializationStep } from "./specialization-step";
import { DictationTextarea } from "./dictation-textarea";
import { EvidenceStep } from "./evidence-step";
import { StepIndicator } from "./step-indicator";
import {
  emptySessionWizardState,
  emptySpecializationDraft,
  type SessionWizardState,
} from "./types";

// Pasos fijos + pasos condicionados por el área elegida (Fase 4). El
// arreglo se recalcula en cada render a partir de `state.area`, así que
// nunca queda desincronizado con lo que el usuario acaba de elegir.
type StepKind =
  | "participants"
  | "schedule"
  | "area"
  | "team-activity-type"
  | "specialization"
  | "objective"
  | "what-happened"
  | "problem"
  | "decision"
  | "learning"
  | "next-step"
  | "evidence";

function buildStepKinds(area: SessionArea | null): StepKind[] {
  const kinds: StepKind[] = ["participants", "schedule", "area"];
  if (area === "team") {
    kinds.push("team-activity-type");
  } else if (area) {
    kinds.push("specialization");
  }
  kinds.push(
    "objective",
    "what-happened",
    "problem",
    "decision",
    "learning",
    "next-step",
    "evidence"
  );
  return kinds;
}

function titleFor(kind: StepKind, area: SessionArea | null): string {
  switch (kind) {
    case "participants":
      return "¿Quién participó?";
    case "schedule":
      return "Horario (opcional)";
    case "area":
      return "¿Qué área es responsable?";
    case "team-activity-type":
      return "Tipo de actividad";
    case "specialization":
      return area ? `Especialización — ${SESSION_AREA_LABELS[area]}` : "Especialización";
    case "objective":
      return "Objetivo";
    case "what-happened":
      return "¿Qué ocurrió?";
    case "problem":
      return "¿Hubo algún problema?";
    case "decision":
      return "¿Qué decisión o solución tomamos?";
    case "learning":
      return "¿Qué aprendimos?";
    case "next-step":
      return "¿Qué sigue?";
    case "evidence":
      return "Evidencia";
  }
}

function draftKey(teamMemberId: string) {
  // v2: el estado del wizard de creación cambió de forma en Fase 4 (área
  // única + horario + especialización). Un borrador viejo bajo la clave
  // anterior simplemente deja de leerse — no se pierde ninguna sesión
  // real, solo un borrador local sin terminar.
  return `session-wizard-draft-v2-${teamMemberId}`;
}

function nowAsTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

// Contexto opcional cuando el wizard se abre desde un proyecto/iteración
// (/sesiones/nueva?projectId=...&iterationId=...). Ya viene validado por
// el Server Component que renderiza SessionWizard — aquí solo se muestra
// y se adjunta al guardar, nunca se ofrece un selector nuevo.
export type SessionWizardContext = {
  projectId: string;
  projectName: string;
  iterationId?: string;
  iterationLabel?: string;
};

function initialStateWithContext(
  context?: SessionWizardContext
): SessionWizardState {
  const base = emptySessionWizardState();
  if (context) {
    base.projectId = context.projectId;
    base.iterationId = context.iterationId ?? null;
  }
  return base;
}

export function SessionWizard({
  teamMember,
  roster,
  activityTypes,
  seasonId,
  context,
}: {
  teamMember: TeamMember;
  roster: TeamMember[];
  activityTypes: Category[];
  seasonId: string;
  context?: SessionWizardContext;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<SessionWizardState>(() =>
    initialStateWithContext(context)
  );
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  const stepKinds = buildStepKinds(state.area);
  const totalSteps = stepKinds.length;
  const currentKind = stepKinds[step];

  // Restaura un borrador guardado en este dispositivo (§28: formulario
  // abandonado no debe perder el trabajo). Los archivos adjuntos no se
  // pueden persistir en localStorage, así que solo se restauran los campos
  // de texto/selección.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey(teamMember.id));
      if (!raw) return;
      const draft = JSON.parse(raw) as Omit<SessionWizardState, "evidence">;
      // Restauración única de un borrador externo (localStorage) hacia
      // estado editable local: no hay forma de "calcular esto durante el
      // render" porque después el usuario sigue mutando `state` libremente.
      //
      // El contexto de proyecto/iteración SIEMPRE se vuelve a aplicar
      // después de mezclar el borrador: un borrador viejo pudo haberse
      // guardado en una sesión independiente (o de otro proyecto) antes
      // de que existiera este contexto, y no debe pisarlo silenciosamente.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState((current) => ({
        ...current,
        ...draft,
        evidence: [],
        projectId: context ? context.projectId : current.projectId,
        iterationId: context ? (context.iterationId ?? null) : current.iterationId,
      }));
      toast.info("Recuperamos un borrador sin terminar de esta sesión.");
    } catch {
      // Borrador corrupto o localStorage no disponible: se ignora.
    }
    // Solo debe intentarse una vez, al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const persistable: Partial<SessionWizardState> = { ...state };
      delete persistable.evidence;
      // El contexto de proyecto/iteración nunca se persiste: representa
      // "desde dónde se abrió el wizard", no algo que deba sobrevivir
      // entre sesiones del navegador ni aplicarse a un contexto distinto.
      delete persistable.projectId;
      delete persistable.iterationId;
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

  function update<K extends keyof SessionWizardState>(
    key: K,
    value: SessionWizardState[K]
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function updateSpecialization(patch: Partial<SessionWizardState["specialization"]>) {
    setState((current) => ({
      ...current,
      specialization: { ...current.specialization, ...patch },
    }));
  }

  // Cambiar de área siempre descarta la clasificación anterior (tipo de
  // actividad de Equipo o especialización técnica): nunca se intenta
  // "traducir" una especialización de un área a otra, igual que en la
  // base de datos (trigger sessions_discard_specialized_record_on_area_change).
  function selectArea(newArea: SessionArea) {
    setState((current) => {
      if (current.area === newArea) return current;
      return {
        ...current,
        area: newArea,
        activityTypeId: null,
        specialization: emptySpecializationDraft(),
      };
    });
  }

  const scheduleOrderValid = !(
    state.startTime && state.endTime && state.endTime < state.startTime
  );

  const specializationCandidate =
    state.area && state.area !== "team"
      ? {
          area: state.area,
          workType: state.specialization.workType,
          subject: state.specialization.subject,
          status: state.specialization.status ?? undefined,
          blockedReason: state.specialization.blockedReason.trim() || undefined,
          blockedNeeds: state.specialization.blockedNeeds.trim() || undefined,
          details: {},
        }
      : null;

  const stepIsValid = (() => {
    switch (currentKind) {
      case "participants":
        return state.participantIds.length > 0;
      case "schedule":
        return scheduleOrderValid;
      case "area":
        return state.area !== null;
      case "team-activity-type":
        return !!state.activityTypeId;
      case "specialization":
        return (
          !!specializationCandidate &&
          specializedRecordSchema.safeParse(specializationCandidate).success
        );
      case "objective":
        return state.objective.trim().length >= 3;
      case "what-happened":
        return state.whatHappened.trim().length >= 3;
      case "problem":
        return (
          state.hadProblem !== null &&
          (!state.hadProblem || state.problemDescription.trim().length >= 3)
        );
      default:
        return true;
    }
  })();

  function patchEvidenceItem(clientId: string, patch: Partial<SessionWizardState["evidence"][number]>) {
    setState((current) => ({
      ...current,
      evidence: current.evidence.map((item) =>
        item.clientId === clientId ? { ...item, ...patch } : item
      ),
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    const supabase = createClient();

    // Paso 1: la sesión y sus vínculos de participantes/categoría de
    // Equipo son el núcleo del registro. Si esto falla, no hay nada que
    // guardar todavía y abortamos por completo (comportamiento sin
    // cambios respecto al wizard anterior).
    let sessionId: string;
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
          project_id: state.projectId,
          iteration_id: state.iterationId,
          area: state.area,
          start_time: state.startTime || null,
          end_time: state.endTime || null,
        })
        .select("id")
        .single();

      if (sessionError) {
        // foreign_key_violation: el par project_id/iteration_id no es
        // válido (p. ej. la iteración ya no pertenece a ese proyecto). El
        // contexto ya se valida server-side antes de mostrar el wizard,
        // así que esto solo debería dispararse en una condición de carrera
        // rarísima — pero la base de datos es la autoridad final, no la UI.
        if (sessionError.code === "23503") {
          throw new Error(
            "El contexto de proyecto/iteración ya no es válido. Vuelve a intentarlo."
          );
        }
        throw sessionError;
      }
      sessionId = session.id as string;

      if (state.participantIds.length > 0) {
        const { error } = await supabase.from("session_participants").insert(
          state.participantIds.map((team_member_id) => ({
            session_id: sessionId,
            team_member_id,
          }))
        );
        if (error) throw error;
      }

      // Una sesión nueva ya NO usa session_categories para el área
      // responsable (vive en sessions.area) — solo Equipo sigue usando
      // esta tabla, y únicamente para su tipo de actividad general.
      if (state.area === "team" && state.activityTypeId) {
        const { error } = await supabase.from("session_categories").insert({
          session_id: sessionId,
          category_id: state.activityTypeId,
        });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la sesión. Intenta de nuevo."
      );
      setSubmitting(false);
      return;
    }

    // A partir de aquí la sesión YA existe. `savedSessionId` se marca de
    // inmediato para que, si algo de lo que sigue falla, el usuario nunca
    // pueda volver a pulsar "Guardar sesión" y crear una sesión duplicada.
    setSavedSessionId(sessionId);

    // Paso 2 (best-effort, no bloquea la sesión ya guardada): registro
    // especializado, solo para áreas técnicas. `details` va vacío en este
    // bloque a propósito — ver comentario en specialization-step.tsx.
    let specializedRecordFailed = false;
    if (specializationCandidate) {
      try {
        const parsed = specializedRecordSchema.safeParse(specializationCandidate);
        if (!parsed.success) {
          throw new Error("La información de especialización no es válida.");
        }
        await createSpecializedRecord(supabase, sessionId, parsed.data);
      } catch {
        specializedRecordFailed = true;
      }
    }

    // Paso 3: evidencia, un ítem a la vez. El fallo de uno NO aborta los
    // demás ni pone en riesgo la sesión ya guardada.
    const total = state.evidence.length;
    let failedCount = 0;
    const failedTitles: string[] = [];

    for (let index = 0; index < state.evidence.length; index += 1) {
      const item = state.evidence[index];
      setUploadProgress({ current: index + 1, total });
      patchEvidenceItem(item.clientId, { status: "uploading" });

      try {
        if (item.kind === "link" && item.url) {
          await insertEvidenceLink(supabase, {
            sessionId,
            uploadedBy: teamMember.id,
            url: item.url,
            title: item.title,
          });
        } else if (item.kind !== "link" && item.file) {
          await uploadEvidenceFile(supabase, {
            sessionId,
            seasonId,
            uploadedBy: teamMember.id,
            kind: item.kind,
            file: item.file,
            title: item.title,
          });
        }
        patchEvidenceItem(item.clientId, { status: "done" });
      } catch (error) {
        failedCount += 1;
        failedTitles.push(item.title);
        patchEvidenceItem(item.clientId, {
          status: "error",
          errorMessage:
            error instanceof Error ? error.message : "No se pudo subir.",
        });
      }
    }

    setUploadProgress(null);
    clearDraft();
    setSubmitting(false);

    if (failedCount === 0 && !specializedRecordFailed) {
      toast.success("Sesión guardada.");
      router.push(`/sesiones/${sessionId}`);
      router.refresh();
      return;
    }

    const parts: string[] = [];
    if (specializedRecordFailed) {
      parts.push("no se pudo guardar la información de especialización");
    }
    if (failedCount > 0) {
      parts.push(
        `${failedCount} de ${total} evidencia(s) no se pudo subir: ${failedTitles.join(", ")}`
      );
    }
    toast.error(`Sesión guardada, pero ${parts.join("; ")}. Revisa el detalle abajo.`);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6">
        {context && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground">
                Proyecto
              </span>
              <span className="text-sm text-foreground">
                {context.projectName}
              </span>
            </div>
            {context.iterationLabel && (
              <div className="flex flex-col">
                <span className="text-xs font-medium text-muted-foreground">
                  Iteración
                </span>
                <span className="text-sm text-foreground">
                  {context.iterationLabel}
                </span>
              </div>
            )}
          </div>
        )}

        <StepIndicator step={step} total={totalSteps} title={titleFor(currentKind, state.area)} />

        {currentKind === "participants" && (
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

        {currentKind === "schedule" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Ambos son opcionales — puedes dejarlos vacíos si no importa
              registrar el horario exacto.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start-time">Hora de inicio</Label>
                <div className="flex gap-2">
                  <Input
                    id="start-time"
                    type="time"
                    value={state.startTime}
                    onChange={(e) => update("startTime", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => update("startTime", nowAsTime())}
                  >
                    Ahora
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="end-time">Hora de finalización</Label>
                <div className="flex gap-2">
                  <Input
                    id="end-time"
                    type="time"
                    value={state.endTime}
                    onChange={(e) => update("endTime", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => update("endTime", nowAsTime())}
                  >
                    Ahora
                  </Button>
                </div>
              </div>
            </div>
            {!scheduleOrderValid && (
              <p className="text-sm text-destructive">
                La hora de finalización no puede ser antes de la de inicio.
              </p>
            )}
          </div>
        )}

        {currentKind === "area" && (
          <AreaPicker value={state.area} onChange={selectArea} />
        )}

        {currentKind === "team-activity-type" && (
          <ChipPicker
            options={activityTypes.map((a) => ({ id: a.id, label: a.label }))}
            selectedIds={state.activityTypeId ? [state.activityTypeId] : []}
            onToggle={(id) =>
              update("activityTypeId", state.activityTypeId === id ? null : id)
            }
          />
        )}

        {currentKind === "specialization" && state.area && state.area !== "team" && (
          <SpecializationStep
            area={state.area}
            value={state.specialization}
            onChange={updateSpecialization}
          />
        )}

        {currentKind === "objective" && (
          <DictationTextarea
            id="objective"
            label="Objetivo"
            hint="¿Qué queríamos conseguir hoy?"
            value={state.objective}
            onChange={(value) => update("objective", value)}
            required
          />
        )}

        {currentKind === "what-happened" && (
          <DictationTextarea
            id="what-happened"
            label="¿Qué ocurrió?"
            value={state.whatHappened}
            onChange={(value) => update("whatHappened", value)}
            required
            minRows={4}
          />
        )}

        {currentKind === "problem" && (
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

        {currentKind === "decision" && (
          <DictationTextarea
            id="decision"
            label="Decisión o solución"
            hint="Opcional."
            value={state.decision}
            onChange={(value) => update("decision", value)}
          />
        )}

        {currentKind === "learning" && (
          <DictationTextarea
            id="learning"
            label="Aprendizaje"
            hint="Opcional."
            value={state.learning}
            onChange={(value) => update("learning", value)}
          />
        )}

        {currentKind === "next-step" && (
          <DictationTextarea
            id="next-step"
            label="Siguiente paso"
            hint="Opcional."
            value={state.nextStep}
            onChange={(value) => update("nextStep", value)}
          />
        )}

        {currentKind === "evidence" && (
          <EvidenceStep
            items={state.evidence}
            onChange={(items) => update("evidence", items)}
            disabled={submitting || !!savedSessionId}
            progressLabel={
              uploadProgress
                ? `Subiendo ${uploadProgress.current} de ${uploadProgress.total}…`
                : undefined
            }
          />
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || submitting || !!savedSessionId}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Atrás
          </Button>

          {step < totalSteps - 1 ? (
            <Button
              type="button"
              disabled={!stepIsValid}
              onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
              className="gap-1.5"
            >
              Siguiente
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : savedSessionId ? (
            <Button asChild>
              <Link href={`/sesiones/${savedSessionId}`}>Ver sesión</Link>
            </Button>
          ) : (
            <Button type="button" disabled={submitting} onClick={handleSubmit}>
              {submitting
                ? uploadProgress
                  ? `Subiendo ${uploadProgress.current} de ${uploadProgress.total}…`
                  : "Guardando…"
                : "Guardar sesión"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
