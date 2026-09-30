import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTeamMember } from "@/lib/queries/roster";
import { SESSION_AREA_LABELS, type SessionArea } from "@/lib/queries/sessions";
import { getSpecializedRecord } from "@/lib/queries/specialized-records";
import { getEvidenceForSession } from "@/lib/queries/evidence";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteSessionButton } from "@/components/session-delete-button";
import { EvidenceIcon } from "@/components/evidence-icon";
import {
  ArrowLeft,
  PencilSimple,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

type SessionDetail = {
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
  created_at: string;
  area: SessionArea | null;
  start_time: string | null;
  end_time: string | null;
  session_participants: { team_members: { id: string; full_name: string; nickname: string | null } }[];
  // Solo relevante cuando area = 'team' (Fase 4, regla 4): la actividad
  // general de Equipo, sin specialized_record equivalente.
  session_categories: { categories: { label: string } }[];
  projects: { id: string; name: string } | null;
  project_iterations: { id: string; sequence: number; name: string | null } | null;
};

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

export default async function SesionDetailPage({
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
         problem_description, decision, learning, next_step, created_at,
         area, start_time, end_time,
         session_participants(team_members(id, full_name, nickname)),
         session_categories(categories(label)),
         projects(id, name),
         project_iterations(id, sequence, name)`
      )
      .eq("id", id)
      .maybeSingle<SessionDetail>(),
    getCurrentTeamMember(supabase),
  ]);

  if (error || !session) notFound();

  // Incondicional a propósito: si el área no es técnica esto siempre
  // devuelve null (el trigger de 0005 lo garantiza) — no hace falta
  // ramificar antes de pedirlo.
  const specializedRecord = await getSpecializedRecord(supabase, id);

  const canEdit =
    !!currentMember &&
    (currentMember.id === session.created_by || currentMember.role === "admin");

  let evidence: Awaited<ReturnType<typeof getEvidenceForSession>> = [];
  let evidenceErrorMessage: string | null = null;
  try {
    evidence = await getEvidenceForSession(supabase, id);
  } catch (evidenceError) {
    evidenceErrorMessage =
      evidenceError instanceof Error ? evidenceError.message : String(evidenceError);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/sesiones"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Sesiones
        </Link>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/sesiones/${session.id}/editar`}>
                <PencilSimple className="size-4" aria-hidden />
                Editar
              </Link>
            </Button>
            <DeleteSessionButton sessionId={session.id} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-data text-sm text-muted-foreground">
          {new Date(`${session.session_date}T00:00:00`).toLocaleDateString("es-MX", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <h1 className="font-heading text-2xl font-semibold">{session.objective}</h1>
        <div className="flex flex-wrap gap-1.5">
          {/* sessions.area es la única fuente de verdad del área (Fase 4/5):
              sin respaldo de session_categories como área — la estructura
              actual no necesita compatibilidad con el modelo histórico.
              Equipo sí sigue usando session_categories, pero solo para su
              actividad general (Fase 4, regla 4), no como área. */}
          {session.area && (
            <Badge variant="secondary">{SESSION_AREA_LABELS[session.area]}</Badge>
          )}
          {specializedRecord && (
            <Badge variant="outline">{specializedRecord.work_type}</Badge>
          )}
          {session.area === "team" && session.session_categories[0] && (
            <Badge variant="outline">
              {session.session_categories[0].categories.label}
            </Badge>
          )}
          {session.had_problem && (
            <Badge variant="outline" className="border-warning text-warning">
              Con problema
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Participantes:{" "}
          {session.session_participants
            ?.map((p) => p.team_members.nickname || p.team_members.full_name)
            .join(", ")}
        </p>
      </div>

      {/* Contexto de proyecto/iteración: solo se muestra si existe, para
          no dejar una sección vacía en sesiones independientes. */}
      {session.projects && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">
              Proyecto
            </span>
            <Link
              href={`/proyectos/${session.projects.id}`}
              className="text-sm text-foreground hover:underline"
            >
              {session.projects.name}
            </Link>
          </div>
          {session.project_iterations && (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground">
                Iteración
              </span>
              <Link
                href={`/proyectos/${session.projects.id}/iteraciones/${session.project_iterations.id}`}
                className="text-sm text-foreground hover:underline"
              >
                Iteración {session.project_iterations.sequence}
                {session.project_iterations.name
                  ? ` · ${session.project_iterations.name}`
                  : ""}
              </Link>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <Field label="¿Qué ocurrió?" value={session.what_happened} />
          <Field label="¿Qué problema encontramos?" value={session.problem_description} />
          <Field label="Decisión o solución" value={session.decision} />
          <Field label="Aprendizaje" value={session.learning} />
          <Field label="Siguiente paso" value={session.next_step} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Evidencia</h2>
        {evidenceErrorMessage && (
          <Card className="border-warning/40">
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <Warning className="mt-1 size-5 shrink-0 text-warning" aria-hidden />
              <div>
                <CardDescription>
                  No se pudo cargar la evidencia de esta sesión. Detalle:{" "}
                  {evidenceErrorMessage}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}
        {!evidenceErrorMessage && evidence.length === 0 && (
          <Card>
            <CardHeader>
              <CardDescription>
                No se agregó evidencia a esta sesión.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        <ul className="flex flex-col gap-2">
          {evidence.map((item) => (
            <li key={item.id}>
              <a
                href={item.href ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
              >
                <EvidenceIcon
                  kind={item.kind}
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="truncate">{item.title || item.href}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
