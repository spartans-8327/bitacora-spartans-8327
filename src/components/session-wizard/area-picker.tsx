"use client";

import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  SESSION_AREA_LABELS,
  TECHNICAL_SESSION_AREAS,
  type SessionArea,
} from "@/lib/queries/sessions";

function AreaChip({
  area,
  selected,
  onSelect,
}: {
  area: SessionArea;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-accent"
      )}
    >
      {selected && <Check className="size-4" weight="bold" aria-hidden />}
      {SESSION_AREA_LABELS[area]}
    </button>
  );
}

// Área responsable única (Fase 4). Separa visualmente las 4 áreas
// técnicas de "Equipo" a propósito: Equipo es una categoría transversal
// para actividades colectivas, nunca una quinta área técnica — no debe
// leerse como una opción más de la misma lista.
export function AreaPicker({
  value,
  onChange,
}: {
  value: SessionArea | null;
  onChange: (area: SessionArea) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          Áreas técnicas
        </p>
        <div className="flex flex-wrap gap-2" role="group">
          {TECHNICAL_SESSION_AREAS.map((area) => (
            <AreaChip
              key={area}
              area={area}
              selected={value === area}
              onSelect={() => onChange(area)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-sm font-medium text-muted-foreground">
          Actividad colectiva
        </p>
        <div className="flex flex-wrap gap-2" role="group">
          <AreaChip
            area="team"
            selected={value === "team"}
            onSelect={() => onChange("team")}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Para armar/desmontar cancha, logística, limpieza, montaje o
          reuniones generales. No es una quinta área técnica.
        </p>
      </div>
    </div>
  );
}
