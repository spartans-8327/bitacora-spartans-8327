import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Warning, Plus } from "@phosphor-icons/react/dist/ssr";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: teamMember, error } = user
    ? await supabase
        .from("team_members")
        .select("id, full_name, role")
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null, error: null };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      {error && (
        <Card className="border-warning/40">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <Warning className="mt-1 size-5 shrink-0 text-warning" aria-hidden />
            <div>
              <CardTitle className="text-base">
                El esquema de base de datos todavía no está aplicado
              </CardTitle>
              <CardDescription>
                Este error es esperado si aún no ejecutaste{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  supabase/migrations/0001_core_schema.sql
                </code>{" "}
                y{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  supabase/seed.sql
                </code>{" "}
                en el SQL Editor de tu proyecto. Detalle: {error.message}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {!error && !teamMember && (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="text-base">
              Tu cuenta todavía no está vinculada a un perfil del roster
            </CardTitle>
            <CardDescription>
              Pide a un administrador del equipo que vincule tu cuenta (
              {user?.email}) a tu nombre en <code>team_members</code>. Sin
              eso no puedes registrar sesiones todavía.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {teamMember && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Hola, {teamMember.full_name}
              </CardTitle>
              <CardDescription>
                Rol: {teamMember.role === "admin" ? "Administrador" : "Miembro"}
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-1.5">
              <Link href="/sesiones/nueva">
                <Plus className="size-4" aria-hidden />
                Nueva sesión
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sesiones">Ver sesiones</Link>
            </Button>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximo en construirse</CardTitle>
          <CardDescription>
            Proyectos, registros especializados, evidencia avanzada y
            análisis todavía no existen — son la Fase 3 en adelante del
            plan aprobado.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
