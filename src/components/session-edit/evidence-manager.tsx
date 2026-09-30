"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Image as ImageIcon,
  VideoCamera,
  Paperclip,
  LinkSimple,
  Trash,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EvidenceIcon } from "@/components/evidence-icon";
import { evidenceLinkSchema } from "@/lib/validation/session";
import { validateEvidenceFile } from "@/lib/validation/evidence-file";
import {
  createEvidenceSignedUrl,
  deleteEvidence,
  insertEvidenceLink,
  uploadEvidenceFile,
  type EvidenceWithUrl,
} from "@/lib/queries/evidence";

// Gestión de evidencia YA guardada (sesión existente). A diferencia de
// EvidenceStep (borrador antes de crear la sesión, con subida diferida
// al guardar todo el wizard), aquí cada acción sucede de inmediato y es
// completamente independiente del resto del formulario de edición: no
// forma parte de su `state`, así que editar otros campos y guardar nunca
// toca la evidencia (Fase 5, Parte A4).
export function EvidenceManager({
  sessionId,
  seasonId,
  uploadedBy,
  initialEvidence,
}: {
  sessionId: string;
  seasonId: string;
  uploadedBy: string;
  initialEvidence: EvidenceWithUrl[];
}) {
  const [items, setItems] = useState<EvidenceWithUrl[]>(initialEvidence);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<EvidenceWithUrl | null>(null);
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const photoCaptureRef = useRef<HTMLInputElement>(null);
  const photoUploadRef = useRef<HTMLInputElement>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(kind: "photo" | "video" | "file", file: File) {
    const validation = validateEvidenceFile(file, kind);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    setUploading(true);
    const supabase = createClient();
    try {
      const created = await uploadEvidenceFile(supabase, {
        sessionId,
        seasonId,
        uploadedBy,
        kind,
        file,
        title: file.name,
      });
      const href = created.storage_path
        ? await createEvidenceSignedUrl(supabase, created.storage_path)
        : created.external_url;
      setItems((current) => [...current, { ...created, href }]);
      toast.success("Evidencia agregada.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo subir la evidencia."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleAddLink() {
    const parsed = evidenceLinkSchema.safeParse({ url: linkUrl });
    if (!parsed.success) {
      setLinkError(parsed.error.issues[0]?.message ?? "Enlace inválido.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    try {
      const created = await insertEvidenceLink(supabase, {
        sessionId,
        uploadedBy,
        url: parsed.data.url,
        title: parsed.data.title ?? parsed.data.url,
      });
      setItems((current) => [
        ...current,
        { ...created, href: created.external_url },
      ]);
      setLinkUrl("");
      setLinkError(null);
      setLinkFormOpen(false);
      toast.success("Enlace agregado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo agregar el enlace."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setDeletingId(target.id);
    const supabase = createClient();
    try {
      await deleteEvidence(supabase, target);
      setItems((current) => current.filter((item) => item.id !== target.id));
      toast.success("Evidencia eliminada (incluido el archivo en Storage).");
    } catch (error) {
      // No se oculta el fallo: si Storage no se pudo limpiar, el registro
      // tampoco se borra (ver deleteEvidence) — el usuario ve exactamente
      // qué pasó y puede reintentar, en vez de creer que ya se eliminó.
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar la evidencia."
      );
    } finally {
      setDeletingId(null);
      setConfirmTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay evidencia agregada a esta sesión.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {item.kind === "photo" && item.href ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview de una URL firmada temporal, no un asset optimizable
                <img
                  src={item.href}
                  alt=""
                  className="size-10 shrink-0 rounded-md object-cover"
                />
              ) : (
                <EvidenceIcon
                  kind={item.kind}
                  className="size-4 shrink-0 text-muted-foreground"
                />
              )}
              <a
                href={item.href ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate hover:underline"
              >
                {item.title || item.href}
              </a>
              <button
                type="button"
                onClick={() => setConfirmTarget(item)}
                disabled={deletingId === item.id}
                className="shrink-0 text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                aria-label={`Eliminar ${item.title ?? "evidencia"}`}
              >
                <Trash className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => photoCaptureRef.current?.click()}
        >
          <Camera className="size-4" aria-hidden />
          Tomar foto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => photoUploadRef.current?.click()}
        >
          <ImageIcon className="size-4" aria-hidden />
          Subir foto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => videoUploadRef.current?.click()}
        >
          <VideoCamera className="size-4" aria-hidden />
          Subir video
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => fileUploadRef.current?.click()}
        >
          <Paperclip className="size-4" aria-hidden />
          Adjuntar archivo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={uploading}
          onClick={() => setLinkFormOpen((open) => !open)}
        >
          <LinkSimple className="size-4" aria-hidden />
          Pegar enlace
        </Button>
      </div>

      {uploading && (
        <p className="text-sm text-muted-foreground">Subiendo…</p>
      )}

      <input
        ref={photoCaptureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected("photo", file);
          e.target.value = "";
        }}
      />
      <input
        ref={photoUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected("photo", file);
          e.target.value = "";
        }}
      />
      <input
        ref={videoUploadRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected("video", file);
          e.target.value = "";
        }}
      />
      <input
        ref={fileUploadRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected("file", file);
          e.target.value = "";
        }}
      />

      {linkFormOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Input
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              aria-invalid={!!linkError}
              disabled={uploading}
            />
            {linkError && (
              <p className="mt-1 text-sm text-destructive">{linkError}</p>
            )}
          </div>
          <Button type="button" size="sm" onClick={handleAddLink} disabled={uploading}>
            Agregar
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Fotos y videos hasta 50 MB por archivo.
      </p>

      <Dialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar esta evidencia?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará el archivo del
              almacenamiento (si tiene uno) y su registro.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmTarget(null)}
              disabled={!!deletingId}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={!!deletingId}
            >
              {deletingId ? "Eliminando…" : "Sí, eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
