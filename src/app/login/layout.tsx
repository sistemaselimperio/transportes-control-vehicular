import { Suspense } from "react";

/**
 * The login page reads the session (headers) to bounce signed-in users to the app; under Cache
 * Components that request-time read has to sit behind a boundary.
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
