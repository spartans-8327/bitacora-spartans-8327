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

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    // Igual que en la edición: RLS bloquea un DELETE afectando 0 filas,
    // sin error. Pedimos las filas eliminadas para distinguir un borrado
    // real de un bloqueo silencioso de permisos.
    const { data: deletedRows, error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId)
      .select("id");
    setDeleting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!deletedRows || deletedRows.length === 0) {
      toast.error(
        "No se pudo eliminar: ya no tienes permiso o la sesión ya no existe."
      );
      return;
    }

    setOpen(false);
    toast.success("Sesión eliminada.");
    router.push("/sesiones");
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
          <DialogTitle>¿Eliminar esta sesión?</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Se eliminará el registro de la
            sesión y sus vínculos de evidencia (los archivos ya subidos no se
            borran automáticamente del almacenamiento).
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
