import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getVisibleProjects,
  PROJECT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  type Project,
} from "@/lib/queries/projects";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Warning, FolderOpen } from "@phosphor-icons/react/dist/ssr";

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ProyectosPage() {
  const supabase = await createClient();

  let projects: Project[] = [];
  let loadError: string | null = null;
  try {
    projects = await getVisibleProjects(supabase);
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Proyectos</h1>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/proyectos/nuevo">
            <Plus className="size-4" aria-hidden />
            Nuevo proyecto
          </Link>
        </Button>
      </div>

      {loadError && (
        <Card className="border-warning/40">
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <Warning className="mt-1 size-5 shrink-0 text-warning" aria-hidden />
            <div>
              <CardTitle className="text-base">
                No se pudieron cargar los proyectos
              </CardTitle>
              <CardDescription>Detalle: {loadError}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {!loadError && projects.length === 0 && (
        <Card>
          <CardHeader className="flex-row items-start gap-3 space-y-0">
            <FolderOpen
              className="mt-1 size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div>
              <CardTitle className="text-base">
                Todavía no hay proyectos
              </CardTitle>
              <CardDescription>
                Registra el primero con &quot;Nuevo proyecto&quot;.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {projects.map((project) => (
          <li key={project.id}>
            <Link href={`/proyectos/${project.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-heading text-base">
                      {project.name}
                    </CardTitle>
                    <Badge variant="secondary">
                      {PROJECT_STATUS_LABELS[project.status]}
                    </Badge>
                  </div>
                  <CardDescription className="text-foreground">
                    {project.objective}
                  </CardDescription>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Badge variant="outline">
                      {PROJECT_TYPE_LABELS[project.project_type]}
                    </Badge>
                    <span className="font-data text-xs text-muted-foreground">
                      Desde {formatDate(project.start_date)}
                      {project.end_date
                        ? ` · hasta ${formatDate(project.end_date)}`
                        : ""}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
