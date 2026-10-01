"use client";
import { ArrowRight, Plus, Leaf, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useShop } from "./shop-context";
import { money } from "@/lib/commerce";
export default function Store() {
  const { products, items, busy, ready, setQuantity } = useShop();
  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">OBJECTS FOR EVERYDAY LIVING</p>
          <h1>
            Make room
            <br />
            for the <em>everyday.</em>
          </h1>
          <p className="intro">
            Good things for slow mornings, shared tables,
            <br />
            and all the moments in between.
          </p>
          <a className="solid-link" href="#collection">
            Find your next favourite <ArrowRight size={18} />
          </a>
          <div className="hero-note">
            Considered essentials. Lasting comfort.
          </div>
        </div>
        <div
          className="hero-art"
          role="img"
          aria-label="Cream ceramic vase, olive linen and terracotta bowl in warm sunlight"
        >
          <div className="image-caption">
            THE EVERYDAY EDIT <span>01 — 08</span>
          </div>
        </div>
      </section>
      <section id="collection" className="collection">
        <div className="section-head">
          <div>
            <p className="eyebrow">FEWER, BETTER THINGS</p>
            <h2>The everyday collection</h2>
          </div>
          <p>Made for your kind of home.</p>
        </div>
        <div className="products">
          {products.map((p) => (
            <article key={p.id}>
              <div className="product-photo">
                <img
                  src={p.image}
                  alt={p.name}
                  width={768}
                  height={768}
                  loading="lazy"
                />
                <span>THE HOME EDIT</span>
              </div>
              <p className="category">{p.category}</p>
              <div className="product-title">
                <h3>{p.name}</h3>
                <span>{money(p.price)}</span>
              </div>
              <p className="small product-description">{p.description}</p>
              <Button
                disabled={busy || !ready}
                variant="outline"
                className="add-button"
                onClick={async () => {
                  try {
                    const n =
                      (items.find((x) => x.id === p.id)?.quantity || 0) + 1;
                    await setQuantity(p.id, n);
                    toast.success(`${p.name} added to your bag`, {
                      action: {
                        label: "View bag",
                        onClick: () => (location.href = "/checkout"),
                      },
                    });
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Add to bag <Plus size={16} />
              </Button>
            </article>
          ))}
        </div>
      </section>
      <section className="values">
        <div>
          <Leaf />
          <span>
            Thoughtfully selected<p>Objects that earn their place.</p>
          </span>
        </div>
        <div>
          <PackageCheck />
          <span>
            A little care in every order<p>Packed for the journey home.</p>
          </span>
        </div>
      </section>
    </main>
  );
}
