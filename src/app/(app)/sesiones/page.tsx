import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Warning, CalendarBlank, Paperclip } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import {
  SESSION_AREAS,
  SESSION_AREA_LABELS,
  firstOrNull,
  getSessionsList,
  type SessionArea,
  type SessionListItem,
} from "@/lib/queries/sessions";

const FILTER_OPTIONS: { value: SessionArea | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "mechanical", label: "Mecánica" },
  { value: "programming", label: "Programación" },
  { value: "design", label: "Diseño" },
  { value: "marketing", label: "Marketing" },
  { value: "team", label: "Equipo" },
];

// URL inválida (?area=whatever): se ignora el filtro y se muestran todas
// — nunca un error (Fase 5, Parte D).
function isValidArea(value: string | undefined): value is SessionArea {
  return !!value && (SESSION_AREAS as readonly string[]).includes(value);
}

function formatParticipants(names: string[]): string {
  const MAX_VISIBLE = 3;
  if (names.length === 0) return "Sin participantes";
  if (names.length <= MAX_VISIBLE) return names.join(" · ");
  return `${names.slice(0, MAX_VISIBLE).join(" · ")} · +${names.length - MAX_VISIBLE}`;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SessionCard({ session }: { session: SessionListItem }) {
  // sessions.area + specialized_records.work_type son la fuente de
  // verdad para áreas técnicas (Fase 4/5). Equipo no tiene
  // specialized_record: su "tipo de trabajo" equivalente es la actividad
  // general que sigue viviendo en session_categories (Fase 4, regla 4).
  const record = firstOrNull(session.specialized_records);
  const teamActivityLabel =
    session.area === "team"
      ? session.session_categories[0]?.categories.label
      : undefined;
  const evidenceCount = firstOrNull(session.evidence)?.count ?? 0;
  const participantNames = session.session_participants.map(
    (p) => p.team_members.nickname || p.team_members.full_name
  );

  return (
    <Link href={`/sesiones/${session.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {session.area && (
                <Badge variant="secondary">{SESSION_AREA_LABELS[session.area]}</Badge>
              )}
              {record && <Badge variant="outline">{record.work_type}</Badge>}
              {teamActivityLabel && (
                <Badge variant="outline">{teamActivityLabel}</Badge>
              )}
              {session.had_problem && (
                <Badge variant="outline" className="border-warning text-warning">
                  Con problema
                </Badge>
              )}
            </div>
            <CardTitle className="shrink-0 font-data text-xs font-normal text-muted-foreground">
              {formatDate(session.session_date)}
            </CardTitle>
          </div>
          <CardDescription className="text-foreground">
            {session.objective}
          </CardDescription>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1">
            <p className="text-xs text-muted-foreground">
              {formatParticipants(participantNames)}
            </p>
            {evidenceCount > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="size-3.5" aria-hidden />
                {evidenceCount} evidencia{evidenceCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {session.projects && (
            <p className="text-xs text-muted-foreground">
              Proyecto: {session.projects.name}
              {session.project_iterations
                ? ` · Iteración ${session.project_iterations.sequence}${
                    session.project_iterations.name
                      ? ` (${session.project_iterations.name})`
                      : ""
                  }`
                : ""}
            </p>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}

export default async function SesionesPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const { area: rawArea } = await searchParams;
  const area = isValidArea(rawArea) ? rawArea : undefined;

  const supabase = await createClient();

  let sessions: SessionListItem[] = [];
  let loadError: string | null = null;
  try {
    sessions = await getSessionsList(supabase, { area });
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Sesiones</h1>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/sesiones/nueva">
            <Plus className="size-4" aria-hidden />
            Nueva sesión
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por área">
        {FILTER_OPTIONS.map((option) => {
          const isActive = option.value === "all" ? !area : area === option.value;
          const href =
            option.value === "all" ? "/sesiones" : `/sesiones?area=${option.value}`;
          return (
            <Link
              key={option.value}
              href={href}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent"
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      {loadError && (
        <Card className="border-warning/40">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <Warning className="mt-1 size-5 shrink-0 text-warning" aria-hidden />
            <div>
              <CardTitle className="text-base">
                No se pudieron cargar las sesiones
              </CardTitle>
              <CardDescription>
                Detalle: {loadError}. Recarga la página para volver a intentarlo.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {!loadError && sessions.length === 0 && (
        <Card>
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <CalendarBlank className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <CardTitle className="text-base">
                {area
                  ? "No hay sesiones registradas en esta área."
                  : "Todavía no hay sesiones registradas."}
              </CardTitle>
              {!area && (
                <CardDescription>
                  Registra la primera con &quot;Nueva sesión&quot;.
                </CardDescription>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {sessions.map((session) => (
          <li key={session.id}>
            <SessionCard session={session} />
          </li>
        ))}
      </ul>
    </div>
  );
}
