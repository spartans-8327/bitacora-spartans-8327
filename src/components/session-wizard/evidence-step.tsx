"use client";

import { useRef, useState } from "react";
import {
  Camera,
  Image as ImageIcon,
  VideoCamera,
  Paperclip,
  LinkSimple,
  X,
  FileText,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { evidenceLinkSchema } from "@/lib/validation/session";
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
}: {
  items: EvidenceDraft[];
  onChange: (items: EvidenceDraft[]) => void;
}) {
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const photoCaptureRef = useRef<HTMLInputElement>(null);
  const photoUploadRef = useRef<HTMLInputElement>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  function addFile(kind: EvidenceDraft["kind"], file: File) {
    onChange([
      ...items,
      { clientId: crypto.randomUUID(), kind, file, title: file.name },
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
      },
    ]);
    setLinkUrl("");
    setLinkError(null);
    setLinkFormOpen(false);
  }

  function removeItem(clientId: string) {
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
          onClick={() => setLinkFormOpen((open) => !open)}
        >
          <LinkSimple className="size-4" aria-hidden />
          Pegar enlace
        </Button>
      </div>

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
            />
            {linkError && (
              <p className="mt-1 text-sm text-destructive">{linkError}</p>
            )}
          </div>
          <Button type="button" size="sm" onClick={addLink}>
            Agregar
          </Button>
        </div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const Icon = iconFor(item.kind);
            return (
              <li
                key={item.clientId}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1 truncate">{item.title}</span>
                <button
                  type="button"
                  onClick={() => removeItem(item.clientId)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Quitar ${item.title}`}
                >
                  <X className="size-4" aria-hidden />
                </button>
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
