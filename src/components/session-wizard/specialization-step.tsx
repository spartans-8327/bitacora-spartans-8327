"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  designWorkTypes,
  mechanicalWorkTypes,
  programmingWorkTypes,
  marketingWorkTypes,
  type SpecializationArea,
  type SpecializationStatus,
} from "@/lib/validation/specialized-record";
import { ChipPicker } from "./chip-picker";
import { DictationTextarea } from "./dictation-textarea";
import type { SpecializationDraft } from "./types";

// Vocabulario de "tipo de trabajo" por área técnica. Los valores YA son
// las etiquetas en español (así están definidos en specialized-record.ts,
// a diferencia de project_type/session_area que usan claves en inglés) —
// no se traducen ni se duplican aquí.
const WORK_TYPES_BY_AREA: Record<SpecializationArea, readonly string[]> = {
  design: designWorkTypes,
  mechanical: mechanicalWorkTypes,
  programming: programmingWorkTypes,
  marketing: marketingWorkTypes,
};

const STATUS_OPTIONS: { id: SpecializationStatus; label: string }[] = [
  { id: "in_progress", label: "En progreso" },
  { id: "completed", label: "Terminado" },
  { id: "blocked", label: "Bloqueado" },
];

// Paso de especialización (Fase 4, Bloque de integración del wizard).
// Cubre work_type/subject/status/blocked_reason/blocked_needs — las
// columnas estructuradas de specialized_records. Los campos específicos
// de cada área que viven en `details` (validación de diseño, fabricación/
// pruebas mecánicas, referencia técnica de programación, sub-entidades de
// marketing) se dejan para el siguiente bloque a propósito: ya están
// definidos en specialized-record.ts, pero mostrar los ~40+ campos de las
// 4 áreas de una sola vez sería la "encuesta extensa" que la Fase 4 pide
// evitar. `details: {}` es válido contra los 4 esquemas mientras tanto.
export function SpecializationStep({
  area,
  value,
  onChange,
}: {
  area: SpecializationArea;
  value: SpecializationDraft;
  onChange: (patch: Partial<SpecializationDraft>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Tipo de trabajo</Label>
        <ChipPicker
          options={WORK_TYPES_BY_AREA[area].map((label) => ({
            id: label,
            label,
          }))}
          selectedIds={value.workType ? [value.workType] : []}
          onToggle={(id) =>
            onChange({ workType: value.workType === id ? "" : id })
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="specialization-subject">¿Sobre qué trabajaron?</Label>
        <Input
          id="specialization-subject"
          value={value.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          placeholder="p. ej. chasis, garra, sistema de visión, campaña de redes…"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Estado</Label>
        <ChipPicker
          options={STATUS_OPTIONS}
          selectedIds={value.status ? [value.status] : []}
          onToggle={(id) =>
            onChange({
              status: id as SpecializationStatus,
              // Cambiar de estado fuera de "bloqueado" limpia el motivo y
              // la necesidad — igual que exige el CHECK de la base de
              // datos (0005): no deben quedar datos de bloqueo colgados.
              ...(id !== "blocked"
                ? { blockedReason: "", blockedNeeds: "" }
                : {}),
            })
          }
        />
      </div>

      {value.status === "blocked" && (
        <>
          <DictationTextarea
            id="specialization-blocked-reason"
            label="¿Qué impide continuar?"
            value={value.blockedReason}
            onChange={(v) => onChange({ blockedReason: v })}
            required
          />
          <DictationTextarea
            id="specialization-blocked-needs"
            label="¿Qué necesitan para continuar?"
            value={value.blockedNeeds}
            onChange={(v) => onChange({ blockedNeeds: v })}
            required
          />
        </>
      )}
    </div>
  );
}
