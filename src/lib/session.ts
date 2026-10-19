import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** Server actions and route handlers are callable directly: always re-check the session. */
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("No autorizado");
  return session;
}
