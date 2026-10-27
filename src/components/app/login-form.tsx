"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const { error } = await authClient.signIn.username({
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      rememberMe: form.get("remember") === "on",
    });
    setPending(false);
    if (error) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="username"
            className="text-sm font-medium text-foreground"
          >
            Usuario
          </Label>
          <Input
            id="username"
            className="h-12 rounded-lg border-2 border-input bg-card shadow-none transition-colors hover:border-muted-foreground/60 focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-plate px-4 text-base"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            required
          />
        </div>

        <div className="flex flex-col">
          <Label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Contraseña
          </Label>
          <div className="relative">
            <Input
              id="password"
              className="h-12 rounded-lg border-2 border-input bg-card shadow-none transition-colors hover:border-muted-foreground/60 focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-plate pr-12 pl-4 text-base"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              aria-describedby={capsLock ? "caps-lock" : undefined}
              onKeyUp={trackCapsLock}
              onKeyDown={trackCapsLock}
              onBlur={() => setCapsLock(false)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          </div>
          {capsLock ? (
            <p
              id="caps-lock"
              className="text-sm font-medium text-warn-foreground"
            >
              Tienes activadas las mayúsculas.
            </p>
          ) : null}
        </div>
      </div>

      <label className="mt-3 flex min-h-11 items-center gap-2.5 text-sm text-muted-foreground select-none">
        <input
          type="checkbox"
          name="remember"
          defaultChecked
          className="size-4"
        />
        Mantener la sesión iniciada en este equipo
      </label>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md bg-danger px-4 py-3 text-sm font-medium text-danger-foreground"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-8 flex cursor-pointer h-12 items-center justify-center gap-2 rounded-lg border-[3px] border-foreground bg-plate text-base font-black tracking-[0.04em] uppercase text-plate-foreground transition-colors hover:bg-[#f5c800] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-[#e6bc00] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <Loader2
            aria-hidden
            className="size-4 animate-spin motion-reduce:animate-none "
          />
        ) : null}
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
