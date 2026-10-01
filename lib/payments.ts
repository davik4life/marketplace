import { settlementQuery } from "./settlement";
import { sendMail } from "./mail";
import { db, HttpError, paystack } from "./server";
import { money, paymentMatches } from "./commerce";
export async function sendReceipt(orderId: string) {
  const sql = db();
  const [claim] =
    await sql`UPDATE email_outbox SET status='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes' WHERE order_id=${orderId} AND (status='pending' OR (status='sending' AND lease_until<now())) RETURNING order_id`;
  if (!claim) return;
  try {
    const [order] =
      await sql`SELECT * FROM orders WHERE id=${orderId} AND status='paid'`;
    if (!order) throw Error("Missing paid order");
    const messageId = await sendMail({
      to: order.email,
      subject: `Your Okirika order is confirmed · ${order.reference}`,
      text: `Thank you for your patronage, ${order.delivery.name}!\n\nYour test payment has been confirmed.\nOrder: ${order.reference}\n\n${order.items.map((x: any) => `${x.name} × ${x.quantity}: ${money(x.price * x.quantity)}`).join("\n")}\nDelivery: ${money(order.shipping)}\nTotal: ${money(order.total)}\n\nDelivery address: ${order.delivery.address}, ${order.delivery.city}, ${order.delivery.state}, Nigeria\n\nThis is a test order; no goods will be dispatched.\nWith care,\nOkirika`,
      messageId: `okirika-${order.id}`,
    });
    await sql`UPDATE email_outbox SET status='sent',message_id=${messageId},sent_at=now(),lease_until=null WHERE order_id=${orderId}`;
  } catch {
    await sql`UPDATE email_outbox SET status='pending',lease_until=null WHERE order_id=${orderId}`;
    throw new HttpError(
      502,
      "Your payment is confirmed, but the confirmation email could not be sent. You can retry from your orders.",
    );
  }
}
export async function settle(reference: string) {
  const sql = db();
  const [order] = await sql`SELECT * FROM orders WHERE reference=${reference}`;
  if (!order) throw new HttpError(404, "Order not found.");
  if (order.status !== "paid") {
    const payment = await paystack(
      "/transaction/verify/" + encodeURIComponent(reference),
    );
    if (!paymentMatches(order as any, payment))
      throw new HttpError(
        409,
        payment.status === "success"
          ? "Payment details do not match this order. Please contact the shop."
          : "Payment is not yet successful. Check your orders again after completing payment.",
      );
    // A single statement atomically settles once and creates the durable outbox entry.
    await sql.query(settlementQuery, [order.id]);
  }
  await sendReceipt(order.id);
  const [receipt] =
    await sql`SELECT status FROM email_outbox WHERE order_id=${order.id}`;
  return { id: order.id, emailSent: receipt?.status === "sent" };
}
