import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db, schema } from "@/db";

/**
 * Vercel serves the app under several hosts (production domain, team alias, branch and deployment
 * URLs). BETTER_AUTH_URL names only one, so the others are trusted from Vercel's system variables;
 * without this, auth requests from any other host fail with "Invalid origin".
 */
const vercelOrigins = [
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_URL,
]
  .filter((host): host is string => !!host)
  .map((host) => `https://${host}`);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins: vercelOrigins,
  emailAndPassword: {
    enabled: true,
    // Users are created by seed/admin tooling, never by sign-up.
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      // Read-only for clients: the role is only ever written by seed/admin tooling.
      role: { type: "string", required: true, defaultValue: "staff", input: false },
      // Same for the theme.
      theme: { type: "string", required: true, defaultValue: "yellow", input: false },
    },
  },
  plugins: [
    username(),
    nextCookies(), // must be the last plugin
  ],
});
