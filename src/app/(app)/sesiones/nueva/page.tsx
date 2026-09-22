import { createClient } from "@/lib/supabase/server";
import { getCurrentTeamMember, getActiveRoster } from "@/lib/queries/roster";
import { getActiveCategories } from "@/lib/queries/categories";
import { getActiveSeason } from "@/lib/queries/seasons";
import { SessionWizard } from "@/components/session-wizard/session-wizard";
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

export default async function NuevaSesionPage() {
  const supabase = await createClient();

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

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <SessionWizard
        teamMember={teamMember}
        roster={roster}
        areas={categories.areas}
        activityTypes={categories.activityTypes}
        seasonId={season.id}
      />
    </div>
  );
}
