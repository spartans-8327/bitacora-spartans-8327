"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function IterationDeleteButton({
  projectId,
  iterationId,
}: {
  projectId: string;
  iterationId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    // Igual que en sesiones/proyectos: RLS bloquea un DELETE afectando 0
    // filas, sin error. Pedimos las filas eliminadas para distinguir un
    // borrado real de un bloqueo silencioso de permisos. project_id se
    // exige junto con id, por la misma razón que getIterationById lo
    // hace: nunca confiar solo en el id de la URL.
    const { data: deletedRows, error } = await supabase
      .from("project_iterations")
      .delete()
      .eq("id", iterationId)
      .eq("project_id", projectId)
      .select("id");
    setDeleting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!deletedRows || deletedRows.length === 0) {
      toast.error(
        "No se pudo eliminar: ya no tienes permiso o la iteración ya no existe."
      );
      return;
    }

    setOpen(false);
    toast.success("Iteración eliminada.");
    router.push(`/proyectos/${projectId}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-1.5">
          <Trash className="size-4" aria-hidden />
          Eliminar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar esta iteración?</DialogTitle>
          <DialogDescription>
            Esta acción eliminará la iteración, pero conservará las sesiones
            asociadas al proyecto. Si existen sesiones vinculadas, dejarán de
            pertenecer a esta iteración.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Eliminando…" : "Sí, eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
