import { LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/app/brand-mark";
import { LoginForm } from "@/components/app/login-form";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Iniciar sesión · Control de Flota",
};

const VALUES = ["Seguridad en cada viaje", "Papeles al día"];

export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");

  return (
    <main className="login-theme grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Brand side: a centred poster. Logo, the plate as the hero, headline and copy beneath, road band at the foot. */}
      <section className="relative grid grid-rows-[1fr_auto] overflow-hidden bg-foreground text-background">
        <div className="flex flex-col items-center justify-between gap-8 px-5 py-8 text-center sm:px-10 lg:px-14 lg:py-10">
          <BrandMark decorative className="h-20 sm:h-24 lg:h-36" />

          <Plate />

          <div className="flex flex-col items-center gap-5">
            <h1 className="text-[clamp(2.25rem,7vw,5.5rem)] leading-[0.85] font-black tracking-[-0.045em] uppercase lg:text-[clamp(2.75rem,5vw,5.5rem)]">
              <span className="block motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-6 motion-safe:delay-300 motion-safe:fill-mode-backwards motion-safe:duration-500">
                Cada placa,
              </span>
              <span className="block text-plate motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-6 motion-safe:delay-[400ms] motion-safe:fill-mode-backwards motion-safe:duration-500">
                al día.
              </span>
            </h1>
            <p className="max-w-lg text-sm text-background/80 sm:text-base">
              Un espacio para estar pendientes de todo lo que necesitan los vehículos antes de que se venza: papeles al día, pólizas claras, impuestos pagados y los mantenimientos de aceite, cuidando la flota y asegurando que nada pare la operación.
            </p>
          </div>
        </div>

        {/* Road band: the two company values, centred, split by a lane marking. */}
        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t-[6px] border-black bg-plate px-5 py-3 text-plate-foreground sm:gap-6">
          {VALUES.map((item, i) => (
            <li key={item} className="flex items-center gap-4 text-sm font-black tracking-[0.04em] uppercase sm:gap-6 sm:text-lg sm:whitespace-nowrap">
              {i > 0 ? <span aria-hidden className="hidden h-2 w-10 bg-black sm:block" /> : null}
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Form side: one framed block with a hard yellow offset, echoing the plate on the left. */}
      <section className="flex flex-col items-center justify-center gap-8 bg-background px-5 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-md rounded-2xl border-[3px] border-foreground bg-card p-6 [box-shadow:8px_8px_0_0_var(--plate)] sm:p-9 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:delay-150 motion-safe:fill-mode-backwards motion-safe:duration-500">
          <header className="mb-8">
            <h2 className="text-3xl leading-tight font-black tracking-[-0.03em] text-foreground uppercase sm:text-4xl">
              Iniciar sesión
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Ingresa con el usuario y la contraseña que se te asignó.
            </p>
          </header>

          <LoginForm />
        </div>

        <p className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
          <LockKeyhole aria-hidden className="size-4 shrink-0" />
          Solo personal autorizado.
        </p>
      </section>
    </main>
  );
}

/** A Colombian plate drawn in CSS: yellow, heavy black frame, city on the bottom line. */
function Plate() {
  return (
    <div
      aria-hidden
      className="relative hidden w-full max-w-[36rem] -rotate-3 transition-transform duration-300 hover:rotate-0 rounded-2xl border-[6px] border-black bg-plate px-6 pt-5 pb-3 text-plate-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:delay-100 motion-safe:fill-mode-backwards motion-safe:duration-700 motion-reduce:transition-none sm:block sm:border-8 sm:px-10"
    >
      <span className="absolute top-3 left-4 size-2.5 rounded-full bg-black/70 sm:size-3" />
      <span className="absolute top-3 right-4 size-2.5 rounded-full bg-black/70 sm:size-3" />
      <p className="text-center text-[clamp(3rem,11vw,6.5rem)] leading-none font-black tracking-[0.04em] tabular-nums lg:text-[clamp(3rem,6.5vw,6.5rem)]">
        IMP 001
      </p>
      <p className="mt-1 text-center text-base font-bold tracking-[0.3em] sm:text-xl">CHIQUINQUIRÁ - BOYACÁ</p>
    </div>
  );
}
