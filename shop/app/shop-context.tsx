"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ShoppingBag, ArrowUpRight } from "lucide-react";
import { sampleProducts } from "@/lib/catalog";
export type Product = (typeof sampleProducts)[number];
export type Item = Product & { quantity: number };
type User = { id: string; name: string; email: string };
export async function api(path: string, options: RequestInit = {}) {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = (await response.json()) as any;
  if (!response.ok)
    throw Error(data.error || "Something went wrong. Please try again.");
  return data;
}
const ShopContext = createContext<any>(null);
export function useShop() {
  return useContext(ShopContext) as {
    items: Item[];
    products: Product[];
    user: User | null;
    preview: boolean;
    ready: boolean;
    busy: boolean;
    error: string;
    googleReady: boolean;
    paymentReady: boolean;
    setQuantity: (id: string, n: number) => Promise<void>;
    refresh: () => Promise<void>;
  };
}
export function ShopProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]),
    [products, setProducts] = useState<Product[]>(sampleProducts),
    [user, setUser] = useState<User | null>(null),
    [preview, setPreview] = useState(true),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [googleReady, setGoogleReady] = useState(false),
    [paymentReady, setPaymentReady] = useState(false);
  const refresh = useCallback(async () => {
    setError("");
    try {
      const [catalog, me] = await Promise.all([api("/catalog"), api("/me")]);
      setProducts(catalog.products);
      setPreview(catalog.preview);
      setUser(me.user);
      setGoogleReady(me.googleReady);
      setPaymentReady(me.paymentReady);
      if (me.configured) {
        const cart = await api("/cart");
        setItems(cart.items);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const params = new URLSearchParams(location.search);
    const auth = params.get("auth");
    if (params.get("welcome") === "sent") toast.success("Your account is ready. Your welcome email has been submitted for delivery.");
    if (params.get("welcome") === "pending") toast.info("Your account is ready. We’ll retry your welcome email shortly.");
    if (auth === "unavailable")
      toast.error(
        "Google sign-in is unavailable. Please check the shop configuration.",
      );
    if (auth === "cancelled")
      toast.info("Sign-in cancelled. You can try again whenever you’re ready.");
  }, [refresh]);
  const setQuantity = useCallback(
    async (id: string, n: number) => {
      if (preview)
        throw Error(
          "This is a catalog preview. The shop owner needs to connect the database before bags can be saved.",
        );
      if (!Number.isInteger(n) || n < 0 || n > 20)
        throw Error("Choose between 0 and 20 items.");
      setBusy(true);
      try {
        const cart = await api("/cart", {
          method: "PUT",
          body: JSON.stringify({ productId: id, quantity: n }),
        });
        setItems(cart.items);
      } finally {
        setBusy(false);
      }
    },
    [preview],
  );
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifetime = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "set_bag_quantity",
          description:
            "Set a product quantity in the saved shopping bag. Zero removes it. Does not purchase or pay.",
          inputSchema: {
            type: "object",
            properties: {
              productId: { type: "string" },
              quantity: { type: "integer", minimum: 0, maximum: 20 },
            },
            required: ["productId", "quantity"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: async (input: any) => {
            if (
              !input ||
              typeof input.productId !== "string" ||
              !Number.isInteger(input.quantity) ||
              Object.keys(input).some(
                (k) => !["productId", "quantity"].includes(k),
              )
            )
              throw Error("Invalid bag request");
            await setQuantity(input.productId, input.quantity);
            return {
              productId: input.productId,
              quantity: input.quantity,
              saved: true,
            };
          },
        },
        { signal: lifetime.signal },
      ),
    ).catch(() => {});
    return () => lifetime.abort();
  }, [setQuantity]);
  return (
    <ShopContext.Provider
      value={{
        items,
        products,
        user,
        preview,
        ready,
        busy,
        error,
        googleReady,
        paymentReady,
        setQuantity,
        refresh,
      }}
    >
      <div className="announcement">
        A little more home. A little more you.{" "}
        <span>Thoughtfully chosen, beautifully lived in.</span>
      </div>
      <header>
        <a className="wordmark" href="/">
          okirika<span>®</span>
        </a>
        <nav>
          <a href="/#collection">The collection</a>
          <a href="/checkout">
            Your bag <ShoppingBag size={17} />
            <span>({items.reduce((s, x) => s + x.quantity, 0)})</span>
          </a>
          {user && <a href="/orders">Orders</a>}
        </nav>
        {user ? (
          <button
            className="subtle-button"
            onClick={async () => {
              try {
                await api("/auth/logout", { method: "POST" });
                location.href = "/";
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Sign out
          </button>
        ) : (
          <a className="signin" href="/signin">
            Sign in <ArrowUpRight size={15} />
          </a>
        )}
      </header>
      {ready && preview && (
        <div className="notice">
          You’re viewing the sample collection. Shopping and sign-in will open
          once the shop is connected.
        </div>
      )}
      {error && (
        <div className="notice" role="alert">
          {error}{" "}
          <button className="subtle-button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}
      {children}
      <footer className="store-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <a className="wordmark" href="/" aria-label="Okirika home">okirika<span>®</span></a>
            <h2>A home is made<br />of little things.</h2>
            <p>Considered objects. Everyday comforts. A collection of good things to make your space feel like you.</p>
            <a className="footer-explore" href="/#collection">Find your next favourite <ArrowUpRight size={16} /></a>
          </div>
          <nav className="footer-links" aria-label="Shop links">
            <h3>MAKE YOURSELF AT HOME</h3>
            <a href="/#collection">Shop the collection</a>
            <a href="/checkout">Your shopping bag</a>
            <a href="/orders">Your orders</a>
            <a href="/signin">Sign in</a>
            <a href="/signup">Create an account</a>
          </nav>
          <nav className="footer-links" aria-label="Shopping help">
            <h3>THE HELPFUL DETAILS</h3>
            <a href="/help#delivery">Delivery information</a>
            <a href="/help#payments">Payments & checkout</a>
            <a href="/help#orders">Order confirmations</a>
            <a href="/help#privacy">Your account & privacy</a>
          </nav>
          <div className="footer-note">
            <span className="footer-note-label">GOOD TO KNOW</span>
            <h3>A little something<br />for home.</h3>
            <p>Delivery within Nigeria.<br />₦2,500 delivery, on us from ₦75,000.</p>
            <span className="footer-test">Currently in test mode</span>
            <p>No real charges or shipments while we get ready to welcome you.</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Okirika. All rights reserved.</span>
          <span>Nigeria · NGN ₦</span>
          <span className="footer-payment">Secure checkout with <strong>Paystack</strong> <span>TEST</span></span>
        </div>
      </footer>
      <Toaster position="bottom-right" />
    </ShopContext.Provider>
  );
}
