import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {bearerToken,validMobileChallenge,validMobileVerifier} from '../lib/mobile-auth.ts';
test('mobile auth accepts only explicit opaque tokens and proof-of-possession values',()=>{
 const token='10000000-0000-4000-8000-000000000001'.repeat(2);
 assert.equal(bearerToken('Bearer '+token),token);
 assert.equal(bearerToken('Bearer short'),'');
 assert.equal(bearerToken(null),'');
 assert.equal(validMobileChallenge('a'.repeat(64)),true);
 assert.equal(validMobileChallenge('https://attacker.example'),false);
 assert.equal(validMobileVerifier('a'.repeat(64)),true);
 assert.equal(validMobileVerifier('short'),false);
});
test('mobile login codes require the matching challenge, are single-use, and checkout sessions revoke with their parent',async()=>{
 const db=new PGlite();try{
  await db.exec(await readFile(new URL('../db/migrations/001_shop.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../db/migrations/004_mobile.sql',import.meta.url),'utf8'));
  const user='10000000-0000-4000-8000-000000000001',cart='10000000-0000-4000-8000-000000000002';
  await db.query('INSERT INTO users(id,google_sub,email,name) VALUES($1,$2,$3,$4)',[user,'google-test','test@example.com','Test']);
  await db.query('INSERT INTO carts(id,token_hash,user_id) VALUES($1,$2,$3)',[cart,'cart',user]);
  await db.query("INSERT INTO mobile_login_codes VALUES('code','challenge',$1,now()+interval '1 minute')",[user]);
  const consume="DELETE FROM mobile_login_codes WHERE code_hash=$1 AND challenge=$2 AND expires_at>now() RETURNING user_id";
  assert.equal((await db.query(consume,['code','wrong'])).rows.length,0);
  assert.equal((await db.query(consume,['code','challenge'])).rows.length,1);
  assert.equal((await db.query(consume,['code','challenge'])).rows.length,0);
  await db.query("INSERT INTO sessions(token_hash,user_id,cart_id,expires_at) VALUES('parent',$1,$2,now()+interval '1 day')",[user,cart]);
  await db.query("INSERT INTO sessions(token_hash,user_id,cart_id,expires_at,parent_token_hash) VALUES('child',$1,$2,now()+interval '1 day','parent')",[user,cart]);
  await db.exec("INSERT INTO mobile_checkout_tickets VALUES('ticket','parent',now()+interval '60 seconds'); DELETE FROM sessions WHERE token_hash='parent'");
  assert.equal((await db.query('SELECT * FROM sessions')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM mobile_checkout_tickets')).rows.length,0);
 }finally{await db.close()}
});
