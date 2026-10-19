import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";
import { auth } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <>
      <AppNav userName={session.user.name} />
      <main className="mx-auto w-full max-w-screen-2xl flex-1 p-4">{children}</main>
    </>
  );
}
