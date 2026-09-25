import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/lib/queries/projects";
import { getIterationById } from "@/lib/queries/project-iterations";
import { getCurrentTeamMember } from "@/lib/queries/roster";
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

export default async function EditarIteracionPage({
  params,
}: {
  params: Promise<{ id: string; iterId: string }>;
}) {
  const { id, iterId } = await params;
  const supabase = await createClient();

  let project;
  let iteration;
  let currentMember;
  try {
    // getIterationById exige id Y project_id en el mismo WHERE: si la
    // iteración pertenece a otro proyecto, esto devuelve null.
    [project, iteration, currentMember] = await Promise.all([
      getProjectById(supabase, id),
      getIterationById(supabase, iterId, id),
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

  if (!project || !iteration) notFound();

  // Regla de escritura real (0004): solo quien creó la iteración o un
  // admin puede editarla — a diferencia de projects, aquí NO basta con
  // ser integrante del proyecto.
  const canEdit =
    !!currentMember &&
    (currentMember.id === iteration.created_by ||
      currentMember.role === "admin");

  if (!canEdit) {
    return (
      <BlockedState
        title="No puedes editar esta iteración"
        description="Solo quien la registró o un administrador puede editarla."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/proyectos/${project.id}/iteraciones/${iteration.id}`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Cancelar
        </Link>
        <h1 className="font-heading text-lg font-semibold">
          Editar Iteración {iteration.sequence}
        </h1>
      </div>
      <IterationForm
        mode="edit"
        projectId={project.id}
        iterationId={iteration.id}
        initialValues={{
          name: iteration.name ?? "",
          objective: iteration.objective,
          hypothesis: iteration.hypothesis ?? "",
          change_made: iteration.change_made ?? "",
          test_method: iteration.test_method ?? "",
          result: iteration.result ?? "",
          decision: iteration.decision ?? "",
          learning: iteration.learning ?? "",
          next_step: iteration.next_step ?? "",
          status: iteration.status,
          started_at: iteration.started_at,
          completed_at: iteration.completed_at ?? "",
        }}
      />
    </div>
  );
}
