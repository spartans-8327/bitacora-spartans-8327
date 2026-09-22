"use client";

import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };

export function ChipPicker({
  options,
  selectedIds,
  onToggle,
}: {
  options: Option[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((option) => {
        const selected = selectedIds.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(option.id)}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            {selected && <Check className="size-4" weight="bold" aria-hidden />}
            {option.label}
          </button>
        );
      })}
      {options.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin opciones disponibles.
        </p>
      )}
    </div>
  );
}
