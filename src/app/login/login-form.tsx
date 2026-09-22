"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const credentialsSchema = z.object({
  email: z.string().email("Escribe un correo válido."),
  password: z.string().min(8, "Mínimo 8 caracteres."),
});

type Credentials = z.infer<typeof credentialsSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
  });

  async function onSubmit(values: Credentials) {
    setSubmitting(true);
    const supabase = createClient();

    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword(values)
        : await supabase.auth.signUp(values);

    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (mode === "sign-up") {
      toast.success(
        "Cuenta creada. Un administrador del equipo debe vincularla a tu " +
          "perfil del roster antes de que veas tu información."
      );
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-heading">Bitácora SPARTANS 8327</CardTitle>
        <CardDescription>
          {mode === "sign-in"
            ? "Inicia sesión con tu cuenta de equipo."
            : "Crea tu cuenta de equipo."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as typeof mode)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="sign-in" className="flex-1">
              Iniciar sesión
            </TabsTrigger>
            <TabsTrigger value="sign-up" className="flex-1">
              Crear cuenta
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nombre@ejemplo.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              aria-invalid={!!errors.password}
              aria-describedby={
                errors.password ? "password-error" : undefined
              }
              {...register("password")}
            />
            {errors.password && (
              <p id="password-error" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting
              ? "Procesando…"
              : mode === "sign-in"
                ? "Iniciar sesión"
                : "Crear cuenta"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          El acceso público (sin cuenta) puede consultar la información en{" "}
          <span className="font-medium text-foreground">spartans_8327</span>.
        </p>
      </CardFooter>
    </Card>
  );
}
