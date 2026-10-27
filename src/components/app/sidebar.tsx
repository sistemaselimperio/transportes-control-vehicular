"use client";

import {
  Bell,
  Building2,
  Loader2,
  LogOut,
  Menu,
  NotebookText,
  Receipt,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/app/brand-mark";
import { SlideOver } from "@/components/app/slide-over";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { ExpiredVehicleCounts } from "@/modules/dashboard/application/dashboard-queries";
import { parseGroupParam, type OwnerGroup } from "@/modules/dashboard/domain/dashboard-metrics";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shows the expired-vehicle count after the label. */
  badge?: "expired";
};

const SECTIONS: ReadonlyArray<{ label: string; items: ReadonlyArray<NavItem> }> = [
  {
    label: "Operación",
    items: [
      { href: "/", label: "Alertas", icon: Bell, badge: "expired" },
      { href: "/flota", label: "Flota", icon: Truck },
      { href: "/conductores", label: "Conductores", icon: Users },
      { href: "/bitacora", label: "Bitácora", icon: NotebookText },
    ],
  },
  {
    label: "Administración",
    items: [
      { href: "/propietarios", label: "Propietarios", icon: Building2 },
      { href: "/ventas", label: "Ventas", icon: Receipt },
    ],
  },
];

const GROUPS: ReadonlyArray<{
  value: OwnerGroup | null;
  label: string;
  /** Fits a half-width chip; the full label goes in the tooltip. */
  short: string;
  code: string;
}> = [
  { value: null, label: "Todos", short: "Todos", code: "ALL" },
  { value: "IMPERIO", label: "Transportes El Imperio", short: "Imperio", code: "IMP" },
  { value: "PAEZ", label: "Fabián Páez", short: " Fabián P.", code: "PAE" },
  { value: "THIRD_PARTY", label: "Terceros", short: "Terceros", code: "TER" },
];

interface BodyProps {
  pathname: string;
  grupo: OwnerGroup | null;
  /** Query string of the current page, kept when only the group changes. */
  currentQuery: string;
  userName: string;
  /** Expired vehicles for the active owner group. */
  expiredVehicles: number;
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

function SidebarBody({ pathname, grupo, currentQuery, userName, expiredVehicles, onNavigate }: BodyProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  const focus =
    "outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar";

  return (
    <>
      <nav aria-label="Principal" className="flex flex-col gap-1 p-3 md:gap-0.5 md:py-2">
        {SECTIONS.map((section) => (
          <div key={section.label} className="flex flex-col gap-1 not-first:mt-3 md:gap-0.5 md:not-first:mt-2">
            <span className="micro-label px-3 pt-1 pb-2 md:pb-1.5">{section.label}</span>
            {section.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={navHref(item.href, grupo)}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "relative flex h-11 items-center gap-3 md:h-9 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-[0.99]",
                    focus,
                    active &&
                      "bg-primary font-semibold text-primary-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--foreground),transparent_85%)] hover:bg-primary hover:text-primary-foreground",
                  )}
                >
                  <Icon className="size-[1.125rem] shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge === "expired" && (
                    <span
                      className={cn(
                        "num text-xs font-medium tabular-nums",
                        active ? "text-primary-foreground" : expiredVehicles > 0 ? "text-danger-foreground" : "text-muted-foreground",
                      )}
                    >
                      {expiredVehicles}
                      <span className="sr-only"> {expiredVehicles === 1 ? "vehículo vencido" : "vehículos vencidos"}</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <nav aria-label="Filtrar por propietario" className="border-t p-3 md:py-2.5">
        <span className="micro-label block px-3 pt-1 pb-2 md:pb-1.5">Propietario</span>
        <div className="grid grid-cols-2 gap-1">
          {GROUPS.map((g) => {
            const selected = g.value === grupo;
            return (
              <Link
                key={g.code}
                href={groupHref(pathname, currentQuery, g.value)}
                aria-current={selected ? "true" : undefined}
                aria-label={g.label}
                title={g.label}
                onClick={onNavigate}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-[0.99] md:min-h-8 md:px-2.5",
                  focus,
                  selected && "bg-secondary font-medium text-foreground hover:bg-secondary",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 border border-muted-foreground/50",
                    selected && "border-brand bg-brand",
                  )}
                />
                <span className="min-w-0 truncate leading-tight">{g.short}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Account: a tone-step field at the foot, the name set as text and one flat, square sign-out bar. */}
      <div className="mt-auto flex flex-col gap-3 bg-muted px-4 pt-4 pb-4 md:pb-3">
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          aria-busy={signingOut}
          className={cn(
            "group flex h-11 cursor-pointer rounded-sm items-center justify-between bg-foreground px-3.5 text-sm font-semibold text-background transition-colors duration-150 hover:bg-danger-foreground active:translate-y-px disabled:pointer-events-none disabled:opacity-70 motion-reduce:transition-none md:h-10",
            focus,
          )}
        >
          {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
          {signingOut ? (
            <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
          ) : (
            <LogOut className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          )}
        </button>
      </div>
    </>
  );
}

/** Compact lockup for the phone top bar: logo beside the name. */
function BrandInline() {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandMark decorative className="h-10" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-bold tracking-tight">
          Transportes El Imperio
        </span>
        <span className="micro-label mt-1 block">Control de Flota</span>
      </span>
    </div>
  );
}

/** Stacked lockup for the desktop sidebar: the logo leads, the name sits under it. */
function BrandStacked() {
  return (
    <div className="flex flex-col items-center gap-2 border-b px-4 pt-4 pb-3.5 text-center">
      <BrandMark decorative className="h-24 drop-shadow-sm" />
      <span className="leading-tight">
        <span className="block text-base font-bold tracking-tight text-balance">
          Transportes El Imperio
        </span>
        <span className="mt-2 flex items-center justify-center gap-2">
          <span aria-hidden className="h-px w-4 bg-brand" />
          <span className="micro-label">Control de Flota</span>
          <span aria-hidden className="h-px w-4 bg-brand" />
        </span>
      </span>
    </div>
  );
}

/**
 * Navigation shell: a fixed sidebar from `md`, an off-canvas drawer on
 * phones. The owner-group filter lives here and travels in `?grupo=`.
 */
export function Sidebar({
  userName,
  expiredCounts,
}: {
  userName: string;
  expiredCounts: ExpiredVehicleCounts;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const grupo = parseGroupParam(searchParams.get("grupo") ?? undefined);
  const currentQuery = searchParams.toString();
  const shared = { pathname, grupo, currentQuery, userName, expiredVehicles: expiredCounts[grupo ?? "ALL"] };

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
        <BrandInline />
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
        <BrandStacked />
        <SidebarBody {...shared} />
      </aside>
    </>
  );
}
