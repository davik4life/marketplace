"use client";
import { useEffect, useState } from "react";
import { api, useShop } from "../shop-context";
import { money } from "@/lib/commerce";
import { openInlinePayment } from "@/lib/inline-payment";
import { toast } from "sonner";
export default function Orders() {
  const { user, ready, googleReady } = useShop();
  const [orders, setOrders] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      setOrders((await api("/orders")).orders);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user) void load();
    else if (ready) setLoading(false);
  }, [user, ready]);
  async function action(order: any) {
    setBusy(order.id);
    try {
      if (order.status === "paid") {
        await api("/orders/receipt", {
          method: "POST",
          body: JSON.stringify({ id: order.id }),
        });
        toast.success("Receipt request processed.");
      } else {
        const result = await api("/payment/verify", {
          method: "POST",
          body: JSON.stringify({ reference: order.reference }),
        });
        toast.success(
          result.emailPending
            ? "Payment confirmed. Receipt pending."
            : "Payment confirmed.",
        );
      }
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function resume(order: any) {
    setBusy(order.id);
    try {
      if (await openInlinePayment(order.access_code)) await action(order);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(""); }
  }
  return (
    <main className="orders">
      <p className="eyebrow">YOUR OKIRIKA</p>
      <h2>Little things, all in one place.</h2>
      {!user && ready ? (
        <div className="empty">
          <p>Sign in to see your orders.</p>
          {googleReady && (
            <a className="solid-link" href="/signin">
              Sign in with Google
            </a>
          )}
        </div>
      ) : loading ? (
        <p className="loading">Loading your orders…</p>
      ) : error ? (
        <p className="error" role="alert">
          {error} <button onClick={() => void load()}>Retry</button>
        </p>
      ) : orders.length ? (
        orders.map((order) => (
          <article className="order" key={order.id}>
            <p className="small">
              {new Date(order.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              · {order.reference}
            </p>
            <span className="tag">
              {order.status === "paid"
                ? "Payment confirmed"
                : "Awaiting payment"}
            </span>
            {order.items.map((item: any) => (
              <div className="money-row" key={item.id}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{money(item.price * item.quantity)}</span>
              </div>
            ))}
            <div className="money-row total">
              <span>Total, including delivery</span>
              <strong>{money(order.total)}</strong>
            </div>
            <p className="small">
              {order.status === "paid"
                ? order.email_status === "sent"
                  ? "Confirmation email accepted by Mailgun."
                  : "Confirmation email pending."
                : "If you completed payment, check its status below."}
            </p>
            {order.status !== "paid" && order.access_code && (
              <button className="solid-link" disabled={!!busy} onClick={() => void resume(order)}>Continue test payment</button>
            )}
            {(order.status !== "paid" || order.email_status !== "sent") && (
              <button
                className="subtle-button"
                disabled={!!busy}
                onClick={() => void action(order)}
              >
                {busy === order.id
                  ? "Checking…"
                  : order.status === "paid"
                    ? "Retry confirmation email"
                    : "Check payment status"}
              </button>
            )}
          </article>
        ))
      ) : (
        <div className="empty">
          <p>No orders just yet.</p>
          <a className="solid-link" href="/#collection">
            Find your first favourite
          </a>
        </div>
      )}
    </main>
  );
}
