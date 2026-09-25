import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectById, getProjectMembers } from "@/lib/queries/projects";
import { getCurrentTeamMember } from "@/lib/queries/roster";
import { ProjectForm } from "@/components/project/project-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Warning } from "@phosphor-icons/react/dist/ssr";

function BlockedState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Card className="border-warning/40">
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <Warning className="mt-1 size-5 shrink-0 text-warning" aria-hidden />
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}

export default async function EditarProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  let project;
  let members;
  let currentMember;
  try {
    [project, members, currentMember] = await Promise.all([
      getProjectById(supabase, id),
      getProjectMembers(supabase, id),
      getCurrentTeamMember(supabase),
    ]);
  } catch (error) {
    return (
      <BlockedState
        title="No se pudo cargar el proyecto"
        description={`Detalle: ${
          error instanceof Error ? error.message : String(error)
        }`}
      />
    );
  }

  if (!project) notFound();

  const canEdit =
    !!currentMember &&
    (currentMember.id === project.created_by ||
      members.some((m) => m.team_member_id === currentMember.id) ||
      currentMember.role === "admin");

  if (!canEdit) {
    return (
      <BlockedState
        title="No puedes editar este proyecto"
        description="Solo quien lo creó, un integrante del proyecto o un administrador puede editarlo."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/proyectos/${project.id}`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Cancelar
        </Link>
        <h1 className="font-heading text-lg font-semibold">Editar proyecto</h1>
      </div>
      <ProjectForm
        mode="edit"
        projectId={project.id}
        initialValues={{
          name: project.name,
          description: project.description ?? "",
          objective: project.objective,
          project_type: project.project_type,
          status: project.status,
          start_date: project.start_date,
          end_date: project.end_date ?? "",
          final_result: project.final_result ?? "",
        }}
      />
    </div>
  );
}
