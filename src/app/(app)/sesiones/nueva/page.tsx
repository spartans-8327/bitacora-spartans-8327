import { createClient } from "@/lib/supabase/server";
import { getCurrentTeamMember, getActiveRoster } from "@/lib/queries/roster";
import { getActiveCategories } from "@/lib/queries/categories";
import { getActiveSeason } from "@/lib/queries/seasons";
import { getProjectById } from "@/lib/queries/projects";
import { getIterationById } from "@/lib/queries/project-iterations";
import {
  SessionWizard,
  type SessionWizardContext,
} from "@/components/session-wizard/session-wizard";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Warning } from "@phosphor-icons/react/dist/ssr";

function BlockedState({ title, description }: { title: string; description: string }) {
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

export default async function NuevaSesionPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; iterationId?: string }>;
}) {
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;

  let teamMember;
  let season;
  let categories;
  let roster;

  try {
    [teamMember, season, categories, roster] = await Promise.all([
      getCurrentTeamMember(supabase),
      getActiveSeason(supabase),
      getActiveCategories(supabase),
      getActiveRoster(supabase),
    ]);
  } catch (error) {
    return (
      <BlockedState
        title="El esquema de base de datos todavía no está aplicado"
        description={`Aplica supabase/migrations/0001_core_schema.sql y 0002_sessions_and_evidence.sql antes de registrar sesiones. Detalle: ${
          error instanceof Error ? error.message : String(error)
        }`}
      />
    );
  }

  if (!teamMember) {
    return (
      <BlockedState
        title="Tu cuenta todavía no está vinculada a un perfil del roster"
        description="Pide a un administrador que vincule tu cuenta a tu nombre en team_members antes de registrar sesiones."
      />
    );
  }

  if (!season) {
    return (
      <BlockedState
        title="No hay una temporada activa"
        description="Un administrador debe marcar una temporada como activa en la tabla seasons."
      />
    );
  }

  // Contexto opcional de proyecto/iteración (?projectId=...&iterationId=...).
  // Se valida aquí, en el servidor — el wizard nunca ofrece un selector
  // para esto. Si el proyecto no existe/no es visible, o si la iteración
  // no pertenece realmente a ese proyecto, el contexto correspondiente se
  // descarta silenciosamente: la sesión sigue siendo válida, solo se crea
  // sin ese vínculo en vez de mostrar un error duro que bloquee registrar
  // una sesión independiente.
  let context: SessionWizardContext | undefined;
  try {
    const { projectId, iterationId } = resolvedSearchParams;
    if (projectId) {
      const contextProject = await getProjectById(supabase, projectId);
      if (contextProject) {
        context = {
          projectId: contextProject.id,
          projectName: contextProject.name,
        };
        if (iterationId) {
          const contextIteration = await getIterationById(
            supabase,
            iterationId,
            contextProject.id
          );
          if (contextIteration) {
            context.iterationId = contextIteration.id;
            context.iterationLabel = `Iteración ${contextIteration.sequence}${
              contextIteration.name ? ` · ${contextIteration.name}` : ""
            }`;
          }
        }
      }
    }
  } catch {
    // Un fallo al resolver el contexto no debe impedir registrar una
    // sesión independiente: se ignora y el wizard se abre sin contexto.
    context = undefined;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <SessionWizard
        teamMember={teamMember}
        roster={roster}
        areas={categories.areas}
        activityTypes={categories.activityTypes}
        seasonId={season.id}
        context={context}
      />
    </div>
  );
}
