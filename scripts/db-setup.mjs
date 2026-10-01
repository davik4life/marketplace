import { seedProducts } from "./seed-products.mjs";
import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
const local = parseEnv(await readFile(".env", "utf8").catch(() => ""));
const connection = process.env.DATABASE_URL || local.DATABASE_URL;
if (!connection) throw Error("Set DATABASE_URL in .env first.");
const sql = neon(connection);
await sql`CREATE TABLE IF NOT EXISTS okirika_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
for (const [version, file] of [["001", "001_shop.sql"], ["002", "002_welcome_email.sql"], ["003", "003_inline_payment.sql"]]) {
  const migration = await readFile(`db/migrations/${file}`, "utf8");
  await sql.query(`DO $migration$ BEGIN PERFORM pg_advisory_xact_lock(92746312); IF NOT EXISTS(SELECT 1 FROM okirika_migrations WHERE version='${version}') THEN ${migration} INSERT INTO okirika_migrations(version) VALUES('${version}'); END IF; END $migration$;`);
}
await seedProducts(sql);
console.log("Neon schema and sample catalog are ready.");
