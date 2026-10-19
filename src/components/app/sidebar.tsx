"use client";

import {
  BarChart3,
  CalendarCheck,
  LogOut,
  Menu,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/app/brand-mark";
import { SlideOver } from "@/components/app/slide-over";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { parseGroupParam, type OwnerGroup } from "@/modules/dashboard/domain/dashboard-metrics";

const ITEMS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Hoy", icon: CalendarCheck },
  { href: "/flota", label: "Flota", icon: Truck },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
];

const GROUPS: ReadonlyArray<{ value: OwnerGroup | null; label: string; code: string }> = [
  { value: null, label: "Todos", code: "ALL" },
  { value: "IMPERIO", label: "Transportes El Imperio", code: "IMP" },
  { value: "PAEZ", label: "Fabián y Sandra Páez", code: "PAE" },
  { value: "THIRD_PARTY", label: "Terceros", code: "TER" },
];

interface BodyProps {
  pathname: string;
  grupo: OwnerGroup | null;
  /** Query string of the current page, kept when only the group changes. */
  currentQuery: string;
  userName: string;
  onNavigate?: () => void;
}

function navHref(path: string, grupo: OwnerGroup | null) {
  return grupo ? `${path}?grupo=${grupo}` : path;
}

function groupHref(pathname: string, currentQuery: string, value: OwnerGroup | null) {
  // On a vehicle file the group means nothing: go back to the list instead.
  const path = pathname.startsWith("/flota/") ? "/flota" : pathname;
  const params = new URLSearchParams(pathname.startsWith("/flota/") ? "" : currentQuery);
  if (value) params.set("grupo", value);
  else params.delete("grupo");
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function SidebarBody({ pathname, grupo, currentQuery, userName, onNavigate }: BodyProps) {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  const focus =
    "outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar";

  return (
    <>
      <nav aria-label="Principal" className="flex flex-col gap-1 p-3">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={navHref(item.href, grupo)}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-[0.99]",
                focus,
                active &&
                  "bg-secondary font-medium text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary hover:bg-secondary",
              )}
            >
              <Icon className="size-[1.125rem] shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Filtrar por propietario" className="flex flex-col gap-1 border-t p-3">
        <span className="micro-label px-3 pt-1 pb-2">Propietario</span>
        {GROUPS.map((g) => {
          const selected = g.value === grupo;
          return (
            <Link
              key={g.code}
              href={groupHref(pathname, currentQuery, g.value)}
              aria-current={selected ? "true" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-[0.99]",
                focus,
                selected && "bg-secondary font-medium text-foreground hover:bg-secondary",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 border border-muted-foreground/50",
                  selected && "border-primary bg-primary",
                )}
              />
              <span className="min-w-0 leading-tight">{g.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t p-3 px-4">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-sm font-medium text-secondary-foreground uppercase"
        >
          {userName.trim().charAt(0) || "?"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm" title={userName}>
          {userName}
        </span>
        <button
          type="button"
          onClick={signOut}
          aria-label="Salir"
          title="Salir"
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground",
            focus,
          )}
        >
          <LogOut className="size-[1.125rem]" aria-hidden />
        </button>
      </div>
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold tracking-tight">Control de Flota</span>
        <span className="micro-label mt-1 block">El Imperio · Páez</span>
      </span>
    </div>
  );
}

/**
 * Navigation shell: a fixed sidebar from `md`, an off-canvas drawer on
 * phones. The owner-group filter lives here and travels in `?grupo=`.
 */
export function Sidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const grupo = parseGroupParam(searchParams.get("grupo") ?? undefined);
  const currentQuery = searchParams.toString();
  const shared = { pathname, grupo, currentQuery, userName };

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-2 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={drawerOpen}
          className="flex size-11 items-center justify-center rounded-lg text-foreground outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <Brand />
      </div>

      <SlideOver
        side="left"
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Menú"
        bodyClassName="flex flex-col p-0"
      >
        <SidebarBody {...shared} onNavigate={() => setDrawerOpen(false)} />
      </SlideOver>

      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r bg-sidebar md:flex">
        <div className="flex h-16 items-center border-b px-4">
          <Brand />
        </div>
        <SidebarBody {...shared} />
      </aside>
    </>
  );
}
