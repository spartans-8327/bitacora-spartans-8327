"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  Image as ImageIcon,
  VideoCamera,
  Paperclip,
  LinkSimple,
  X,
  FileText,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { evidenceLinkSchema } from "@/lib/validation/session";
import { validateEvidenceFile } from "@/lib/validation/evidence-file";
import type { EvidenceDraft } from "./types";

function iconFor(kind: EvidenceDraft["kind"]) {
  switch (kind) {
    case "photo":
      return ImageIcon;
    case "video":
      return VideoCamera;
    case "link":
      return LinkSimple;
    default:
      return FileText;
  }
}

export function EvidenceStep({
  items,
  onChange,
  progressLabel,
  disabled = false,
}: {
  items: EvidenceDraft[];
  onChange: (items: EvidenceDraft[]) => void;
  progressLabel?: string;
  disabled?: boolean;
}) {
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const photoCaptureRef = useRef<HTMLInputElement>(null);
  const photoUploadRef = useRef<HTMLInputElement>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  // Referencia siempre actualizada de `items`, usada solo para liberar los
  // object URLs de preview al desmontar el componente (limpieza única). El
  // ref se sincroniza en un efecto (nunca durante el render) y se lee en
  // el efecto de limpieza de desmontaje.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  function addFile(kind: "photo" | "video" | "file", file: File) {
    const validation = validateEvidenceFile(file, kind);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    const previewUrl = kind === "photo" ? URL.createObjectURL(file) : undefined;
    onChange([
      ...items,
      {
        clientId: crypto.randomUUID(),
        kind,
        file,
        title: file.name,
        status: "pending",
        previewUrl,
      },
    ]);
  }

  function addLink() {
    const parsed = evidenceLinkSchema.safeParse({ url: linkUrl });
    if (!parsed.success) {
      setLinkError(parsed.error.issues[0]?.message ?? "Enlace inválido.");
      return;
    }
    onChange([
      ...items,
      {
        clientId: crypto.randomUUID(),
        kind: "link",
        url: parsed.data.url,
        title: parsed.data.url,
        status: "pending",
      },
    ]);
    setLinkUrl("");
    setLinkError(null);
    setLinkFormOpen(false);
  }

  function removeItem(clientId: string) {
    const target = items.find((item) => item.clientId === clientId);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(items.filter((item) => item.clientId !== clientId));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
          onClick={() => setLinkFormOpen((open) => !open)}
        >
          <LinkSimple className="size-4" aria-hidden />
          Pegar enlace
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Fotos y videos hasta 50 MB por archivo.
      </p>

      {/* Inputs de archivo ocultos, disparados por los botones de arriba. */}
      <input
        ref={photoCaptureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) addFile("photo", file);
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
          if (file) addFile("photo", file);
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
          if (file) addFile("video", file);
          e.target.value = "";
        }}
      />
      <input
        ref={fileUploadRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) addFile("file", file);
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
              disabled={disabled}
            />
            {linkError && (
              <p className="mt-1 text-sm text-destructive">{linkError}</p>
            )}
          </div>
          <Button type="button" size="sm" onClick={addLink} disabled={disabled}>
            Agregar
          </Button>
        </div>
      )}

      {progressLabel && (
        <p className="text-sm font-medium text-foreground">{progressLabel}</p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const Icon = iconFor(item.kind);
            return (
              <li
                key={item.clientId}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preview local de un File, no un asset optimizable
                    <img
                      src={item.previewUrl}
                      alt=""
                      className="size-10 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <Icon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <span className="flex-1 truncate">{item.title}</span>
                  {item.status === "uploading" && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Subiendo…
                    </span>
                  )}
                  {item.status === "done" && (
                    <CheckCircle
                      className="size-4 shrink-0 text-success"
                      weight="fill"
                      aria-label="Subido correctamente"
                    />
                  )}
                  {item.status === "error" && (
                    <WarningCircle
                      className="size-4 shrink-0 text-destructive"
                      weight="fill"
                      aria-label="Error al subir"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item.clientId)}
                    disabled={disabled || item.status === "uploading"}
                    className="shrink-0 text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                    aria-label={`Quitar ${item.title}`}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                {item.status === "error" && item.errorMessage && (
                  <p className="text-xs text-destructive">{item.errorMessage}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.length === 0 && !linkFormOpen && (
        <p className="text-sm text-muted-foreground">
          No es obligatorio agregar evidencia ahora — puedes omitir este paso
          y continuar.
        </p>
      )}
    </div>
  );
}
