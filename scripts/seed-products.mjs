import { readFile } from "node:fs/promises";
export async function seedProducts(sql) {
  const products = JSON.parse(
    await readFile(new URL("../lib/catalog.json", import.meta.url), "utf8"),
  );
  await sql.transaction(
    products.map(
      (p) =>
        sql`INSERT INTO products(id,name,category,description,price,image,position,tone) VALUES(${p.id},${p.name},${p.category},${p.description},${p.price},${p.image},${p.position},${p.tone}) ON CONFLICT(id) DO UPDATE SET image=excluded.image,position=excluded.position,tone=excluded.tone`,
    ),
  );
  return products.length;
}
