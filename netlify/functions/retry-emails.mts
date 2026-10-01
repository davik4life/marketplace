import { db } from "../../lib/server";
import { sendReceipt } from "../../lib/payments";
import { sendWelcome } from "../../lib/welcome";
export default async () => {
  const sql = db();
  const [welcomes, receipts] = await Promise.all([
    sql`SELECT user_id FROM welcome_email_outbox WHERE attempts<12 AND (status='pending' OR (status='sending' AND lease_until<now())) ORDER BY attempts LIMIT 3`,
    sql`SELECT order_id FROM email_outbox WHERE attempts<12 AND (status='pending' OR (status='sending' AND lease_until<now())) ORDER BY attempts LIMIT 3`,
  ]);
  const results = await Promise.allSettled([
    ...welcomes.map(row => sendWelcome(row.user_id)),
    ...receipts.map(row => sendReceipt(row.order_id)),
  ]);
  console.log("Email retry batch", {processed: results.length, failed: results.filter(r => r.status === "rejected").length});
};
export const config = { schedule: "*/10 * * * *" };
