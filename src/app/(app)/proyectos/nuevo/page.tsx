import { createClient } from "@/lib/supabase/server";
import { getCurrentTeamMember } from "@/lib/queries/roster";
import { getActiveSeason } from "@/lib/queries/seasons";
import { ProjectForm } from "@/components/project/project-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Warning } from "@phosphor-icons/react/dist/ssr";

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

export default async function NuevoProyectoPage() {
  const supabase = await createClient();

  let teamMember;
  let season;
  try {
    [teamMember, season] = await Promise.all([
      getCurrentTeamMember(supabase),
      getActiveSeason(supabase),
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

  if (!teamMember) {
    return (
      <BlockedState
        title="Tu cuenta todavía no está vinculada a un perfil del roster"
        description="Pide a un administrador que vincule tu cuenta a tu nombre en team_members antes de crear proyectos."
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <ProjectForm
        mode="create"
        teamMemberId={teamMember.id}
        seasonId={season?.id ?? null}
      />
    </div>
  );
}
