"use client";

import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TeamMember } from "@/lib/queries/roster";

export function MemberPicker({
  members,
  selectedIds,
  onChange,
}: {
  members: TeamMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const allSelected =
    members.length > 0 && members.every((m) => selectedIds.includes(m.id));

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((existing) => existing !== id)
        : [...selectedIds, id]
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          onChange(allSelected ? [] : members.map((m) => m.id))
        }
      >
        {allSelected ? "Quitar selección" : "Seleccionar todos los presentes"}
      </Button>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {members.map((member) => {
          const selected = selectedIds.includes(member.id);
          return (
            <button
              key={member.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(member.id)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent"
              )}
            >
              {selected && (
                <Check className="size-4 shrink-0" weight="bold" aria-hidden />
              )}
              <span className="truncate">
                {member.nickname || member.full_name}
              </span>
            </button>
          );
        })}
      </div>

      {members.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay miembros activos en el roster todavía.
        </p>
      )}
    </div>
  );
}
