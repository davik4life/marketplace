"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { api, useShop } from "./shop-context";

export function AuthPage({ signup = false }: { signup?: boolean }) {
  const { user, ready, googleReady } = useShop();
  const [retrying, setRetrying] = useState(false);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    const status = new URLSearchParams(location.search).get("auth");
    if (status === "unavailable") setAuthError("We couldn’t complete Google sign-in. Please try again.");
    if (status === "no-account") setAuthError("There’s no Okirika account for this Google account yet. Create an account to get started.");
    if (status === "exists") setAuthError("You already have an Okirika account. Please sign in instead.");
    if (status === "cancelled") setAuthError("Sign-in was cancelled. You can try again below.");
  }, []);
  return (
    <main className="signin-page">
      <div className="signin-photo" role="img" aria-label="Thoughtfully chosen pieces for your home" />
      <section className="signin-card">
        <a href="/#collection" className="back"><ArrowLeft size={14} /> Back to the collection</a>
        <p className="eyebrow">{signup ? "NEW TO OKIRIKA" : "YOUR OKIRIKA"}</p>
        <h1>{signup ? "Make yourself at home." : "Welcome home."}</h1>
        <p>{signup ? "Create your account to save your favourites, keep your orders together, and bring a few good things home." : "Sign in to your account to pick up where you left off, check your orders, and revisit your favourites."}</p>
        {authError && <p className="error" role="alert">{authError}</p>}
        {!ready ? <p aria-live="polite">Getting things ready…</p> : user ? (
          <><p className="small">You’re signed in as {user.email}.</p><a className="solid-link" href="/#collection">Explore the collection <ArrowRight size={16} /></a><a className="back" href="/orders">View your orders</a><button className="subtle-button" disabled={retrying} onClick={async () => { setRetrying(true); try { await api("/account/welcome", {method:"POST"}); toast.success("Any pending welcome email has been processed."); } catch (e) { toast.error((e as Error).message); } finally { setRetrying(false); } }}>{retrying ? "Checking…" : "Retry pending welcome email"}</button></>
        ) : googleReady ? (
          <a className="google-button" href={signup ? "/api/auth/google?intent=signup" : "/api/auth/google?intent=signin"}><span aria-hidden="true">G</span> {signup ? "Sign up with Google" : "Sign in with Google"} <ArrowRight size={16} /></a>
        ) : <p role="status">Google sign-in is temporarily unavailable. Please try again shortly.</p>}
        {!user && <p className="auth-switch">{signup ? "Already at home here? " : "New to Okirika? "}<a href={signup ? "/signin" : "/signup"}>{signup ? "Sign in" : "Create an account"} <ArrowRight size={14} /></a></p>}
        <p className="small signin-privacy"><LockKeyhole size={14} /> Secure sign-in. We use your name and email for your account and order confirmations.</p>
        <p className="small">Try the complete checkout with Paystack test payments. No real charges or shipments.</p>
      </section>
    </main>
  );
}

