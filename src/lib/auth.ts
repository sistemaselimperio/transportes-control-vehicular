import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db, schema } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Rocío is the only operator for now; users are created by seed/admin tooling.
    disableSignUp: true,
  },
  plugins: [
    username(),
    nextCookies(), // must be the last plugin
  ],
});
