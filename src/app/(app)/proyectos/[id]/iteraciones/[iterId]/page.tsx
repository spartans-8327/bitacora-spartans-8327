import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/lib/queries/projects";
import {
  getIterationById,
  ITERATION_STATUS_LABELS,
} from "@/lib/queries/project-iterations";
import { getCurrentTeamMember } from "@/lib/queries/roster";
import { getSessionsByIteration } from "@/lib/queries/sessions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IterationDeleteButton } from "@/components/project/iteration-delete-button";
import {
  ArrowLeft,
  PencilSimple,
  Plus,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

export default async function IteracionDetailPage({
  params,
}: {
  params: Promise<{ id: string; iterId: string }>;
}) {
  const { id, iterId } = await params;
  const supabase = await createClient();

  let project;
  let iteration;
  let currentMember;
  let sessions;
  try {
    // getIterationById exige id Y project_id en el mismo WHERE: si la
    // iteración pertenece a otro proyecto, esto devuelve null — no un
    // registro "equivocado" que haya que descartar después por su cuenta.
    [project, iteration, currentMember] = await Promise.all([
      getProjectById(supabase, id),
      getIterationById(supabase, iterId, id),
      getCurrentTeamMember(supabase),
    ]);
    // getSessionsByIteration también exige ambos IDs juntos, y solo puede
    // ejecutarse una vez confirmado que la iteración es real (necesita su
    // id ya validado, no directamente iterId de la URL sin verificar).
    sessions = iteration
      ? await getSessionsByIteration(supabase, iteration.id, id)
      : [];
  } catch (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <Card className="border-warning/40">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <Warning className="mt-1 size-5 shrink-0 text-warning" aria-hidden />
            <div>
              <CardTitle className="text-base">
                No se pudo cargar la iteración
              </CardTitle>
              <CardDescription>
                Detalle: {error instanceof Error ? error.message : String(error)}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!project || !iteration) notFound();

  // Regla de escritura real (0004): solo quien creó la iteración o un
  // admin puede editarla/eliminarla — a diferencia de projects, aquí NO
  // basta con ser integrante del proyecto.
  const canEdit =
    !!currentMember &&
    (currentMember.id === iteration.created_by ||
      currentMember.role === "admin");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/proyectos/${project.id}`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {project.name}
        </Link>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/proyectos/${project.id}/iteraciones/${iteration.id}/editar`}>
                <PencilSimple className="size-4" aria-hidden />
                Editar
              </Link>
            </Button>
            <IterationDeleteButton
              projectId={project.id}
              iterationId={iteration.id}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">
            {ITERATION_STATUS_LABELS[iteration.status]}
          </Badge>
        </div>
        <h1 className="font-heading text-2xl font-semibold">
          Iteración {iteration.sequence}
          {iteration.name ? ` · ${iteration.name}` : ""}
        </h1>
        <p className="font-data text-sm text-muted-foreground">
          Desde {formatDate(iteration.started_at)}
          {iteration.completed_at
            ? ` · hasta ${formatDate(iteration.completed_at)}`
            : ""}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <Field label="Objetivo" value={iteration.objective} />
          <Field label="Hipótesis" value={iteration.hypothesis} />
          <Field label="Cambio realizado" value={iteration.change_made} />
          <Field label="Método de prueba" value={iteration.test_method} />
          <Field label="Resultado" value={iteration.result} />
          <Field label="Decisión" value={iteration.decision} />
          <Field label="Aprendizaje" value={iteration.learning} />
          <Field label="Siguiente paso" value={iteration.next_step} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            Sesiones ({sessions.length})
          </h2>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link
              href={`/sesiones/nueva?projectId=${project.id}&iterationId=${iteration.id}`}
            >
              <Plus className="size-4" aria-hidden />
              Registrar sesión
            </Link>
          </Button>
        </div>

        {sessions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardDescription>
                Esta iteración todavía no tiene sesiones registradas.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link href={`/sesiones/${session.id}`}>
                  <Card className="transition-colors hover:bg-accent/50">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="font-data text-sm font-normal text-muted-foreground">
                          {formatDate(session.session_date)}
                        </CardTitle>
                        {session.had_problem && (
                          <Badge
                            variant="outline"
                            className="border-warning text-warning"
                          >
                            Con problema
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-foreground">
                        {session.objective}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
