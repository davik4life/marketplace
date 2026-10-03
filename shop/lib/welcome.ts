import { db, origin, HttpError } from "./server";
import { welcomeHtml } from "./email-template";
import { sendMail } from "./mail";
export async function sendWelcome(userId: string) {
  const sql = db();
  const [claim] = await sql`UPDATE welcome_email_outbox SET status='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes' WHERE user_id=${userId} AND (status='pending' OR (status='sending' AND lease_until<now())) RETURNING user_id`;
  if (!claim) return;
  try {
    const [user] = await sql`SELECT name,email FROM users WHERE id=${userId}`;
    if (!user) throw Error("Account not found");
    const messageId = await sendMail({to: user.email, subject: "Welcome to Okirika — your account is ready", messageId: `okirika-welcome-${userId}`,
      html: welcomeHtml(user.name, origin()),
      text: `Welcome home, ${user.name}.\n\nYour Okirika account has been created with Google. Your bag and orders now have a place of their own.\n\nExplore the collection: ${origin()}/#collection\nYour account: ${origin()}/signin\n\nWe’re currently in test mode: no real charges or shipments. After a successful test payment, we’ll send a separate order confirmation.\n\nWith care,\nOkirika`});
    await sql`UPDATE welcome_email_outbox SET status='sent',message_id=${messageId},sent_at=now(),lease_until=null WHERE user_id=${userId}`;
  } catch {
    await sql`UPDATE welcome_email_outbox SET status='pending',lease_until=null WHERE user_id=${userId}`;
    throw new HttpError(502, "Your account is ready, but the welcome email is pending. Please retry shortly.");
  }
}
