import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MapPin, InstagramLogo, ArrowRight } from "@phosphor-icons/react/dist/ssr";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-lg font-semibold tracking-wide">
              SPARTANS <span className="text-primary">·</span> 8327
            </span>
          </div>
          <Button asChild size="sm">
            <Link href="/login">
              Entrar
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="flex flex-col gap-4">
          {/*
            Placeholder de identidad: el logo/escudo oficial todavía no ha
            sido proporcionado por el equipo. No se genera por IA (§22/§26).
          */}
          <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            Escudo
          </div>
          <h1 className="max-w-xl font-heading text-4xl font-semibold leading-tight tracking-tight text-balance">
            Bitácora digital de temporada
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground">
            More than robots. Equipo de robótica SPARTANS · 8327, CBTIS 203.
          </p>
        </div>

        <dl className="grid max-w-lg grid-cols-1 gap-3 border-t border-border pt-6 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">
              Tecnológico 1067 Nte, San Jerónimo Chicahualco, 52172 San
              Jerónimo Chicahualco, Méx.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <InstagramLogo className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <a
              href="https://www.instagram.com/spartans_8327/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              @spartans_8327
            </a>
          </div>
        </dl>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 text-xs text-muted-foreground">
          SPARTANS · 8327 — CBTIS 203. Bitácora interna de temporada.
        </div>
      </footer>
    </div>
  );
}
