import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import "./App.css";
import {
  activityLogsApi,
  approvalExecutionApi,
  aiGatewayApi,
  alertCenterApi,
  dataFreshnessApi,
  experimentsApi,
  getJson,
  launchChecklistApi,
  launchGateApi,
} from "./api";
import type {
  ActionLedgerRow,
  ActivityLogEvent,
  ActivityLogSummary,
  AnyRecord,
  ApiRows,
  ApprovalExecutionSummary,
  AiCostEstimate,
  AiCostSummary,
  AiGatewayStatus,
  AlertEvent,
  AlertSummary,
  CreativeRecommendation,
  CreativeRecommendationSummary,
  DailyOrchestratorRun,
  DailyOrchestratorStatus,
  DataFreshnessRow,
  DataFreshnessSummary,
  EngineRegistryItem,
  EngineRunLog,
  ExecutionAttempt,
  ExecutionGatewayStatus,
  ExperimentSummary,
  LearningEvent,
  LearningSummary,
  LaunchChecklistItem,
  LaunchChecklistSummary,
  LaunchGateCheck,
  LaunchGateSummary,
  LiveExecutionRun,
  LiveExecutionStatus,
  ListingDraft,
  MaintenanceRun,
  MaintenanceSummary,
  NotificationMessage,
  NotificationSummary,
  ProductionHealthModule,
  ProductionHealthSummary,
  ProductEconomics,
  ProductPassport,
  QaSmokeLatest,
  QaSmokeRun,
  Recommendation,
  RollbackSnapshot,
  RollbackSummary,
  SafetyAuditEvent,
  SafetyControlStatus,
  SchedulerJob,
  SchedulerSummary,
  SecurityAuditEvent,
  SecurityGuardrailSummary,
  TodayCommandSummary
} from "./types";

const SELLER_ID = "default";

const technicalTabs = [
  "Daily AI-CGO",
  "Engine Command Center",
  "Approval Execution",
  "Execution Gateway",
  "Live Execution",
  "Launch Gate",
  "Launch Checklist",
  "Scheduler",
  "Notification Outbox",
  "Security Guardrails",
  "Production Health",
  "QA Smoke",
  "Maintenance",
  "Activity Logs",
  "Rollback Center",
  "Data Freshness",
  "AI Gateway",
  "Alert Center",
  "Learning",
  "Experiments",
  "Safety Control",
  "Product Passport",
  "Product Economics",
  "PPC Recommendations",
  "Approval Center",
  "Listing Drafts",
  "Image + A+",
  "CEO Report",
  "Settings"
] as const;

const founderTabs = ["Today", "Products", "Approvals", "Growth", "Brand", "Sales & Ads", "Reports", "More"] as const;

type Tab = (typeof technicalTabs)[number];
type FounderTab = (typeof founderTabs)[number];
type AppPage = FounderTab | Tab | "Product Detail";
type LoadState<T> = { data: T | null; loading: boolean; error: string | null };
type ProductPassportSection = "READINESS" | "COST_COMPLETION";

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
        if (alive) setState({ data: null, loading: false, error: "Unable to load this section." });
      });

    return () => {
      alive = false;
    };
  }, [reloadKey, ...deps]);

  return {
    ...state,
    reload: () => setReloadKey((key) => key + 1)
  };
}

function rowsOf<T>(value: unknown): T[] {
  if (!value || typeof value !== "object") return [];
  const rows = (value as ApiRows<T>).rows;
  return Array.isArray(rows) ? rows : [];
}

function actionLedgerRowsOf(value: unknown): AnyRecord[] {
  if (Array.isArray(value)) return value as ActionLedgerRow[];
  return rowsOf<ActionLedgerRow>(value);
}

function recordOf(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function readNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatEmpty(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function formatShortId(value: unknown): string {
  const id = String(value ?? "").trim();
  if (!id) return "Unavailable";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

]+)/gi,
      "$1[redacted]"
    )
    .replace(/\b(access_token|refresh_token|api_key|client_secret|secret_key|auth_token)=([^&\s]+)/gi, "$1=[redacted]")
    .trim();
  return redacted || "Unknown error.";
}

function formatMoney(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(numeric);
}

function formatPercent(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric.toFixed(2)}%`;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function StatusBadge({ value }: { value: unknown }) {
  const label = formatEmpty(value).toUpperCase();
  const tone = ["READY", "PASS", "APPROVED", "ACTIVE", "RUNNING", "SUCCESS", "SHADOW", "GOOD", "AVAILABLE", "LOW", "SAFE", "DISABLED", "REQUIRED", "FRESH", "WON"].includes(label)
    ? "good"
    : ["WATCH", "WARN", "STALE", "UNKNOWN", "NEEDS_FIX", "MONITORING", "WARNING", "NEW", "DRAFT", "DRAFTED", "NEEDS_COST_DATA", "MISSING_COST_DATA", "PARTIAL", "INCOMPLETE", "NEEDS_INPUT", "SUBCATEGORY MISSING", "MEDIUM", "INCONCLUSIVE", "APPROVAL REQUIRED", "APPROVAL_REQUIRED"].includes(label)
      ? "watch"
      : ["RISK", "ERROR", "FAIL", "FAILED", "REJECTED", "POOR", "BLOCKED", "HIGH", "CRITICAL", "VERY_HIGH", "LOST", "HIGH_RISK_APPROVAL", "FOUNDER_OVERRIDE_REQUIRED"].includes(label)
        ? "risk"
        : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

function LoadingBlock({ text = "Loading..." }: { text?: string }) {
  return <div className="soft-state">{text}</div>;
}

function ErrorBlock({ text = "Could not load this section. Backend may still be deploying." }: { text?: string }) {
  return <div className="soft-state error-state">{text}</div>;
}

function EmptyBlock({ text = "No rows yet." }: { text?: string }) {
  return <div className="soft-state">{text}</div>;
}

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RecommendationCard({ item, footer }: { item: AnyRecord; footer?: ReactNode }) {
  return (
    <article className="item-card">
      <div className="item-top">
        <strong>{formatEmpty(item.entityValue ?? item.searchTerm ?? item.campaignName)}</strong>
        <StatusBadge value={item.riskLevel ?? item.status ?? "NEW"} />
      </div>
      <div className="item-meta">
        <span>{formatEmpty(item.recommendationType)}</span>
        <span>{formatEmpty(item.recommendedAction)}</span>
      </div>
      <div className="badge-row">
        <StatusBadge value={item.priorityLabel ?? "LOW"} />
        <StatusBadge value={item.confidenceLabel ?? "LOW"} />
        {item.status ? <StatusBadge value={item.status} /> : null}
      </div>
      <p>{formatEmpty(item.reason)}</p>
      {footer}
    </article>
  );
}

type FounderProduct = {
  key: string;
  id?: string;
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
  listingScore: unknown;
  inventory: unknown;
  status: unknown;
  bullets: string[];
  description: string;
  raw: AnyRecord;
};

type FounderNavigate = (page: AppPage, product?: FounderProduct | null) => void;

const sampleFounderProduct: FounderProduct = {
  key: "sample-product",
  id: "sample-product",
  name: "Leafy Dew Amazon Product",
  brand: "Leafy Dew",
  sku: "Connect SKU",
  asin: "Connect ASIN",
  category: "Home and lifestyle",
  price: null,
  netProfit: null,
  margin: null,
  profitStatus: "Not available yet",
  readiness: "Needs data",
  costStatus: "Connect cost data",
  listingScore: "Not available yet",
  inventory: "Not available yet",
  status: "Draft",
  bullets: [
    "Connect catalog data to preview the live listing.",
    "Add cost data to unlock profit and ACOS guidance.",
    "Review AI recommendations before any Amazon change."
  ],
  description: "Connect product, catalog, and economics data to make this detail page fully business-ready.",
  raw: {}
};

function cleanFounderText(value: unknown, fallback = "Not available yet"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    const record = recordOf(value);
    const readable = readFirst(record, ["title", "name", "summary", "message", "recommendedAction", "reason"]);
    return readable ? cleanFounderText(readable, fallback) : fallback;
  }
  return String(value);
}

function isValidImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("/") || trimmed.startsWith("//");
}

function readImagePath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current === null || current === undefined) return undefined;
    if (/^\d+$/.test(part)) return Array.isArray(current) ? current[Number(part)] : undefined;
    return recordOf(current)[part];
  }, source);
}

// ====== ENHANCED IMAGE RESOLUTION - FIX FOR AMAZON SP-API ======
function extractUrlFromImageObject(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = recordOf(value);
  // Amazon SP-API image object: { variant: "MAIN", link: "https://...", height, width }
  const link = record.link ?? record.url ?? record.src ?? record.imageUrl ?? record.image_url;
  if (typeof link === "string" && isValidImageUrl(link)) return link.trim();
  return null;
}

function firstValidImageUrl(value: unknown, depth = 0): string | null {
  if (isValidImageUrl(value)) return (value as string).trim();

  // Handle Amazon image object format
  const fromObject = extractUrlFromImageObject(value);
  if (fromObject) return fromObject;

  if (depth > 3 || value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = firstValidImageUrl(item, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  if (typeof value === "object") {
    const record = recordOf(value);
    // Check common URL fields first
    const directCandidates = [
      record.mainImageUrl,
      record.imageUrl,
      record.amazonImageUrl,
      record.imageUrls,
      record.images,
      record.url,
      record.link,
      record.src,
      record.main_image_url,
      record.image_url,
      record.amazon_image_url,
      record.image_urls,
      record.productImageUrl,
      record.product_image_url
    ];
    for (const candidate of directCandidates) {
      const nested = firstValidImageUrl(candidate, depth + 1);
      if (nested) return nested;
    }

    // Check for Amazon's nested image structure: images: [{ marketplaceId, images: [{link}] }]
    if (record.images && Array.isArray(record.images)) {
      for (const marketplaceImage of record.images) {
        if (marketplaceImage && typeof marketplaceImage === "object") {
          const innerImages = (marketplaceImage as AnyRecord).images;
          if (Array.isArray(innerImages)) {
            for (const img of innerImages) {
              const url = extractUrlFromImageObject(img);
              if (url) return url;
            }
          }
          const direct = firstValidImageUrl(marketplaceImage, depth + 1);
          if (direct) return direct;
        }
      }
    }
  }
  return null;
}

const productImagePaths = [
  "mainImageUrl",
  "imageUrl",
  "amazonImageUrl",
  "imageUrls.0",
  "images.0",
  "images.0.url",
  "images.0.link",
  "main_image_url",
  "image_url",
  "amazon_image_url",
  "productImageUrl",
  "product_image_url",
  "imageUrls",
  "image_urls.0",
  "image_urls",
  "media.mainImageUrl",
  "media.imageUrl",
  "metadata.mainImageUrl",
  "payload.mainImageUrl",
  "summaries.0.mainImage.link",
  "image",
  "images",
  "media.main_image_url",
  "metadata.imageUrl",
  "payload.imageUrl",
  "attributes.main_image_url",
  "attributes.image_url",
  "catalog.imageUrl",
  "catalog.mainImageUrl",
  "images.0.images.0.link",
  "includedData.images.0.images.0.link",
  // NEW: Additional Amazon SP-API paths
  "catalog.images",
  "catalogData.images",
  "raw.images",
  "productData.images",
  "listingData.images",
  "product.images",
  "item.images",
  "attributes.images",
  "payload.images",
  "summaries.0.images",
  "summaries.0.images.0.link",
  "includedData.images",
  "includedData.images.0",
  "includedData.images.0.link"
] as const;

const nestedProductImagePaths = [
  "product",
  "productData",
  "product_data",
  "productInfo",
  "product_info",
  "productPayload",
  "product_payload",
  "catalogProduct",
  "catalog_product",
  "listing",
  "listingData",
  "listing_data",
  "payload.product",
  "payload.productData",
  "metadata.product",
  "metadata.productData",
  "action.product",
  "action.productData",
  // NEW: Additional nested paths
  "catalog",
  "catalogData",
  "catalog_data",
  "item",
  "itemData",
  "attributes",
  "raw",
  "data",
  "result",
  "response"
] as const;

const productImageCollectionPaths = [
  "imageUrls",
  "images",
  "image_urls",
  "media.images",
  "metadata.images",
  "payload.images",
  "summaries.0.images",
  "summaries.0.mainImage",
  "includedData.images",
  // NEW: Additional collection paths
  "catalog.images",
  "catalogData.images",
  "product.images",
  "item.images",
  "attributes.images"
] as const;

type ProductImageResolution = {
  url: string;
  sourcePath: string;
};

function resolveProductImage(product: unknown, depth = 0): ProductImageResolution | null {
  const directImage = firstValidImageUrl(product);
  if (directImage) return { url: directImage, sourcePath: "direct" };

  for (const path of productImagePaths) {
    const image = firstValidImageUrl(readImagePath(product, path));
    if (image) return { url: image, sourcePath: path };
  }

  if (depth >= 2) return null;

  for (const path of nestedProductImagePaths) {
    const nested = readImagePath(product, path);
    if (!nested || nested === product) continue;
    const nestedImage = resolveProductImage(nested, depth + 1);
    if (nestedImage) return { ...nestedImage, sourcePath: `${path}.${nestedImage.sourcePath}` };
  }

  return null;
}

function getProductImage(product: unknown): string | null {
  return resolveProductImage(product)?.url ?? null;
}

function addUniqueImageUrl(urls: string[], value: unknown) {
  const image = firstValidImageUrl(value);
  if (image && !urls.includes(image)) urls.push(image);
}

function collectImageUrls(value: unknown, urls: string[], depth = 0) {
  if (depth > 3 || value === null || value === undefined) return;
  if (isValidImageUrl(value)) {
    addUniqueImageUrl(urls, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, urls, depth + 1));
    return;
  }
  if (typeof value === "object") {
    const record = recordOf(value);
    [
      record.url,
      record.link,
      record.src,
      record.imageUrl,
      record.image_url,
      record.mainImageUrl,
      record.main_image_url,
      record.productImageUrl,
      record.product_image_url,
      record.amazonImageUrl,
      record.amazon_image_url,
      record.imageUrls,
      record.image_urls,
      record.images
    ].forEach((candidate) => collectImageUrls(candidate, urls, depth + 1));
  }
}

function getProductImages(product: unknown): string[] {
  const urls: string[] = [];
  const primary = getProductImage(product);
  addUniqueImageUrl(urls, primary);
  productImageCollectionPaths.forEach((path) => collectImageUrls(readImagePath(product, path), urls));
  nestedProductImagePaths.forEach((path) => {
    const nested = readImagePath(product, path);
    if (nested && nested !== product) getProductImages(nested).forEach((url) => addUniqueImageUrl(urls, url));
  });
  return urls.slice(0, 8);
}

function productImageDebugValue(product: unknown, keys: string[]): unknown {
  for (const key of keys) {
    const value = readImagePath(product, key);
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

function productImageDebugFields(product: unknown): Array<[string, ReactNode]> {
  const imageStatus = productImageDebugValue(product, [
    "imageStatus",
    "image_status",
    "media.imageStatus",
    "media.image_status",
    "metadata.imageStatus",
    "payload.imageStatus",
    "product.imageStatus",
    "product.image_status"
  ]);
  const mediaJoinMatched = productImageDebugValue(product, [
    "mediaJoinMatched",
    "media_join_matched",
    "media.mediaJoinMatched",
    "media.media_join_matched",
    "metadata.mediaJoinMatched",
    "payload.mediaJoinMatched",
    "product.mediaJoinMatched",
    "product.media_join_matched"
  ]);
  const resolvedImage = getProductImage(product);
  const sourcePath = resolveProductImage(product)?.sourcePath ?? "none";

  return [
    imageStatus !== undefined ? ["Image Status", formatEmpty(imageStatus)] : null,
    mediaJoinMatched !== undefined ? ["Media Join Matched", formatEmpty(mediaJoinMatched)] : null,
    resolvedImage ? ["Resolved URL", formatEmpty(resolvedImage.slice(0, 80) + "...")] : ["Resolved URL", "No image found"],
    ["Source Path", sourcePath]
  ].filter(Boolean) as Array<[string, ReactNode]>;
}

function ProductImageDebug({ product, compact = false }: { product: unknown; compact?: boolean }) {
  const fields = productImageDebugFields(product);
  if (!import.meta.env.DEV || fields.length === 0) return null;
  return (
    <div className={`product-image-debug ${compact ? "compact" : ""}`}>
      {fields.map(([label, value]) => (
        <span key={label}>{label}: {value}</span>
      ))}
    </div>
  );
}

function productKeyOf(row: AnyRecord, index = 0): string {
  const sku = cleanFounderText(readFirst(row, ["sku", "sellerSku"]), "");
  const asin = cleanFounderText(readFirst(row, ["asin"]), "");
  const id = cleanFounderText(readFirst(row, ["id", "key"]), "");
  return sku || asin || id || `product-${index}`;
}

function normalizeFounderProduct(source: AnyRecord, index = 0): FounderProduct {
  const economics = recordOf(source.economics);
  const name = cleanFounderText(readFirst(source, ["productName", "product_name", "itemName", "title", "name"]) ?? readFirst(economics, ["productName", "product_name"]), "Unnamed product");
  const rawBullets = readFirst(source, ["bullets", "bulletPoints", "features", "listingBullets"]);
  const bullets = Array.isArray(rawBullets)
    ? rawBullets.map((item) => cleanFounderText(item, "")).filter(Boolean).slice(0, 6)
    : [];

  return {
    key: productKeyOf(source, index),
    id: cleanFounderText(readFirst(source, ["id", "key"]), ""),
    name,
    brand: cleanFounderText(readFirst(source, ["brand", "brandName", "manufacturer"]), "Leafy Dew"),
    sku: cleanFounderText(readFirst(source, ["sku", "sellerSku", "seller_sku"]), "-"),
    asin: cleanFounderText(readFirst(source, ["asin"]), "-"),
    category: cleanFounderText(readFirst(source, ["category", "subCategory", "subcategory", "sub_category", "productType"]) ?? readFirst(economics, ["category", "subCategory", "subcategory"]), "Not available yet"),
    price: readFirst(source, ["sellingPrice", "selling_price", "price"]) ?? readFirst(economics, ["sellingPrice", "selling_price", "price"]),
    netProfit: readFirst(source, ["netProfit", "net_profit"]) ?? readFirst(economics, ["netProfit", "net_profit", "netProfitBeforeAds"]),
    margin: readFirst(source, ["profitMargin", "margin"]) ?? readFirst(economics, ["profitMargin", "margin"]),
    profitStatus: readFirst(source, ["profitStatus", "currentProfitStatus", "current_profit_status"]) ?? readFirst(economics, ["profitStatus", "currentProfitStatus"]),
    readiness: readFirst(source, ["readiness", "readinessStatus", "listingReadiness", "status"]),
    costStatus: readFirst(source, ["costStatus", "cost_status", "profitDataStatus"]) ?? readFirst(economics, ["costStatus", "profitDataStatus"]),
    listingScore: readFirst(source, ["listingScore", "readinessScore", "passportScore", "score"]),
    inventory: readFirst(source, ["inventory", "inventoryStatus", "availableQuantity", "quantity"]),
    status: readFirst(source, ["status", "listingStatus", "productStatus"]),
    bullets,
    description: cleanFounderText(readFirst(source, ["description", "productDescription", "listingDescription"]), "No description available yet."),
    raw: source
  };
}

function mergeFounderProducts(...sources: unknown[]): FounderProduct[] {
  const byKey = new Map<string, AnyRecord>();

  sources.forEach((source) => {
    recordsOf(source).forEach((row, index) => {
      const key = productKeyOf(row, index);
      const existing = byKey.get(key) ?? {};
      byKey.set(key, { ...existing, ...row, economics: { ...recordOf(existing.economics), ...recordOf(row.economics) } });
    });
  });

  return Array.from(byKey.values()).map((row, index) => normalizeFounderProduct(row, index));
}

function productMatches(product: FounderProduct, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [product.name, product.sku, product.asin, product.category, product.brand]
    .some((value) => String(value ?? "").toLowerCase().includes(needle));
}

function productNeedsCost(product: FounderProduct): boolean {
  const state = normalizeState(product.costStatus);
  return state.includes("MISSING") || state.includes("NEEDS") || state.includes("PARTIAL") || state.includes("INPUT");
}

function productLowProfit(product: FounderProduct): boolean {
  const state = normalizeState(product.profitStatus);
  const margin = Number(product.margin ?? 0);
  return state.includes("LOW") || state.includes("RISK") || (Number.isFinite(margin) && margin > 0 && margin < 15);
}

function productStatusTone(value: unknown): "good" | "watch" | "risk" | "neutral" {
  const state = normalizeState(value);
  if (["PASS", "READY", "COMPLETE", "ACTIVE", "HEALTHY", "GOOD", "SAFE", "APPROVED", "DONE"].some((token) => state.includes(token))) return "good";
  if (["HIGH", "RISK", "FAIL", "BLOCK", "URGENT", "REJECTED"].some((token) => state.includes(token))) return "risk";
  if (["MISSING", "NEEDS", "PARTIAL", "WATCH", "PENDING", "DRAFT"].some((token) => state.includes(token))) return "watch";
  return "neutral";
}

function FounderBadge({ value, tone }: { value: unknown; tone?: "good" | "watch" | "risk" | "neutral" }) {
  const label = cleanFounderText(value, "Not available yet");
  const displayLabel = /^[A-Z0-9]{1,4}$/.test(label.trim()) ? label.trim() : labelize(label);
  return <Badge tone={tone ?? productStatusTone(value)}>{displayLabel}</Badge>;
}

type FounderIconName = "spark" | "check" | "cost" | "box" | "approval" | "growth" | "brand" | "sales" | "report" | "shield" | "bell" | "arrow" | "chart";

function FounderIcon({ name }: { name: FounderIconName }) {
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
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

type ProductThumbnailVariant = "small" | "medium" | "large" | "hero";
type ProductFallbackType = "product" | "brand" | "creative" | "listing";

function fallbackTypeForTitle(title: string, fallbackType: ProductFallbackType): ProductFallbackType {
  const normalized = title.toLowerCase();
  if (fallbackType !== "product") return fallbackType;
  if (/(image|a\+|creative|asset|lifestyle|infographic|video)/.test(normalized)) return "creative";
  if (/(brand|store|campaign)/.test(normalized)) return "brand";
  if (/(listing|keyword|bullet|content)/.test(normalized)) return "listing";
  return "product";
}

function ProductPlaceholder({
  title = "Product image",
  variant = "medium",
  fallbackType = "product",
  className = ""
}: {
  title?: string;
  variant?: ProductThumbnailVariant;
  fallbackType?: ProductFallbackType;
  className?: string;
}) {
  const resolvedFallback = fallbackTypeForTitle(title, fallbackType);
  const normalizedTitle = title.toLowerCase();
  const theme = /(yoga|mat|band|fitness|gym)/.test(normalizedTitle)
    ? "fitness"
    : /bottle/.test(normalizedTitle)
      ? "bottle"
      : resolvedFallback;
  return (
    <div className={`product-placeholder product-placeholder-${variant} product-placeholder-${theme} ${className}`} aria-label={`${title} image placeholder`}>
      <FounderIcon name="box" />
      {variant !== "small" ? <span>{resolvedFallback === "creative" ? "Creative asset" : resolvedFallback === "brand" ? "Brand asset" : resolvedFallback === "listing" ? "Listing preview" : "Product image"}</span> : null}
    </div>
  );
}

function ProductThumbnail({
  src,
  title,
  variant = "medium",
  fallbackType = "product",
  className = ""
}: {
  src?: unknown;
  title: string;
  size?: number;
  variant?: ProductThumbnailVariant;
  fallbackType?: ProductFallbackType;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const image = firstValidImageUrl(src);
  useEffect(() => {
    setFailed(false);
  }, [image]);
  if (!image || failed) return <ProductPlaceholder title={title} variant={variant} fallbackType={fallbackType} className={className} />;
  return <img loading="lazy" decoding="async" className={`product-thumbnail product-thumbnail-${variant} ${className}`} src={image} alt={title} onError={() => setFailed(true)} />;
}

function ProductThumb({
  product,
  className = "",
  variant,
  fallbackType = "product"
}: {
  product: FounderProduct | AnyRecord;
  className?: string;
  variant?: ProductThumbnailVariant;
  fallbackType?: ProductFallbackType;
}) {
  const image = getProductImage("raw" in product ? product.raw : product);
  const inferredVariant = variant ?? (className.includes("main") ? "hero" : className.includes("growth") ? "large" : className.includes("thumb") ? "small" : "medium");
  const title = cleanFounderText("name" in product ? product.name : readFirst(product, ["productName", "title", "name"]), "Product");
  return <ProductThumbnail src={image} title={title} variant={inferredVariant} fallbackType={fallbackType} className={className} />;
}

function FounderMetric({ label, value, badge, icon = "chart", trend = "Ready for review", tone = "green" }: { label: string; value: ReactNode; badge?: boolean; icon?: FounderIconName; trend?: string; tone?: "green" | "gold" | "blue" | "neutral" }) {
  return (
    <div className={`metric-card metric-card-${tone}`}>
      <div className="metric-card-top">
        <span>{label}</span>
        <span className="metric-icon"><FounderIcon name={icon} /></span>
      </div>
      <strong>{badge ? <FounderBadge value={value} /> : value}</strong>
      <em><i />{trend}</em>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState<AppPage>("Today");
  const [selectedProduct, setSelectedProduct] = useState<FounderProduct | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const mainContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mainContentRef.current?.scrollTo({ top: 0 });
  }, [activePage]);

  function navigate(page: AppPage, product: FounderProduct | null = null) {
    if (product) setSelectedProduct(product);
    setActivePage(page);
  }

  
  const activeFounderTab: FounderTab = activePage === "Product Detail"
    ? "Products"
    : founderTabs.includes(activePage as FounderTab)
      ? activePage as FounderTab
      : "More";

  return (
    <div className="app-shell founder-app-shell">
      <header className="top-header">
        <button type="button" className="brand-left" onClick={() => navigate("Today")} aria-label="Open Today">
          {logoFailed ? (
            <div className="logo-fallback">LD</div>
          ) : (
            <img src="/ld-logo.png" alt="Leafy Dew" onError={() => setLogoFailed(true)} />
          )}
          <span>
            <strong>Leafy Dew AI-CGO</strong>
            <small>AI Co-Pilot for Amazon Growth</small>
          </span>
        </button>
        <nav className="top-nav" aria-label="Founder navigation">
          {founderTabs.map((tab) => (
            <button
              type="button"
              key={tab}
              className={`nav-tab ${activeFounderTab === tab ? "nav-tab-active" : ""}`}
              onClick={() => navigate(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="safe-mode-pill" title="Nothing changes on Amazon without your approval and safety checks."><FounderIcon name="shield" />Safe Mode ON</span>
          <span className="change-lock-pill">No Amazon change is made</span>
          <button type="button" className="icon-button" aria-label="Notifications"><FounderIcon name="bell" /></button>
          <button type="button" className="founder-menu">Founder</button>
        </div>
      </header>

      <main className="main-panel founder-main-panel">
        <div className="main-content page-container" ref={mainContentRef}>
          {activePage === "Today" && <TodayDashboard navigate={navigate} />}
          {activePage === "Products" && <ProductsPage navigate={navigate} />}
          {activePage === "Product Detail" && <ProductDetailPage product={selectedProduct} navigate={navigate} />}
          {activePage === "Approvals" && <FounderApprovalsPage navigate={navigate} />}
          {activePage === "Growth" && <GrowthPage navigate={navigate} />}
          {activePage === "Brand" && <BrandPage navigate={navigate} />}
          {activePage === "Sales & Ads" && <SalesAdsPage />}
          {activePage === "Reports" && <ReportsPage navigate={navigate} />}
          {activePage === "More" && <MoreToolsPage navigate={navigate} />}
          {activePage === "Daily AI-CGO" && <DailyAiCgoPage />}
          {activePage === "Product Passport" && <ProductPassportPage />}
          {activePage === "Product Economics" && <ProductEconomicsPage />}
          {activePage === "PPC Recommendations" && <PpcRecommendationsPage />}
          {activePage === "Engine Command Center" && <EngineCommandCenterPage />}
          {activePage === "Approval Center" && <ApprovalCenterPage />}
          {activePage === "Approval Execution" && <ApprovalExecutionPage />}
          {activePage === "Execution Gateway" && <ExecutionGatewayPage />}
          {activePage === "Live Execution" && <LiveExecutionPage />}
          {activePage === "Rollback Center" && <RollbackCenterPage />}
          {activePage === "Listing Drafts" && <ListingDraftsPage />}
          {activePage === "Image + A+" && <ImageAplusPage />}
          {activePage === "CEO Report" && <CeoReportPage />}
          {activePage === "Settings" && <SettingsPage />}
          {activePage === "Launch Gate" && <LaunchGatePage />}
          {activePage === "Launch Checklist" && <LaunchChecklistPage />}
          {activePage === "Scheduler" && <SchedulerPage />}
          {activePage === "Notification Outbox" && <NotificationOutboxPage />}
          {activePage === "Security Guardrails" && <SecurityGuardrailsPage />}
          {activePage === "Production Health" && <ProductionHealthPage />}
          {activePage === "QA Smoke" && <QaSmokePage />}
          {activePage === "Maintenance" && <MaintenancePage />}
          {activePage === "Activity Logs" && <ActivityLogsPage />}
          {activePage === "Data Freshness" && <DataFreshnessPage />}
          {activePage === "AI Gateway" && <AiGatewayPage />}
          {activePage === "Alert Center" && <AlertCenterPage />}
          {activePage === "Learning" && <LearningPage />}
          {activePage === "Experiments" && <ExperimentsPage />}
          {activePage === "Safety Control" && <SafetyControlPage />}
        </div>
      </main>

      <footer className="bottom-bar">
        <span className="bottom-bar-left">
          <FounderIcon name="shield" />
          Safe Mode: On — No Amazon change is made without your approval.
        </span>
        <span className="bottom-bar-center">
          <FounderIcon name="spark" />
          Leafy Dew AI-CGO v1.0 — Founder-first, AI-assisted growth
        </span>
        <span className="bottom-bar-right">
          <FounderIcon name="check" />
          All changes are logged and reversible.
        </span>
      </footer>
    </div>
  );
}

function PageHeader({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: string }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {badge ? <Badge tone="good">{badge}</Badge> : null}
    </div>
  );
}

function TodayDashboard({ navigate }: { navigate: FounderNavigate }) {
  const today = useApi<TodayCommandSummary>(() => getJson(`/api/today?sellerId=${SELLER_ID}`));
  const approvals = useApi<ApprovalExecutionSummary>(() => approvalExecutionApi.summary(SELLER_ID));
  const passport = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const creative = useApi<CreativeRecommendationSummary>(() => getJson(`/api/creative-recommendations/summary?sellerId=${SELLER_ID}`));
  const products = mergeFounderProducts(passport.data, economics.data);
  const needsCost = products.filter(productNeedsCost).length;
  const lowProfit = products.filter(productLowProfit).length;
  const pendingApprovals = actionLedgerRowsOf(approvals.data).filter((row) => ["APPROVAL_REQUIRED", "HIGH_RISK_APPROVAL", "FOUNDER_OVERRIDE_REQUIRED"].includes(String(row.actionStatus))).length;
  const readyActions = actionLedgerRowsOf(approvals.data).filter((row) => row.actionStatus === "READY").length;

  const topProducts = products.slice(0, 4);
  const topActions = actionLedgerRowsOf(approvals.data).filter((row) => ["APPROVAL_REQUIRED", "HIGH_RISK_APPROVAL", "FOUNDER_OVERRIDE_REQUIRED"].includes(String(row.actionStatus))).slice(0, 4);

  const todaySummary = recordOf(today.data);
  const todayStatus = cleanFounderText(todaySummary.status, "Not available yet");
  const todayRun = cleanFounderText(todaySummary.runDate, "Not available yet");
  const todayItems = actionLedgerRowsOf(todaySummary.items).slice(0, 6);

  return (
    <div className="page founder-page">
      <PageHeader title="Today" subtitle="What needs your attention right now." badge="Safe Mode ON" />

      <div className="today-hero">
        <div className="today-hero-text">
          <h2>Good morning, Founder.</h2>
          <p>AI-CGO is running in safe mode. Here is what is ready for your review today.</p>
        </div>
        <div className="today-hero-meta">
          <span>Status: <strong>{todayStatus}</strong></span>
          <span>Last run: <strong>{todayRun}</strong></span>
        </div>
      </div>

      <div className="metric-grid">
        <FounderMetric label="Products Needing Cost Data" value={needsCost} icon="cost" trend="Add costs to unlock profit guidance" tone={needsCost > 0 ? "gold" : "green"} />
        <FounderMetric label="Low Profit Products" value={lowProfit} icon="chart" trend="Review margin and pricing" tone={lowProfit > 0 ? "gold" : "green"} />
        <FounderMetric label="Pending Approvals" value={pendingApprovals} icon="approval" trend="Review before any Amazon change" tone={pendingApprovals > 0 ? "gold" : "green"} />
        <FounderMetric label="Ready to Execute" value={readyActions} icon="check" trend="Approved and queued for execution" tone="green" />
        <FounderMetric label="Creative Recommendations" value={readNumber(readFirst(creative.data, ["totalRecommendations", "total"]))} icon="growth" trend="Review image and A+ suggestions" tone="green" />
        <FounderMetric label="Total Products" value={products.length} icon="box" trend="Product catalog overview" tone="green" />
      </div>

      <div className="today-section">
        <div className="today-section-header">
          <h3>Top Actions</h3>
          <button type="button" className="btn-link" onClick={() => navigate("Approvals")}>View all approvals</button>
        </div>
        {topActions.length === 0 ? (
          <div className="today-empty">
            <FounderIcon name="check" />
            <p>No actions need approval right now. AI-CGO is monitoring your account.</p>
          </div>
        ) : (
          <div className="action-list">
            {topActions.map((action) => (
              <div className="action-item" key={String(action.actionId)}>
                <div className="action-item-top">
                  <strong>{formatEmpty(action.actionTitle)}</strong>
                  <StatusBadge value={action.actionStatus} />
                </div>
                <div className="action-item-meta">
                  <span>{formatEmpty(action.actionType)}</span>
                  <span>{formatShortId(action.actionId)}</span>
                </div>
                <p>{formatEmpty(action.actionDescription)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="today-section">
        <div className="today-section-header">
          <h3>Top Products</h3>
          <button type="button" className="btn-link" onClick={() => navigate("Products")}>View all products</button>
        </div>
        <div className="product-grid">
          {topProducts.map((product) => (
            <div className="product-card" key={product.key} onClick={() => navigate("Product Detail", product)}>
              <ProductThumb product={product} className="product-card-thumb" />
              <div className="product-card-body">
                <strong>{product.name}</strong>
                <div className="product-card-meta">
                  <span>{product.sku}</span>
                  <span>{product.asin}</span>
                </div>
                <div className="badge-row">
                  <FounderBadge value={product.costStatus} />
                  <FounderBadge value={product.profitStatus} />
                  <FounderBadge value={product.readiness} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {todayItems.length > 0 && (
        <div className="today-section">
          <div className="today-section-header">
            <h3>Today's AI-CGO Run</h3>
          </div>
          <div className="action-list">
            {todayItems.map((item) => (
              <div className="action-item" key={String(item.actionId)}>
                <div className="action-item-top">
                  <strong>{formatEmpty(item.actionTitle)}</strong>
                  <StatusBadge value={item.actionStatus} />
                </div>
                <div className="action-item-meta">
                  <span>{formatEmpty(item.actionType)}</span>
                  <span>{formatShortId(item.actionId)}</span>
                </div>
                <p>{formatEmpty(item.actionDescription)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductsPage({ navigate }: { navigate: FounderNavigate }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const products = mergeFounderProducts(passports.data, economics.data);

  const filtered = products.filter((product) => {
    if (!productMatches(product, query)) return false;
    if (filter === "ALL") return true;
    if (filter === "NEEDS_COST") return productNeedsCost(product);
    if (filter === "LOW_PROFIT") return productLowProfit(product);
    if (filter === "READY") return normalizeState(product.readiness).includes("READY");
    return true;
  });

  return (
    <div className="page founder-page">
      <PageHeader title="Products" subtitle="All products with catalog, cost, and profit status." />

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search by name, SKU, ASIN..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="search-input"
        />
        <div className="filter-pills">
          {["ALL", "NEEDS_COST", "LOW_PROFIT", "READY"].map((f) => (
            <button
              type="button"
              key={f}
              className={`filter-pill ${filter === f ? "filter-pill-active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="product-grid">
        {filtered.map((product) => (
          <div className="product-card" key={product.key} onClick={() => navigate("Product Detail", product)}>
            <ProductThumb product={product} className="product-card-thumb" />
            <div className="product-card-body">
              <strong>{product.name}</strong>
              <div className="product-card-meta">
                <span>{product.sku}</span>
                <span>{product.asin}</span>
              </div>
              <div className="badge-row">
                <FounderBadge value={product.costStatus} />
                <FounderBadge value={product.profitStatus} />
                <FounderBadge value={product.readiness} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="today-empty">
          <FounderIcon name="box" />
          <p>No products match your search.</p>
        </div>
      )}
    </div>
  );
}

function ProductDetailPage({ product, navigate }: { product: FounderProduct | null; navigate: FounderNavigate }) {
  const selectedProduct = product ?? sampleFounderProduct;
  const detailImageSource = selectedProduct.raw;
  const galleryImages = getProductImages(detailImageSource);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setActiveImage(0);
  }, [selectedProduct.key]);

  const detailProduct = selectedProduct;

  return (
    <div className="page founder-page">
      <div className="detail-header">
        <button type="button" className="btn-back" onClick={() => navigate("Products")}>
          <FounderIcon name="arrow" /> Back to Products
        </button>
        <PageHeader title={detailProduct.name} />
      </div>

      <div className="detail-layout">
        <div className="detail-gallery">
          {galleryImages.length > 0 ? (
            <>
              <div className="gallery-main">
                <ProductThumbnail src={galleryImages[activeImage]} title={detailProduct.name} variant="hero" />
              </div>
              {galleryImages.length > 1 && (
                <div className="gallery-thumbs">
                  {galleryImages.map((url, index) => (
                    <button
                      type="button"
                      key={index}
                      className={`gallery-thumb ${activeImage === index ? "gallery-thumb-active" : ""}`}
                      onClick={() => setActiveImage(index)}
                    >
                      <ProductThumbnail src={url} title={`${detailProduct.name} image ${index + 1}`} variant="small" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <ProductPlaceholder title={detailProduct.name} variant="hero" />
          )}
        </div>

        <div className="detail-info">
          <div className="detail-section">
            <h3>Product Info</h3>
            <div className="detail-grid">
              <MetricRow label="SKU" value={detailProduct.sku} />
              <MetricRow label="ASIN" value={detailProduct.asin} />
              <MetricRow label="Brand" value={detailProduct.brand} />
              <MetricRow label="Category" value={detailProduct.category} />
              <MetricRow label="Status" value={<FounderBadge value={detailProduct.status} />} />
              <MetricRow label="Listing Score" value={formatEmpty(detailProduct.listingScore)} />
            </div>
          </div>

          <div className="detail-section">
            <h3>Pricing & Profit</h3>
            <div className="detail-grid">
              <MetricRow label="Selling Price" value={formatMoney(detailProduct.price)} />
              <MetricRow label="Net Profit" value={formatMoney(detailProduct.netProfit)} />
              <MetricRow label="Margin" value={formatPercent(detailProduct.margin)} />
              <MetricRow label="Profit Status" value={<FounderBadge value={detailProduct.profitStatus} />} />
              <MetricRow label="Cost Status" value={<FounderBadge value={detailProduct.costStatus} />} />
            </div>
          </div>

          <div className="detail-section">
            <h3>Listing Content</h3>
            <div className="detail-bullets">
              {detailProduct.bullets.length > 0 ? detailProduct.bullets.map((bullet, index) => (
                <div className="bullet-row" key={index}>
                  <span>{index + 1}</span>
                  <p>{bullet}</p>
                </div>
              )) : <p className="soft-state">No bullet points available yet.</p>}
            </div>
            <div className="detail-description">
              <h4>Description</h4>
              <p>{detailProduct.description}</p>
            </div>
          </div>

          <details className="technical-accordion">
            <summary>Technical Details (Image Debug)</summary>
            <div className="detail-grid">
              <MetricRow label="Internal Key" value={detailProduct.key} />
              <MetricRow label="Data Status" value={cleanFounderText(detailProduct.costStatus)} />
              <MetricRow label="Image Resolution Source" value={resolveProductImage(detailImageSource)?.sourcePath ?? "None found"} />
              <MetricRow label="Gallery Image Count" value={galleryImages.length} />
              <MetricRow label="First Image URL" value={galleryImages[0] ?? "None"} />
            </div>
            <ProductImageDebug product={detailImageSource} />

            {/* NEW: Raw image data inspector for debugging */}
            <div className="image-raw-debug">
              <h4>Raw Image Data from Backend</h4>
              <pre style={{ fontSize: "11px", overflow: "auto", maxHeight: "300px", background: "#f5f5f5", padding: "8px" }}>
                {JSON.stringify({
                  images: readImagePath(detailImageSource, "images"),
                  summaries: readImagePath(detailImageSource, "summaries"),
                  catalog: readImagePath(detailImageSource, "catalog"),
                  raw_images: readImagePath(detailImageSource, "raw.images"),
                  productData_images: readImagePath(detailImageSource, "productData.images"),
                  item_images: readImagePath(detailImageSource, "item.images")
                }, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

// ====== FIXED BRAND PAGE WITH API INTEGRATION ======
function BrandPage({ navigate }: { navigate: FounderNavigate }) {
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const creative = useApi<CreativeRecommendationSummary>(() => getJson(`/api/creative-recommendations/summary?sellerId=${SELLER_ID}`));

  // NEW: Fetch brand store data from backend
  const brandStore = useApi<AnyRecord>(() => getJson(`/api/brand-store/summary?sellerId=${SELLER_ID}`));
  const brandInsights = useApi<AnyRecord>(() => getJson(`/api/brand-store/insights?sellerId=${SELLER_ID}`));

  const products = mergeFounderProducts(passports.data, economics.data);
  const topProducts = products.slice(0, 4);

  // Extract real brand store data with fallbacks
  const storeData = recordOf(brandStore.data?.data ?? brandStore.data?.summary ?? brandStore.data);
  const insightsData = recordOf(brandInsights.data?.data ?? brandInsights.data?.summary ?? brandInsights.data);

  const healthScore = readNumber(storeData.healthScore ?? insightsData.healthScore ?? storeData.storeHealthScore);
  const storeStatus = cleanFounderText(storeData.status ?? storeData.storeStatus ?? insightsData.status, "Not connected yet");
  const storeTraffic = readNumber(storeData.traffic7d ?? storeData.traffic ?? insightsData.traffic7d);
  const storeSales = readNumber(storeData.sales7d ?? storeData.sales ?? insightsData.sales7d);
  const storeConversion = readNumber(storeData.conversionRate ?? insightsData.conversionRate);
  const pageCount = readNumber(storeData.pageCount ?? storeData.pages ?? insightsData.pageCount);
  const isConnected = healthScore > 0 || normalizeState(storeStatus).includes("ACTIVE") || normalizeState(storeStatus).includes("LIVE");

  return (
    <div className="page founder-page">
      <PageHeader title="Brand Overview" subtitle="Track brand health, content, assets, and top products." />

      <section className="brand-hero-card">
        <div>
          <span className="eyebrow">Leafy Dew Brand Workspace</span>
          <h2>Protect the brand, improve creative, and turn top products into stronger storefront assets.</h2>
          <p>Brand Store, A+ content, product imagery, and campaign ideas stay founder-approved and safe.</p>
        </div>
        <div className="brand-hero-score">
          <span>Brand Health Score</span>
          <strong>{healthScore > 0 ? healthScore : "—"}</strong>
          <FounderBadge value={isConnected ? (healthScore >= 70 ? "Healthy" : healthScore >= 40 ? "Needs Work" : "At Risk") : "Not Connected"} tone={isConnected ? (healthScore >= 70 ? "good" : healthScore >= 40 ? "watch" : "risk") : "neutral"} />
        </div>
      </section>

      <div className="brand-grid">
        <FounderMetric label="Brand Health Score" value={healthScore > 0 ? healthScore : "Not available"} badge={healthScore > 0} />
        <FounderMetric label="A+ Content Status" value={readNumber(readFirst(creative.data, ["aplusContentReviews", "aPlusContentReviews"])) > 0 ? "Needs review" : "Not available yet"} badge />
        <FounderMetric label="Store Status" value={storeStatus} badge />
        <FounderMetric label="Store Pages" value={pageCount > 0 ? pageCount : "—"} />
        <FounderMetric label="Store Traffic 7D" value={storeTraffic > 0 ? storeTraffic : "—"} />
        <FounderMetric label="Store Sales 7D" value={storeSales > 0 ? formatMoney(storeSales) : "—"} />
        <FounderMetric label="Store Conversion" value={storeConversion > 0 ? `${storeConversion.toFixed(2)}%` : "—"} />
        <FounderMetric label="Creative Assets" value={readNumber(readFirst(creative.data, ["totalRecommendations", "total"]))} />
        <FounderMetric label="Top Brand Products" value={topProducts.length} />
      </div>

      <div className="brand-section">
        <div className="brand-section-header">
          <h3>Brand Store</h3>
          <button type="button" className="btn-link" onClick={() => navigate("More")}>Manage store</button>
        </div>
        {isConnected ? (
          <div className="brand-store-preview">
            <div className="brand-store-metrics">
              <div className="brand-store-metric">
                <span>Pages</span>
                <strong>{pageCount > 0 ? pageCount : "—"}</strong>
              </div>
              <div className="brand-store-metric">
                <span>Traffic (7d)</span>
                <strong>{storeTraffic > 0 ? storeTraffic : "—"}</strong>
              </div>
              <div className="brand-store-metric">
                <span>Sales (7d)</span>
                <strong>{storeSales > 0 ? formatMoney(storeSales) : "—"}</strong>
              </div>
              <div className="brand-store-metric">
                <span>Conversion</span>
                <strong>{storeConversion > 0 ? `${storeConversion.toFixed(2)}%` : "—"}</strong>
              </div>
            </div>
            <p className="brand-store-note">Brand Store is connected and tracking. Review performance in Reports.</p>
          </div>
        ) : (
          <div className="brand-store-empty">
            <FounderIcon name="brand" />
            <p>Brand Store not connected yet. Connect your Amazon Brand Store to track pages, traffic, and sales.</p>
            <button type="button" className="btn-primary">Connect Brand Store</button>
          </div>
        )}
      </div>

      <div className="brand-section">
        <div className="brand-section-header">
          <h3>Top Products</h3>
          <button type="button" className="btn-link" onClick={() => navigate("Products")}>View all products</button>
        </div>
        <div className="product-grid">
          {topProducts.map((product) => (
            <div className="product-card" key={product.key} onClick={() => navigate("Product Detail", product)}>
              <ProductThumb product={product} className="product-card-thumb" />
              <div className="product-card-body">
                <strong>{product.name}</strong>
                <div className="product-card-meta">
                  <span>{product.sku}</span>
                  <span>{product.asin}</span>
                </div>
                <div className="badge-row">
                  <FounderBadge value={product.costStatus} />
                  <FounderBadge value={product.profitStatus} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="brand-section">
        <div className="brand-section-header">
          <h3>Creative Assets</h3>
          <button type="button" className="btn-link" onClick={() => navigate("Image + A+")}>View all creative</button>
        </div>
        <div className="creative-grid">
          <div className="creative-card">
            <ProductPlaceholder title="Main product images" variant="medium" fallbackType="creative" />
            <strong>Main Images</strong>
            <p>Review and optimize main product images for all SKUs.</p>
          </div>
          <div className="creative-card">
            <ProductPlaceholder title="A+ Content modules" variant="medium" fallbackType="creative" />
            <strong>A+ Content</strong>
            <p>Manage A+ content modules and brand storytelling.</p>
          </div>
          <div className="creative-card">
            <ProductPlaceholder title="Brand Store pages" variant="medium" fallbackType="brand" />
            <strong>Brand Store</strong>
            <p>Design and manage brand storefront pages.</p>
          </div>
          <div className="creative-card">
            <ProductPlaceholder title="Video content" variant="medium" fallbackType="creative" />
            <strong>Video</strong>
            <p>Upload and manage product videos for listings.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FounderApprovalsPage() {
  const approvals = useApi<ApprovalExecutionSummary>(() => approvalExecutionApi.summary(SELLER_ID));
  const rows = actionLedgerRowsOf(approvals.data);
  const pending = rows.filter((row) => ["APPROVAL_REQUIRED", "HIGH_RISK_APPROVAL", "FOUNDER_OVERRIDE_REQUIRED"].includes(String(row.actionStatus)));
  const approved = rows.filter((row) => String(row.actionStatus) === "APPROVED");
  const executed = rows.filter((row) => String(row.actionStatus) === "EXECUTED");

  return (
    <div className="page founder-page">
      <PageHeader title="Approvals" subtitle="Review and approve AI-CGO actions before they go to Amazon." />

      <div className="metric-grid">
        <FounderMetric label="Pending Approval" value={pending.length} icon="approval" trend="Needs your review" tone={pending.length > 0 ? "gold" : "green"} />
        <FounderMetric label="Approved" value={approved.length} icon="check" trend="Ready for execution" tone="green" />
        <FounderMetric label="Executed" value={executed.length} icon="chart" trend="Already on Amazon" tone="green" />
        <FounderMetric label="Total Actions" value={rows.length} icon="shield" trend="All tracked actions" tone="green" />
      </div>

      {pending.length > 0 && (
        <div className="today-section">
          <div className="today-section-header">
            <h3>Pending Approval</h3>
          </div>
          <div className="action-list">
            {pending.map((action) => (
              <div className="action-item" key={String(action.actionId)}>
                <div className="action-item-top">
                  <strong>{formatEmpty(action.actionTitle)}</strong>
                  <StatusBadge value={action.actionStatus} />
                </div>
                <div className="action-item-meta">
                  <span>{formatEmpty(action.actionType)}</span>
                  <span>{formatShortId(action.actionId)}</span>
                </div>
                <p>{formatEmpty(action.actionDescription)}</p>
                <div className="action-item-actions">
                  <button type="button" className="btn-primary">Approve</button>
                  <button type="button" className="btn-secondary">Reject</button>
                  <button type="button" className="btn-ghost">View Details</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div className="today-section">
          <div className="today-section-header">
            <h3>Approved</h3>
          </div>
          <div className="action-list">
            {approved.map((action) => (
              <div className="action-item" key={String(action.actionId)}>
                <div className="action-item-top">
                  <strong>{formatEmpty(action.actionTitle)}</strong>
                  <StatusBadge value={action.actionStatus} />
                </div>
                <div className="action-item-meta">
                  <span>{formatEmpty(action.actionType)}</span>
                  <span>{formatShortId(action.actionId)}</span>
                </div>
                <p>{formatEmpty(action.actionDescription)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && approved.length === 0 && (
        <div className="today-empty">
          <FounderIcon name="check" />
          <p>No actions need approval right now. AI-CGO is monitoring your account.</p>
        </div>
      )}
    </div>
  );
}

function GrowthPage({ navigate }: { navigate: FounderNavigate }) {
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const products = mergeFounderProducts(passports.data, economics.data);
  const topProducts = products.slice(0, 6);

  return (
    <div className="page founder-page">
      <PageHeader title="Growth" subtitle="AI recommendations for pricing, keywords, and campaigns." />

      <div className="metric-grid">
        <FounderMetric label="Total Products" value={products.length} icon="box" trend="Product catalog" tone="green" />
        <FounderMetric label="Products Needing Cost" value={products.filter(productNeedsCost).length} icon="cost" trend="Add costs to unlock profit" tone="gold" />
        <FounderMetric label="Low Profit Products" value={products.filter(productLowProfit).length} icon="chart" trend="Review margin and pricing" tone="gold" />
        <FounderMetric label="Growth Opportunities" value={products.length > 0 ? products.length : 0} icon="growth" trend="AI-analyzed opportunities" tone="green" />
      </div>

      <div className="today-section">
        <div className="today-section-header">
          <h3>Top Growth Opportunities</h3>
        </div>
        <div className="product-grid">
          {topProducts.map((product) => (
            <div className="product-card" key={product.key} onClick={() => navigate("Product Detail", product)}>
              <ProductThumb product={product} className="product-card-thumb" />
              <div className="product-card-body">
                <strong>{product.name}</strong>
                <div className="product-card-meta">
                  <span>{product.sku}</span>
                  <span>{product.asin}</span>
                </div>
                <div className="badge-row">
                  <FounderBadge value={product.costStatus} />
                  <FounderBadge value={product.profitStatus} />
                  <FounderBadge value={product.readiness} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SalesAdsPage() {
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const products = mergeFounderProducts(passports.data, economics.data);

  return (
    <div className="page founder-page">
      <PageHeader title="Sales & Ads" subtitle="PPC performance, sales trends, and ad spend overview." />

      <div className="metric-grid">
        <FounderMetric label="Total Products" value={products.length} icon="box" trend="Product catalog" tone="green" />
        <FounderMetric label="Products with Cost Data" value={products.filter((p) => !productNeedsCost(p)).length} icon="cost" trend="Cost data complete" tone="green" />
        <FounderMetric label="Low Profit Products" value={products.filter(productLowProfit).length} icon="chart" trend="Review margin and pricing" tone="gold" />
        <FounderMetric label="Avg Margin" value={formatPercent(products.length > 0 ? products.reduce((sum, p) => sum + Number(p.margin ?? 0), 0) / products.length : 0)} icon="sales" trend="Average profit margin" tone="green" />
      </div>

      <div className="today-section">
        <div className="today-section-header">
          <h3>Sales Overview</h3>
        </div>
        <div className="today-empty">
          <FounderIcon name="sales" />
          <p>Sales and PPC data will appear here once connected. Connect your Amazon Advertising API to see campaign performance.</p>
          <button type="button" className="btn-primary">Connect Amazon Ads</button>
        </div>
      </div>
    </div>
  );
}

function ReportsPage({ navigate }: { navigate: FounderNavigate }) {
  return (
    <div className="page founder-page">
      <PageHeader title="Reports" subtitle="Business reports, performance summaries, and exportable data." />

      <div className="today-section">
        <div className="today-section-header">
          <h3>Available Reports</h3>
        </div>
        <div className="report-grid">
          <div className="report-card" onClick={() => navigate("CEO Report")}>
            <FounderIcon name="report" />
            <strong>CEO Report</strong>
            <p>Executive summary of business health, top products, and AI-CGO performance.</p>
          </div>
          <div className="report-card" onClick={() => navigate("Product Passport")}>
            <FounderIcon name="box" />
            <strong>Product Passport</strong>
            <p>Detailed product readiness and catalog health report.</p>
          </div>
          <div className="report-card" onClick={() => navigate("Product Economics")}>
            <FounderIcon name="cost" />
            <strong>Product Economics</strong>
            <p>Profit, margin, and pricing analysis for all products.</p>
          </div>
          <div className="report-card" onClick={() => navigate("PPC Recommendations")}>
            <FounderIcon name="growth" />
            <strong>PPC Recommendations</strong>
            <p>AI-generated campaign optimization suggestions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoreToolsPage({ navigate }: { navigate: FounderNavigate }) {
  return (
    <div className="page founder-page">
      <PageHeader title="More Tools" subtitle="Advanced tools and technical settings." />

      <div className="tools-grid">
        <div className="tool-card" onClick={() => navigate("Image + A+")}>
          <FounderIcon name="growth" />
          <strong>Image + A+</strong>
          <p>Manage product images, A+ content, and creative assets.</p>
        </div>
        <div className="tool-card" onClick={() => navigate("Listing Drafts")}>
          <FounderIcon name="report" />
          <strong>Listing Drafts</strong>
          <p>Create and manage listing content drafts before publishing.</p>
        </div>
        <div className="tool-card" onClick={() => navigate("Approval Center")}>
          <FounderIcon name="approval" />
          <strong>Approval Center</strong>
          <p>Review and manage all AI-CGO action approvals.</p>
        </div>
        <div className="tool-card" onClick={() => navigate("Settings")}>
          <FounderIcon name="shield" />
          <strong>Settings</strong>
          <p>Configure AI-CGO behavior, notifications, and integrations.</p>
        </div>
        <div className="tool-card" onClick={() => navigate("Daily AI-CGO")}>
          <FounderIcon name="spark" />
          <strong>Daily AI-CGO</strong>
          <p>View daily orchestrator runs and command history.</p>
        </div>
        <div className="tool-card" onClick={() => navigate("Engine Command Center")}>
          <FounderIcon name="chart" />
          <strong>Engine Command Center</strong>
          <p>Monitor and control AI engine execution.</p>
        </div>
      </div>
    </div>
  );
}

function DailyAiCgoPage() {
  const daily = useApi<DailyOrchestratorStatus>(() => getJson(`/api/daily-orchestrator/status?sellerId=${SELLER_ID}`));
  const runs = useApi<DailyOrchestratorRun[]>(() => getJson(`/api/daily-orchestrator/runs?sellerId=${SELLER_ID}`));
  const commands = useApi<TodayCommandSummary>(() => getJson(`/api/today?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Daily AI-CGO" subtitle="Orchestrator status, run history, and command summaries." />

      <div className="metric-grid">
        <FounderMetric label="Status" value={cleanFounderText(daily.data?.status, "Unknown")} badge />
        <FounderMetric label="Last Run" value={cleanFounderText(daily.data?.lastRunDate, "Never")} />
        <FounderMetric label="Next Run" value={cleanFounderText(daily.data?.nextRunDate, "Not scheduled")} />
        <FounderMetric label="Total Runs" value={readNumber(daily.data?.totalRuns)} />
      </div>

      <Card title="Recent Runs">
        {runs.loading ? <LoadingBlock /> : runs.error ? <ErrorBlock /> : runs.data && runs.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Run ID</th><th>Date</th><th>Status</th><th>Commands</th><th>Actions</th></tr></thead>
              <tbody>
                {runs.data.map((run) => (
                  <tr key={String(run.runId)}>
                    <td>{formatShortId(run.runId)}</td>
                    <td>{formatEmpty(run.runDate)}</td>
                    <td><StatusBadge value={run.status} /></td>
                    <td>{readNumber(run.commandCount)}</td>
                    <td>{readNumber(run.actionCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>

      <Card title="Today's Commands">
        {commands.loading ? <LoadingBlock /> : commands.error ? <ErrorBlock /> : (
          <div className="action-list">
            {actionLedgerRowsOf(commands.data).slice(0, 10).map((cmd) => (
              <div className="action-item" key={String(cmd.actionId)}>
                <div className="action-item-top">
                  <strong>{formatEmpty(cmd.actionTitle)}</strong>
                  <StatusBadge value={cmd.actionStatus} />
                </div>
                <div className="action-item-meta">
                  <span>{formatEmpty(cmd.actionType)}</span>
                  <span>{formatShortId(cmd.actionId)}</span>
                </div>
                <p>{formatEmpty(cmd.actionDescription)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ProductPassportPage() {
  const [section, setSection] = useState<ProductPassportSection>("READINESS");
  const passports = useApi<ApiRows<AnyRecord>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const rows = rowsOf<AnyRecord>(passports.data);

  return (
    <div className="page">
      <PageHeader title="Product Passport" subtitle="Product readiness and catalog health." />

      <div className="filter-pills">
        <button type="button" className={`filter-pill ${section === "READINESS" ? "filter-pill-active" : ""}`} onClick={() => setSection("READINESS")}>Readiness</button>
        <button type="button" className={`filter-pill ${section === "COST_COMPLETION" ? "filter-pill-active" : ""}`} onClick={() => setSection("COST_COMPLETION")}>Cost Completion</button>
      </div>

      <Card title={section === "READINESS" ? "Readiness Status" : "Cost Completion Queue"}>
        {passports.loading ? <LoadingBlock /> : passports.error ? <ErrorBlock /> : rows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th>ASIN</th><th>Name</th><th>Status</th><th>Score</th></tr></thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>{formatEmpty(row.sku)}</td>
                    <td>{formatEmpty(row.asin)}</td>
                    <td>{formatEmpty(row.productName ?? row.name)}</td>
                    <td><StatusBadge value={row.status ?? row.readinessStatus} /></td>
                    <td>{readNumber(row.readinessScore ?? row.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function ProductEconomicsPage() {
  const economics = useApi<ApiRows<AnyRecord>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const rows = rowsOf<AnyRecord>(economics.data);

  return (
    <div className="page">
      <PageHeader title="Product Economics" subtitle="Profit, margin, and pricing analysis." />

      <Card title="Economics Overview">
        {economics.loading ? <LoadingBlock /> : economics.error ? <ErrorBlock /> : rows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th>ASIN</th><th>Price</th><th>Net Profit</th><th>Margin</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>{formatEmpty(row.sku)}</td>
                    <td>{formatEmpty(row.asin)}</td>
                    <td>{formatMoney(row.sellingPrice ?? row.price)}</td>
                    <td>{formatMoney(row.netProfit ?? row.net_profit)}</td>
                    <td>{formatPercent(row.profitMargin ?? row.margin)}</td>
                    <td><StatusBadge value={row.profitStatus ?? row.costStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function PpcRecommendationsPage() {
  const recommendations = useApi<ApiRows<Recommendation>>(() => getJson(`/api/ppc-recommendations?sellerId=${SELLER_ID}`));
  const rows = rowsOf<Recommendation>(recommendations.data);

  return (
    <div className="page">
      <PageHeader title="PPC Recommendations" subtitle="AI-generated campaign optimization suggestions." />

      <Card title="Recommendations">
        {recommendations.loading ? <LoadingBlock /> : recommendations.error ? <ErrorBlock /> : rows.length > 0 ? (
          <div className="item-list">
            {rows.map((row, index) => (
              <RecommendationCard key={index} item={row as AnyRecord} />
            ))}
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function EngineCommandCenterPage() {
  const registry = useApi<EngineRegistryItem[]>(() => getJson(`/api/engine-registry?sellerId=${SELLER_ID}`));
  const logs = useApi<EngineRunLog[]>(() => getJson(`/api/engine-logs?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Engine Command Center" subtitle="Monitor and control AI engine execution." />

      <Card title="Engine Registry">
        {registry.loading ? <LoadingBlock /> : registry.error ? <ErrorBlock /> : registry.data && registry.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Engine</th><th>Status</th><th>Last Run</th><th>Health</th></tr></thead>
              <tbody>
                {registry.data.map((engine) => (
                  <tr key={String(engine.engineId)}>
                    <td>{formatEmpty(engine.name)}</td>
                    <td><StatusBadge value={engine.status} /></td>
                    <td>{formatEmpty(engine.lastRunDate)}</td>
                    <td><StatusBadge value={engine.health} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>

      <Card title="Run Logs">
        {logs.loading ? <LoadingBlock /> : logs.error ? <ErrorBlock /> : logs.data && logs.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Log ID</th><th>Engine</th><th>Date</th><th>Status</th><th>Duration</th></tr></thead>
              <tbody>
                {logs.data.map((log) => (
                  <tr key={String(log.logId)}>
                    <td>{formatShortId(log.logId)}</td>
                    <td>{formatEmpty(log.engineName)}</td>
                    <td>{formatEmpty(log.runDate)}</td>
                    <td><StatusBadge value={log.status} /></td>
                    <td>{readNumber(log.durationMs)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function ApprovalCenterPage() {
  const approvals = useApi<ApprovalExecutionSummary>(() => approvalExecutionApi.summary(SELLER_ID));
  const rows = actionLedgerRowsOf(approvals.data);

  return (
    <div className="page">
      <PageHeader title="Approval Center" subtitle="Review and manage all AI-CGO action approvals." />

      <Card title="Approval Summary">
        {approvals.loading ? <LoadingBlock /> : approvals.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Actions" value={rows.length} />
            <MetricRow label="Pending" value={rows.filter((r) => r.actionStatus === "APPROVAL_REQUIRED").length} />
            <MetricRow label="High Risk" value={rows.filter((r) => r.actionStatus === "HIGH_RISK_APPROVAL").length} />
            <MetricRow label="Approved" value={rows.filter((r) => r.actionStatus === "APPROVED").length} />
            <MetricRow label="Executed" value={rows.filter((r) => r.actionStatus === "EXECUTED").length} />
            <MetricRow label="Rejected" value={rows.filter((r) => r.actionStatus === "REJECTED").length} />
          </div>
        )}
      </Card>

      <Card title="All Actions">
        {approvals.loading ? <LoadingBlock /> : approvals.error ? <ErrorBlock /> : rows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.actionId)}>
                    <td>{formatShortId(row.actionId)}</td>
                    <td>{formatEmpty(row.actionTitle)}</td>
                    <td>{formatEmpty(row.actionType)}</td>
                    <td><StatusBadge value={row.actionStatus} /></td>
                    <td>{formatEmpty(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function ApprovalExecutionPage() {
  const summary = useApi<ApprovalExecutionSummary>(() => approvalExecutionApi.summary(SELLER_ID));
  const rows = actionLedgerRowsOf(summary.data);

  return (
    <div className="page">
      <PageHeader title="Approval Execution" subtitle="Detailed view of approval and execution pipeline." />

      <Card title="Execution Pipeline">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : rows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Status</th><th>Risk</th><th>Created</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.actionId)}>
                    <td>{formatShortId(row.actionId)}</td>
                    <td>{formatEmpty(row.actionTitle)}</td>
                    <td>{formatEmpty(row.actionType)}</td>
                    <td><StatusBadge value={row.actionStatus} /></td>
                    <td><StatusBadge value={row.riskLevel ?? "LOW"} /></td>
                    <td>{formatEmpty(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function ExecutionGatewayPage() {
  const status = useApi<ExecutionGatewayStatus>(() => getJson(`/api/execution-gateway/status?sellerId=${SELLER_ID}`));
  const attempts = useApi<ExecutionAttempt[]>(() => getJson(`/api/execution-gateway/attempts?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Execution Gateway" subtitle="Monitor execution attempts and gateway health." />

      <Card title="Gateway Status">
        {status.loading ? <LoadingBlock /> : status.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Status" value={<StatusBadge value={status.data?.status} />} />
            <MetricRow label="Queue Depth" value={readNumber(status.data?.queueDepth)} />
            <MetricRow label="Success Rate" value={formatPercent(status.data?.successRate)} />
            <MetricRow label="Last Check" value={formatEmpty(status.data?.lastCheckDate)} />
          </div>
        )}
      </Card>

      <Card title="Recent Attempts">
        {attempts.loading ? <LoadingBlock /> : attempts.error ? <ErrorBlock /> : attempts.data && attempts.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Action</th><th>Date</th><th>Status</th><th>Error</th></tr></thead>
              <tbody>
                {attempts.data.map((attempt) => (
                  <tr key={String(attempt.attemptId)}>
                    <td>{formatShortId(attempt.attemptId)}</td>
                    <td>{formatEmpty(attempt.actionTitle)}</td>
                    <td>{formatEmpty(attempt.attemptDate)}</td>
                    <td><StatusBadge value={attempt.status} /></td>
                    <td>{formatEmpty(attempt.errorMessage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function LiveExecutionPage() {
  const status = useApi<LiveExecutionStatus>(() => getJson(`/api/live-execution/status?sellerId=${SELLER_ID}`));
  const runs = useApi<LiveExecutionRun[]>(() => getJson(`/api/live-execution/runs?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Live Execution" subtitle="Real-time execution monitoring and run history." />

      <Card title="Live Status">
        {status.loading ? <LoadingBlock /> : status.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Status" value={<StatusBadge value={status.data?.status} />} />
            <MetricRow label="Active Runs" value={readNumber(status.data?.activeRuns)} />
            <MetricRow label="Completed Today" value={readNumber(status.data?.completedToday)} />
            <MetricRow label="Failed Today" value={readNumber(status.data?.failedToday)} />
          </div>
        )}
      </Card>

      <Card title="Recent Runs">
        {runs.loading ? <LoadingBlock /> : runs.error ? <ErrorBlock /> : runs.data && runs.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Run ID</th><th>Date</th><th>Status</th><th>Actions</th><th>Duration</th></tr></thead>
              <tbody>
                {runs.data.map((run) => (
                  <tr key={String(run.runId)}>
                    <td>{formatShortId(run.runId)}</td>
                    <td>{formatEmpty(run.runDate)}</td>
                    <td><StatusBadge value={run.status} /></td>
                    <td>{readNumber(run.actionCount)}</td>
                    <td>{readNumber(run.durationMs)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function RollbackCenterPage() {
  const snapshots = useApi<RollbackSnapshot[]>(() => getJson(`/api/rollback/snapshots?sellerId=${SELLER_ID}`));
  const summary = useApi<RollbackSummary>(() => getJson(`/api/rollback/summary?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Rollback Center" subtitle="Manage snapshots and rollback operations." />

      <Card title="Rollback Summary">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Snapshots" value={readNumber(summary.data?.totalSnapshots)} />
            <MetricRow label="Available Rollbacks" value={readNumber(summary.data?.availableRollbacks)} />
            <MetricRow label="Last Snapshot" value={formatEmpty(summary.data?.lastSnapshotDate)} />
          </div>
        )}
      </Card>

      <Card title="Snapshots">
        {snapshots.loading ? <LoadingBlock /> : snapshots.error ? <ErrorBlock /> : snapshots.data && snapshots.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Date</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {snapshots.data.map((snapshot) => (
                  <tr key={String(snapshot.snapshotId)}>
                    <td>{formatShortId(snapshot.snapshotId)}</td>
                    <td>{formatEmpty(snapshot.createdAt)}</td>
                    <td>{formatEmpty(snapshot.snapshotType)}</td>
                    <td><StatusBadge value={snapshot.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function ListingDraftsPage() {
  const drafts = useApi<ApiRows<ListingDraft>>(() => getJson(`/api/listing-drafts?sellerId=${SELLER_ID}`));
  const rows = rowsOf<ListingDraft>(drafts.data);

  return (
    <div className="page">
      <PageHeader title="Listing Drafts" subtitle="Create and manage listing content drafts." />

      <Card title="Drafts">
        {drafts.loading ? <LoadingBlock /> : drafts.error ? <ErrorBlock /> : rows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>SKU</th><th>Title</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>{formatShortId(row.draftId ?? row.id)}</td>
                    <td>{formatEmpty(row.sku)}</td>
                    <td>{formatEmpty(row.title ?? row.productName)}</td>
                    <td><StatusBadge value={row.status} /></td>
                    <td>{formatEmpty(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function ImageAplusPage() {
  const creative = useApi<CreativeRecommendationSummary>(() => getJson(`/api/creative-recommendations/summary?sellerId=${SELLER_ID}`));
  const recommendations = useApi<ApiRows<CreativeRecommendation>>(() => getJson(`/api/creative-recommendations?sellerId=${SELLER_ID}`));
  const rows = rowsOf<CreativeRecommendation>(recommendations.data);

  return (
    <div className="page">
      <PageHeader title="Image + A+" subtitle="Manage product images, A+ content, and creative assets." />

      <div className="metric-grid">
        <FounderMetric label="Total Recommendations" value={readNumber(readFirst(creative.data, ["totalRecommendations", "total"]))} icon="growth" trend="AI-generated suggestions" tone="green" />
        <FounderMetric label="A+ Content Reviews" value={readNumber(readFirst(creative.data, ["aplusContentReviews", "aPlusContentReviews"]))} icon="report" trend="Needs founder review" tone="gold" />
        <FounderMetric label="Image Reviews" value={readNumber(readFirst(creative.data, ["imageReviews", "image_reviews"]))} icon="growth" trend="Image optimization suggestions" tone="green" />
      </div>

      <Card title="Creative Recommendations">
        {recommendations.loading ? <LoadingBlock /> : recommendations.error ? <ErrorBlock /> : rows.length > 0 ? (
          <div className="item-list">
            {rows.map((row, index) => (
              <RecommendationCard key={index} item={row as AnyRecord} />
            ))}
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function CeoReportPage() {
  const today = useApi<TodayCommandSummary>(() => getJson(`/api/today?sellerId=${SELLER_ID}`));
  const approvals = useApi<ApprovalExecutionSummary>(() => approvalExecutionApi.summary(SELLER_ID));
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const products = mergeFounderProducts(passports.data, economics.data);

  return (
    <div className="page">
      <PageHeader title="CEO Report" subtitle="Executive summary of business health and AI-CGO performance." />

      <div className="metric-grid">
        <FounderMetric label="Total Products" value={products.length} icon="box" trend="Product catalog" tone="green" />
        <FounderMetric label="Pending Approvals" value={actionLedgerRowsOf(approvals.data).filter((r) => r.actionStatus === "APPROVAL_REQUIRED").length} icon="approval" trend="Needs founder review" tone="gold" />
        <FounderMetric label="Ready to Execute" value={actionLedgerRowsOf(approvals.data).filter((r) => r.actionStatus === "READY").length} icon="check" trend="Approved and queued" tone="green" />
        <FounderMetric label="Today's Status" value={cleanFounderText(recordOf(today.data).status, "Not available")} icon="spark" trend="AI-CGO daily run" tone="green" />
      </div>

      <Card title="Product Health Summary">
        <div className="detail-grid">
          <MetricRow label="Products Needing Cost" value={products.filter(productNeedsCost).length} />
          <MetricRow label="Low Profit Products" value={products.filter(productLowProfit).length} />
          <MetricRow label="Ready Products" value={products.filter((p) => normalizeState(p.readiness).includes("READY")).length} />
          <MetricRow label="Avg Margin" value={formatPercent(products.length > 0 ? products.reduce((sum, p) => sum + Number(p.margin ?? 0), 0) / products.length : 0)} />
        </div>
      </Card>
    </div>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState<AnyRecord>({});
  const current = useApi<AnyRecord>(() => getJson(`/api/settings?sellerId=${SELLER_ID}`));

  useEffect(() => {
    if (current.data) setSettings(recordOf(current.data));
  }, [current.data]);

  function updateSetting(key: string, value: unknown) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Configure AI-CGO behavior and integrations." />

      <Card title="General Settings">
        {current.loading ? <LoadingBlock /> : current.error ? <ErrorBlock /> : (
          <div className="form-grid">
            <TextInput label="Seller ID" value={String(settings.sellerId ?? SELLER_ID)} onChange={(value) => updateSetting("sellerId", value)} />
            <SelectField label="Safe Mode" value={String(settings.safeMode ?? "ON")} options={["ON", "OFF"]} onChange={(value) => updateSetting("safeMode", value)} />
            <SelectField label="Auto-Approve" value={String(settings.autoApprove ?? "OFF")} options={["ON", "OFF"]} onChange={(value) => updateSetting("autoApprove", value)} />
            <TextInput label="Notification Email" value={String(settings.notificationEmail ?? "")} onChange={(value) => updateSetting("notificationEmail", value)} />
          </div>
        )}
      </Card>
    </div>
  );
}

function LaunchGatePage() {
  const checks = useApi<LaunchGateSummary>(() => getJson(`/api/launch-gate/summary?sellerId=${SELLER_ID}`));
  const items = useApi<LaunchGateCheck[]>(() => getJson(`/api/launch-gate/checks?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Launch Gate" subtitle="Pre-launch safety checks and validation." />

      <Card title="Launch Gate Summary">
        {checks.loading ? <LoadingBlock /> : checks.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Checks" value={readNumber(checks.data?.totalChecks)} />
            <MetricRow label="Passed" value={readNumber(checks.data?.passedChecks)} />
            <MetricRow label="Failed" value={readNumber(checks.data?.failedChecks)} />
            <MetricRow label="Status" value={<StatusBadge value={checks.data?.status} />} />
          </div>
        )}
      </Card>

      <Card title="Check Details">
        {items.loading ? <LoadingBlock /> : items.error ? <ErrorBlock /> : items.data && items.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Check</th><th>Status</th><th>Message</th></tr></thead>
              <tbody>
                {items.data.map((check) => (
                  <tr key={String(check.checkId)}>
                    <td>{formatEmpty(check.checkName)}</td>
                    <td><StatusBadge value={check.status} /></td>
                    <td>{formatEmpty(check.message)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function LaunchChecklistPage() {
  const checklist = useApi<LaunchChecklistSummary>(() => getJson(`/api/launch-checklist/summary?sellerId=${SELLER_ID}`));
  const items = useApi<LaunchChecklistItem[]>(() => getJson(`/api/launch-checklist/items?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Launch Checklist" subtitle="Pre-launch checklist and task tracking." />

      <Card title="Checklist Summary">
        {checklist.loading ? <LoadingBlock /> : checklist.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Items" value={readNumber(checklist.data?.totalItems)} />
            <MetricRow label="Completed" value={readNumber(checklist.data?.completedItems)} />
            <MetricRow label="Pending" value={readNumber(checklist.data?.pendingItems)} />
            <MetricRow label="Status" value={<StatusBadge value={checklist.data?.status} />} />
          </div>
        )}
      </Card>

      <Card title="Checklist Items">
        {items.loading ? <LoadingBlock /> : items.error ? <ErrorBlock /> : items.data && items.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Status</th><th>Priority</th></tr></thead>
              <tbody>
                {items.data.map((item) => (
                  <tr key={String(item.itemId)}>
                    <td>{formatEmpty(item.itemName)}</td>
                    <td><StatusBadge value={item.status} /></td>
                    <td><StatusBadge value={item.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function SchedulerPage() {
  const summary = useApi<SchedulerSummary>(() => getJson(`/api/scheduler/summary?sellerId=${SELLER_ID}`));
  const jobs = useApi<SchedulerJob[]>(() => getJson(`/api/scheduler/jobs?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Scheduler" subtitle="Job scheduling and cron management." />

      <Card title="Scheduler Summary">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Jobs" value={readNumber(summary.data?.totalJobs)} />
            <MetricRow label="Active" value={readNumber(summary.data?.activeJobs)} />
            <MetricRow label="Failed (24h)" value={readNumber(summary.data?.failedJobs24h)} />
            <MetricRow label="Status" value={<StatusBadge value={summary.data?.status} />} />
          </div>
        )}
      </Card>

      <Card title="Scheduled Jobs">
        {jobs.loading ? <LoadingBlock /> : jobs.error ? <ErrorBlock /> : jobs.data && jobs.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Job</th><th>Schedule</th><th>Status</th><th>Last Run</th></tr></thead>
              <tbody>
                {jobs.data.map((job) => (
                  <tr key={String(job.jobId)}>
                    <td>{formatEmpty(job.jobName)}</td>
                    <td>{formatEmpty(job.schedule)}</td>
                    <td><StatusBadge value={job.status} /></td>
                    <td>{formatEmpty(job.lastRunDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function NotificationOutboxPage() {
  const summary = useApi<NotificationSummary>(() => getJson(`/api/notifications/summary?sellerId=${SELLER_ID}`));
  const messages = useApi<NotificationMessage[]>(() => getJson(`/api/notifications/messages?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Notification Outbox" subtitle="Notification history and delivery status." />

      <Card title="Notification Summary">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Sent" value={readNumber(summary.data?.totalSent)} />
            <MetricRow label="Pending" value={readNumber(summary.data?.pending)} />
            <MetricRow label="Failed" value={readNumber(summary.data?.failed)} />
            <MetricRow label="Last Sent" value={formatEmpty(summary.data?.lastSentDate)} />
          </div>
        )}
      </Card>

      <Card title="Recent Messages">
        {messages.loading ? <LoadingBlock /> : messages.error ? <ErrorBlock /> : messages.data && messages.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Sent</th></tr></thead>
              <tbody>
                {messages.data.map((msg) => (
                  <tr key={String(msg.messageId)}>
                    <td>{formatShortId(msg.messageId)}</td>
                    <td>{formatEmpty(msg.messageType)}</td>
                    <td><StatusBadge value={msg.status} /></td>
                    <td>{formatEmpty(msg.sentAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function SecurityGuardrailsPage() {
  const summary = useApi<SecurityGuardrailSummary>(() => getJson(`/api/security-guardrails/summary?sellerId=${SELLER_ID}`));
  const events = useApi<SecurityAuditEvent[]>(() => getJson(`/api/security-guardrails/events?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Security Guardrails" subtitle="Security monitoring and audit logs." />

      <Card title="Security Summary">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Events" value={readNumber(summary.data?.totalEvents)} />
            <MetricRow label="Violations" value={readNumber(summary.data?.violations)} />
            <MetricRow label="Blocked Actions" value={readNumber(summary.data?.blockedActions)} />
            <MetricRow label="Status" value={<StatusBadge value={summary.data?.status} />} />
          </div>
        )}
      </Card>

      <Card title="Recent Events">
        {events.loading ? <LoadingBlock /> : events.error ? <ErrorBlock /> : events.data && events.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Type</th><th>Severity</th><th>Date</th></tr></thead>
              <tbody>
                {events.data.map((event) => (
                  <tr key={String(event.eventId)}>
                    <td>{formatShortId(event.eventId)}</td>
                    <td>{formatEmpty(event.eventType)}</td>
                    <td><StatusBadge value={event.severity} /></td>
                    <td>{formatEmpty(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function ProductionHealthPage() {
  const summary = useApi<ProductionHealthSummary>(() => getJson(`/api/production-health/summary?sellerId=${SELLER_ID}`));
  const modules = useApi<ProductionHealthModule[]>(() => getJson(`/api/production-health/modules?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Production Health" subtitle="System health and module status monitoring." />

      <Card title="Health Summary">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Overall Status" value={<StatusBadge value={summary.data?.overallStatus} />} />
            <MetricRow label="Healthy Modules" value={readNumber(summary.data?.healthyModules)} />
            <MetricRow label="Degraded Modules" value={readNumber(summary.data?.degradedModules)} />
            <MetricRow label="Failed Modules" value={readNumber(summary.data?.failedModules)} />
          </div>
        )}
      </Card>

      <Card title="Module Status">
        {modules.loading ? <LoadingBlock /> : modules.error ? <ErrorBlock /> : modules.data && modules.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Module</th><th>Status</th><th>Latency</th><th>Last Check</th></tr></thead>
              <tbody>
                {modules.data.map((module) => (
                  <tr key={String(module.moduleId)}>
                    <td>{formatEmpty(module.moduleName)}</td>
                    <td><StatusBadge value={module.status} /></td>
                    <td>{readNumber(module.latencyMs)}ms</td>
                    <td>{formatEmpty(module.lastCheckDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function QaSmokePage() {
  const latest = useApi<QaSmokeLatest>(() => getJson(`/api/qa-smoke/latest?sellerId=${SELLER_ID}`));
  const runs = useApi<QaSmokeRun[]>(() => getJson(`/api/qa-smoke/runs?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="QA Smoke" subtitle="Smoke test results and validation." />

      <Card title="Latest Run">
        {latest.loading ? <LoadingBlock /> : latest.error ? <ErrorBlock /> : latest.data ? (
          <div className="detail-grid">
            <MetricRow label="Run ID" value={formatShortId(latest.data.runId)} />
            <MetricRow label="Date" value={formatEmpty(latest.data.runDate)} />
            <MetricRow label="Status" value={<StatusBadge value={latest.data.status} />} />
            <MetricRow label="Passed" value={readNumber(latest.data.passedChecks)} />
            <MetricRow label="Failed" value={readNumber(latest.data.failedChecks)} />
          </div>
        ) : <EmptyBlock />}
      </Card>

      <Card title="Run History">
        {runs.loading ? <LoadingBlock /> : runs.error ? <ErrorBlock /> : runs.data && runs.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Run ID</th><th>Date</th><th>Status</th><th>Passed</th><th>Failed</th></tr></thead>
              <tbody>
                {runs.data.map((run) => (
                  <tr key={String(run.runId)}>
                    <td>{formatShortId(run.runId)}</td>
                    <td>{formatEmpty(run.runDate)}</td>
                    <td><StatusBadge value={run.status} /></td>
                    <td>{readNumber(run.passedChecks)}</td>
                    <td>{readNumber(run.failedChecks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function MaintenancePage() {
  const summary = useApi<MaintenanceSummary>(() => getJson(`/api/maintenance/summary?sellerId=${SELLER_ID}`));
  const runs = useApi<MaintenanceRun[]>(() => getJson(`/api/maintenance/runs?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Maintenance" subtitle="Maintenance runs and system upkeep." />

      <Card title="Maintenance Summary">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Runs" value={readNumber(summary.data?.totalRuns)} />
            <MetricRow label="Successful" value={readNumber(summary.data?.successfulRuns)} />
            <MetricRow label="Failed" value={readNumber(summary.data?.failedRuns)} />
            <MetricRow label="Last Run" value={formatEmpty(summary.data?.lastRunDate)} />
          </div>
        )}
      </Card>

      <Card title="Recent Runs">
        {runs.loading ? <LoadingBlock /> : runs.error ? <ErrorBlock /> : runs.data && runs.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Run ID</th><th>Date</th><th>Status</th><th>Duration</th></tr></thead>
              <tbody>
                {runs.data.map((run) => (
                  <tr key={String(run.runId)}>
                    <td>{formatShortId(run.runId)}</td>
                    <td>{formatEmpty(run.runDate)}</td>
                    <td><StatusBadge value={run.status} /></td>
                    <td>{readNumber(run.durationMs)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function ActivityLogsPage() {
  const summary = useApi<ActivityLogSummary>(() => getJson(`/api/activity-logs/summary?sellerId=${SELLER_ID}`));
  const events = useApi<ActivityLogEvent[]>(() => getJson(`/api/activity-logs/events?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Activity Logs" subtitle="System activity and event tracking." />

      <Card title="Activity Summary">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Events" value={readNumber(summary.data?.totalEvents)} />
            <MetricRow label="Today" value={readNumber(summary.data?.eventsToday)} />
            <MetricRow label="Errors" value={readNumber(summary.data?.errorEvents)} />
            <MetricRow label="Last Event" value={formatEmpty(summary.data?.lastEventDate)} />
          </div>
        )}
      </Card>

      <Card title="Recent Events">
        {events.loading ? <LoadingBlock /> : events.error ? <ErrorBlock /> : events.data && events.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Type</th><th>Level</th><th>Date</th></tr></thead>
              <tbody>
                {events.data.map((event) => (
                  <tr key={String(event.eventId)}>
                    <td>{formatShortId(event.eventId)}</td>
                    <td>{formatEmpty(event.eventType)}</td>
                    <td><StatusBadge value={event.level} /></td>
                    <td>{formatEmpty(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function DataFreshnessPage() {
  const summary = useApi<DataFreshnessSummary>(() => getJson(`/api/data-freshness/summary?sellerId=${SELLER_ID}`));
  const rows = useApi<DataFreshnessRow[]>(() => getJson(`/api/data-freshness/rows?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Data Freshness" subtitle="Data freshness and staleness monitoring." />

      <Card title="Freshness Summary">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Sources" value={readNumber(summary.data?.totalSources)} />
            <MetricRow label="Fresh" value={readNumber(summary.data?.freshSources)} />
            <MetricRow label="Stale" value={readNumber(summary.data?.staleSources)} />
            <MetricRow label="Unknown" value={readNumber(summary.data?.unknownSources)} />
          </div>
        )}
      </Card>

      <Card title="Data Sources">
        {rows.loading ? <LoadingBlock /> : rows.error ? <ErrorBlock /> : rows.data && rows.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Source</th><th>Status</th><th>Last Update</th><th>Age</th></tr></thead>
              <tbody>
                {rows.data.map((row) => (
                  <tr key={String(row.sourceId)}>
                    <td>{formatEmpty(row.sourceName)}</td>
                    <td><StatusBadge value={row.status} /></td>
                    <td>{formatEmpty(row.lastUpdateDate)}</td>
                    <td>{readNumber(row.ageMinutes)}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function AiGatewayPage() {
  const status = useApi<AiGatewayStatus>(() => getJson(`/api/ai-gateway/status?sellerId=${SELLER_ID}`));
  const costs = useApi<AiCostSummary>(() => getJson(`/api/ai-gateway/costs?sellerId=${SELLER_ID}`));
  const estimates = useApi<AiCostEstimate[]>(() => getJson(`/api/ai-gateway/estimates?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="AI Gateway" subtitle="AI service status, costs, and usage monitoring." />

      <Card title="Gateway Status">
        {status.loading ? <LoadingBlock /> : status.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Status" value={<StatusBadge value={status.data?.status} />} />
            <MetricRow label="Active Models" value={readNumber(status.data?.activeModels)} />
            <MetricRow label="Requests Today" value={readNumber(status.data?.requestsToday)} />
            <MetricRow label="Avg Latency" value={`${readNumber(status.data?.avgLatencyMs)}ms`} />
          </div>
        )}
      </Card>

      <Card title="Cost Summary">
        {costs.loading ? <LoadingBlock /> : costs.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Today" value={formatMoney(costs.data?.todayCost)} />
            <MetricRow label="This Month" value={formatMoney(costs.data?.monthCost)} />
            <MetricRow label="Total" value={formatMoney(costs.data?.totalCost)} />
            <MetricRow label="Budget" value={formatMoney(costs.data?.budget)} />
          </div>
        )}
      </Card>

      <Card title="Cost Estimates">
        {estimates.loading ? <LoadingBlock /> : estimates.error ? <ErrorBlock /> : estimates.data && estimates.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Model</th><th>Estimated Cost</th><th>Confidence</th></tr></thead>
              <tbody>
                {estimates.data.map((estimate) => (
                  <tr key={String(estimate.estimateId)}>
                    <td>{formatEmpty(estimate.modelName)}</td>
                    <td>{formatMoney(estimate.estimatedCost)}</td>
                    <td>{formatPercent(estimate.confidence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function AlertCenterPage() {
  const summary = useApi<AlertSummary>(() => getJson(`/api/alert-center/summary?sellerId=${SELLER_ID}`));
  const events = useApi<AlertEvent[]>(() => getJson(`/api/alert-center/events?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Alert Center" subtitle="Alert monitoring and event management." />

      <Card title="Alert Summary">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Alerts" value={readNumber(summary.data?.totalAlerts)} />
            <MetricRow label="Active" value={readNumber(summary.data?.activeAlerts)} />
            <MetricRow label="Resolved" value={readNumber(summary.data?.resolvedAlerts)} />
            <MetricRow label="Critical" value={readNumber(summary.data?.criticalAlerts)} />
          </div>
        )}
      </Card>

      <Card title="Recent Alerts">
        {events.loading ? <LoadingBlock /> : events.error ? <ErrorBlock /> : events.data && events.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Type</th><th>Severity</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {events.data.map((event) => (
                  <tr key={String(event.alertId)}>
                    <td>{formatShortId(event.alertId)}</td>
                    <td>{formatEmpty(event.alertType)}</td>
                    <td><StatusBadge value={event.severity} /></td>
                    <td><StatusBadge value={event.status} /></td>
                    <td>{formatEmpty(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function LearningPage() {
  const summary = useApi<LearningSummary>(() => getJson(`/api/learning/summary?sellerId=${SELLER_ID}`));
  const events = useApi<LearningEvent[]>(() => getJson(`/api/learning/events?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Learning" subtitle="AI learning events and model improvement tracking." />

      <Card title="Learning Summary">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total Events" value={readNumber(summary.data?.totalEvents)} />
            <MetricRow label="Model Updates" value={readNumber(summary.data?.modelUpdates)} />
            <MetricRow label="Accuracy" value={formatPercent(summary.data?.accuracy)} />
            <MetricRow label="Last Update" value={formatEmpty(summary.data?.lastUpdateDate)} />
          </div>
        )}
      </Card>

      <Card title="Recent Events">
        {events.loading ? <LoadingBlock /> : events.error ? <ErrorBlock /> : events.data && events.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Type</th><th>Impact</th><th>Date</th></tr></thead>
              <tbody>
                {events.data.map((event) => (
                  <tr key={String(event.eventId)}>
                    <td>{formatShortId(event.eventId)}</td>
                    <td>{formatEmpty(event.eventType)}</td>
                    <td><StatusBadge value={event.impact} /></td>
                    <td>{formatEmpty(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function ExperimentsPage() {
  const summary = useApi<ExperimentSummary>(() => getJson(`/api/experiments/summary?sellerId=${SELLER_ID}`));
  const experiments = useApi<AnyRecord[]>(() => getJson(`/api/experiments/list?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Experiments" subtitle="A/B tests and experiment tracking." />

      <Card title="Experiment Summary">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Total" value={readNumber(summary.data?.totalExperiments)} />
            <MetricRow label="Active" value={readNumber(summary.data?.activeExperiments)} />
            <MetricRow label="Completed" value={readNumber(summary.data?.completedExperiments)} />
            <MetricRow label="Winners" value={readNumber(summary.data?.winners)} />
          </div>
        )}
      </Card>

      <Card title="Experiments">
        {experiments.loading ? <LoadingBlock /> : experiments.error ? <ErrorBlock /> : experiments.data && experiments.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Winner</th></tr></thead>
              <tbody>
                {experiments.data.map((exp) => (
                  <tr key={String(exp.experimentId)}>
                    <td>{formatShortId(exp.experimentId)}</td>
                    <td>{formatEmpty(exp.experimentName)}</td>
                    <td><StatusBadge value={exp.status} /></td>
                    <td>{formatEmpty(exp.winnerVariant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

function SafetyControlPage() {
  const status = useApi<SafetyControlStatus>(() => getJson(`/api/safety-control/status?sellerId=${SELLER_ID}`));
  const events = useApi<SafetyAuditEvent[]>(() => getJson(`/api/safety-control/events?sellerId=${SELLER_ID}`));

  return (
    <div className="page">
      <PageHeader title="Safety Control" subtitle="Safety controls and audit monitoring." />

      <Card title="Safety Status">
        {status.loading ? <LoadingBlock /> : status.error ? <ErrorBlock /> : (
          <div className="detail-grid">
            <MetricRow label="Status" value={<StatusBadge value={status.data?.status} />} />
            <MetricRow label="Total Checks" value={readNumber(status.data?.totalChecks)} />
            <MetricRow label="Passed" value={readNumber(status.data?.passedChecks)} />
            <MetricRow label="Blocked" value={readNumber(status.data?.blockedActions)} />
          </div>
        )}
      </Card>

      <Card title="Recent Events">
        {events.loading ? <LoadingBlock /> : events.error ? <ErrorBlock /> : events.data && events.data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Type</th><th>Result</th><th>Date</th></tr></thead>
              <tbody>
                {events.data.map((event) => (
                  <tr key={String(event.eventId)}>
                    <td>{formatShortId(event.eventId)}</td>
                    <td>{formatEmpty(event.eventType)}</td>
                    <td><StatusBadge value={event.result} /></td>
                    <td>{formatEmpty(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyBlock />}
      </Card>
    </div>
  );
}

// ====== HELPER FUNCTIONS ======

function readFirst(value: unknown, keys: string[]): unknown {
  for (const key of keys) {
    const result = readImagePath(value, key);
    if (result !== null && result !== undefined && result !== "") return result;
  }
  return undefined;
}

function recordsOf(value: unknown): AnyRecord[] {
  if (Array.isArray(value)) return value as AnyRecord[];
  const rows = (value as ApiRows<AnyRecord>)?.rows;
  if (Array.isArray(rows)) return rows;
  if (value && typeof value === "object") return [value as AnyRecord];
  return [];
}

function normalizeState(value: unknown): string {
  return String(value ?? "").toUpperCase().trim();
}

function labelize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default App;
