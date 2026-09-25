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
  PROJECT_TYPES,
  PROJECT_STATUSES,
  PROJECT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  type ProjectType,
  type ProjectStatus,
} from "@/lib/queries/projects";
import { projectSchema } from "@/lib/validation/project";

export type ProjectFormState = {
  name: string;
  description: string;
  objective: string;
  project_type: ProjectType | undefined;
  status: ProjectStatus;
  start_date: string;
  end_date: string;
  final_result: string;
};

function emptyState(): ProjectFormState {
  return {
    name: "",
    description: "",
    objective: "",
    project_type: undefined,
    status: "planned",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    final_result: "",
  };
}

// Mensajes propios para los dos campos de selección (enums): así no
// dependemos del mensaje por defecto de Zod, que no está en español.
// projectSchema en sí no se toca — sigue siendo la única fuente de
// verdad de las reglas de validación.
function labelForFieldError(key: keyof ProjectFormState, fallback: string) {
  if (key === "project_type") return "Elige un tipo de proyecto.";
  if (key === "status") return "Elige un estado.";
  return fallback;
}

// Crear y editar comparten exactamente los mismos campos/layout (a
// diferencia del wizard de sesiones, que sí se mantiene separado de su
// edición) — por eso un solo componente, bifurcando solo el envío.
type ProjectFormProps =
  | { mode: "create"; teamMemberId: string; seasonId: string | null }
  | { mode: "edit"; projectId: string; initialValues: ProjectFormState };

export function ProjectForm(props: ProjectFormProps) {
  const router = useRouter();
  const [state, setState] = useState<ProjectFormState>(
    props.mode === "edit" ? props.initialValues : emptyState()
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProjectFormState, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof ProjectFormState>(
    key: K,
    value: ProjectFormState[K]
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const parsed = projectSchema.safeParse({
      name: state.name,
      description: state.description.trim() || undefined,
      objective: state.objective,
      project_type: state.project_type,
      status: state.status,
      start_date: state.start_date,
      end_date: state.end_date || undefined,
      final_result: state.final_result.trim() || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof ProjectFormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ProjectFormState;
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
        const { data: project, error } = await supabase
          .from("projects")
          .insert({
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            objective: parsed.data.objective,
            project_type: parsed.data.project_type,
            status: parsed.data.status,
            start_date: parsed.data.start_date,
            end_date: parsed.data.end_date ?? null,
            final_result: parsed.data.final_result ?? null,
            created_by: props.teamMemberId,
            season_id: props.seasonId,
          })
          .select("id")
          .single();

        if (error) throw error;
        if (!project) {
          throw new Error(
            "No se pudo crear el proyecto: no se recibió confirmación de Supabase."
          );
        }

        // El creador queda registrado como integrante del proyecto por
        // defecto (efecto secundario mínimo, no un gestor de integrantes —
        // eso es un bloque posterior). Sin esto, un proyecto recién creado
        // se vería sin nadie asignado. Si esto falla, el proyecto igual
        // quedó creado: se avisa, pero no se bloquea el flujo.
        const { error: memberError } = await supabase
          .from("project_members")
          .insert({ project_id: project.id, team_member_id: props.teamMemberId });
        if (memberError) {
          toast.error(
            `Proyecto creado, pero no se pudo registrarte como integrante: ${memberError.message}`
          );
        }

        toast.success("Proyecto creado.");
        router.push(`/proyectos/${project.id}`);
        router.refresh();
        return;
      }

      // mode === "edit" — igual que en la edición de sesiones: si una
      // política de RLS bloquea este UPDATE, Postgres no lanza error, solo
      // afecta 0 filas. Pedimos las filas afectadas para distinguir un
      // guardado real de un bloqueo silencioso de permisos.
      const { data: updatedRows, error } = await supabase
        .from("projects")
        .update({
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          objective: parsed.data.objective,
          project_type: parsed.data.project_type,
          status: parsed.data.status,
          start_date: parsed.data.start_date,
          end_date: parsed.data.end_date ?? null,
          final_result: parsed.data.final_result ?? null,
        })
        .eq("id", props.projectId)
        .select("id");

      if (error) throw error;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          "No se pudo actualizar el proyecto: ya no tienes permiso o dejó de existir."
        );
      }

      toast.success("Cambios guardados.");
      router.push(`/proyectos/${props.projectId}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el proyecto. Intenta de nuevo."
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="project-name"
              value={state.name}
              onChange={(e) => update("name", e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "project-name-error" : undefined}
            />
            {errors.name && (
              <p id="project-name-error" className="text-sm text-destructive">
                {errors.name}
              </p>
            )}
          </div>

          <DictationTextarea
            id="project-description"
            label="Descripción"
            hint="¿Qué es este proyecto y por qué existe?"
            value={state.description}
            onChange={(value) => update("description", value)}
            error={errors.description}
          />

          <DictationTextarea
            id="project-objective"
            label="Objetivo"
            hint="¿Qué queremos lograr con este proyecto?"
            value={state.objective}
            onChange={(value) => update("objective", value)}
            required
            error={errors.objective}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-type">
                Tipo de proyecto <span className="text-destructive">*</span>
              </Label>
              <Select
                value={state.project_type}
                onValueChange={(value) =>
                  update("project_type", value as ProjectType)
                }
              >
                <SelectTrigger
                  id="project-type"
                  className="w-full"
                  aria-invalid={!!errors.project_type}
                >
                  <SelectValue placeholder="Elige un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PROJECT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.project_type && (
                <p className="text-sm text-destructive">{errors.project_type}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="project-status">Estado</Label>
              <Select
                value={state.status}
                onValueChange={(value) =>
                  update("status", value as ProjectStatus)
                }
              >
                <SelectTrigger id="project-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {PROJECT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-start-date">
                Fecha de inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="project-start-date"
                type="date"
                value={state.start_date}
                onChange={(e) => update("start_date", e.target.value)}
                aria-invalid={!!errors.start_date}
              />
              {errors.start_date && (
                <p className="text-sm text-destructive">{errors.start_date}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="project-end-date">Fecha de fin</Label>
              <Input
                id="project-end-date"
                type="date"
                value={state.end_date}
                onChange={(e) => update("end_date", e.target.value)}
                aria-invalid={!!errors.end_date}
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Solo si el proyecto ya tiene fecha de cierre.
              </p>
              {errors.end_date && (
                <p className="text-sm text-destructive">{errors.end_date}</p>
              )}
            </div>
          </div>

          <DictationTextarea
            id="project-final-result"
            label="Resultado final"
            hint="Opcional. Se puede completar más adelante, cuando el proyecto cierre."
            value={state.final_result}
            onChange={(value) => update("final_result", value)}
          />

          <div className="flex items-center justify-end border-t border-border pt-6">
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Guardando…"
                : props.mode === "edit"
                  ? "Guardar cambios"
                  : "Crear proyecto"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
