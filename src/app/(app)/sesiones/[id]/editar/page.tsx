import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeamMember, getActiveRoster } from "@/lib/queries/roster";
import { getActiveCategories } from "@/lib/queries/categories";
import { SessionEditForm } from "@/components/session-edit/session-edit-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Warning } from "@phosphor-icons/react/dist/ssr";

type EditableSessionRow = {
  id: string;
  created_by: string;
  session_date: string;
  objective: string;
  what_happened: string;
  had_problem: boolean;
  problem_description: string | null;
  decision: string | null;
  learning: string | null;
  next_step: string | null;
};

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

export default async function EditarSesionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: session, error }, currentMember] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        `id, created_by, session_date, objective, what_happened, had_problem,
         problem_description, decision, learning, next_step`
      )
      .eq("id", id)
      .maybeSingle<EditableSessionRow>(),
    getCurrentTeamMember(supabase),
  ]);

  if (error || !session) notFound();

  if (
    !currentMember ||
    (currentMember.id !== session.created_by && currentMember.role !== "admin")
  ) {
    return (
      <BlockedState
        title="No puedes editar esta sesión"
        description="Solo quien registró la sesión o un administrador puede editarla."
      />
    );
  }

  let roster;
  let categories;

  try {
    [roster, categories] = await Promise.all([
      getActiveRoster(supabase),
      getActiveCategories(supabase),
    ]);
  } catch (loadError) {
    return (
      <BlockedState
        title="No se pudo cargar la información para editar"
        description={`Detalle: ${
          loadError instanceof Error ? loadError.message : String(loadError)
        }`}
      />
    );
  }

  const [participantsRes, categoriesRes] = await Promise.all([
    supabase
      .from("session_participants")
      .select("team_member_id")
      .eq("session_id", id)
      .returns<{ team_member_id: string }[]>(),
    supabase
      .from("session_categories")
      .select("category_id")
      .eq("session_id", id)
      .returns<{ category_id: string }[]>(),
  ]);

  if (participantsRes.error || categoriesRes.error) {
    return (
      <BlockedState
        title="No se pudo cargar la información para editar"
        description={`Detalle: ${
          participantsRes.error?.message ?? categoriesRes.error?.message
        }`}
      />
    );
  }

  const participantIds = (participantsRes.data ?? []).map(
    (row) => row.team_member_id
  );
  const sessionCategoryIds = (categoriesRes.data ?? []).map(
    (row) => row.category_id
  );
  const activityTypeIdSet = new Set(categories.activityTypes.map((c) => c.id));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/sesiones/${session.id}`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Cancelar
        </Link>
        <h1 className="font-heading text-lg font-semibold">Editar sesión</h1>
      </div>
      <SessionEditForm
        sessionId={session.id}
        roster={roster}
        areas={categories.areas}
        activityTypes={categories.activityTypes}
        initialValues={{
          sessionDate: session.session_date,
          participantIds,
          areaIds: sessionCategoryIds.filter(
            (cid) => !activityTypeIdSet.has(cid)
          ),
          activityTypeId:
            sessionCategoryIds.find((cid) => activityTypeIdSet.has(cid)) ??
            null,
          objective: session.objective,
          whatHappened: session.what_happened,
          hadProblem: session.had_problem,
          problemDescription: session.problem_description ?? "",
          decision: session.decision ?? "",
          learning: session.learning ?? "",
          nextStep: session.next_step ?? "",
        }}
      />
    </div>
  );
}
