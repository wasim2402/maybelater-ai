/**
 * Creates or updates Better Auth's tables in the `auth` PostgreSQL schema.
 * Run: npm run auth:migrate   (reads frontend/.env.local)
 * The app's own tables are managed separately by Alembic in the backend.
 */
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";

import { AUTH_SCHEMA, authOptions } from "../src/lib/auth/options.ts";

const url = process.env.AUTH_DATABASE_URL;
if (!url) throw new Error("AUTH_DATABASE_URL is not set");

const admin = new Pool({ connectionString: url });
await admin.query(`CREATE SCHEMA IF NOT EXISTS ${AUTH_SCHEMA}`);
await admin.end();

const options = authOptions();
const { toBeCreated, toBeAdded, unsafeChanges, runMigrations } = await getMigrations(options);
if (unsafeChanges.length) {
  console.error("Refusing unsafe auth migration:\n" + unsafeChanges.join("\n"));
  process.exit(1);
}
if (!toBeCreated.length && !toBeAdded.length) {
  console.log("auth schema is up to date");
} else {
  await runMigrations();
  console.log(`auth schema migrated: created ${toBeCreated.map((t) => t.table).join(", ") || "none"}; updated ${toBeAdded.map((t) => t.table).join(", ") || "none"}`);
}
await (options.database as Pool).end();
