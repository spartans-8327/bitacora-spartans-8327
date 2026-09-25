import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/lib/queries/projects";
import { getCurrentTeamMember } from "@/lib/queries/roster";
import { getNextIterationSequence } from "@/lib/queries/project-iterations";
import { IterationForm } from "@/components/project/iteration-form";
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

export default async function NuevaIteracionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // El proyecto se resuelve por el id de la URL — nunca se acepta un
  // project_id enviado desde un input. getProjectById ya lo valida contra
  // Supabase (y su RLS) antes de que exista cualquier formulario.
  let project;
  let teamMember;
  try {
    [project, teamMember] = await Promise.all([
      getProjectById(supabase, id),
      getCurrentTeamMember(supabase),
    ]);
  } catch (error) {
    return (
      <BlockedState
        title="No se pudo cargar la información necesaria"
        description={`Detalle: ${
          error instanceof Error ? error.message : String(error)
        }`}
      />
    );
  }

  if (!project) notFound();

  if (!teamMember) {
    return (
      <BlockedState
        title="Tu cuenta todavía no está vinculada a un perfil del roster"
        description="Pide a un administrador que vincule tu cuenta a tu nombre en team_members antes de registrar iteraciones."
      />
    );
  }

  let nextSequence: number;
  try {
    nextSequence = await getNextIterationSequence(supabase, project.id);
  } catch (error) {
    return (
      <BlockedState
        title="No se pudo calcular el número de iteración"
        description={`Detalle: ${
          error instanceof Error ? error.message : String(error)
        }`}
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
          {project.name}
        </Link>
        <h1 className="font-heading text-lg font-semibold">Nueva iteración</h1>
      </div>
      <IterationForm
        mode="create"
        projectId={project.id}
        teamMemberId={teamMember.id}
        nextSequenceHint={nextSequence}
      />
    </div>
  );
}
