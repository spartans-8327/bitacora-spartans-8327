import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Image as ImageIcon,
  VideoCamera,
  Paperclip,
  LinkSimple,
  FileText,
} from "@phosphor-icons/react/dist/ssr";

type SessionDetail = {
  id: string;
  session_date: string;
  objective: string;
  what_happened: string;
  had_problem: boolean;
  problem_description: string | null;
  decision: string | null;
  learning: string | null;
  next_step: string | null;
  created_at: string;
  session_participants: { team_members: { id: string; full_name: string; nickname: string | null } }[];
  session_categories: { categories: { id: string; label: string; kind: string } }[];
};

type EvidenceRow = {
  id: string;
  kind: "photo" | "video" | "file" | "link" | "document" | "code_commit" | "other";
  storage_path: string | null;
  external_url: string | null;
  title: string | null;
};

const EVIDENCE_ICON = {
  photo: ImageIcon,
  video: VideoCamera,
  file: Paperclip,
  link: LinkSimple,
  document: FileText,
  code_commit: FileText,
  other: FileText,
} as const;

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

  const { data: session, error } = await supabase
    .from("sessions")
    .select(
      `id, session_date, objective, what_happened, had_problem,
       problem_description, decision, learning, next_step, created_at,
       session_participants(team_members(id, full_name, nickname)),
       session_categories(categories(id, label, kind))`
    )
    .eq("id", id)
    .maybeSingle<SessionDetail>();

  if (error || !session) notFound();

  const { data: evidenceRows } = await supabase
    .from("evidence")
    .select("id, kind, storage_path, external_url, title")
    .eq("session_id", id)
    .returns<EvidenceRow[]>();

  const evidence = await Promise.all(
    (evidenceRows ?? []).map(async (item) => {
      if (!item.storage_path) return { ...item, href: item.external_url };
      const { data: signed } = await supabase.storage
        .from("evidence")
        .createSignedUrl(item.storage_path, 60 * 60);
      return { ...item, href: signed?.signedUrl ?? null };
    })
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <Link
        href="/sesiones"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Sesiones
      </Link>

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
          {session.session_categories?.map(({ categories: category }) => (
            <Badge key={category.id} variant="secondary">
              {category.label}
            </Badge>
          ))}
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
        {evidence.length === 0 && (
          <Card>
            <CardHeader>
              <CardDescription>
                No se agregó evidencia a esta sesión.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        <ul className="flex flex-col gap-2">
          {evidence.map((item) => {
            const Icon = EVIDENCE_ICON[item.kind];
            return (
              <li key={item.id}>
                <a
                  href={item.href ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{item.title || item.href}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
