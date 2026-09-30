"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamMember } from "@/lib/queries/roster";
import type { Category } from "@/lib/queries/categories";
import type { Project } from "@/lib/queries/projects";
import type { SessionArea } from "@/lib/queries/sessions";
import type { SessionWizardState } from "@/components/session-wizard/types";
import { emptySpecializationDraft } from "@/components/session-wizard/types";
import { MemberPicker } from "@/components/session-wizard/member-picker";
import { ChipPicker } from "@/components/session-wizard/chip-picker";
import { AreaPicker } from "@/components/session-wizard/area-picker";
import { SpecializationStep } from "@/components/session-wizard/specialization-step";
import { DictationTextarea } from "@/components/session-wizard/dictation-textarea";
import { EvidenceManager } from "@/components/session-edit/evidence-manager";
import type { EvidenceWithUrl } from "@/lib/queries/evidence";
import {
  specializedRecordSchema,
  type SpecializedRecord,
} from "@/lib/validation/specialized-record";
import {
  createSpecializedRecord,
  updateSpecializedRecord,
} from "@/lib/queries/specialized-records";
import {
  getIterationsByProject,
  type ProjectIteration,
} from "@/lib/queries/project-iterations";

type EditableFields = Omit<SessionWizardState, "evidence">;

// Sentinel para representar "sin proyecto"/"sin iteración" en los Select
// de Radix, que no aceptan value="" de forma confiable.
const NONE_VALUE = "none";

function nowAsTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

export function SessionEditForm({
  sessionId,
  seasonId,
  uploadedBy,
  roster,
  areas,
  activityTypes,
  projects,
  hasExistingSpecializedRecord,
  initialSpecializedRecordDetails,
  initialEvidence,
  initialValues,
}: {
  sessionId: string;
  seasonId: string;
  uploadedBy: string;
  roster: TeamMember[];
  // Ya no se usa para elegir área (eso vive en sessions.area, selección
  // única) — solo para identificar y limpiar etiquetas legacy de área en
  // session_categories al guardar (Fase 4: sessions.area es la única
  // fuente de verdad).
  areas: Category[];
  activityTypes: Category[];
  projects: Project[];
  hasExistingSpecializedRecord: boolean;
  initialSpecializedRecordDetails: Record<string, unknown>;
  initialEvidence: EvidenceWithUrl[];
  initialValues: EditableFields;
}) {
  const router = useRouter();
  const [state, setState] = useState<EditableFields>(initialValues);
  const [errors, setErrors] = useState<
    Partial<Record<keyof EditableFields, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [iterations, setIterations] = useState<ProjectIteration[]>([]);
  const [loadingIterations, setLoadingIterations] = useState(false);
  const [areaChangeDialogOpen, setAreaChangeDialogOpen] = useState(false);
  const [pendingArea, setPendingArea] = useState<SessionArea | null>(null);

  // Capturados una sola vez, al montar — nunca deben recalcularse cuando
  // el usuario edita el formulario, solo reflejan con qué llegó cargada
  // la sesión desde el servidor.
  const initialAreaRef = useRef(initialValues.area);
  const hadExistingSpecializedRecordRef = useRef(hasExistingSpecializedRecord);
  const loadedDetailsRef = useRef(initialSpecializedRecordDetails);

  function update<K extends keyof EditableFields>(
    key: K,
    value: EditableFields[K]
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function updateSpecialization(patch: Partial<EditableFields["specialization"]>) {
    setState((current) => ({
      ...current,
      specialization: { ...current.specialization, ...patch },
    }));
  }

  // Cambiar de área siempre descarta la clasificación anterior — nunca se
  // intenta "traducir" una especialización de un área a otra, igual que
  // en session-wizard.tsx y en el trigger de la base de datos
  // (sessions_discard_specialized_record_on_area_change).
  function applyAreaChange(newArea: SessionArea) {
    setState((current) => ({
      ...current,
      area: newArea,
      activityTypeId: null,
      specialization: emptySpecializationDraft(),
    }));
  }

  // Solo pide confirmación cuando hay algo real que perder: si todavía
  // no había ningún área elegida, o si se vuelve a elegir la misma, no
  // hace falta interrumpir con un diálogo.
  function requestAreaChange(newArea: SessionArea) {
    if (state.area === null || newArea === state.area) {
      applyAreaChange(newArea);
      return;
    }
    setPendingArea(newArea);
    setAreaChangeDialogOpen(true);
  }

  function confirmAreaChange() {
    if (pendingArea) applyAreaChange(pendingArea);
    setAreaChangeDialogOpen(false);
    setPendingArea(null);
  }

  function cancelAreaChange() {
    setAreaChangeDialogOpen(false);
    setPendingArea(null);
  }

  // Recarga las iteraciones disponibles cada vez que cambia el proyecto
  // seleccionado (incluyendo el montaje inicial, si la sesión ya tenía un
  // proyecto asignado) — así el Select de iteración siempre refleja
  // exactamente las iteraciones del proyecto actualmente elegido.
  useEffect(() => {
    // Sin proyecto seleccionado no hay nada que cargar. No reseteamos
    // `iterations` aquí (evitaría un setState síncrono dentro del efecto);
    // el render calcula la lista efectiva a mostrar con
    // `availableIterations` más abajo, así que un valor viejo en este
    // estado nunca llega a mostrarse mientras el Select está deshabilitado.
    if (!state.projectId) {
      return;
    }
    let cancelled = false;
    // Debe marcarse "cargando" antes de que arranque la promesa, no hay
    // forma de moverlo a un callback (mismo caso ya resuelto así en
    // session-wizard.tsx para el borrador de localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingIterations(true);
    const supabase = createClient();
    getIterationsByProject(supabase, state.projectId)
      .then((data) => {
        if (!cancelled) setIterations(data);
      })
      .catch(() => {
        if (!cancelled) {
          setIterations([]);
          toast.error("No se pudieron cargar las iteraciones de este proyecto.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingIterations(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state.projectId]);

  const availableIterations = state.projectId ? iterations : [];

  const scheduleOrderValid = !(
    state.startTime && state.endTime && state.endTime < state.startTime
  );

  function validateBaseFields(): Partial<Record<keyof EditableFields, string>> {
    const fieldErrors: Partial<Record<keyof EditableFields, string>> = {};
    if (!state.sessionDate) fieldErrors.sessionDate = "Elige una fecha.";
    if (state.participantIds.length === 0) {
      fieldErrors.participantIds = "Selecciona al menos un participante.";
    }
    if (!state.area) {
      fieldErrors.area = "Selecciona un área responsable.";
    }
    if (state.area === "team" && !state.activityTypeId) {
      fieldErrors.activityTypeId = "Elige el tipo de actividad.";
    }
    if (state.objective.trim().length < 3) {
      fieldErrors.objective = "Cuéntanos qué querían conseguir.";
    }
    if (state.whatHappened.trim().length < 3) {
      fieldErrors.whatHappened = "Cuéntanos qué ocurrió.";
    }
    if (state.hadProblem === null) {
      fieldErrors.hadProblem = "Indica si hubo un problema.";
    } else if (state.hadProblem && state.problemDescription.trim().length < 3) {
      fieldErrors.problemDescription = "Describe brevemente el problema.";
    }
    if (!scheduleOrderValid) {
      fieldErrors.endTime =
        "La hora de finalización no puede ser antes de la de inicio.";
    }
    return fieldErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const fieldErrors = validateBaseFields();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      toast.error("Revisa los campos marcados antes de guardar.");
      return;
    }

    const areaChanged = state.area !== initialAreaRef.current;

    // El área ya se validó como no-nula arriba (validateBaseFields), pero
    // TypeScript no puede inferir eso a través de la llamada a esa
    // función — por eso el `!!state.area` explícito aquí también.
    const isTechnicalArea = !!state.area && state.area !== "team";
    let specializedPayload: SpecializedRecord | null = null;

    if (isTechnicalArea && state.area) {
      const candidate = {
        area: state.area,
        workType: state.specialization.workType,
        subject: state.specialization.subject,
        status: state.specialization.status ?? undefined,
        blockedReason: state.specialization.blockedReason.trim() || undefined,
        blockedNeeds: state.specialization.blockedNeeds.trim() || undefined,
        // Si el área no cambió y ya existía un registro, se conserva su
        // `details` tal cual — todavía no hay UI para editarlo y no debe
        // perderse por una edición de otros campos. Si el área cambió (o
        // nunca existió un registro), se empieza desde cero.
        details:
          !areaChanged && hadExistingSpecializedRecordRef.current
            ? loadedDetailsRef.current
            : {},
      };
      const parsed = specializedRecordSchema.safeParse(candidate);
      if (!parsed.success) {
        toast.error("Completa correctamente la especialización antes de guardar.");
        return;
      }
      specializedPayload = parsed.data;
    }

    setErrors({});
    setSubmitting(true);
    const supabase = createClient();

    try {
      // OJO: si una política de RLS bloquea este UPDATE, Postgres no lanza
      // un error — simplemente afecta 0 filas y PostgREST responde éxito
      // igual. Por eso pedimos las filas afectadas con `.select("id")` y
      // tratamos "0 filas" como un fallo explícito.
      //
      // Si `area` cambió, el trigger sessions_discard_specialized_record_on
      // _area_change (migración 0005) ya elimina por su cuenta cualquier
      // specialized_record anterior — esa es la protección principal, no
      // se duplica aquí ningún borrado manual.
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
          project_id: state.projectId,
          iteration_id: state.iterationId,
          area: state.area,
          start_time: state.startTime || null,
          end_time: state.endTime || null,
        })
        .eq("id", sessionId)
        .select("id");
      if (updateError) {
        if (updateError.code === "23503") {
          throw new Error(
            "El proyecto y la iteración seleccionados no coinciden. Vuelve a elegirlos."
          );
        }
        throw updateError;
      }
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

      // sessions.area es la única fuente de verdad del área (Fase 4): las
      // etiquetas legacy de kind='area' en session_categories se eliminan
      // siempre, sin excepción. Las de kind='activity_type' se limpian y
      // se vuelven a escribir solo si el área actual es Equipo — para
      // cualquier área técnica, ninguna de las dos debe quedar.
      const areaCategoryIds = areas.map((a) => a.id);
      if (areaCategoryIds.length > 0) {
        const { error } = await supabase
          .from("session_categories")
          .delete()
          .eq("session_id", sessionId)
          .in("category_id", areaCategoryIds);
        if (error) throw error;
      }

      const activityTypeCategoryIds = activityTypes.map((a) => a.id);
      if (activityTypeCategoryIds.length > 0) {
        const { error } = await supabase
          .from("session_categories")
          .delete()
          .eq("session_id", sessionId)
          .in("category_id", activityTypeCategoryIds);
        if (error) throw error;
      }

      if (state.area === "team" && state.activityTypeId) {
        const { error } = await supabase.from("session_categories").insert({
          session_id: sessionId,
          category_id: state.activityTypeId,
        });
        if (error) throw error;
      }

      // Registro especializado: solo áreas técnicas. Si el área cambió,
      // el trigger ya eliminó el registro anterior (ver comentario
      // arriba) — aquí solo decidimos crear uno nuevo o actualizar el
      // existente, nunca borrar.
      if (isTechnicalArea && specializedPayload) {
        if (!areaChanged && hadExistingSpecializedRecordRef.current) {
          await updateSpecializedRecord(supabase, sessionId, specializedPayload);
        } else {
          await createSpecializedRecord(supabase, sessionId, specializedPayload);
        }
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

          <div className="flex flex-col gap-4 border-t border-border pt-6">
            <h2 className="font-heading text-lg font-semibold">
              Horario (opcional)
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-start-time">Hora de inicio</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-start-time"
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
                <Label htmlFor="edit-end-time">Hora de finalización</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-end-time"
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
            {errors.endTime && (
              <p className="text-sm text-destructive">{errors.endTime}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="font-heading text-lg font-semibold">
              ¿Qué área es responsable?
            </h2>
            <AreaPicker value={state.area} onChange={requestAreaChange} />
            {errors.area && (
              <p className="text-sm text-destructive">{errors.area}</p>
            )}
          </div>

          {state.area === "team" && (
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
          )}

          {state.area && state.area !== "team" && (
            <div className="flex flex-col gap-3 border-t border-border pt-6">
              <h2 className="font-heading text-lg font-semibold">
                Especialización
              </h2>
              <SpecializationStep
                area={state.area}
                value={state.specialization}
                onChange={updateSpecialization}
              />
            </div>
          )}

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

          <div className="flex flex-col gap-4 border-t border-border pt-6">
            <h2 className="font-heading text-lg font-semibold">
              Proyecto e iteración
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-session-project">Proyecto</Label>
                <Select
                  value={state.projectId ?? NONE_VALUE}
                  onValueChange={(value) => {
                    const newProjectId = value === NONE_VALUE ? null : value;
                    update("projectId", newProjectId);
                    // Cambiar de proyecto (o quitarlo) siempre limpia la
                    // iteración: una iteración de otro proyecto nunca es
                    // una combinación válida.
                    update("iterationId", null);
                  }}
                >
                  <SelectTrigger id="edit-session-project" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Sin proyecto</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-session-iteration">Iteración</Label>
                <Select
                  value={state.iterationId ?? NONE_VALUE}
                  onValueChange={(value) =>
                    update("iterationId", value === NONE_VALUE ? null : value)
                  }
                  disabled={!state.projectId || loadingIterations}
                >
                  <SelectTrigger id="edit-session-iteration" className="w-full">
                    <SelectValue
                      placeholder={
                        !state.projectId
                          ? "Elige un proyecto primero"
                          : loadingIterations
                            ? "Cargando…"
                            : "Ninguna"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>
                      Ninguna (directa al proyecto)
                    </SelectItem>
                    {availableIterations.map((iteration) => (
                      <SelectItem key={iteration.id} value={iteration.id}>
                        Iteración {iteration.sequence}
                        {iteration.name ? ` · ${iteration.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!state.projectId && (
                  <p className="text-xs text-muted-foreground">
                    Elige un proyecto para poder asociar una iteración.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6">
            <h2 className="font-heading text-lg font-semibold">Evidencia</h2>
            {/*
              Independiente del resto del formulario a propósito: no lee
              ni escribe `state`, así que guardar cambios en cualquier
              otro campo nunca toca la evidencia (Fase 5, Parte A4).
            */}
            <EvidenceManager
              sessionId={sessionId}
              seasonId={seasonId}
              uploadedBy={uploadedBy}
              initialEvidence={initialEvidence}
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

      <Dialog
        open={areaChangeDialogOpen}
        onOpenChange={(open) => {
          if (!open) cancelAreaChange();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cambiar de área?</DialogTitle>
            <DialogDescription>
              Cambiar el área descartará la especialización o el tipo de
              actividad que ya capturaste en este formulario — no se
              traduce de una área a otra, se empieza desde cero. Esto se
              aplica hasta que guardes los cambios.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelAreaChange}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmAreaChange}>
              Sí, cambiar de área
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
