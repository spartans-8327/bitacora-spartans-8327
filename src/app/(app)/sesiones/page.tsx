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
import { Plus, Warning, CalendarBlank } from "@phosphor-icons/react/dist/ssr";

type SessionListRow = {
  id: string;
  session_date: string;
  objective: string;
  had_problem: boolean;
  session_participants: { team_members: { full_name: string; nickname: string | null } }[];
  session_categories: { categories: { id: string; label: string; kind: string } }[];
};

export default async function SesionesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sessions")
    .select(
      `id, session_date, objective, had_problem,
       session_participants(team_members(full_name, nickname)),
       session_categories(categories(id, label, kind))`
    )
    .order("session_date", { ascending: false })
    .returns<SessionListRow[]>();

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

      {error && (
        <Card className="border-warning/40">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <Warning className="mt-1 size-5 shrink-0 text-warning" aria-hidden />
            <div>
              <CardTitle className="text-base">
                No se pudieron cargar las sesiones
              </CardTitle>
              <CardDescription>
                Detalle: {error.message}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {!error && data && data.length === 0 && (
        <Card>
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <CalendarBlank className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <CardTitle className="text-base">Todavía no hay sesiones</CardTitle>
              <CardDescription>
                Registra la primera con &quot;Nueva sesión&quot;.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {data?.map((session) => (
          <li key={session.id}>
            <Link href={`/sesiones/${session.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-data font-normal text-muted-foreground">
                      {new Date(`${session.session_date}T00:00:00`).toLocaleDateString(
                        "es-MX",
                        { day: "numeric", month: "long", year: "numeric" }
                      )}
                    </CardTitle>
                    {session.had_problem && (
                      <Badge variant="outline" className="border-warning text-warning">
                        Con problema
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-foreground">
                    {session.objective}
                  </CardDescription>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {session.session_categories?.map(({ categories: category }) => (
                      <Badge key={category.id} variant="secondary">
                        {category.label}
                      </Badge>
                    ))}
                  </div>
                  <p className="pt-1 text-xs text-muted-foreground">
                    {session.session_participants
                      ?.map((p) => p.team_members.nickname || p.team_members.full_name)
                      .join(", ")}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
