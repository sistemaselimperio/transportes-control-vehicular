"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/vehiculos", label: "Vehículos" },
  { href: "/conductores", label: "Conductores" },
  { href: "/configuracion", label: "Configuración" },
] as const;

export function AppNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-2">
        <span className="font-semibold whitespace-nowrap">Control de Flota</span>
        <nav
          aria-label="Principal"
          className="flex flex-1 gap-1 overflow-x-auto"
        >
          {ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm whitespace-nowrap hover:bg-muted",
                  active && "bg-muted font-medium",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {userName}
        </span>
        <Button variant="outline" size="sm" onClick={signOut}>
          Salir
        </Button>
      </div>
    </header>
  );
}
