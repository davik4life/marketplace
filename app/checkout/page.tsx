"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, LockKeyhole, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useShop, api } from "../shop-context";
import { money, totals } from "@/lib/commerce";
import { Button } from "@/components/ui/button";
export default function Checkout() {
  const { items, user, ready, busy, preview, googleReady, paymentReady, setQuantity } =
    useShop();
  const [submitting, setSubmitting] = useState(false),
    [error, setError] = useState(""),
    [key, setKey] = useState("");
  const amount = items.length
    ? totals(items)
    : { subtotal: 0, shipping: 0, total: 0 };
  useEffect(() => setKey(""), [items]);
  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("Sign in with Google before payment.");
      return;
    }
    const form = new FormData(e.currentTarget);
    const delivery = Object.fromEntries(form.entries());
    const idempotencyKey = key || crypto.randomUUID();
    setKey(idempotencyKey);
    setSubmitting(true);
    try {
      const result = await api("/checkout", {
        method: "POST",
        body: JSON.stringify({ delivery, idempotencyKey }),
      });
      location.assign(result.url);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }
  return (
    <main className="checkout">
      <a href="/#collection" className="back">
        <ArrowLeft size={14} />
        Back to the collection
      </a>
      <p className="eyebrow">A FEW GOOD THINGS, ON THEIR WAY</p>
      <h2>Your bag & checkout</h2>
      <p className="small">Test checkout · No real charges or shipments</p>
      {!ready ? (
        <p className="loading">Opening your bag…</p>
      ) : (
        <div className="checkout-grid">
          <form onSubmit={pay} onChange={() => setKey("")}>
            <section className="panel">
              <h3>01 &nbsp; Your details</h3>
              {user ? (
                <p className="small">
                  Signed in as <strong>{user.email}</strong>
                  <br />
                  Your confirmation will be sent to this address.
                </p>
              ) : (
                <>
                  <p className="small">
                    Sign in to keep your orders together and receive your
                    confirmation.
                  </p>
                  <Button
                    className="add-button"
                    variant="outline"
                    disabled={!googleReady}
                    asChild={googleReady}
                  >
                    {googleReady ? (
                      <a href="/signin">
                        Sign in with Google <ArrowRight size={16} />
                      </a>
                    ) : (
                      <span>Google sign-in is being connected</span>
                    )}
                  </Button>
                  <p className="small auth-switch">New to Okirika? <a href="/signup">Create an account</a></p>
                </>
              )}
            </section>
            <section className="panel">
              <h3>02 &nbsp; A place to call home</h3>
              <p className="small">
                Delivery within Nigeria. ₦2,500 delivery; free on orders from
                ₦75,000.
              </p>
              <div className="fields">
                {[
                  {
                    name: "name",
                    label: "Full name",
                    auto: "name",
                    min: 2,
                    max: 100,
                  },
                  {
                    name: "phone",
                    label: "Phone number",
                    auto: "tel",
                    min: 7,
                    max: 25,
                  },
                  {
                    name: "address",
                    label: "Street address",
                    auto: "street-address",
                    min: 5,
                    max: 300,
                  },
                  {
                    name: "city",
                    label: "City",
                    auto: "address-level2",
                    min: 2,
                    max: 100,
                  },
                  {
                    name: "state",
                    label: "State",
                    auto: "address-level1",
                    min: 2,
                    max: 100,
                  },
                  {
                    name: "postal",
                    label: "Postal code (optional)",
                    auto: "postal-code",
                    min: 0,
                    max: 20,
                  },
                ].map((f) => (
                  <label
                    className={f.name === "address" ? "full" : ""}
                    key={f.name}
                  >
                    {f.label}
                    <input
                      name={f.name}
                      defaultValue={f.name === "name" ? user?.name : undefined}
                      required={f.name !== "postal"}
                      minLength={f.min}
                      maxLength={f.max}
                      autoComplete={f.auto}
                      type={f.name === "phone" ? "tel" : "text"}
                      placeholder={f.name === "state" ? "Lagos" : undefined}
                      disabled={submitting}
                    />
                  </label>
                ))}
              </div>
            </section>
            <section className="panel">
              <h3>03 &nbsp; The finishing touch</h3>
              <p className="small">
                <LockKeyhole
                  size={14}
                  style={{ display: "inline", marginRight: 7 }}
                />
                You’ll complete your test payment securely on Paystack.
              </p>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button
                className="pay-button"
                disabled={
                  !user || !items.length || submitting || preview || busy || !paymentReady
                }
              >
                {submitting
                  ? "Opening secure checkout…"
                  : !paymentReady ? "Test payments are being connected" : `Pay ${money(amount.total)} with Paystack`}
              </button>
              <p className="small">
                Your order is confirmed only after payment is verified.
              </p>
            </section>
          </form>
          <aside className="summary">
            <h3>A little something for home</h3>
            {!items.length ? (
              <div className="empty">
                <ShoppingBagIcon />
                <p>Your bag is waiting for a good thing.</p>
                <a className="solid-link" href="/#collection">
                  Explore the collection <ArrowRight size={15} />
                </a>
              </div>
            ) : (
              items.map((item) => (
                <div className="bag-item" key={item.id}>
                  <img
                    src={item.image}
                    alt={item.name}
                    style={{ objectPosition: item.position }}
                  />
                  <div>
                    <h4>{item.name}</h4>
                    <p>{money(item.price)}</p>
                    <div className="quantity">
                      <button
                        type="button"
                        disabled={busy || submitting}
                        aria-label={`Remove one ${item.name}`}
                        onClick={() =>
                          setQuantity(item.id, item.quantity - 1).catch((e) =>
                            toast.error(e.message),
                          )
                        }
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        disabled={busy || submitting || item.quantity >= 20}
                        aria-label={`Add one ${item.name}`}
                        onClick={() =>
                          setQuantity(item.id, item.quantity + 1).catch((e) =>
                            toast.error(e.message),
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <span className="small">
                    {money(item.price * item.quantity)}
                  </span>
                </div>
              ))
            )}
            <div className="money-row">
              <span>Subtotal</span>
              <span>{money(amount.subtotal)}</span>
            </div>
            <div className="money-row">
              <span>Delivery</span>
              <span>
                {items.length
                  ? amount.shipping
                    ? money(amount.shipping)
                    : "On us"
                  : "—"}
              </span>
            </div>
            <div className="money-row total">
              <strong>Total</strong>
              <strong>{money(amount.total)}</strong>
            </div>
            <p className="small">All prices in Nigerian naira.</p>
          </aside>
        </div>
      )}
    </main>
  );
}
function ShoppingBagIcon() {
  return <span style={{ font: "38px Georgia" }}>o.</span>;
}
