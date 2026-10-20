"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { error } = await authClient.signIn.username({
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (error) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-2 shadow-[inset_0_5px_0_var(--primary)] duration-300 [--card-spacing:--spacing(6)]">
      <CardHeader className="text-center">
        <BrandMark decorative className="mx-auto mb-3 h-28" />
        <CardTitle className="text-xl">Transportes El Imperio</CardTitle>
        <span className="mt-1 flex items-center justify-center gap-2">
          <span aria-hidden className="h-px w-4 bg-brand" />
          <span className="micro-label">Control de Flota</span>
          <span aria-hidden className="h-px w-4 bg-brand" />
        </span>
        <CardDescription className="mt-2">
          Ingresa con tu usuario y contraseña para continuar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="mt-1 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              className="h-11"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              className="h-11"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="mt-1 h-11" disabled={pending}>
            {pending ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
