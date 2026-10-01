"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, LockKeyhole, ArrowRight, ShieldCheck, Truck, Mail, ShoppingBag, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useShop, api } from "../shop-context";
import { money, totals } from "@/lib/commerce";
import { openInlinePayment } from "@/lib/inline-payment";
import { Button } from "@/components/ui/button";
export default function Checkout() {
  const { items, user, ready, busy, preview, googleReady, paymentReady, setQuantity, refresh } =
    useShop();
  const [submitting, setSubmitting] = useState(false),
    [error, setError] = useState(""),
    [key, setKey] = useState(""),
    [pendingReference, setPendingReference] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [emailPending, setEmailPending] = useState(false),
    [verifying, setVerifying] = useState(false);
  async function verifyPayment(reference: string) {
    setVerifying(true);
    try {
      const result = await api("/payment/verify", {method: "POST", body: JSON.stringify({reference})});
      if (!result.paid) throw Error("Payment is awaiting verification. Please check your orders.");
      setEmailPending(result.emailPending);
      setConfirmed(true);
      setPendingReference("");
      await refresh();
    } finally { setVerifying(false); }
  }
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
      if (pendingReference) { await verifyPayment(pendingReference); return; }
      const result = await api("/checkout", {
        method: "POST",
        body: JSON.stringify({ delivery, idempotencyKey }),
      });
      if (result.paid || await openInlinePayment(result.accessCode)) {
        setPendingReference(result.reference);
        await verifyPayment(result.reference);
      } else {
        toast.info("Payment window closed. Your bag and details are still here.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally { setSubmitting(false); }
  }
  return (
    <main className="checkout">
      <a href="/#collection" className="back">
        <ArrowLeft size={14} />
        Back to the collection
      </a>
      <div className="checkout-heading">
        <div><p className="eyebrow">A FEW GOOD THINGS, ALMOST HOME</p><h1>Your bag & checkout</h1><p>Every detail in one place. A secure finishing touch.</p></div>
        <span className="secure-label"><LockKeyhole size={16} /> Secure checkout</span>
      </div>
      <div className="checkout-test-note"><span>TEST MODE</span> Try the complete checkout. No real charges or shipments.</div>
      {confirmed ? (
        <section className="empty-checkout" aria-live="polite"><span className="empty-bag-icon"><CheckCircle2 size={36} /></span><p className="eyebrow">PAYMENT CONFIRMED</p><h2>Thank you for your patronage!</h2><p>{emailPending ? "Your test order is confirmed. We’re retrying your confirmation email." : "Your test order is confirmed. Your confirmation email has been submitted for delivery."}</p><a className="solid-link" href="/orders">View your order <ArrowRight size={16} /></a></section>
      ) : !ready ? (
        <p className="loading">Opening your bag…</p>
      ) : !items.length ? (
        <section className="empty-checkout">
          <span className="empty-bag-icon"><ShoppingBag size={32} strokeWidth={1.3} /></span>
          <p className="eyebrow">ROOM FOR SOMETHING GOOD</p>
          <h2>Your bag is waiting for you.</h2>
          <p>Explore our collection of everyday comforts.<br />We’ll keep your favourites here when you add them.</p>
          <a className="solid-link" href="/#collection">Explore the collection <ArrowRight size={16} /></a>
          <div className="empty-assurance"><span><ShieldCheck size={16} /> Secure Paystack checkout</span><span><Mail size={16} /> Email confirmation after payment</span></div>
        </section>
      ) : (
        <>
        <ol className="checkout-steps" aria-label="Checkout steps"><li><span>1</span> Your account</li><li><span>2</span> Delivery details</li><li><span>3</span> Secure payment</li></ol>
        <div className="checkout-grid">
          <form onSubmit={pay} onChange={() => setKey("")}>
            <section className="panel">
              <h3><span className="step-number">01</span> Your account</h3>
              {user ? (
                <div className="verified-account"><CheckCircle2 size={22} /><div><strong>{user.name}</strong><span>{user.email}</span><p>Your order confirmation will be sent here.</p></div><span className="verified-tag">Signed in</span></div>
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
              <h3><span className="step-number">02</span> Delivery details</h3>
              <p className="small">
                Delivery within Nigeria. ₦2,500 delivery; free on orders from
                ₦75,000.
              </p>
              <p className="field-note">All fields are required unless marked optional.</p>
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
                      placeholder={{name: "Your full name", phone: "e.g. 0801 234 5678", address: "House number and street", city: "e.g. Ikeja", state: "e.g. Lagos", postal: "Postal code"}[f.name]}
                      disabled={submitting}
                    />
                  </label>
                ))}
              </div>
            </section>
            <section className="panel">
              <h3><span className="step-number">03</span> Secure payment</h3>
              <p className="small">
                <LockKeyhole
                  size={14}
                  style={{ display: "inline", marginRight: 7 }}
                />
                Your card details stay on Paystack’s secure checkout.
              </p>
              <div className="payment-provider"><ShieldCheck size={26} /><div><strong>Paystack</strong><span>Complete your test payment here, without leaving the shop.</span></div><span className="provider-test">TEST</span></div>
              {!user && <p className="field-note">Sign in or create an account above to continue to payment.</p>}
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
                  ? verifying ? "Verifying your payment…" : "Opening secure payment…"
                  : pendingReference ? "Check payment status" : !paymentReady ? "Test payments are being connected" : `Pay ${money(amount.total)} with Paystack`}
              </button>
              <p className="payment-footnote"><Mail size={14} /> A confirmation email follows your verified payment.</p>
              <a className="checkout-help" href="/help#payments">How checkout works <ArrowRight size={12} /></a>
            </section>
          </form>
          <aside className="summary">
            <div className="summary-heading"><h3>Your order</h3><span>{items.reduce((n, item) => n + item.quantity, 0)} items</span></div><p className="small">A little something for home.</p>
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
            <p className="small">All prices in Nigerian naira. Delivery included above.</p>
            <div className="checkout-assurances"><div><Truck size={20} /><p><strong>Delivery within Nigeria</strong><span>₦2,500 · Free from ₦75,000</span></p></div><div><LockKeyhole size={20} /><p><strong>Secure payment</strong><span>Paystack payment window · Stay on this page</span></p></div><div><Mail size={20} /><p><strong>Keep track of every order</strong><span>Email confirmation & saved order history</span></p></div></div>
          </aside>
        </div>
        </>
      )}
    </main>
  );
}
function ShoppingBagIcon() { return <ShoppingBag size={30} />; }
