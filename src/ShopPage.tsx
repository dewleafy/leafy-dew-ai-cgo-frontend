import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "./api";
import "./shop-page.css";

// Leafy Dew Amazon Brand Store (clean link, no visit tracking parts).
const BRAND_STORE_URL = "https://www.amazon.in/stores/page/88406B56-85D9-419E-A977-71CE99DC4AC0";

type ShopItem = { asin: string; name: string; family: string; imageUrl: string | null; buyerLink: string };

// Public link-in-bio page. No login. Reads only products the owner marked OK.
export function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [family, setFamily] = useState("All");
  const [featuredAsin, setFeaturedAsin] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Leafy Dew | Shop on Amazon";
    let alive = true;
    fetch(`${API_BASE}/api/public/shop`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data: { items?: ShopItem[]; featuredAsin?: string | null }) => { if (alive) { setItems(Array.isArray(data.items) ? data.items : []); setFeaturedAsin(data.featuredAsin ?? null); setState("ok"); } })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, []);

  const families = useMemo(() => ["All", ...Array.from(new Set(items.map((item) => item.family))).sort()], [items]);
  // A post can link straight to its product with /shop?p=ASIN. Otherwise the owner's featured product is used.
  const wanted = new URLSearchParams(window.location.search).get("p");
  const featured = items.find((item) => item.asin === wanted) ?? items.find((item) => item.asin === featuredAsin) ?? null;
  const rest = items.filter((item) => item.asin !== featured?.asin);
  const shown = family === "All" ? rest : rest.filter((item) => item.family === family);

  return (
    <main className="shop">
      <header className="shop-head">
        <img src="/ld-logo.png" alt="Leafy Dew" width={64} height={64} />
        <h1>Leafy Dew</h1>
        <p>Connecting people with nature. Tap a product to see it on Amazon.</p>
      </header>

      {state === "loading" ? <p className="shop-note">Loading...</p> : null}
      {state === "error" ? <p className="shop-note">Could not load products. Please try again in a moment.</p> : null}

      {state === "ok" ? (
        <>
          {featured ? (
            <a className="shop-featured" href={featured.buyerLink} target="_blank" rel="noopener noreferrer">
              <span className="shop-tag">Featured in our latest post</span>
              {featured.imageUrl ? <img src={featured.imageUrl} alt={featured.name} /> : <div className="shop-noimg" />}
              <span className="shop-name">{featured.name}</span>
              <span className="shop-btn">Buy on Amazon</span>
            </a>
          ) : null}
          <nav className="shop-chips" aria-label="Product types">
            {families.map((name) => (
              <button key={name} type="button" className={name === family ? "shop-chip on" : "shop-chip"} onClick={() => setFamily(name)}>{name}</button>
            ))}
          </nav>
          <section className="shop-grid">
            {shown.map((item) => (
              <a className="shop-card" key={item.asin} href={item.buyerLink} target="_blank" rel="noopener noreferrer">
                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} loading="lazy" /> : <div className="shop-noimg" />}
                <span className="shop-name">{item.name}</span>
                <span className="shop-btn">Buy on Amazon</span>
              </a>
            ))}
          </section>
        </>
      ) : null}
      <a className="shop-store" href={BRAND_STORE_URL} target="_blank" rel="noopener noreferrer">See all Leafy Dew products on Amazon</a>
      <footer className="shop-foot">Links open Amazon.in. Leafy Dew</footer>
    </main>
  );
}
