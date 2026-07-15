import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./App.css";
import { getJson } from "./api";

const SELLER_ID = "default";

// -----------------------------------------------------------------------------
// TYPES & NAVIGATION
// -----------------------------------------------------------------------------
type AnyRecord = Record<string, unknown>;
type ApiRows<T> = { rows: T[] };

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
  const imageUrls = Array.isArray(record.imageUrls) ? record.imageUrls : [];
  const images = Array.isArray(record.images) ? record.images : [];
  
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
      <p className="text-gray-500 mb-8">This module is part of the workspace. Connect backend functionality to view.</p>
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
  const placeholderProducts = products.length > 0 ? products : [];

  return (
    <div className="max-w-[1700px] mx-auto p-4 md:p-8 space-y-6">
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
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-2xl">AI</div>
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
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
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
            <div className="overflow-auto flex-1 border border-gray-100 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-2 py-3 font-semibold">SKU</th>
                    <th className="px-2 py-3 font-semibold">Price</th>
                    <th className="px-2 py-3 font-semibold">Profit</th>
                    <th className="px-2 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {placeholderProducts.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No products found in backend.</td></tr>
                  ) : (
                    placeholderProducts.slice(0, 5).map((p, i) => {
                      const img = getProductImage(p.raw) || placeholderImg;
                      return (
                        <tr key={String(p.key || i)} className="hover:bg-gray-50/50 transition cursor-pointer" onClick={() => navigate("Product Detail", p)}>
                          <td className="px-4 py-3 flex items-center gap-3">
                            <img src={img} alt="" className="w-8 h-8 object-cover rounded shadow-sm border border-gray-200" />
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
               <div className="flex items-center justify-center h-full text-gray-400">Add products to view details.</div>
             ) : (
               <div className="flex gap-6 h-full">
                  <div className="w-48 h-64 border border-gray-100 rounded-lg flex items-center justify-center p-4 bg-gray-50">
                     <img src={getProductImage(products[0].raw) || placeholderImg} alt="" className="w-full h-full object-contain mix-blend-multiply rounded" />
                  </div>
                  <div className="flex-1">
                     <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2">{products[0].name}</h3>
                     <div className="text-sm text-gray-500 mb-4">SKU: {products[0].sku} | ASIN: {products[0].asin}</div>
                     <div className="text-2xl font-bold text-gray-900 mb-4">{formatMoney(products[0].price)}</div>
                     <div className="space-y-2 mb-6">
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Margin</span> <span className="font-bold text-green-600">{formatPercent(products[0].margin)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Profit</span> <span className="font-bold text-gray-900">{formatMoney(products[0].netProfit)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">Status</span> <StatusBadge value={products[0].profitStatus || "UNKNOWN"} /></div>
                     </div>
                     <button className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded w-full mb-2 text-sm transition" onClick={() => navigate("Growth")}>Optimize Listing</button>
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
             <div className="overflow-auto flex-1 space-y-4">
                {approvalRows.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">No pending action ledger records.</div>
                ) : (
                  approvalRows.map((row, i) => (
                     <div key={String(row.id ?? i)} className="flex justify-between items-center p-4 border border-gray-100 rounded-xl bg-white shadow-sm hover:border-green-200 transition">
                        <div className="flex gap-4 items-start">
                           <StatusBadge value={row.riskLevel || "LOW"} />
                           <div>
                              <h4 className="text-sm font-bold text-gray-900">{formatEmpty(row.title ?? row.recommendedAction)}</h4>
                              <p className="text-[10px] text-gray-500 uppercase">{formatEmpty(row.actionType)}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <button className="bg-green-700 hover:bg-green-800 text-white text-xs font-bold px-3 py-1.5 rounded transition">Review</button>
                        </div>
                     </div>
                  ))
                )}
             </div>
             <button className="w-full text-center mt-4 text-sm font-bold text-blue-600 hover:text-blue-800 transition" onClick={() => navigate("Approvals")}>
              View all {pendingCount} approvals →
            </button>
          </div>
        </div>

      </div>

      {/* ADDITIONAL GRID FOR COMPLETENESS (5 & 6) */}
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
             <div className="overflow-auto flex-1 space-y-4">
                {growthOpportunities.length === 0 ? (
                   <div className="text-center text-gray-400 py-8">No PPC growth opportunities found.</div>
                ) : (
                   growthOpportunities.map((opp, i) => (
                      <div key={String(opp.id ?? i)} className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                         <h4 className="text-sm font-bold text-gray-900 mb-1">{formatEmpty(opp.title ?? opp.recommendationType)}</h4>
                         <p className="text-xs text-gray-500 mb-2">{formatEmpty(opp.reason ?? opp.summary)}</p>
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
             <div className="grid grid-cols-2 gap-6 mb-8 border-b border-gray-100 pb-6">
                <div>
                   <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">A+ Modules Live</div>
                   <div className="flex items-baseline gap-1 mb-1">
                     <span className="text-4xl font-extrabold text-gray-900">{aplusLive}</span>
                     <span className="text-lg text-gray-400">/ {aplusTotal}</span>
                   </div>
                </div>
                <div className="border-l border-gray-100 pl-6">
                   <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Store Status</div>
                   <div className="text-lg font-bold text-green-600 mb-2 mt-2">Active</div>
                </div>
             </div>
             
             <h4 className="text-xs font-bold text-gray-900 mb-3">Top Brand Products</h4>
             <div className="space-y-3 mb-3 flex-1 overflow-auto">
                {products.length === 0 ? (
                  <div className="text-xs text-gray-400">No products connected.</div>
                ) : (
                  products.slice(0, 3).map((p, i) => (
                    <div key={String(p.key || i)} className="flex gap-3 items-center p-2 border border-gray-100 rounded-lg">
                       <img src={getProductImage(p.raw) || placeholderImg} alt="" className="w-10 h-10 object-cover rounded" />
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
                          <div className="text-xs text-gray-500">{formatMoney(p.price)}</div>
                       </div>
                    </div>
                  ))
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
// MAIN APP SHELL
// -----------------------------------------------------------------------------
export default function App() {
  const [activePage, setActivePage] = useState<AppPage>("Today");

  function navigate(page: AppPage) {
    setActivePage(page);
  }

  const activeFounderTab: FounderTab = founderTabs.includes(activePage as FounderTab) 
    ? (activePage as FounderTab) 
    : "More";

  return (
    <div className="min-h-screen bg-[#f3f4f6] font-sans text-gray-900 selection:bg-green-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-10 h-full">
          <button type="button" onClick={() => navigate("Today")} className="flex items-center gap-2 hover:opacity-80 transition">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-inner">
              LD
            </div>
            <span className="text-lg font-extrabold tracking-tight text-gray-900">
              Leafy Dew <span className="text-gray-500 font-medium text-sm ml-1 hidden sm:inline-block">AI-CGO</span>
            </span>
          </button>
          
          <nav className="hidden lg:flex items-center h-full gap-1">
            {founderTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => navigate(tab)}
                className={`h-full px-4 text-sm font-semibold border-b-2 transition-colors ${
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

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Safe Mode ON
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">
              Shadow Mode OFF
            </span>
          </div>
          <div className="flex items-center gap-2 pl-4 border-l border-gray-200 cursor-pointer hover:opacity-80">
            <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-xs">F</div>
            <span className="text-sm font-semibold hidden sm:block">Founder</span>
          </div>
        </div>
      </header>

      <main className="w-full">
        {activePage === "Today" ? (
          <TodayDashboard navigate={navigate} />
        ) : (
          <StubPage title={activePage} navigate={navigate} />
        )}
      </main>
    </div>
  );
}
