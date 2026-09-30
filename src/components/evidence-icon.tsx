import {
  Image as ImageIcon,
  VideoCamera,
  Paperclip,
  LinkSimple,
  FileText,
} from "@phosphor-icons/react/dist/ssr";
import type { EvidenceKind } from "@/lib/queries/evidence";

const EVIDENCE_ICON_BY_KIND = {
  photo: ImageIcon,
  video: VideoCamera,
  file: Paperclip,
  link: LinkSimple,
  document: FileText,
  code_commit: FileText,
  other: FileText,
} as const;

// Antes duplicado como un mapeo local idéntico en sesiones/[id]/page.tsx;
// ahora es el único lugar que decide qué ícono corresponde a cada tipo
// de evidencia.
export function EvidenceIcon({
  kind,
  className,
}: {
  kind: EvidenceKind;
  className?: string;
}) {
  const Icon = EVIDENCE_ICON_BY_KIND[kind];
  return <Icon className={className} aria-hidden />;
}
