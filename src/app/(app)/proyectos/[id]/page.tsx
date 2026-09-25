import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getProjectById,
  getProjectMembers,
  PROJECT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/queries/projects";
import { getCurrentTeamMember } from "@/lib/queries/roster";
import {
  getIterationsByProject,
  ITERATION_STATUS_LABELS,
} from "@/lib/queries/project-iterations";
import { getDirectSessionsByProject } from "@/lib/queries/sessions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default async function ProyectoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  let project;
  let members;
  let currentMember;
  let iterations;
  let directSessions;
  try {
    [project, members, currentMember, iterations, directSessions] =
      await Promise.all([
        getProjectById(supabase, id),
        getProjectMembers(supabase, id),
        getCurrentTeamMember(supabase),
        getIterationsByProject(supabase, id),
        getDirectSessionsByProject(supabase, id),
      ]);
  } catch (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <Card className="border-warning/40">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <Warning className="mt-1 size-5 shrink-0 text-warning" aria-hidden />
            <div>
              <CardTitle className="text-base">
                No se pudo cargar el proyecto
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

  if (!project) notFound();

  const canEdit =
    !!currentMember &&
    (currentMember.id === project.created_by ||
      members.some((m) => m.team_member_id === currentMember.id) ||
      currentMember.role === "admin");

  const creatorMember = members.find(
    (m) => m.team_member_id === project.created_by
  );
  const creatorName = creatorMember
    ? creatorMember.nickname || creatorMember.full_name
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/proyectos"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Proyectos
        </Link>
        {canEdit && (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/proyectos/${project.id}/editar`}>
              <PencilSimple className="size-4" aria-hidden />
              Editar proyecto
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
          <Badge variant="outline">
            {PROJECT_TYPE_LABELS[project.project_type]}
          </Badge>
        </div>
        <h1 className="font-heading text-2xl font-semibold">{project.name}</h1>
        <p className="font-data text-sm text-muted-foreground">
          Desde {formatDate(project.start_date)}
          {project.end_date ? ` · hasta ${formatDate(project.end_date)}` : ""}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <Field label="Objetivo" value={project.objective} />
          <Field label="Descripción" value={project.description} />
          <Field label="Resultado final" value={project.final_result} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Integrantes</h2>
        <Card>
          <CardContent className="pt-6">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin integrantes registrados todavía.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {members.map((member) => (
                  <li key={member.team_member_id}>
                    <Badge variant="secondary">
                      {member.nickname || member.full_name}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Creado por {creatorName ?? "(no disponible)"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Iteraciones</h2>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/proyectos/${project.id}/iteraciones/nueva`}>
              <Plus className="size-4" aria-hidden />
              Registrar iteración
            </Link>
          </Button>
        </div>

        {iterations.length === 0 ? (
          <Card>
            <CardHeader>
              <CardDescription>
                Este proyecto todavía no tiene iteraciones registradas.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {iterations.map((iteration) => (
              <li key={iteration.id}>
                <Link
                  href={`/proyectos/${project.id}/iteraciones/${iteration.id}`}
                >
                  <Card className="transition-colors hover:bg-accent/50">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="font-data text-sm font-normal text-muted-foreground">
                          Iteración {iteration.sequence}
                          {iteration.name ? ` · ${iteration.name}` : ""}
                        </CardTitle>
                        <Badge variant="secondary">
                          {ITERATION_STATUS_LABELS[iteration.status]}
                        </Badge>
                      </div>
                      <CardDescription className="text-foreground">
                        {iteration.objective}
                      </CardDescription>
                      <p className="font-data text-xs text-muted-foreground">
                        Desde {formatDate(iteration.started_at)}
                        {iteration.completed_at
                          ? ` · hasta ${formatDate(iteration.completed_at)}`
                          : ""}
                      </p>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">
            Sesiones directas
          </h2>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/sesiones/nueva?projectId=${project.id}`}>
              <Plus className="size-4" aria-hidden />
              Registrar sesión
            </Link>
          </Button>
        </div>

        {directSessions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardDescription>
                Este proyecto todavía no tiene sesiones directas (sin
                iteración) registradas.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {directSessions.map((session) => (
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
