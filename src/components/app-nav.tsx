"use client";

import { useState } from "react";
import Link from "next/link";
import { List } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SignOutButton } from "@/components/sign-out-button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/sesiones", label: "Sesiones" },
  { href: "/proyectos", label: "Proyectos" },
];

export function AppNav() {
  // Controla el Sheet manualmente (mismo patrón ya usado para el Dialog de
  // confirmación en session-delete-button.tsx) para poder cerrarlo al
  // navegar, además del cierre automático por overlay/Escape/botón X que
  // Radix ya maneja solo con onOpenChange.
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Escritorio/tablet: navegación en línea, igual que antes. */}
      <nav className="hidden items-center gap-4 text-sm sm:flex">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-muted-foreground hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
        <SignOutButton />
      </nav>

      {/* Móvil: un botón de menú abre un Sheet real — no se depende de
          flex-wrap para que la navegación quepa en pantallas angostas. */}
      <div className="flex sm:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              aria-label="Abrir menú de navegación"
            >
              <List className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Menú</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-3 text-base text-foreground hover:bg-accent"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2 border-t border-border p-4">
              <SignOutButton />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
