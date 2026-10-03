import { db } from "./server";
import { sendReceipt } from "./payments";
import { sendWelcome } from "./welcome";

export async function retryEmails() {
  const sql = db();
  const [welcomes, receipts] = await Promise.all([
    sql`SELECT user_id FROM welcome_email_outbox WHERE attempts<12 AND (status='pending' OR (status='sending' AND lease_until<now())) ORDER BY attempts LIMIT 3`,
    sql`SELECT order_id FROM email_outbox WHERE attempts<12 AND (status='pending' OR (status='sending' AND lease_until<now())) ORDER BY attempts LIMIT 3`,
  ]);
  const results = await Promise.allSettled([
    ...welcomes.map(row => sendWelcome(row.user_id)),
    ...receipts.map(row => sendReceipt(row.order_id)),
  ]);
  return {processed: results.length, failed: results.filter(r => r.status === "rejected").length};
}
