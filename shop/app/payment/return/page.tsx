"use client";
import { useEffect, useState } from "react";
import { api } from "../../shop-context";
export default function PaymentReturn() {
  const [state, setState] = useState("Checking your payment…"),
    [busy, setBusy] = useState(true),
    [success, setSuccess] = useState(false);
  async function verify() {
    setBusy(true);
    const reference = new URLSearchParams(location.search).get("reference");
    if (!reference) {
      setState(
        "No payment reference was provided. Open your orders to check payment.",
      );
      setBusy(false);
      return;
    }
    try {
      const result = await api("/payment/verify", {
        method: "POST",
        body: JSON.stringify({ reference }),
      });
      setSuccess(result.paid);
      setState(
        result.emailPending
          ? "Your payment is confirmed. Your receipt is waiting to be sent; retry it from your orders."
          : "Your payment is confirmed. Your receipt has been submitted for delivery.",
      );
    } catch (e) {
      setState((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void verify();
  }, []);
  return (
    <main className="orders empty">
      <p className="eyebrow">
        {success ? "THANK YOU FOR SHOPPING OKIRIKA" : "ONE LAST CHECK"}
      </p>
      <h2>
        {success ? "Thank you for your patronage!" : "Your payment"}
      </h2>
      <p role="status">{state}</p>
      {!busy && !success && (
        <button className="subtle-button" onClick={() => void verify()}>
          Check payment again
        </button>
      )}
      <div>
        <a className="solid-link" href="/orders">
          View your orders
        </a>
      </div>
      <p className="small">
        This is a test purchase. No goods will be dispatched.
      </p>
    </main>
  );
}
