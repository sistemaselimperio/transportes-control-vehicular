import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Sidebar } from "@/components/app/sidebar";
import { auth } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
      <a
        href="#contenido"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-[60] focus-visible:rounded-lg focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-primary-foreground focus-visible:shadow-soft"
      >
        Saltar al contenido
      </a>
      {/* useSearchParams in the sidebar needs a boundary. */}
      <Suspense fallback={<div className="hidden w-60 shrink-0 border-r bg-sidebar md:block" />}>
        <Sidebar userName={session.user.name} />
      </Suspense>
      <main id="contenido" className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-[96rem]">{children}</div>
      </main>
    </div>
  );
}
