import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./App.css";
import { getJson } from "./api";
import type { AnyRecord, ApiRows } from "./types";

const SELLER_ID = "default";

// -----------------------------------------------------------------------------
// TYPES & NAVIGATION
// -----------------------------------------------------------------------------
const founderTabs = ["Today", "Catalog", "Product Detail", "Approvals", "Growth", "Brand", "Sales & Ads", "Reports", "More"] as const;
type FounderTab = (typeof founderTabs)[number];
type AppPage = FounderTab | string;

type LoadState<T> = { data: T | null; loading: boolean; error: string | null };
const emptyState = <T,>(): LoadState<T> => ({ data: null, loading: true, error: null });

function useApi<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<LoadState<T>>(emptyState<T>());
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    loader()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch(() => {
        if (alive) setState({ data: null, loading: false, error: "Error loading data." });
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, ...deps]);

  return { ...state, reload: () => setReloadKey((key) => key + 1) };
}

// -----------------------------------------------------------------------------
// CORE DATA HELPERS
// -----------------------------------------------------------------------------
function recordOf(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function recordsOf(value: unknown): AnyRecord[] {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === "object" && v !== null) as AnyRecord[];
  }
  return [];
}

function readNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatEmpty(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(numeric);
}

function formatPercent(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toFixed(1)}%`;
}

function readFirst(source: unknown, keys: string[]): unknown {
  const root = recordOf(source);
  for (const key of keys) {
    if (root[key] !== undefined && root[key] !== null && root[key] !== "") return root[key];
  }
  return undefined;
}

function cleanFounderText(value: unknown, fallback = "Not available yet"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function isValidImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("/");
}

function getProductImage(product: unknown): string | null {
  const record = recordOf(product);
  const imageUrls = Array.isArray(record.imageUrls) ? (record.imageUrls as string[]) : [];
  const images = Array.isArray(record.images) ? (record.images as string[]) : [];
  
  const candidates = [
    record.mainImageUrl, record.imageUrl, record.amazonImageUrl, 
    record.image_url, record.productImageUrl, imageUrls[0], images[0]
  ];
  
  for (const candidate of candidates) {
    if (isValidImageUrl(candidate)) return candidate;
  }
  
  const economics = recordOf(record.economics);
  if (isValidImageUrl(economics.mainImageUrl)) return economics.mainImageUrl as string;
  if (isValidImageUrl(economics.imageUrl)) return economics.imageUrl as string;
  return null;
}

function productKeyOf(row: AnyRecord, index = 0): string {
  const sku = cleanFounderText(readFirst(row, ["sku", "sellerSku"]), "");
  const asin = cleanFounderText(readFirst(row, ["asin"]), "");
  const id = cleanFounderText(readFirst(row, ["id", "key"]), "");
  return sku || asin || id || `product-${index}`;
}

type FounderProduct = {
  key: string;
  name: string;
  brand: string;
  sku: string;
  asin: string;
  category: string;
  price: unknown;
  netProfit: unknown;
  margin: unknown;
  profitStatus: unknown;
  readiness: unknown;
  costStatus: unknown;
  status: unknown;
  raw: AnyRecord;
};

type FounderNavigate = (page: AppPage, product?: FounderProduct | null) => void;

function normalizeFounderProduct(source: AnyRecord, index = 0): FounderProduct {
  const economics = recordOf(source.economics);
  return {
    key: productKeyOf(source, index),
    name: cleanFounderText(readFirst(source, ["productName", "title", "name", "itemName"]) ?? readFirst(economics, ["productName"]), "Unnamed product"),
    brand: cleanFounderText(readFirst(source, ["brand", "brandName"]), "Leafy Dew"),
    sku: cleanFounderText(readFirst(source, ["sku", "sellerSku"]), "-"),
    asin: cleanFounderText(readFirst(source, ["asin"]), "-"),
    category: cleanFounderText(readFirst(source, ["category", "subCategory"]), "-"),
    price: readFirst(source, ["sellingPrice", "price"]) ?? readFirst(economics, ["sellingPrice"]),
    netProfit: readFirst(source, ["netProfit"]) ?? readFirst(economics, ["netProfit"]),
    margin: readFirst(source, ["profitMargin", "margin"]) ?? readFirst(economics, ["profitMargin"]),
    profitStatus: readFirst(source, ["profitStatus", "currentProfitStatus"]) ?? readFirst(economics, ["profitStatus"]),
    readiness: readFirst(source, ["readiness", "status", "readinessStatus"]),
    costStatus: readFirst(source, ["costStatus", "profitDataStatus"]) ?? readFirst(economics, ["costStatus"]),
    status: readFirst(source, ["status", "listingStatus"]),
    raw: source
  };
}

function mergeFounderProducts(...sources: unknown[]): FounderProduct[] {
  const byKey = new Map<string, AnyRecord>();
  sources.forEach((source) => {
    recordsOf(source).forEach((row: AnyRecord, index: number) => {
      const key = productKeyOf(row, index);
      byKey.set(key, { ...(byKey.get(key) ?? {}), ...row, economics: { ...recordOf((byKey.get(key) ?? {}).economics), ...recordOf(row.economics) } });
    });
  });
  return Array.from(byKey.values()).map((row, index) => normalizeFounderProduct(row, index));
}

// -----------------------------------------------------------------------------
// UI COMPONENTS
// -----------------------------------------------------------------------------
type FounderIconName = "spark" | "check" | "cost" | "box" | "approval" | "growth" | "brand" | "sales" | "report" | "shield" | "bell" | "arrow" | "chart";

function FounderIcon({ name, className = "w-5 h-5" }: { name: FounderIconName; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 2 };
  const paths: Record<FounderIconName, ReactNode> = {
    spark: <><path {...common} d="M12 3l1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5L12 3z" /><path {...common} d="M19 15l.8 2.7 2.7.8-2.7.8L19 23l-.8-2.7-2.7-.8 2.7-.8L19 15z" /></>,
    check: <><path {...common} d="M20 6L9 17l-5-5" /><path {...common} d="M21 12a9 9 0 1 1-3-6.7" /></>,
    cost: <><path {...common} d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" /><path {...common} d="M9 9h6M9 13h6" /></>,
    box: <><path {...common} d="M4 8l8-4 8 4-8 4-8-4z" /><path {...common} d="M4 8v8l8 4 8-4V8" /><path {...common} d="M12 12v8" /></>,
    approval: <><path {...common} d="M5 12l4 4L19 6" /><path {...common} d="M4 20h16" /></>,
    growth: <><path {...common} d="M4 19V5" /><path {...common} d="M4 19h16" /><path {...common} d="M7 15l4-4 3 3 5-7" /></>,
    brand: <><path {...common} d="M12 3l7 4v5c0 4.5-2.9 7.7-7 9-4.1-1.3-7-4.5-7-9V7l7-4z" /><path {...common} d="M9 12h6" /></>,
    sales: <><path {...common} d="M5 19V9" /><path {...common} d="M12 19V5" /><path {...common} d="M19 19v-7" /></>,
    report: <><path {...common} d="M7 3h7l5 5v13H7z" /><path {...common} d="M14 3v5h5" /><path {...common} d="M9 14h6M9 18h4" /></>,
    shield: <><path {...common} d="M12 3l7 4v5c0 4.5-2.9 7.7-7 9-4.1-1.3-7-4.5-7-9V7l7-4z" /><path {...common} d="M9 12l2 2 4-4" /></>,
    bell: <><path {...common} d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path {...common} d="M10 21h4" /></>,
    arrow: <><path {...common} d="M5 12h14" /><path {...common} d="M13 6l6 6-6 6" /></>,
    chart: <><path {...common} d="M4 19h16" /><path {...common} d="M7 16v-5" /><path {...common} d="M12 16V7" /><path {...common} d="M17 16v-8" /></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>{paths[name]}</svg>;
}

function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: string; className?: string }) {
  const baseClasses = "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap";
  const toneClasses = {
    good: "bg-green-50 text-green-700 border border-green-100",
    watch: "bg-orange-50 text-orange-700 border border-orange-100",
    risk: "bg-red-50 text-red-700 border border-red-100",
    neutral: "bg-gray-50 text-gray-600 border border-gray-200"
  }[tone] || "bg-gray-50 text-gray-600 border border-gray-200";
  return <span className={`${baseClasses} ${toneClasses} ${className}`}>{children}</span>;
}

function StatusBadge({ value }: { value: unknown }) {
  const label = formatEmpty(value).toUpperCase();
  const tone = ["READY", "PASS", "APPROVED", "ACTIVE", "RUNNING", "SUCCESS", "GOOD", "PROFITABLE"].some(t => label.includes(t))
    ? "good"
    : ["WATCH", "WARN", "PENDING", "DRAFT", "REVIEW", "MEDIUM", "PARTIAL", "MISSING"].some(t => label.includes(t))
      ? "watch"
      : ["RISK", "ERROR", "FAIL", "REJECTED", "HIGH", "CRITICAL"].some(t => label.includes(t))
        ? "risk"
        : "neutral";
  return <Badge tone={tone}>{label.replace(/_/g, " ")}</Badge>;
}

function StubPage({ title, navigate }: { title: string; navigate: FounderNavigate }) {
  return (
    <div className="p-8 max-w-4xl mx-auto mt-10 bg-white rounded-2xl shadow-sm border border-gray-100 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{title}</h1>
      <p className="text-gray-500 mb-8">This module is part of the backend workspace. It is currently under construction.</p>
      <button onClick={() => navigate("Today")} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition">
        Return to Dashboard
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// DASHBOARD (REAL BACKEND INTEGRATION)
// -----------------------------------------------------------------------------
function TodayDashboard({ navigate }: { navigate: FounderNavigate }) {
  // Fetch Real Backend Data
  const today = useApi<AnyRecord>(() => getJson(`/api/today-command/summary?sellerId=${SELLER_ID}`));
  const approvalsSummary = useApi<AnyRecord>(() => getJson(`/api/action-ledger/summary?sellerId=${SELLER_ID}`));
  const approvalsList = useApi<AnyRecord>(() => getJson(`/api/action-ledger?sellerId=${SELLER_ID}&limit=10`));
  const passports = useApi<ApiRows<AnyRecord>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<AnyRecord>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const ppc = useApi<AnyRecord>(() => getJson(`/api/amazon-ads/ppc-recommendations?sellerId=${SELLER_ID}&days=30`));
  const creativeSummary = useApi<AnyRecord>(() => getJson(`/api/creative-recommendations/summary?sellerId=${SELLER_ID}`));

  // Parse Data
  const data = recordOf(today.data?.summary ?? today.data?.todayCommand ?? today.data);
  const products = mergeFounderProducts(passports.data, economics.data);
  const approvalRows = recordsOf(approvalsList.data?.rows).slice(0, 4);
  const growthOpportunities = [...recordsOf(ppc.data?.scaleOpportunities), ...recordsOf(ppc.data?.watchlistRisks)].slice(0, 4);
  
  // Calculate Metrics from Backend
  const productCount = products.length;
  const activeListings = products.filter(p => String(p.status).toUpperCase().includes("ACTIVE")).length;
  const pendingCount = readNumber(readFirst(approvalsSummary.data, ["pendingCount", "summary.pendingCount"]));
  const missingCostCount = products.filter(p => {
    const s = String(p.costStatus).toUpperCase();
    return s.includes("MISSING") || s.includes("NEEDS") || s.includes("PARTIAL");
  }).length;
  const acosValue = formatPercent(readFirst(data, ["acos7d", "acos", "metrics.acos7d"]));
  const revenueValue = formatMoney(readFirst(data, ["sales7d", "revenue", "metrics.sales7d"]));
  const profitValue = formatMoney(readFirst(data, ["netProfit7d", "profit", "metrics.netProfit7d"]));

  // Brand Metrics from Backend
  const aplusLive = readNumber(readFirst(creativeSummary.data, ["aplusLive", "aPlusContentLive", "summary.aplusLive"]));
  const aplusTotal = readNumber(readFirst(creativeSummary.data, ["aplusTotal", "aPlusContentTotal", "summary.aplusTotal"])) || 18;

  // Placeholder Fallbacks
  const placeholderImg = "https://placehold.co/400x400/f8fafc/a1a1aa?text=Product+Image";

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 space-y-6 pb-12">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* CARD 1: Command Center */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition" onClick={() => navigate("Today")}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-green-800 text-white flex items-center justify-center font-bold text-sm">1</span>
              <h2 className="text-lg font-bold text-gray-900">Today / Command Center</h2>
            </div>
            <span className="text-gray-400">›</span>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            <p className="text-sm text-gray-500 mb-6 -mt-2">Your AI growth cockpit for today.</p>
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-2xl font-bold">AI</div>
                <div>
                  <h3 className="text-xl font-extrabold text-gray-900">Good morning, Founder! 👋</h3>
                  <p className="text-xs text-gray-500">Here's what your AI agent recommends from backend data.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="border border-green-100 bg-green-50/30 rounded-xl p-4 flex flex-col h-full">
                 <div className="flex items-center gap-2 mb-2 font-bold text-gray-900"><span className="text-green-600">✨</span> Run Daily AI</div>
                 <p className="text-xs text-gray-500 mb-4 flex-1">Get safe recommendations from engines.</p>
                 <button className="bg-green-700 hover:bg-green-800 text-white text-xs font-bold py-2 px-4 rounded-lg w-full transition">Run Daily AI</button>
              </div>
              <div className="border border-blue-100 bg-blue-50/30 rounded-xl p-4 flex flex-col h-full relative overflow-hidden">
                 <div className="flex items-center gap-2 mb-2 font-bold text-blue-900">Pending Approvals</div>
                 <p className="text-xs text-blue-700/70 mb-4 flex-1">{pendingCount} items waiting in Action Ledger.</p>
                 <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-lg w-full transition" onClick={() => navigate("Approvals")}>Review Now</button>
                 <div className="absolute top-4 right-4 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{pendingCount}</div>
              </div>
              <div className="border border-orange-100 bg-orange-50/30 rounded-xl p-4 flex flex-col h-full relative overflow-hidden">
                 <div className="flex items-center gap-2 mb-2 font-bold text-orange-900">Missing Cost Data</div>
                 <p className="text-xs text-orange-700/70 mb-4 flex-1">{missingCostCount} products missing passport costs.</p>
                 <button className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-2 px-4 rounded-lg w-full transition" onClick={() => navigate("Catalog")}>Fix Now</button>
                 <div className="absolute top-4 right-4 bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{missingCostCount}</div>
              </div>
            </div>

            <div className="mt-auto">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Quick Status (Backend)</h4>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 border-t border-gray-100 pt-4">
                <div className="text-center sm:text-left">
                  <div className="text-xs text-gray-500 mb-1">Total Products</div>
                  <div className="text-xl font-bold text-gray-900">{productCount}</div>
                </div>
                <div className="text-center sm:text-left border-l border-gray-100 pl-4">
                  <div className="text-xs text-gray-500 mb-1">Active Listings</div>
                  <div className="text-xl font-bold text-gray-900">{activeListings}</div>
                </div>
                <div className="text-center sm:text-left border-l border-gray-100 pl-4">
                  <div className="text-xs text-gray-500 mb-1">Revenue (7D)</div>
                  <div className="text-xl font-bold text-gray-900">{revenueValue}</div>
                </div>
                <div className="text-center sm:text-left border-l border-gray-100 pl-4">
                  <div className="text-xs text-gray-500 mb-1">Net Profit</div>
                  <div className="text-xl font-bold text-gray-900">{profitValue}</div>
                </div>
                <div className="text-center sm:text-left border-l border-gray-100 pl-4">
                  <div className="text-xs text-gray-500 mb-1">ACOS (7D)</div>
                  <div className="text-xl font-bold text-gray-900">{acosValue}</div>
                </div>
                <div className="text-center sm:text-left border-l border-gray-100 pl-4">
                  <div className="text-xs text-gray-500 mb-1">Safe Mode</div>
                  <div className="text-xl font-bold text-green-600">ON</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 2: Catalog / Product List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition" onClick={() => navigate("Catalog")}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-green-800 text-white flex items-center justify-center font-bold text-sm">2</span>
              <h2 className="text-lg font-bold text-gray-900">Catalog / Product List</h2>
            </div>
            <span className="text-gray-400">›</span>
          </div>
          <div className="p-6 flex-1 flex flex-col overflow-hidden">
            <p className="text-sm text-gray-500 mb-4 -mt-2">Backend products, pricing, and profit readiness.</p>
            <div className="overflow-auto flex-1 border border-gray-100 rounded-xl relative">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-2 py-3 font-semibold">SKU</th>
                    <th className="px-2 py-3 font-semibold">Price</th>
                    <th className="px-2 py-3 font-semibold">Profit</th>
                    <th className="px-2 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <FounderIcon name="box" className="w-6 h-6 text-gray-400" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-900 mb-1">No products found</h3>
                          <p className="text-xs text-gray-500 max-w-xs">Your backend database is currently empty. Connect your catalog to populate this list.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    products.slice(0, 5).map((p, i) => {
                      const img = getProductImage(p.raw) || placeholderImg;
                      return (
                        <tr key={String(p.key || i)} className="hover:bg-gray-50/50 transition cursor-pointer" onClick={() => navigate("Product Detail", p)}>
                          <td className="px-4 py-3 flex items-center gap-3">
                            <img src={img} alt="" className="w-8 h-8 object-cover rounded shadow-sm border border-gray-200 bg-white" />
                            <span className="font-semibold text-gray-800 truncate max-w-[150px]">{p.name}</span>
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-500">{p.sku}</td>
                          <td className="px-2 py-3 font-medium">{formatMoney(p.price)}</td>
                          <td className="px-2 py-3 font-bold text-green-600">{formatPercent(p.margin)}</td>
                          <td className="px-2 py-3"><StatusBadge value={p.profitStatus || "UNKNOWN"} /></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <button className="w-full text-center mt-4 text-sm font-bold text-blue-600 hover:text-blue-800 transition" onClick={() => navigate("Catalog")}>
              View all {productCount} backend products →
            </button>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CARD 3: Product Detail */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px]">
           <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition" onClick={() => navigate("Product Detail")}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-green-800 text-white flex items-center justify-center font-bold text-sm">3</span>
              <h2 className="text-lg font-bold text-gray-900">Product Detail <span className="text-gray-400 font-medium text-sm ml-1">(Data View)</span></h2>
            </div>
            <span className="text-gray-400">›</span>
          </div>
          <div className="p-6 flex-1 flex flex-col">
             {products.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <FounderIcon name="chart" className="w-6 h-6 text-gray-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">No product selected</h3>
                  <p className="text-xs text-gray-500 max-w-xs">Add products to your catalog to view deep intelligence.</p>
                </div>
             ) : (
               <div className="flex gap-6 h-full">
                  <div className="w-48 h-64 border border-gray-100 rounded-lg flex items-center justify-center p-4 bg-gray-50">
                     <img src={getProductImage(products[0].raw) || placeholderImg} alt="" className="w-full h-full object-contain mix-blend-multiply rounded" />
                  </div>
                  <div className="flex-1 flex flex-col">
                     <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2">{products[0].name}</h3>
                     <div className="text-sm text-gray-500 mb-4">SKU: {products[0].sku} | ASIN: {products[0].asin}</div>
                     <div className="text-2xl font-bold text-gray-900 mb-4 border-b border-gray-100 pb-4">{formatMoney(products[0].price)}</div>
                     <div className="space-y-3 mb-6 flex-1">
                        <div className="flex justify-between items-center text-sm"><span className="text-gray-500">Margin</span> <span className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded">{formatPercent(products[0].margin)}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="text-gray-500">Net Profit</span> <span className="font-bold text-gray-900">{formatMoney(products[0].netProfit)}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="text-gray-500">Status</span> <StatusBadge value={products[0].profitStatus || "UNKNOWN"} /></div>
                     </div>
                     <div className="grid grid-cols-2 gap-2 mt-auto">
                       <button className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded text-sm transition" onClick={() => navigate("Growth")}>Optimize Listing</button>
                       <button className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded text-sm transition" onClick={() => navigate("Sales & Ads")}>Manage Ads</button>
                     </div>
                  </div>
               </div>
             )}
          </div>
        </div>

        {/* CARD 4: Approvals */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px]">
           <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition" onClick={() => navigate("Approvals")}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-green-800 text-white flex items-center justify-center font-bold text-sm">4</span>
              <h2 className="text-lg font-bold text-gray-900">Decision Center</h2>
            </div>
            <span className="text-gray-400">›</span>
          </div>
          <div className="p-6 flex-1 flex flex-col overflow-hidden">
             <div className="overflow-auto flex-1 space-y-3">
                {approvalRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                      <FounderIcon name="approval" className="w-6 h-6 text-green-500" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Inbox Zero</h3>
                    <p className="text-xs text-gray-500 max-w-xs">No pending action ledger records requiring your review.</p>
                  </div>
                ) : (
                  approvalRows.map((row, i) => (
                     <div key={String(row.id ?? i)} className="flex justify-between items-center p-4 border border-gray-100 rounded-xl bg-white shadow-sm hover:border-green-300 hover:shadow-md transition">
                        <div className="flex gap-4 items-start">
                           <StatusBadge value={row.riskLevel || "LOW"} />
                           <div>
                              <h4 className="text-sm font-bold text-gray-900 leading-tight mb-1">{formatEmpty(row.title ?? row.recommendedAction)}</h4>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide">{formatEmpty(row.actionType)}</p>
                           </div>
                        </div>
                        <div className="text-right shrink-0">
                           <button className="bg-green-700 hover:bg-green-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-sm">Review</button>
                        </div>
                     </div>
                  ))
                )}
             </div>
             <button className="w-full text-center mt-4 pt-4 border-t border-gray-100 text-sm font-bold text-blue-600 hover:text-blue-800 transition" onClick={() => navigate("Approvals")}>
              View all {pendingCount} approvals →
            </button>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CARD 5: Growth Ideas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px]">
           <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition" onClick={() => navigate("Growth")}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-green-800 text-white flex items-center justify-center font-bold text-sm">5</span>
              <h2 className="text-lg font-bold text-gray-900">Growth Ideas (PPC)</h2>
            </div>
            <span className="text-gray-400">›</span>
          </div>
          <div className="p-6 flex-1 flex flex-col overflow-hidden">
             <div className="overflow-auto flex-1 space-y-3">
                {growthOpportunities.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                      <FounderIcon name="growth" className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">No PPC Opportunities</h3>
                    <p className="text-xs text-gray-500 max-w-xs">Connect your ads data to discover growth and optimization ideas.</p>
                  </div>
                ) : (
                   growthOpportunities.map((opp, i) => (
                      <div key={String(opp.id ?? i)} className="p-4 border border-gray-100 rounded-xl bg-gray-50 hover:bg-white hover:shadow-sm hover:border-gray-200 transition cursor-pointer">
                         <h4 className="text-sm font-bold text-gray-900 mb-1">{formatEmpty(opp.title ?? opp.recommendationType)}</h4>
                         <p className="text-xs text-gray-500 mb-3 line-clamp-2">{formatEmpty(opp.reason ?? opp.summary)}</p>
                         <div className="flex gap-2">
                           <StatusBadge value={opp.priorityLabel ?? opp.riskLevel ?? "MEDIUM"} />
                           <StatusBadge value={opp.confidenceLabel ?? "MEDIUM"} />
                         </div>
                      </div>
                   ))
                )}
             </div>
          </div>
        </div>

        {/* CARD 6: Brand Overview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px]">
           <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition" onClick={() => navigate("Brand")}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-green-800 text-white flex items-center justify-center font-bold text-sm">6</span>
              <h2 className="text-lg font-bold text-gray-900">Brand Overview</h2>
            </div>
            <span className="text-gray-400">›</span>
          </div>
          <div className="p-6 flex-1 flex flex-col overflow-hidden">
             <div className="grid grid-cols-2 gap-6 mb-6 border-b border-gray-100 pb-6">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                   <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">A+ Modules Live</div>
                   <div className="flex items-baseline gap-1">
                     <span className="text-3xl font-extrabold text-blue-600">{aplusLive}</span>
                     <span className="text-sm text-gray-400 font-bold">/ {aplusTotal}</span>
                   </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                   <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2">Store Status</div>
                   <div className="text-xl font-bold text-green-600 mt-1">Active</div>
                </div>
             </div>
             
             <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Top Brand Products</h4>
             <div className="space-y-3 mb-3 flex-1 overflow-auto">
                {products.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4 text-center bg-gray-50 rounded-lg">No products connected.</div>
                ) : (
                  products.slice(0, 3).map((p, i) => {
                    const img = getProductImage(p.raw) || placeholderImg;
                    return (
                      <div key={String(p.key || i)} className="flex gap-3 items-center p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
                         <img src={img} alt="" className="w-10 h-10 object-cover rounded shadow-sm border border-gray-200 bg-white" />
                         <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate mb-0.5">{p.name}</p>
                            <div className="text-xs text-gray-500 font-medium">{formatMoney(p.price)}</div>
                         </div>
                      </div>
                    )
                  })
                )}
             </div>
             <button className="w-full text-center mt-auto pt-4 border-t border-gray-100 text-sm font-bold text-blue-600 hover:text-blue-800 transition" onClick={() => navigate("Brand")}>
              View Brand Report →
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SECONDARY PAGES (Stubs to prevent TS2304)
// -----------------------------------------------------------------------------
function ProductsPage({ navigate }: { navigate: FounderNavigate }) { return <StubPage title="Catalog / Products" navigate={navigate} />; }
function ProductDetailPage({ navigate }: { product: FounderProduct | null; navigate: FounderNavigate }) { return <StubPage title="Product Detail" navigate={navigate} />; }
function FounderApprovalsPage({ navigate }: { navigate: FounderNavigate }) { return <StubPage title="Approvals" navigate={navigate} />; }
function GrowthPage({ navigate }: { navigate: FounderNavigate }) { return <StubPage title="Growth Ideas" navigate={navigate} />; }
function BrandPage({ navigate }: { navigate: FounderNavigate }) { return <StubPage title="Brand Overview" navigate={navigate} />; }
function SalesAdsPage({ navigate }: { navigate: FounderNavigate }) { return <StubPage title="Sales & Ads" navigate={navigate} />; }
function ReportsPage({ navigate }: { navigate: FounderNavigate }) { return <StubPage title="Reports" navigate={navigate} />; }
function MoreToolsPage({ navigate }: { navigate: FounderNavigate }) { return <StubPage title="More Tools" navigate={navigate} />; }

function DailyAiCgoPage({ setActiveTab }: { setActiveTab: (t: string) => void }) { return <StubPage title="Daily AI-CGO" navigate={() => setActiveTab("Today")} />; }
function ProductPassportPage() { return <StubPage title="Product Passport" navigate={() => {}} />; }
function ProductEconomicsPage() { return <StubPage title="Product Economics" navigate={() => {}} />; }
function PpcRecommendationsPage({ setActiveTab }: { setActiveTab: (t: string) => void }) { return <StubPage title="PPC Recommendations" navigate={() => setActiveTab("Today")} />; }
function EngineCommandCenterPage() { return <StubPage title="Engine Command Center" navigate={() => {}} />; }
function ApprovalCenterPage() { return <StubPage title="Approval Center" navigate={() => {}} />; }
function ApprovalExecutionPage({ setActiveTab }: { setActiveTab: (t: string) => void }) { return <StubPage title="Approval Execution" navigate={() => setActiveTab("Today")} />; }
function ExecutionGatewayPage() { return <StubPage title="Execution Gateway" navigate={() => {}} />; }
function LiveExecutionPage() { return <StubPage title="Live Execution" navigate={() => {}} />; }
function RollbackCenterPage() { return <StubPage title="Rollback Center" navigate={() => {}} />; }
function ListingDraftsPage({ setActiveTab }: { setActiveTab: (t: string) => void }) { return <StubPage title="Listing Drafts" navigate={() => setActiveTab("Today")} />; }
function CreativeRecommendationsPage({ setActiveTab }: { setActiveTab: (t: string) => void }) { return <StubPage title="Image + A+" navigate={() => setActiveTab("Today")} />; }
function SafetyControlPage() { return <StubPage title="Safety Control" navigate={() => {}} />; }
function LaunchGatePage() { return <StubPage title="Launch Gate" navigate={() => {}} />; }
function LaunchChecklistPage() { return <StubPage title="Launch Checklist" navigate={() => {}} />; }
function SchedulerControlPage() { return <StubPage title="Scheduler Control" navigate={() => {}} />; }
function NotificationOutboxPage() { return <StubPage title="Notification Outbox" navigate={() => {}} />; }
function SecurityGuardrailsPage() { return <StubPage title="Security Guardrails" navigate={() => {}} />; }
function AlertCenterPage({ setActiveTab }: { setActiveTab: (t: string) => void }) { return <StubPage title="Alert Center" navigate={() => setActiveTab("Today")} />; }
function ExperimentsPage() { return <StubPage title="Experiments" navigate={() => {}} />; }
function DataFreshnessPage() { return <StubPage title="Data Freshness" navigate={() => {}} />; }
function AiGatewayPage() { return <StubPage title="AI Gateway" navigate={() => {}} />; }
function ProductionHealthPage() { return <StubPage title="Production Health" navigate={() => {}} />; }
function QaSmokePage() { return <StubPage title="QA Smoke" navigate={() => {}} />; }
function MaintenancePage() { return <StubPage title="Maintenance" navigate={() => {}} />; }
function CeoReportPage() { return <StubPage title="CEO Report" navigate={() => {}} />; }
function LearningPage() { return <StubPage title="Learning Loop" navigate={() => {}} />; }
function ActivityLogsPage() { return <StubPage title="Activity Logs" navigate={() => {}} />; }
function SettingsPage() { return <StubPage title="Settings" navigate={() => {}} />; }

// -----------------------------------------------------------------------------
// MAIN APP SHELL
// -----------------------------------------------------------------------------
export default function App() {
  const [activePage, setActivePage] = useState<AppPage>("Today");
  const [selectedProduct, setSelectedProduct] = useState<FounderProduct | null>(null);

  function navigate(page: AppPage, product: FounderProduct | null = null) {
    if (product) setSelectedProduct(product);
    setActivePage(page);
  }

  function setTechnicalTab(tab: string) {
    setActivePage(tab);
  }

  const activeFounderTab: FounderTab = founderTabs.includes(activePage as FounderTab) 
    ? (activePage as FounderTab) 
    : "More";

  return (
    <div className="w-full min-h-screen bg-[#f3f4f6] font-sans text-gray-900 selection:bg-green-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-4 md:px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4 md:gap-10 h-full">
          <button type="button" onClick={() => navigate("Today")} className="flex items-center gap-2 hover:opacity-80 transition shrink-0">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-inner">
              LD
            </div>
            <span className="text-lg font-extrabold tracking-tight text-gray-900">
              Leafy Dew <span className="text-gray-500 font-medium text-sm ml-1 hidden lg:inline-block">AI-CGO</span>
            </span>
          </button>
          
          <nav className="hidden md:flex items-center h-full gap-1 overflow-x-auto no-scrollbar">
            {founderTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => navigate(tab)}
                className={`h-full px-3 lg:px-4 text-xs lg:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeFounderTab === tab 
                    ? "border-green-600 text-green-700" 
                    : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden xl:flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">
              <FounderIcon name="shield" className="w-3 h-3" /> Safe Mode ON
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold border border-gray-200">
              Shadow Mode OFF
            </span>
          </div>
          <div className="flex items-center gap-2 pl-4 border-l border-gray-200 cursor-pointer hover:opacity-80">
            <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-xs">F</div>
            <span className="text-sm font-semibold hidden sm:block">Founder</span>
          </div>
        </div>
      </header>

      <main className="w-full pt-6">
         {activePage === "Today" && <TodayDashboard navigate={navigate} />}
         {activePage === "Catalog" && <ProductsPage navigate={navigate} />}
         {activePage === "Products" && <ProductsPage navigate={navigate} />}
         {activePage === "Product Detail" && <ProductDetailPage navigate={navigate} product={selectedProduct} />}
         {activePage === "Approvals" && <FounderApprovalsPage navigate={navigate} />}
         {activePage === "Growth" && <GrowthPage navigate={navigate} />}
         {activePage === "Brand" && <BrandPage navigate={navigate} />}
         {activePage === "Sales & Ads" && <SalesAdsPage navigate={navigate} />}
         {activePage === "Reports" && <ReportsPage navigate={navigate} />}
         {activePage === "More" && <MoreToolsPage navigate={navigate} />}
         
         {activePage === "Daily AI-CGO" && <DailyAiCgoPage setActiveTab={setTechnicalTab} />}
         {activePage === "Product Passport" && <ProductPassportPage />}
         {activePage === "Product Economics" && <ProductEconomicsPage />}
         {activePage === "PPC Recommendations" && <PpcRecommendationsPage setActiveTab={setTechnicalTab} />}
         {activePage === "Engine Command Center" && <EngineCommandCenterPage />}
         {activePage === "Approval Center" && <ApprovalCenterPage />}
         {activePage === "Approval Execution" && <ApprovalExecutionPage setActiveTab={setTechnicalTab} />}
         {activePage === "Execution Gateway" && <ExecutionGatewayPage />}
         {activePage === "Live Execution" && <LiveExecutionPage />}
         {activePage === "Rollback Center" && <RollbackCenterPage />}
         {activePage === "Listing Drafts" && <ListingDraftsPage setActiveTab={setTechnicalTab} />}
         {activePage === "Image + A+" && <CreativeRecommendationsPage setActiveTab={setTechnicalTab} />}
         {activePage === "Safety Control" && <SafetyControlPage />}
         {activePage === "Launch Gate" && <LaunchGatePage />}
         {activePage === "Launch Checklist" && <LaunchChecklistPage />}
         {activePage === "Scheduler" && <SchedulerControlPage />}
         {activePage === "Notification Outbox" && <NotificationOutboxPage />}
         {activePage === "Security Guardrails" && <SecurityGuardrailsPage />}
         {activePage === "Alert Center" && <AlertCenterPage setActiveTab={setTechnicalTab} />}
         {activePage === "Experiments" && <ExperimentsPage />}
         {activePage === "Data Freshness" && <DataFreshnessPage />}
         {activePage === "AI Gateway" && <AiGatewayPage />}
         {activePage === "Production Health" && <ProductionHealthPage />}
         {activePage === "QA Smoke" && <QaSmokePage />}
         {activePage === "Maintenance" && <MaintenancePage />}
         {activePage === "CEO Report" && <CeoReportPage />}
         {activePage === "Learning" && <LearningPage />}
         {activePage === "Activity Logs" && <ActivityLogsPage />}
         {activePage === "Settings" && <SettingsPage />}
      </main>
    </div>
  );
}
