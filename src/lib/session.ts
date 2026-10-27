import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth";

/** The session of this request, read once however many components ask. Reads headers: request time only. */
export const getRequestSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Server actions and route handlers are callable directly: always re-check the session. */
export async function requireSession() {
  const session = await getRequestSession();
  if (!session) throw new Error("No autorizado");
  return session;
}
