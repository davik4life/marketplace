import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { seedProducts } from "./seed-products.mjs";
const local = parseEnv(await readFile(".env", "utf8"));
try {
  const count = await seedProducts(
    neon(process.env.DATABASE_URL || local.DATABASE_URL),
  );
  console.log(
    `Catalog synced: ${count} products. Existing prices and order history preserved.`,
  );
} catch (error) {
  console.error("Catalog sync failed:", error.name, error.code || "");
  process.exitCode = 1;
}
