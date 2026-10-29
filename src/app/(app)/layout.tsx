import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Sidebar } from "@/components/app/sidebar";
import { canViewSection, parseRole } from "@/lib/permissions";
import { getRequestSession } from "@/lib/session";
import { getExpiredVehicleCounts } from "@/modules/dashboard/application/dashboard-queries";

/**
 * The shell (skip link, frame, skeletons) prerenders; everything that needs the session streams in
 * behind a boundary. The pages sit behind `SessionGate`, so no page renders — or reads data — for a
 * request whose session is not valid.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
      <a
        href="#contenido"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-[60] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-primary-foreground focus-visible:shadow-soft"
      >
        Saltar al contenido
      </a>
      {/* useSearchParams in the sidebar needs a boundary, and the session read streams in here. */}
      <Suspense fallback={<div className="hidden w-60 shrink-0 border-r bg-sidebar md:block" />}>
        <SessionSidebar />
      </Suspense>
      <main id="contenido" className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-[96rem]">
          <Suspense fallback={<ContentSkeleton />}>
            <SessionGate>{children}</SessionGate>
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function SessionSidebar() {
  const session = await getRequestSession();
  if (!session) redirect("/login");
  const role = parseRole(session.user.role);
  // The counts only feed the alerts entry, which staff do not see.
  const expiredCounts = canViewSection(role, "today") ? await getExpiredVehicleCounts() : null;
  return <Sidebar userName={session.user.name} role={role} expiredCounts={expiredCounts} />;
}

/** Renders the page only once the session is confirmed; the proxy alone just checks the cookie. */
async function SessionGate({ children }: { children: React.ReactNode }) {
  const session = await getRequestSession();
  if (!session) redirect("/login");
  return children;
}

function ContentSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Cargando">
      <div className="skeleton h-8 w-40" />
      <div className="skeleton h-4 w-64" />
    </div>
  );
}
