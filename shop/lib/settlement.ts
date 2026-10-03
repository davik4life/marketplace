// One atomic PostgreSQL statement. Replays do not touch newly added cart items.
export const settlementQuery = `
WITH paid AS (
 UPDATE orders SET status='paid', paid_at=now()
 WHERE id=$1 AND status='pending'
 RETURNING id, cart_id, items
), cleared AS (
 DELETE FROM cart_items c
 USING paid p, jsonb_to_recordset(p.items) AS item(id text, quantity integer)
 WHERE c.cart_id=p.cart_id AND c.product_id=item.id AND c.quantity=item.quantity
 RETURNING c.product_id
)
INSERT INTO email_outbox(order_id) SELECT id FROM paid
ON CONFLICT(order_id) DO NOTHING
`;
