/**
 * Side-effect import for CLI scripts. ES imports run before the importing
 * module's body, so env vars must load in an import that precedes `./index`.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
