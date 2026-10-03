import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { settlementQuery } from "../lib/settlement.ts";
test("Postgres schema and settlement preserve order, clear purchased bag once, and create one receipt", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      await readFile(
        new URL("../db/migrations/001_shop.sql", import.meta.url),
        "utf8",
      ),
    );
    const user = "10000000-0000-4000-8000-000000000001",
      cart = "10000000-0000-4000-8000-000000000002",
      order = "10000000-0000-4000-8000-000000000003";
    await db.query(
      "INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)",
      [user, "google-1", "test@example.com", "Test User"],
    );
    await db.query("INSERT INTO carts(id,token_hash) VALUES($1,$2)", [
      cart,
      "hash",
    ]);
    await db.exec(
      "INSERT INTO products(id,name,category,description,price,image,position) VALUES('vase','Vase','Home','Test',2450000,'/home-edit.png','center');",
    );
    await db.query(
      "INSERT INTO cart_items(cart_id,product_id,quantity) VALUES($1,'vase',2)",
      [cart],
    );
    await db.query(
      "INSERT INTO orders(id,user_id,cart_id,idempotency_key,reference,email,delivery,items,subtotal,shipping,total) VALUES($1,$2,$3,$1,'TEST-1','test@example.com','{}',$4,4900000,250000,5150000)",
      [
        order,
        user,
        cart,
        JSON.stringify([
          { id: "vase", name: "Vase", quantity: 2, price: 2450000 },
        ]),
      ],
    );
    await db.query(settlementQuery, [order]);
    assert.equal(
      (await db.query<any>("SELECT status FROM orders")).rows[0].status,
      "paid",
    );
    assert.equal((await db.query("SELECT * FROM cart_items")).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM email_outbox")).rows.length, 1);
    await db.query(
      "INSERT INTO cart_items(cart_id,product_id,quantity) VALUES($1,'vase',1)",
      [cart],
    );
    await db.query(settlementQuery, [order]);
    assert.equal(
      (await db.query("SELECT * FROM cart_items")).rows.length,
      1,
      "replayed callback must not clear newly added products",
    );
    assert.equal((await db.query("SELECT * FROM email_outbox")).rows.length, 1);
    await assert.rejects(
      db.query(
        "INSERT INTO orders(id,user_id,cart_id,idempotency_key,reference,email,delivery,items,subtotal,shipping,total) VALUES($1,$2,$3,$4,'TEST-2','test@example.com','{}','[]',100,0,100)",
        ["10000000-0000-4000-8000-000000000004", user, cart, order],
      ),
      /unique/i,
    );
    await assert.rejects(
      db.query("UPDATE cart_items SET quantity=-1"),
      /check/i,
    );
  } finally {
    await db.close();
  }
});
