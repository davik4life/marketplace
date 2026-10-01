import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { signinQuery, signupQuery } from "../lib/account.ts";

test("sign-in cannot register users and repeated sign-up cannot change an existing account", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL("../db/migrations/001_shop.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../db/migrations/002_welcome_email.sql", import.meta.url), "utf8"));
    const id = "10000000-0000-4000-8000-000000000001";
    assert.equal((await db.query(signinQuery, ["google-a", "a@example.com", "A"])).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM users")).rows.length, 0);
    assert.deepEqual((await db.query(signupQuery, [id, "google-a", "a@example.com", "A"])).rows, [{id}]);
    assert.equal((await db.query(signupQuery, ["10000000-0000-4000-8000-000000000002", "google-a", "changed@example.com", "Changed"])).rows.length, 0);
    assert.deepEqual((await db.query("SELECT email,name FROM users")).rows, [{email: "a@example.com", name: "A"}]);
    assert.deepEqual((await db.query(signinQuery, ["google-a", "updated@example.com", "Updated"])).rows, [{id}]);
    assert.equal((await db.query("SELECT * FROM users")).rows.length, 1);
    assert.deepEqual((await db.query("SELECT user_id,status,attempts FROM welcome_email_outbox")).rows, [{user_id:id,status:"pending",attempts:0}]);
  } finally { await db.close(); }
});
