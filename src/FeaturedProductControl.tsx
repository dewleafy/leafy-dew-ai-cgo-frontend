import { useEffect, useState } from "react";
import { API_BASE, shopFeatureApi } from "./api";

type Item = { asin: string; name: string };

// Owner control: pick the product shown at the top of the public /shop page.
export function FeaturedProductControl() {
  const [items, setItems] = useState<Item[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetch(`${API_BASE}/api/public/shop`)
      .then((r) => r.json())
      .then((d: { items?: Item[]; featuredAsin?: string | null }) => { setItems(d.items ?? []); setCurrent(d.featuredAsin ?? null); })
      .catch(() => setMsg("Could not load products."));
  }
  useEffect(load, []);

  async function save(asin: string | null) {
    setBusy(true);
    setMsg(null);
    try {
      await shopFeatureApi.set(asin);
      setMsg(asin ? "Saved. It can take up to a minute to show on /shop." : "Cleared.");
      setCurrent(asin);
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const currentName = items.find((i) => i.asin === current)?.name;

  return (
    <section className="sm-real">
      <div className="sm-zh"><h2>Featured on your shop page</h2><span className="sm-pill sm-pill-live">live data</span></div>
      <p className="sm-zs">The product shown first on app.leafydew.in/shop, under "Featured in our latest post". Currently: {currentName ?? "nothing featured"}.</p>
      <div className="sm-realact" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ maxWidth: 320 }}>
          <option value="">Choose a product...</option>
          {items.map((i) => <option key={i.asin} value={i.asin}>{i.name}</option>)}
        </select>
        <button type="button" disabled={busy || !pick} onClick={() => save(pick)}>Feature this</button>
        <button type="button" className="secondary" disabled={busy || !current} onClick={() => save(null)}>Clear</button>
      </div>
      {msg ? <div className="sm-empty">{msg}</div> : null}
    </section>
  );
}
