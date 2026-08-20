import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, FormEvent, ReactNode, RefObject } from "react";
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
  liveExecutionApi,
  maintenanceApi,
  notificationOutboxApi,
  postJson,
  productionHealthApi,
  putJson,
  qaSmokeApi,
  rollbackApi,
  safetyControlApi,
  schedulerControlApi,
  securityGuardrailsApi
} from "./api";
import type {
  ActionLedgerRow,
  ActionLedgerSummary,
  ActivityLogEvent,
  ActivityLogSummary,
  AnyRecord,
  ApiRows,
  ApprovalExecutionSummary,
  ApprovalReadyAction,
  AiCostEstimate,
  AiCostSummary,
  AiGatewayStatus,
  AiLedgerRow,
  AlertEvent,
  AlertSummary,
  CostCompletionQueueItem,
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
  Experiment,
  ExperimentSummary,
  LearningEngineSummary,
  LearningEvent,
  LearningSummary,
  LaunchChecklistItem,
  LaunchChecklistSummary,
  LaunchGateCheck,
  LaunchGateSummary,
  LiveExecutionRun,
  LiveExecutionStatus,
  ListingDraft,
  ListingDraftSummary,
  MaintenanceRun,
  MaintenanceSummary,
  NotificationMessage,
  NotificationSettings,
  NotificationSummary,
  ProductionHealthModule,
  ProductionHealthSummary,
  ProductEconomics,
  ProductPassport,
  QaSmokeCheck,
  QaSmokeLatest,
  QaSmokeRun,
  Recommendation,
  RollbackSnapshot,
  RollbackSummary,
  SafetyAuditEvent,
  SafetyControlStatus,
  SchedulerJob,
  SchedulerSummary,
  SchemaReadinessReport,
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
  "Listing Readiness",
  "Product Economics",
  "PPC Recommendations",
  "Approval Center",
  "Listing Drafts",
  "Image + A+",
  "CEO Report",
  "Settings"
] as const;

const founderTabs = ["Today", "Products", "AI Actions", "Growth Engine", "Brand Center", "Sales & Ads", "Reports"] as const;

type Tab = (typeof technicalTabs)[number];
type FounderTab = (typeof founderTabs)[number];
type LegacyFounderPage = "Approvals" | "Growth" | "Brand" | "More";
type AppPage = FounderTab | LegacyFounderPage | Tab | "Product Detail" | "Advanced Admin";
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

function actionLedgerRowsOf(value: unknown): ActionLedgerRow[] {
  if (Array.isArray(value)) return value as ActionLedgerRow[];
  return rowsOf<ActionLedgerRow>(value);
}

function arrayOf(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? (value as AnyRecord[]) : [];
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

function sanitizeActionError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error || "Unknown error.");
  const redacted = rawMessage
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
    .replace(/\b(?:sk|pk|rk)_[A-Za-z0-9_-]{16,}\b/g, "[redacted]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted]")
    .replace(
      /\b([A-Za-z_]*(?:TOKEN|SECRET|KEY|PASSWORD|PASS|PWD|AUTH)[A-Za-z_]*)\s*([:=])\s*("[^"]+"|'[^']+'|[^,\s;]+)/gi,
      "$1$2[redacted]"
    )
    .replace(
      /(["']?[A-Za-z0-9_.-]*(?:TOKEN|SECRET|KEY|PASSWORD|PASS|PWD|AUTH)[A-Za-z0-9_.-]*["']?\s*:\s*)("[^"]+"|'[^']+'|[^,\s;}]+)/gi,
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

function asInputNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Button({ children, className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={className} {...props}>
      {children}
    </button>
  );
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

function PageLayout({ title, subtitle, children, className = "" }: { title?: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`page founder-page ${className}`}>
      {title && subtitle ? <PageHeader title={title} subtitle={subtitle} /> : null}
      {children}
    </div>
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

function ReadOnlyField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <label className="field readonly-field">
      <span>{label}</span>
      <div>{value}</div>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field field-wide">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
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
  dimensions: unknown;
  weight: unknown;
  material: unknown;
  color: unknown;
  supplierName: unknown;
  raw: AnyRecord;
};

type FounderNavigate = (page: AppPage, product?: FounderProduct | null) => void;

function normalizeAppPage(page: AppPage): AppPage {
  if (page === "Approvals") return "AI Actions";
  if (page === "Growth") return "Growth Engine";
  if (page === "Brand") return "Brand Center";
  if (page === "More") return "Advanced Admin";
  return page;
}

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

function firstValidImageUrl(value: unknown, depth = 0): string | null {
  if (depth > 5 || value == null) return null;

  if (typeof value === "string") {
    const v = value.trim();

    if (
      v.startsWith("http://") ||
      v.startsWith("https://")
    ) {
      return v;
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstValidImageUrl(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = firstValidImageUrl(item, depth + 1);
      if (found) return found;
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
  "includedData.images.0.images.0.link"
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
  "action.productData"
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
  "includedData.images"
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
  return [
    imageStatus !== undefined ? ["Image Status", formatEmpty(imageStatus)] : null,
    mediaJoinMatched !== undefined ? ["Media Join Matched", formatEmpty(mediaJoinMatched)] : null
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

function hasProductContext(value: unknown): boolean {
  return Boolean(readFirst(value, [
    "sku",
    "asin",
    "productName",
    "product_name",
    "product",
    "productData",
    "mainImageUrl",
    "imageUrl",
    "amazonImageUrl",
    "productImageUrl"
  ]));
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
  const rawBullets = readFirst(source, ["bullets", "bulletPoints", "features", "listingBullets", "keyFeatures", "key_features"]);
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
    margin: readFirst(source, ["profitMargin", "margin", "profitMarginPercent"]) ?? readFirst(economics, ["profitMargin", "margin", "profitMarginPercent"]),
    profitStatus: readFirst(source, ["profitStatus", "currentProfitStatus", "current_profit_status"]) ?? readFirst(economics, ["profitStatus", "currentProfitStatus"]),
    readiness: readFirst(source, ["readiness", "readinessStatus", "listingReadiness", "status"]),
    costStatus: readFirst(source, ["costStatus", "cost_status", "profitDataStatus"]) ?? readFirst(economics, ["costStatus", "profitDataStatus"]),
    listingScore: readFirst(source, ["listingScore", "readinessScore", "passportScore", "score"]),
    inventory: readFirst(source, ["inventory", "inventoryStatus", "availableQuantity", "quantity"]),
    status: readFirst(source, ["status", "listingStatus", "productStatus"]),
    bullets,
    description: cleanFounderText(readFirst(source, ["description", "productDescription", "listingDescription"]), "No description available yet."),
    dimensions: readFirst(source, ["dimensions"]),
    weight: readFirst(source, ["weight"]),
    material: readFirst(source, ["material"]),
    color: readFirst(source, ["color"]),
    supplierName: readFirst(source, ["supplierName", "supplier_name"]),
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
  return (
    <div className={`product-placeholder product-placeholder-${variant} product-placeholder-${resolvedFallback} ${className}`} aria-label={`${title} image placeholder`}>
      <FounderIcon name="box" />
      {variant !== "small" ? <span>No product data available</span> : null}
    </div>
  );
}

function ProductImage({
  src,
  product,
  mainImageUrl,
  imageUrl,
  amazonImageUrl,
  imageUrls,
  title,
  variant = "medium",
  fallbackType = "product",
  className = ""
}: {
  src?: unknown;
  product?: unknown;
  mainImageUrl?: unknown;
  imageUrl?: unknown;
  amazonImageUrl?: unknown;
  imageUrls?: unknown;
  title: string;
  variant?: ProductThumbnailVariant;
  fallbackType?: ProductFallbackType;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const image = firstValidImageUrl([mainImageUrl, imageUrl, amazonImageUrl, imageUrls, src]) ?? getProductImage(product);
  useEffect(() => {
    setFailed(false);
  }, [image]);
  if (!image || failed) return <ProductPlaceholder title={title} variant={variant} fallbackType={fallbackType} className={className} />;
  return <img loading="lazy" decoding="async" className={`product-thumbnail product-thumbnail-${variant} ${className}`} src={image} alt={title} onError={() => setFailed(true)} />;
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
  return <ProductImage src={src} title={title} variant={variant} fallbackType={fallbackType} className={className} />;
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
  return <ProductImage product={"raw" in product ? product.raw : product} src={image} title={title} variant={inferredVariant} fallbackType={fallbackType} className={className} />;
}

function MetricCard({ label, value, badge, icon = "chart", trend = "Ready for review", tone = "green" }: { label: string; value: ReactNode; badge?: boolean; icon?: FounderIconName; trend?: string; tone?: "green" | "gold" | "blue" | "neutral" }) {
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

function FounderMetric(props: { label: string; value: ReactNode; badge?: boolean; icon?: FounderIconName; trend?: string; tone?: "green" | "gold" | "blue" | "neutral" }) {
  return <MetricCard {...props} />;
}

type NavItem = { label: string; page: AppPage; note?: string };
type NavGroup = { title: string; items: NavItem[] };

const sideNavGroups: NavGroup[] = [
  { title: "Daily", items: [
    { label: "Today", page: "Today" },
    { label: "Products", page: "Products" },
    { label: "AI Actions", page: "AI Actions" },
    { label: "Reports", page: "Reports" }
  ] },
  { title: "Catalog & Listings", items: [
    { label: "Product Passport", page: "Product Passport", note: "Product truth and cost queue" },
    { label: "Listing Readiness", page: "Listing Readiness", note: "Score, gaps, next action" },
    { label: "Product Economics", page: "Product Economics", note: "Profit calculator" },
    { label: "Listing Drafts", page: "Listing Drafts", note: "Listing improvements" },
    { label: "Image + A+", page: "Image + A+", note: "Creative recommendations" }
  ] },
  { title: "Growth & Ads", items: [
    { label: "Growth Engine", page: "Growth Engine" },
    { label: "Brand Center", page: "Brand Center" },
    { label: "Sales & Ads", page: "Sales & Ads" },
    { label: "PPC Recommendations", page: "PPC Recommendations" },
    { label: "Experiments", page: "Experiments" },
    { label: "Business Alerts", page: "Alert Center" }
  ] },
  { title: "Approvals & Safety", items: [
    { label: "Approval Center", page: "Approval Center" },
    { label: "Action Preview", page: "Approval Execution" },
    { label: "Action Safety", page: "Execution Gateway" },
    { label: "Controlled Live Actions", page: "Live Execution" },
    { label: "Launch Readiness", page: "Launch Gate" },
    { label: "Launch Tasks", page: "Launch Checklist" },
    { label: "Security", page: "Security Guardrails" },
    { label: "Recovery Center", page: "Rollback Center" }
  ] },
  { title: "Automation", items: [
    { label: "Daily AI Run", page: "Daily AI-CGO" },
    { label: "AI Control Room", page: "Engine Command Center" },
    { label: "Automation Calendar", page: "Scheduler" },
    { label: "Learning", page: "Learning" }
  ] },
  { title: "System", items: [
    { label: "Business Health", page: "Production Health" },
    { label: "Readiness Check", page: "QA Smoke" },
    { label: "Housekeeping", page: "Maintenance" },
    { label: "Data Status", page: "Data Freshness" },
    { label: "Activity Timeline", page: "Activity Logs" },
    { label: "AI Budget", page: "AI Gateway" },
    { label: "Notifications", page: "Notification Outbox" },
    { label: "Settings", page: "Settings" }
  ] }
];

function GrowthRing({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="growth-ring">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="3.6" stroke="currentColor" strokeOpacity="0.65" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
    </svg>
  );
}

function SideNav({
  activePage,
  onNavigate
}: {
  activePage: AppPage;
  onNavigate: FounderNavigate;
}) {
  return (
    <nav className="side-nav" aria-label="Primary navigation">
      {sideNavGroups.map((group) => (
        <div className="side-nav-group" key={group.title}>
          <span className="side-nav-group-label">{group.title}</span>
          {group.items.map((item) => {
            const isActive = activePage === item.page || (item.page === "Products" && activePage === "Product Detail");
            return (
              <button
                type="button"
                key={item.page}
                className={`side-nav-item ${isActive ? "side-nav-item-active" : ""}`}
                onClick={() => onNavigate(item.page)}
                title={item.note}
              >
                {isActive ? <GrowthRing size={14} /> : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function AppShell({
  activePage,
  logoFailed,
  onLogoFailed,
  onNavigate,
  children,
  contentRef
}: {
  activePage: AppPage;
  logoFailed: boolean;
  onLogoFailed: () => void;
  onNavigate: FounderNavigate;
  children: ReactNode;
  contentRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="app-shell-v2">
      <aside className="side-nav-rail">
        <Button className="side-nav-brand" onClick={() => onNavigate("Today")} aria-label="Open Today">
          {logoFailed ? (
            <div className="logo-fallback">LD</div>
          ) : (
            <img src="/ld-logo.png" alt="Leafy Dew" onError={onLogoFailed} />
          )}
          <span>
            <strong>Leafy Dew</strong>
            <small>AI-CGO</small>
          </span>
        </Button>
        <SideNav activePage={activePage} onNavigate={onNavigate} />
        <Button className="side-nav-settings" onClick={() => onNavigate("Settings")}>
          <FounderIcon name="shield" />
          <span>Founder Settings</span>
        </Button>
      </aside>

      <div className="side-nav-main">
        <header className="top-bar-slim">
          <span className="safe-mode-pill" title="Nothing changes on Amazon without your approval and safety checks."><FounderIcon name="shield" />Safe Mode ON</span>
          <div className="top-bar-slim-actions">
            <Button className="ai-status-pill" onClick={() => onNavigate("Safety Control")} title="Open advanced safety status">AI Status</Button>
            <Button className="icon-button" onClick={() => onNavigate("Notification Outbox")} aria-label="Notifications"><FounderIcon name="bell" /></Button>
          </div>
        </header>
        <main className="main-panel founder-main-panel">
          <div className="main-content page-container" ref={contentRef}>
            {children}
          </div>
        </main>
      </div>
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
    setActivePage(normalizeAppPage(page));
  }

  function setTechnicalTab(tab: Tab) {
    setActivePage(tab);
  }

  return (
    <AppShell
      activePage={activePage}
      logoFailed={logoFailed}
      onLogoFailed={() => setLogoFailed(true)}
      onNavigate={navigate}
      contentRef={mainContentRef}
    >
          {activePage === "Today" && <TodayDashboard navigate={navigate} />}
          {activePage === "Products" && <ProductsPage navigate={navigate} />}
          {activePage === "Product Detail" && <ProductDetailPage product={selectedProduct} navigate={navigate} />}
          {activePage === "AI Actions" && <FounderApprovalsPage navigate={navigate} />}
          {activePage === "Growth Engine" && <GrowthPage navigate={navigate} />}
          {activePage === "Brand Center" && <BrandPage navigate={navigate} />}
          {activePage === "Sales & Ads" && <SalesAdsPage navigate={navigate} />}
          {activePage === "Reports" && <ReportsPage navigate={navigate} />}
          {activePage === "Advanced Admin" && <MoreToolsPage navigate={navigate} />}
          {activePage === "Daily AI-CGO" && <DailyAiCgoPage setActiveTab={setTechnicalTab} />}
          {activePage === "Product Passport" && <ProductPassportPage />}
          {activePage === "Listing Readiness" && <ListingReadinessPage navigate={navigate} />}
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
    </AppShell>
  );
}

function TodayDashboard({ navigate }: { navigate: FounderNavigate }) {
  const today = useApi<TodayCommandSummary>(() => getJson(`/api/today-command/summary?sellerId=${SELLER_ID}`));
  const approvals = useApi<{ summary: ActionLedgerSummary; rows: ActionLedgerRow[] }>(() => fetchActionLedgerData());
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const costQueue = useApi<ApiRows<CostCompletionQueueItem>>(() => getJson(`/api/product-economics/cost-completion-queue?sellerId=${SELLER_ID}`));
  const data = todayCommandSummaryOf(today.data);
  const products = mergeFounderProducts(passports.data, economics.data, costQueue.data);
  const productCount = products.length;
  const activeListings = products.filter((product) => normalizeState(product.status).includes("ACTIVE")).length;
  const missingCostCount = products.filter(productNeedsCost).length || todayCommandNumber(data, ["missingCostCount", "missingCosts", "missingCostData"]);
  const pendingApprovalCount = readNumber(approvals.data?.summary.pendingCount ?? todayCommandNumber(data, ["pendingApprovals", "pendingApprovalCount", "pendingCount"]));
  const listingIdeas = todayCommandNumber(data, ["listingDrafts", "totalListingDrafts", "listingIdeas"]);
  const ppcRisks = todayCommandNumber(data, ["ppcRisks", "highRiskApprovals", "highRiskCount"]);
  const profitRisks = products.filter(productLowProfit).length;

  const attentionItems = [
    missingCostCount > 0 ? { icon: "cost" as FounderIconName, title: "Missing cost data", text: `${missingCostCount} products need cost or fee data before profit guidance is reliable.`, priority: "High", action: "Fix Now", page: "Products" as AppPage } : null,
    pendingApprovalCount > 0 ? { icon: "approval" as FounderIconName, title: "AI actions waiting", text: `${pendingApprovalCount} recommendations are waiting for your decision.`, priority: "High", action: "Review Now", page: "AI Actions" as AppPage } : null,
    ppcRisks > 0 ? { icon: "sales" as FounderIconName, title: "PPC risk high", text: "Ad spend or ACOS needs a founder review before changes are made.", priority: "Watch", action: "Open Growth Engine", page: "Growth Engine" as AppPage } : null,
    listingIdeas > 0 ? { icon: "spark" as FounderIconName, title: "Listing ideas ready", text: "Content improvements are drafted for review.", priority: "Ready", action: "View Ideas", page: "Growth Engine" as AppPage } : null,
    profitRisks > 0 ? { icon: "chart" as FounderIconName, title: "Profit risk", text: "Some products may need pricing, cost, or ads attention.", priority: "Watch", action: "Open Products", page: "Products" as AppPage } : null
  ].filter(Boolean).slice(0, 5) as Array<{ icon: FounderIconName; title: string; text: string; priority: string; action: string; page: AppPage }>;

  const previewProducts = products.slice(0, 3);
  const nextBestAction = pendingApprovalCount > 0 || missingCostCount > 0
    ? "Review high-priority approvals and fix missing cost data first."
    : "Run Daily AI to refresh growth, catalog, ads, and brand recommendations.";

  return (
    <div className="page founder-page today-page">
      <div className="page-header founder-hero">
        <div className="hero-copy">
          <span className="eyebrow">Leafy Dew AI-CGO Command Center</span>
          <h1>Good morning, Founder</h1>
          <p>Your AI-CGO has reviewed catalog, ads, profit, and brand signals.</p>
          <div className="hero-helper"><FounderIcon name="shield" />Safe Mode is ON. No Amazon change is made without your approval and safety checks.</div>
          <div className="next-best-action">
            <span>Next Best Action</span>
            <strong>{nextBestAction}</strong>
            <div className="next-best-action-buttons">
              <button type="button" onClick={() => navigate(pendingApprovalCount > 0 ? "AI Actions" : missingCostCount > 0 ? "Products" : "Daily AI-CGO")}>Start with Priority Work</button>
              <button type="button" className="secondary" onClick={() => navigate("Daily AI-CGO")}>Run Daily AI</button>
            </div>
          </div>
        </div>
        <div className="hero-status-panel">
          <div><span>AI Ready</span><FounderBadge value={today.error ? "Needs data" : "Ready"} /></div>
          <div><span>Safe Mode</span><FounderBadge value="ON" tone="good" /></div>
          <div><span>Last Run</span><strong>{cleanFounderText(readFirst(data, ["lastRunAt", "latestRunAt", "latestDailyRunAt"]), "Not available yet")}</strong></div>
          <div><span>Seller</span><strong>Leafy Dew</strong></div>
        </div>
      </div>

      <section className="founder-section business-pulse-section">
        <div className="section-heading split-heading">
          <div>
            <h2>Business Pulse</h2>
            <p>Executive signals from products, sales, profit, and safe automation.</p>
          </div>
          <Badge tone="good">Protected</Badge>
        </div>
      <section className="quick-status-strip">
        <FounderMetric label="Total Products" value={today.loading || passports.loading ? "..." : productCount || "-"} icon="box" trend={productCount ? "Catalog connected" : "No product data available"} />
        <FounderMetric label="Active Listings" value={activeListings || "-"} icon="check" trend={activeListings ? "Live catalog signal" : "Waiting for sync"} />
        <FounderMetric label="Sales 7D" value={formatMoney(readFirst(data, ["sales7d", "sales7D", "sevenDaySales"]))} icon="sales" trend="Last 7 days" tone="blue" />
        <FounderMetric label="Net Profit 7D" value={formatMoney(readFirst(data, ["netProfit7d", "netProfit7D", "profit7d"]))} icon="chart" trend="After known costs" />
        <FounderMetric label="ACOS 7D" value={formatPercent(readFirst(data, ["acos7d", "acos7D", "sevenDayAcos"]))} icon="growth" trend="Ads efficiency" tone="gold" />
        <FounderMetric label="Safe Mode" value={<span className="safe-inline">ON</span>} icon="shield" trend="All actions locked" />
      </section>
      </section>

      <section className="founder-section">
        <div className="section-heading">
          <h2>What needs attention today?</h2>
          <p>The highest-impact items your AI-CGO found.</p>
        </div>
        <div className="attention-list">
          {today.error && approvals.error ? <ErrorBlock text="Could not load today's summary." /> : attentionItems.length === 0 ? (
            <div className="attention-row attention-row-calm">
              <div className="row-icon"><FounderIcon name="shield" /></div>
              <div>
                <strong>No urgent founder decisions right now</strong>
                <p>Safe Mode is on. Run Daily AI to refresh recommendations whenever you want a new review.</p>
              </div>
              <FounderBadge value="Protected" tone="good" />
              <button type="button" className="secondary" onClick={() => navigate("Daily AI-CGO")}>Run Daily AI</button>
            </div>
          ) : attentionItems.map((item) => (
            <article className="attention-row" key={item.title}>
              <div className="row-icon"><FounderIcon name={item.icon} /></div>
              <div>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </div>
              <FounderBadge value={item.priority} />
              <button type="button" className="secondary" onClick={() => navigate(item.page)}>{item.action}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="founder-section today-preview-section">
        <div className="section-heading">
          <h2>Today at a glance</h2>
          <p>A quick look at your catalog while you decide what to work on.</p>
        </div>
        <div className="today-glance-row">
          {previewProducts.length ? previewProducts.map((product) => (
            <button type="button" className="today-glance-card" key={product.key} onClick={() => navigate("Product Detail", product)}>
              <ProductThumb product={product} className="product-thumb" />
              <span className="today-glance-name">{product.name}</span>
              <span className="today-glance-meta">{cleanFounderText(product.sku, "SKU pending")}</span>
            </button>
          )) : (
            <div className="attention-row attention-row-calm">
              <span className="preview-empty">No product data available</span>
            </div>
          )}
          <button type="button" className="today-glance-card today-glance-more" onClick={() => navigate("Products")}>
            <span className="preview-metric">{productCount} products</span>
            <span>Open full catalog</span>
            <em>View all <FounderIcon name="arrow" /></em>
          </button>
        </div>
      </section>
    </div>
  );
}

function ProductsPage({ navigate }: { navigate: FounderNavigate }) {
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const costQueue = useApi<ApiRows<CostCompletionQueueItem>>(() => getJson(`/api/product-economics/cost-completion-queue?sellerId=${SELLER_ID}`));
  const [subTab, setSubTab] = useState("All Products");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const products = mergeFounderProducts(passports.data, economics.data, costQueue.data);
  const hasRealProducts = products.length > 0;
  const filteredProducts = products.filter((product) => {
    if (!productMatches(product, query)) return false;
    if (subTab === "Missing Costs" && !productNeedsCost(product)) return false;
    if (filter === "Active" && !normalizeState(product.status).includes("ACTIVE")) return false;
    if (filter === "Missing Cost" && !productNeedsCost(product)) return false;
    if (filter === "Low Profit" && !productLowProfit(product)) return false;
    if (filter === "PPC Risk" && !normalizeState(product.profitStatus).includes("PPC")) return false;
    if (filter === "Listing Needs Work" && productStatusTone(product.readiness) === "good") return false;
    return true;
  });
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize);
  const loading = passports.loading || economics.loading || costQueue.loading;

  return (
    <div className="page founder-page">
      <PageHeader title="Product Catalog" subtitle="Manage products, costs, profit, and listing readiness." />
      <div className="segmented founder-subtabs">
        {["All Products", "Missing Costs", "Profit Calculator"].map((label) => (
          <button type="button" key={label} className={subTab === label ? "active" : ""} onClick={() => { setSubTab(label); setPage(1); }}>{label}</button>
        ))}
      </div>
      <div className="catalog-summary-chips">
        <span><FounderIcon name="box" />{products.length} products</span>
        <span><FounderIcon name="cost" />{products.filter(productNeedsCost).length} missing cost</span>
        <span><FounderIcon name="chart" />{products.filter(productLowProfit).length} profit watch</span>
        <span><FounderIcon name="shield" />Safe Mode ON</span>
      </div>
      {subTab === "Profit Calculator" ? (
        <div className="soft-state">Use the advanced profit calculator when you need fee-level inputs. It keeps Amazon changes locked.</div>
      ) : null}
      <div className="catalog-controls">
        <label className="field">
          <span>Search by product, SKU, ASIN</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        </label>
        <button type="button" className="secondary">Filters</button>
        <button type="button" onClick={() => navigate("Product Passport")}>Add Product</button>
      </div>
      <div className="filter-pills">
        {["All", "Active", "Missing Cost", "Low Profit", "PPC Risk", "Listing Needs Work"].map((label) => (
          <button type="button" key={label} className={filter === label ? "active" : ""} onClick={() => { setFilter(label); setPage(1); }}>{label}</button>
        ))}
      </div>
      <Card title="Products">
        {loading ? <LoadingBlock text="Loading products..." /> : !hasRealProducts ? <EmptyBlock text="No product data available" /> : filteredProducts.length === 0 ? <EmptyBlock text="No products match this filter." /> : (
          <>
            <div className="product-table">
              <div className="product-row product-row-head">
                <span>Product</span>
                <span>SKU</span>
                <span>ASIN</span>
                <span>Price</span>
                <span>Net Profit / Margin</span>
                <span>Profit Status</span>
                <span>Readiness</span>
                <span>Action</span>
              </div>
              {pageRows.map((product) => (
                <div className="product-row" key={product.key}>
                  <div className="product-cell">
                    <ProductThumb product={product} className="product-thumb" />
                    <strong>{product.name}</strong>
                  </div>
                  <span>{product.sku}</span>
                  <span>{product.asin}</span>
                  <span>{formatMoney(product.price)}</span>
                  <span>{formatMoney(product.netProfit)} / {formatPercent(product.margin)}</span>
                  <span><FounderBadge value={product.profitStatus ?? "Not available yet"} /></span>
                  <span><FounderBadge value={product.readiness ?? product.costStatus ?? "Needs data"} /></span>
                  <span><button type="button" className="secondary" onClick={() => navigate("Product Detail", product)}>View</button></span>
                </div>
              ))}
            </div>
            <div className="catalog-pagination">
              <span>Showing {pageRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-{(safePage - 1) * pageSize + pageRows.length} of {filteredProducts.length}</span>
              <div className="button-row compact">
                <button type="button" className="secondary" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
                <button type="button" className="secondary" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function ProductDetailPage({ product, navigate }: { product: FounderProduct | null; navigate: FounderNavigate }) {
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const [activeTab, setActiveTab] = useState("Overview");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [amazonSyncState, setAmazonSyncState] = useState<{
    loading: boolean;
    summary: string | null;
    warnings: string[];
    isError: boolean;
  }>({ loading: false, summary: null, warnings: [], isError: false });
  const products = mergeFounderProducts(passports.data, economics.data);
  const detailProduct = product ?? products[0] ?? null;

  async function handleSyncFromAmazon() {
    setAmazonSyncState({ loading: true, summary: "Starting sync...", warnings: [], isError: false });
    const BATCH_SIZE = 100;
    const MAX_BATCHES = 6; // safety cap: covers up to 600 products in one click
    let totalChecked = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let lastWarnings: string[] = [];

    try {
      for (let batch = 1; batch <= MAX_BATCHES; batch += 1) {
        setAmazonSyncState((current) => ({
          ...current,
          summary: `Syncing batch ${batch}... (${totalUpdated} updated so far)`
        }));

        const result = await postJson<{ ok: boolean; checked: number; updatedCount: number; skippedCount: number; warnings: string[] }>(
          `/api/amazon-sp/sync-listing-attributes?sellerId=${SELLER_ID}&limit=${BATCH_SIZE}`
        );

        totalChecked += result.checked;
        totalUpdated += result.updatedCount;
        totalSkipped += result.skippedCount;
        lastWarnings = result.warnings ?? [];

        if (result.checked < BATCH_SIZE) {
          // Fewer than a full batch came back — we've reached the end of the catalog.
          break;
        }
      }

      setAmazonSyncState({
        loading: false,
        isError: false,
        summary: `Checked ${totalChecked} product(s) across your catalog, updated ${totalUpdated}.${totalSkipped ? ` ${totalSkipped} had no new data from Amazon.` : ""}`,
        warnings: lastWarnings
      });
      passports.reload();
    } catch (error) {
      const details = error instanceof Error ? (error as Error & { details?: unknown }).details : undefined;
      const detailLines: string[] = [];
      if (typeof details === "string" && details.trim().length > 0) {
        detailLines.push(details);
      } else if (details && typeof details === "object") {
        for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
          if (value === null || value === undefined || value === "") continue;
          detailLines.push(`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
        }
      }
      setAmazonSyncState({
        loading: false,
        isError: true,
        summary: `${totalUpdated > 0 ? `Updated ${totalUpdated} before this happened: ` : ""}${error instanceof Error ? error.message : "Could not sync with Amazon."}`,
        warnings: detailLines
      });
    }
  }

  const [schemaCheckState, setSchemaCheckState] = useState<{
    loading: boolean;
    report: SchemaReadinessReport | null;
    error: string | null;
  }>({ loading: false, report: null, error: null });

  async function handleCheckAmazonReadiness() {
    if (!detailProduct?.sku) return;
    setSchemaCheckState({ loading: true, report: null, error: null });
    try {
      const report = await getJson<SchemaReadinessReport>(
        `/api/listing-schema/check?sellerId=${SELLER_ID}&sku=${encodeURIComponent(String(detailProduct.sku))}`
      );
      setSchemaCheckState({ loading: false, report, error: null });
    } catch (error) {
      setSchemaCheckState({
        loading: false,
        report: null,
        error: error instanceof Error ? error.message : "Could not check Amazon readiness."
      });
    }
  }

  if (passports.loading || economics.loading) {
    return (
      <PageLayout title="Product Detail" subtitle="Live Amazon product workspace.">
        <LoadingBlock text="Loading product data..." />
      </PageLayout>
    );
  }

  if (!detailProduct) {
    return (
      <PageLayout title="Product Detail" subtitle="Live Amazon product workspace.">
        <EmptyBlock text="No product data available" />
      </PageLayout>
    );
  }

  const detailImageSource = detailProduct.raw;
  const galleryImages = getProductImages(detailImageSource);
  const gallery = galleryImages.length ? galleryImages : [null, null, null];
  const bullets = detailProduct.bullets;
  const imageDebugFields = productImageDebugFields(detailImageSource);
  const safeActiveImageIndex = activeImageIndex < gallery.length ? activeImageIndex : 0;

  return (
    <div className="page founder-page">
      <div className="detail-topline">
        <button type="button" className="secondary" onClick={() => navigate("Products")}>Back to Products</button>
        <FounderBadge value={detailProduct.status ?? "Safe preview"} />
      </div>
      <div className="product-detail-layout">
        <section className="product-gallery">
          <div className="thumb-rail">
            {gallery.map((image, index) => (
              <button
                type="button"
                key={index}
                className={`gallery-thumb${index === safeActiveImageIndex ? " gallery-thumb-active" : ""}`}
                aria-label={`Thumbnail ${index + 1}`}
                aria-pressed={index === safeActiveImageIndex}
                onClick={() => setActiveImageIndex(index)}
              >
                <ProductThumbnail src={image} title={`${detailProduct.name} thumbnail ${index + 1}`} variant="small" className="product-thumb" />
              </button>
            ))}
          </div>
          <div className="main-product-image">
            <ProductThumbnail src={gallery[safeActiveImageIndex] ?? null} title={detailProduct.name} className="product-main-img" />
          </div>
        </section>
        <section className="product-info-panel">
          <h1>{detailProduct.name}</h1>
          <p className="muted-line">Brand: {detailProduct.brand}</p>
          <div className="badge-row">
            <FounderBadge value={detailProduct.readiness ?? "Listing readiness pending"} />
            <FounderBadge value={detailProduct.profitStatus ?? "Profit data pending"} />
          </div>
          <div className="price-line">{formatMoney(detailProduct.price)}</div>
          <div className="detail-grid compact-business-grid">
            <MetricRow label="ASIN" value={detailProduct.asin} />
            <MetricRow label="SKU" value={detailProduct.sku} />
            <MetricRow label="Category" value={detailProduct.category} />
            <MetricRow label="Product Status" value={<FounderBadge value={detailProduct.status ?? "Not available yet"} />} />
            <MetricRow label="Dimensions" value={cleanFounderText(detailProduct.dimensions, "Not available yet")} />
            <MetricRow label="Weight" value={cleanFounderText(detailProduct.weight, "Not available yet")} />
            <MetricRow label="Material" value={cleanFounderText(detailProduct.material, "Not available yet")} />
            <MetricRow label="Color" value={cleanFounderText(detailProduct.color, "Not available yet")} />
            <MetricRow label="Supplier" value={cleanFounderText(detailProduct.supplierName, "Not available yet")} />
          </div>
          <h2>About this item</h2>
          {bullets.length ? (
            <ul className="clean-list product-bullets">
              {bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}
            </ul>
          ) : <EmptyBlock text="No product data available" />}
          <p className="product-description">{detailProduct.description}</p>
        </section>
        <aside className="product-side-panel">
          <div className="product-health-card">
            <h2>Product Health</h2>
            <MetricRow label="Profit Margin" value={formatPercent(detailProduct.margin)} />
            <MetricRow label="Net Profit" value={formatMoney(detailProduct.netProfit)} />
            <MetricRow label="Cost Status" value={<FounderBadge value={detailProduct.costStatus ?? "Needs data"} />} />
            <MetricRow label="PPC Safe" value={<FounderBadge value="Safe Mode" tone="good" />} />
            <MetricRow label="Inventory" value={cleanFounderText(detailProduct.inventory)} />
            <MetricRow label="Listing Score" value={cleanFounderText(detailProduct.listingScore)} />
            <MetricRow label="Safe Mode" value={<span className="safe-inline">ON</span>} />
          </div>
          <div className="quick-actions-card">
            <h2>Quick Actions</h2>
            <button type="button" onClick={() => navigate("Growth Engine")}>Optimize Listing</button>
            <button type="button" onClick={() => navigate("Sales & Ads")}>Manage PPC & Ads</button>
            <button type="button" onClick={() => navigate("Growth Engine")}>Image & A+ Ideas</button>
            <button type="button" onClick={() => navigate("Products")}>Fix Cost</button>
            <button type="button" onClick={() => navigate("Product Economics")}>Profit Calculator</button>
            <button type="button" onClick={handleSyncFromAmazon} disabled={amazonSyncState.loading}>
              {amazonSyncState.loading ? "Syncing with Amazon..." : "Sync Dimensions/Weight from Amazon"}
            </button>
            {amazonSyncState.summary ? (
              <p className={amazonSyncState.isError ? "error-text" : "success-text"}>{amazonSyncState.summary}</p>
            ) : null}
            {amazonSyncState.warnings.length > 0 ? (
              <ul className="sync-warning-list">
                {amazonSyncState.warnings.slice(0, 5).map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="quick-actions-card schema-readiness-card">
            <h2>Amazon Readiness Check</h2>
            <p className="schema-readiness-intro">Checks your Product Passport against Amazon's real schema for this product's category.</p>
            <button type="button" onClick={handleCheckAmazonReadiness} disabled={schemaCheckState.loading}>
              {schemaCheckState.loading ? "Checking with Amazon..." : "Check Amazon Readiness"}
            </button>
            {schemaCheckState.error ? <p className="error-text">{schemaCheckState.error}</p> : null}
            {schemaCheckState.report ? (
              <div className="schema-readiness-result">
                <p className={schemaCheckState.report.readyForSubmission ? "success-text" : "warning-text"}>
                  {schemaCheckState.report.summaryMessage}
                </p>
                {schemaCheckState.report.attributes.length > 0 ? (
                  <ul className="schema-attribute-list">
                    {schemaCheckState.report.attributes.map((item) => (
                      <li key={item.attribute} className={`schema-attribute-${item.status.toLowerCase()}`}>
                        <span className="schema-attribute-dot" />
                        <span>{item.label}</span>
                        <em>{item.status === "KNOWN" ? "On file" : item.status === "MISSING" ? "Missing" : "Not tracked yet"}</em>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
      <div className="bottom-tabs">
        {["Overview", "Content", "Pricing & Profit", "Images & A+", "PPC", "Recommendations", "History"].map((tab) => (
          <button type="button" key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>
      <Card title={activeTab}>
        <p className="section-note">Business-ready details for {activeTab.toLowerCase()} will appear here as the connected Amazon, economics, ads, and recommendation data grows.</p>
        <details className="technical-accordion">
          <summary>Advanced Details</summary>
          <div className="detail-grid">
            <MetricRow label="Internal Key" value={detailProduct.key} />
            <MetricRow label="Data Status" value={cleanFounderText(detailProduct.costStatus)} />
            {imageDebugFields.map(([label, value]) => (
              <MetricRow key={label} label={label} value={value} />
            ))}
          </div>
          <ProductImageDebug product={detailImageSource} />
        </details>
      </Card>
    </div>
  );
}

function FounderApprovalsPage({ navigate }: { navigate: FounderNavigate }) {
  const [filter, setFilter] = useState("Inbox");
  const [processing, setProcessing] = useState<{ id: string; action: LedgerAction } | null>(null);
  const [openHistory, setOpenHistory] = useState("");
  const approvals = useApi<{ summary: ActionLedgerSummary; rows: ActionLedgerRow[] }>(() => fetchActionLedgerData());
  const rows = approvals.data?.rows ?? [];
  const summary = approvals.data?.summary ?? {};
  const filteredRows = rows.filter((row) => {
    const state = normalizeState(row.approvalStatus ?? row.state);
    if (filter === "Pending") return state.includes("PENDING") || state.includes("WAITING");
    if (filter === "Approved") return state.includes("APPROVED");
    if (filter === "Rejected") return state.includes("REJECTED");
    if (filter === "Watch") return state.includes("MONITOR");
    if (filter === "Done") return state.includes("COMPLETED") || state.includes("DONE");
    return true;
  }).slice(0, 12);

  async function act(row: ActionLedgerRow, action: LedgerAction) {
    const id = row.id;
    const paths: Record<LedgerAction, string> = {
      approve: `/api/action-ledger/${id}/approve`,
      reject: `/api/action-ledger/${id}/reject`,
      monitor: `/api/action-ledger/${id}/monitor`,
      complete: `/api/action-ledger/${id}/complete`
    };
    setProcessing({ id, action });
    try {
      await postJson(paths[action], { note: `${labelize(action)} from founder decision inbox`, actor: "founder" });
      approvals.reload();
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="page founder-page">
      <PageHeader title="AI Actions" subtitle="These are recommendations. You decide what happens." />
      <div className="warning-card founder-safety-banner">
        <p>Approving does not automatically change Amazon unless live execution is enabled and all safety checks pass.</p>
      </div>
      <div className="quick-status-strip">
        <FounderMetric label="Pending" value={approvals.loading ? "..." : readNumber(summary.pendingCount)} icon="approval" trend="Waiting for your decision" />
        <FounderMetric label="High Priority" value={readNumber(summary.highRiskCount)} icon="shield" trend="Review carefully" tone="gold" />
        <FounderMetric label="Approved Today" value={readNumber(summary.approvedCount)} icon="check" trend="Still safety-gated" />
        <FounderMetric label="Watched" value={readNumber(summary.monitoringCount)} icon="chart" trend="Kept under review" tone="blue" />
      </div>
      <div className="filter-pills approval-filter-pills">
        {["Inbox", "Pending", "Approved", "Rejected", "Watch", "Done", "History", "Type", "Priority"].map((label) => (
          <button type="button" key={label} className={filter === label ? "active" : ""} onClick={() => setFilter(label)}>{label}</button>
        ))}
      </div>
      {approvals.loading ? <LoadingBlock text="Loading approvals..." /> : approvals.error ? <ErrorBlock text="Could not load approvals." /> : filteredRows.length === 0 ? <EmptyBlock text="No recommendations match this view." /> : (
        <div className="approval-inbox">
          {filteredRows.map((row) => {
            const id = row.id;
            const title = cleanFounderText(row.title ?? row.recommendedAction ?? row.summary, "Review recommendation");
            return (
              <article className="approval-card" key={id}>
                <div className="approval-row">
                  <ProductThumb product={row as unknown as AnyRecord} className="approval-thumb" variant="small" />
                  <div>
                    <div className="badge-row">
                      <FounderBadge value={row.riskLevel ?? "Watch"} />
                      <FounderBadge value={row.approvalStatus ?? row.state ?? "Pending"} />
                    </div>
                    <h2>{title}</h2>
                    <p>{cleanFounderText(row.summary ?? row.recommendedAction ?? row.actionType, "AI has prepared a recommendation for review.")}</p>
                    <div className="approval-meta-grid">
                      <MetricRow label="Product / Campaign" value={cleanFounderText(row.sku ?? row.asin ?? row.entityId)} />
                      <MetricRow label="Why" value={cleanFounderText(row.summary ?? row.recommendedAction)} />
                      <MetricRow label="Expected impact" value={cleanFounderText(row.confidenceLabel ?? "Not available yet")} />
                      <MetricRow label="Suggested by" value={cleanFounderText(row.source ?? "AI system")} />
                    </div>
                    {openHistory === id ? <p className="history-note">History is available in the advanced approval center. This inbox keeps the founder view simple.</p> : null}
                  </div>
                  <div className="approval-actions">
                    <button type="button" disabled={Boolean(processing)} onClick={() => act(row, "approve")}>{processing?.id === id && processing.action === "approve" ? "Approving..." : "Approve"}</button>
                    <button type="button" className="secondary" disabled={Boolean(processing)} onClick={() => act(row, "reject")}>Reject</button>
                    <button type="button" className="secondary" disabled={Boolean(processing)} onClick={() => act(row, "monitor")}>Watch</button>
                    <button type="button" className="secondary" onClick={() => setOpenHistory(openHistory === id ? "" : id)}>History</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="button-row">
        <button type="button" className="secondary" onClick={() => navigate("Approval Center")}>Open Advanced Approval Center</button>
      </div>
    </div>
  );
}

function GrowthPage({ navigate }: { navigate: FounderNavigate }) {
  const ppc = useApi<AnyRecord>(() => getJson(`/api/amazon-ads/ppc-recommendations?sellerId=${SELLER_ID}&days=30&targetAcos=35`));
  const drafts = useApi<ApiRows<ListingDraft>>(() => getJson(`/api/listing-drafts?sellerId=${SELLER_ID}&limit=20`));
  const creative = useApi<ApiRows<CreativeRecommendation>>(() => getJson(`/api/creative-recommendations?sellerId=${SELLER_ID}&limit=20`));
  const experiments = useApi<ApiRows<Experiment>>(() => experimentsApi.list(SELLER_ID, 20));
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const products = mergeFounderProducts(passports.data, economics.data, drafts.data, creative.data);
  const [tab, setTab] = useState("All Ideas");
  const ppcIdeas = [
    ...arrayOf(ppc.data?.scaleOpportunities),
    ...arrayOf(ppc.data?.exactMatchOpportunities),
    ...arrayOf(ppc.data?.productTargetingOpportunities),
    ...arrayOf(ppc.data?.watchlistRisks)
  ];
  const cards = [
    ...listingDraftRowsOf(drafts.data).map((row) => ({ type: "Listing Improvements", title: cleanFounderText(row.draftType, "Listing improvement"), productName: row.productName, why: row.reason ?? row.proposedValue, impact: row.confidenceLabel, risk: row.riskLevel, row })),
    ...ppcIdeas.map((row, index) => ({ type: "PPC Opportunities", title: cleanFounderText(readFirst(row, ["title", "recommendationType", "recommendedAction"]), "PPC opportunity"), productName: readFirst(row, ["productName", "campaignName", "entityValue"]), why: readFirst(row, ["reason", "summary", "recommendedAction"]), impact: readFirst(row, ["expectedImpact", "confidenceLabel"]), risk: readFirst(row, ["riskLevel"]), row: { ...row, id: `ppc-${index}` } })),
    ...creativeRecommendationRowsOf(creative.data).map((row) => ({ type: "Content & Creative", title: cleanFounderText(row.title ?? row.recommendationType, "Creative idea"), productName: row.productName, why: row.summary ?? row.recommendedAction, impact: row.confidenceLabel, risk: row.riskLevel, row })),
    ...experimentRowsOf(experiments.data).map((row) => ({ type: "Experiments", title: cleanFounderText(row.name ?? row.experimentName, "Experiment"), productName: row.sku ?? row.asin, why: row.hypothesis ?? row.description, impact: row.expectedResult ?? row.successMetric, risk: row.priority, row }))
  ].filter((card) => tab === "All Ideas" || card.type === tab).slice(0, 18);

  return (
    <div className="page founder-page">
      <PageHeader title="Growth Engine" subtitle="AI-powered ideas to grow traffic, conversion, and profit." />
      <SafetyBanner text="Nothing changes on Amazon automatically from this page." />
      <div className="segmented founder-subtabs">
        {["All Ideas", "Listing Improvements", "PPC Opportunities", "Content & Creative", "Experiments"].map((label) => (
          <button type="button" key={label} className={tab === label ? "active" : ""} onClick={() => setTab(label)}>{label}</button>
        ))}
      </div>
      {ppc.loading || drafts.loading || creative.loading || passports.loading || economics.loading ? <LoadingBlock text="Loading growth ideas..." /> : (
        <div className="growth-grid">
          {cards.length === 0 ? <EmptyBlock text="No product data available" /> : cards.map((card, index) => {
            const cardSku = cleanFounderText(readFirst(card.row, ["sku", "sellerSku"]), "");
            const cardAsin = cleanFounderText(readFirst(card.row, ["asin"]), "");
            const cardProductName = cleanFounderText(card.productName, "");
            const product = products.find((item) => (
              (cardSku && item.sku === cardSku)
              || (cardAsin && item.asin === cardAsin)
              || (cardProductName && item.name === cardProductName)
            ));
            const imageProduct = product ? { ...product, raw: { ...product.raw, ...recordOf(card.row) } } : recordOf(card.row);
            return (
              <article className="growth-card" key={String(readFirst(card.row, ["id"]) ?? index)}>
                <ProductThumb product={imageProduct} className="growth-img" />
                <div>
                  <FounderBadge value={card.type} />
                  <h2>{card.title}</h2>
                  <p className="muted-line">{cleanFounderText(card.productName, "Product not linked yet")}</p>
                  <p>{cleanFounderText(card.why, "AI found a growth opportunity worth reviewing.")}</p>
                  <div className="badge-row">
                    <FounderBadge value={card.impact ?? "Impact pending"} />
                    <FounderBadge value={card.risk ?? "Low risk"} />
                  </div>
                  <button type="button" onClick={() => navigate("AI Actions")}>View Suggestion</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BrandPage({ navigate }: { navigate: FounderNavigate }) {
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const creative = useApi<CreativeRecommendationSummary>(() => getJson(`/api/creative-recommendations/summary?sellerId=${SELLER_ID}`));
  const products = mergeFounderProducts(passports.data, economics.data);
  const topProducts = products.slice(0, 4);
  const brandScore = readFirst(creative.data, ["brandHealthScore", "brandScore", "score", "healthScore"]);
  const creativeAssetCount = readNumber(readFirst(creative.data, ["totalRecommendations", "total"]));

  return (
    <div className="page founder-page">
      <PageHeader title="Brand Center" subtitle="Track brand health, content, assets, and top products." />
      <section className="brand-hero-card">
        <div>
          <span className="eyebrow">Leafy Dew Brand Workspace</span>
          <h2>Protect the brand, improve creative, and turn top products into stronger storefront assets.</h2>
          <p>Brand Store, A+ content, product imagery, and campaign ideas stay founder-approved and safe.</p>
        </div>
        <div className="brand-hero-score">
          <span>Brand Health Score</span>
          <strong>{cleanFounderText(brandScore)}</strong>
          <FounderBadge value={brandScore === null || brandScore === undefined ? "Not available yet" : "Available"} tone={brandScore === null || brandScore === undefined ? "neutral" : "good"} />
        </div>
      </section>
      <div className="brand-grid">
        <FounderMetric label="Brand Health Score" value={cleanFounderText(brandScore)} />
        <FounderMetric label="A+ Content Status" value={readNumber(readFirst(creative.data, ["aplusContentReviews", "aPlusContentReviews"])) > 0 ? "Needs review" : "Not available yet"} badge />
        <FounderMetric label="Store Status" value="Not connected yet" badge />
        <FounderMetric label="Creative Assets" value={creativeAssetCount} />
        <FounderMetric label="Brand Insights" value={creativeAssetCount > 0 ? "Available" : "Not available yet"} badge />
        <FounderMetric label="Top Brand Products" value={topProducts.length} />
      </div>
      <section className="brand-sections">
        <article className="brand-card brand-store-card">
          <h2>Brand Store</h2>
          <ProductThumbnail title="Leafy Dew Brand Store" variant="large" fallbackType="brand" className="brand-store-preview" />
          <p>Status: Not Connected / Needs Setup</p>
          <button type="button" onClick={() => navigate("Image + A+")}>Open Brand Plan</button>
        </article>
        <article className="brand-card">
          <h2>A+ Content</h2>
          <p>{cleanFounderText(readFirst(creative.data, ["aplusContentReviews", "aPlusContentReviews"]), "0")} products need A+ review.</p>
          <button type="button" onClick={() => navigate("Growth")}>Review A+ Ideas</button>
        </article>
        <article className="brand-card creative-assets-card">
          <h2>Creative Assets</h2>
          {topProducts.length === 0 ? <EmptyBlock text="No product data available" /> : (
            <div className="asset-grid">
              {topProducts.map((product) => (
                <ProductThumb key={product.key} product={product} variant="medium" fallbackType="creative" className="asset-placeholder" />
              ))}
            </div>
          )}
        </article>
        <article className="brand-card top-products-card">
          <h2>Top Brand Products</h2>
          {topProducts.length === 0 ? <EmptyBlock text="No product data available" /> : topProducts.map((product) => (
            <button type="button" className="brand-product-row" key={product.key} onClick={() => navigate("Product Detail", product)}>
              <ProductThumb product={product} className="product-thumb" />
              <span>{product.name}</span>
              <strong>{formatMoney(product.price)}</strong>
              <FounderBadge value={product.profitStatus ?? "Needs data"} />
            </button>
          ))}
        </article>
        <article className="brand-card campaign-card">
          <h2>Brand Ideas & Campaigns</h2>
          <p>Seasonal bundles, brand story refresh, and creative opportunities can be prepared for founder approval.</p>
          <button type="button" onClick={() => navigate("Growth Engine")}>Open Growth Engine</button>
        </article>
      </section>
    </div>
  );
}

function SalesAdsPage({ navigate }: { navigate: FounderNavigate }) {
  const today = useApi<TodayCommandSummary>(() => getJson(`/api/today-command/summary?sellerId=${SELLER_ID}`));
  const ppc = useApi<AnyRecord>(() => getJson(`/api/amazon-ads/ppc-recommendations?sellerId=${SELLER_ID}&days=30&targetAcos=35`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const data = todayCommandSummaryOf(today.data);
  const ppcRisks = arrayOf(ppc.data?.watchlistRisks).slice(0, 4);
  const products = mergeFounderProducts(economics.data);
  const salesTrend = readNumberSeries(data, ["salesTrend", "sales7dTrend", "dailySales", "salesSeries"]);
  const adsTrend = readNumberSeries(data, ["adSpendTrend", "adSpend7dTrend", "dailyAdSpend", "adsSeries"]);
  const salesMax = Math.max(...salesTrend, 0);
  const adsMax = Math.max(...adsTrend, 0);

  return (
    <div className="page founder-page">
      <PageHeader title="Sales & Ads" subtitle="Understand sales, ads, ACOS, and profit health." />
      <div className="quick-status-strip">
        <FounderMetric label="Sales" value={formatMoney(readFirst(data, ["sales7d", "sales7D", "sales"]))} />
        <FounderMetric label="Orders" value={cleanFounderText(readFirst(data, ["orders7d", "orders7D", "orders"]), "0")} />
        <FounderMetric label="Ad Spend" value={formatMoney(readFirst(data, ["adSpend7d", "adSpend7D", "adSpend"]))} />
        <FounderMetric label="ACOS" value={formatPercent(readFirst(data, ["acos7d", "acos7D", "acos"]))} />
        <FounderMetric label="Profit" value={formatMoney(readFirst(data, ["netProfit7d", "netProfit7D", "profit"]))} />
        <FounderMetric label="PPC Risk" value={ppcRisks.length} />
      </div>
      <div className="sales-layout">
        <Card title="Sales Trend">
          {salesTrend.length === 0 ? <EmptyBlock text="No sales data available" /> : (
            <div className="simple-chart">
              {salesTrend.map((value, index) => <span key={index} style={{ height: `${salesMax > 0 ? Math.max(8, (value / salesMax) * 100) : 8}%` }} />)}
            </div>
          )}
        </Card>
        <Card title="Ad Spend vs Sales">
          {adsTrend.length === 0 ? <EmptyBlock text="No ads data available" /> : (
            <div className="simple-chart ads-chart">
              {adsTrend.map((value, index) => <span key={index} style={{ height: `${adsMax > 0 ? Math.max(8, (value / adsMax) * 100) : 8}%` }} />)}
            </div>
          )}
        </Card>
        <Card title="Top PPC Risks">
          {ppc.loading ? <LoadingBlock /> : ppcRisks.length === 0 ? <EmptyBlock text="No PPC risks returned yet." /> : (
            <div className="card-list">
              {ppcRisks.map((risk, index) => (
                <article className="item-card compact-card" key={String(readFirst(risk, ["id", "entityValue"]) ?? index)}>
                  <strong>{cleanFounderText(readFirst(risk, ["title", "entityValue", "campaignName"]), "PPC risk")}</strong>
                  <p>{cleanFounderText(readFirst(risk, ["reason", "summary", "recommendedAction"]))}</p>
                </article>
              ))}
            </div>
          )}
        </Card>
        <Card title="Profit Warnings">
          {products.filter(productLowProfit).slice(0, 4).map((product) => (
            <button type="button" className="brand-product-row" key={product.key} onClick={() => navigate("Product Detail", product)}>
              <ProductThumb product={product} className="product-thumb" />
              <span>{product.name}</span>
              <FounderBadge value={product.profitStatus ?? "Watch"} />
            </button>
          ))}
          {products.filter(productLowProfit).length === 0 ? <EmptyBlock text="No profit warnings are visible yet." /> : null}
        </Card>
      </div>
      <div className="button-row">
        <button type="button" className="secondary" onClick={() => navigate("CEO Report")}>Open CEO Report</button>
        <button type="button" className="secondary" onClick={() => navigate("PPC Recommendations")}>Open PPC Recommendations</button>
      </div>
    </div>
  );
}

function ReportsPage({ navigate }: { navigate: FounderNavigate }) {
  const reports = [
    { title: "CEO Report", page: "CEO Report" as AppPage },
    { title: "Daily Summary", page: "Today" as AppPage },
    { title: "Weekly Summary", page: "CEO Report" as AppPage },
    { title: "Profit Report", page: "Product Economics" as AppPage },
    { title: "PPC Report", page: "PPC Recommendations" as AppPage },
    { title: "Product Readiness Report", page: "Product Passport" as AppPage }
  ];
  return (
    <div className="page founder-page">
      <PageHeader title="Reports" subtitle="Founder summaries and business reports." />
      <div className="reports-grid">
        {reports.map((report) => (
          <button type="button" className="report-card" key={report.title} onClick={() => navigate(report.page)}>
            <span className="report-icon">R</span>
            <strong>{report.title}</strong>
            <span>Open report</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MoreToolsPage({ navigate }: { navigate: FounderNavigate }) {
  const groups: Array<{ title: string; tools: Array<{ label: string; page: AppPage; note: string }> }> = [
    { title: "Settings & Controls", tools: [
      { label: "Settings", page: "Settings", note: "Workspace preferences" },
      { label: "Safety Settings", page: "Safety Control", note: "Safe mode and approval rules" },
      { label: "AI Budget", page: "AI Gateway", note: "AI budget and usage" },
      { label: "Notifications", page: "Notification Outbox", note: "Queued messages" }
    ] },
    { title: "Operations", tools: [
      { label: "Business Health", page: "Production Health", note: "Operating readiness" },
      { label: "Readiness Check", page: "QA Smoke", note: "Internal checks" },
      { label: "Housekeeping", page: "Maintenance", note: "Safe housekeeping" },
      { label: "Data Status", page: "Data Freshness", note: "Source status" },
      { label: "Activity Timeline", page: "Activity Logs", note: "Recent events" }
    ] },
    { title: "Automation", tools: [
      { label: "Daily AI Run", page: "Daily AI-CGO", note: "Generate safe recommendations" },
      { label: "AI Control Room", page: "Engine Command Center", note: "Advanced AI controls" },
      { label: "Automation Calendar", page: "Scheduler", note: "Automation schedule" },
      { label: "Learning", page: "Learning", note: "Recommendation feedback" }
    ] },
    { title: "Launch & Safety", tools: [
      { label: "Controlled Live Actions", page: "Live Execution", note: "Gated execution only" },
      { label: "Launch Readiness", page: "Launch Gate", note: "Live readiness gate" },
      { label: "Launch Tasks", page: "Launch Checklist", note: "Readiness tasks" },
      { label: "Security", page: "Security Guardrails", note: "Safety blocks and audits" },
      { label: "Recovery Center", page: "Rollback Center", note: "Recovery snapshots" }
    ] },
    { title: "Advanced Growth", tools: [
      { label: "Action Preview", page: "Approval Execution", note: "Approved action preview" },
      { label: "Action Safety", page: "Execution Gateway", note: "Shadow action checks" },
      { label: "Business Alerts", page: "Alert Center", note: "Business alerts" },
      { label: "Experiments", page: "Experiments", note: "Growth experiments" },
      { label: "Product Readiness", page: "Product Passport", note: "Product truth and cost queue" },
      { label: "Listing Readiness", page: "Listing Readiness", note: "Score, gaps, next action per SKU" },
      { label: "Profit Calculator", page: "Product Economics", note: "Profit calculator" },
      { label: "Ads Recommendations", page: "PPC Recommendations", note: "Ads ideas" },
      { label: "Listing Drafts", page: "Listing Drafts", note: "Listing improvements" },
      { label: "Image + A+", page: "Image + A+", note: "Creative recommendations" },
      { label: "Advanced Approval Center", page: "Approval Center", note: "Full approval workflow" }
    ] }
  ];

  return (
    <div className="page founder-page">
      <PageHeader title="Advanced Admin" subtitle="Internal controls and operating checks for administrators." />
      <div className="warning-card founder-safety-banner">
        <p>Advanced tools are for system checking, launch readiness, and debugging. Daily users usually do not need them.</p>
      </div>
      <div className="more-tool-grid">
        {groups.map((group) => (
          <section className="more-tool-card" key={group.title}>
            <h2>{group.title}</h2>
            <div className="more-tool-list">
              {group.tools.map((tool) => (
                <button type="button" key={`${group.title}-${tool.label}`} onClick={() => navigate(tool.page)}>
                  <strong>{tool.label}</strong>
                  <span>{tool.note}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function todayCommandSummaryOf(value: unknown): TodayCommandSummary {
  const root = recordOf(value);
  return recordOf(root.todayCommand ?? root.summary ?? root.data ?? root.result ?? root) as TodayCommandSummary;
}

function todayCommandNumber(data: AnyRecord, keys: string[]): number {
  const countSources = [
    data,
    recordOf(data.counts),
    recordOf(data.summaryCounts),
    recordOf(data.metrics),
    recordOf(data.actionCounts),
    recordOf(data.engineCounts),
    recordOf(data.learningCounts),
    recordOf(data.executionCounts),
    recordOf(data.listingDraftSummary),
    recordOf(data.creativeRecommendationSummary),
    recordOf(data.alertSummary),
    recordOf(data.alertCenter),
    recordOf(data.experimentSummary),
    recordOf(data.experiments),
    recordOf(data.dataFreshnessSummary),
    recordOf(data.dataFreshness),
    recordOf(data.aiCostSummary),
    recordOf(data.aiGateway),
    recordOf(data.productionHealthSummary),
    recordOf(data.productionReadiness),
    recordOf(data.activityLogs),
    recordOf(data.activityLogsSummary),
    recordOf(data.rollback),
    recordOf(data.rollbackSummary),
    recordOf(data.approvalExecution),
    recordOf(data.approvalExecutionSummary),
    recordOf(data.liveExecution),
    recordOf(data.liveExecutionSummary),
    recordOf(data.launchGate),
    recordOf(data.launchGateSummary),
    recordOf(data.launchChecklist),
    recordOf(data.launchChecklistSummary),
    recordOf(data.scheduler),
    recordOf(data.schedulerSummary),
    recordOf(data.schedulerControl),
    recordOf(data.notificationOutbox),
    recordOf(data.notificationSummary),
    recordOf(data.securityGuardrails),
    recordOf(data.securityGuardrailSummary),
    recordOf(data.maintenance),
    recordOf(data.maintenanceSummary),
    recordOf(data.qaSmoke),
    recordOf(data.qaSmokeLatest),
    recordOf(data.qaSmokeSummary)
  ];
  for (const source of countSources) {
    const value = readFirst(source, keys);
    if (value !== undefined && value !== null && value !== "") return readNumber(value);
  }
  return 0;
}

function readNumberSeries(source: unknown, keys: string[]): number[] {
  const value = readFirst(source, keys);
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((item) => {
      if (typeof item === "number" || typeof item === "string") return Number(item);
      return Number(readFirst(item, ["value", "sales", "adSpend", "spend", "amount", "total"]));
    })
    .filter((item) => Number.isFinite(item) && item >= 0);
}

function SafetyBanner({ text }: { text: string }) {
  return (
    <div className="warning-card approval-warning safety-banner">
      <p>{text}</p>
    </div>
  );
}

function dailyRoot(value: unknown): AnyRecord {
  const root = recordOf(value);
  return recordOf(root.status ?? root.summary ?? root.data ?? root.result ?? root);
}

function dailyRunResultOf(value: unknown): DailyOrchestratorRun {
  const root = recordOf(value);
  return recordOf(root.run ?? root.result ?? root.data ?? root) as DailyOrchestratorRun;
}

function dailyRunRowsOf(value: unknown): DailyOrchestratorRun[] {
  if (Array.isArray(value)) return value as DailyOrchestratorRun[];
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  const rows = root.rows ?? root.runs ?? root.items ?? data.rows ?? data.runs ?? data.items ?? result.rows ?? result.runs ?? result.items;
  return recordsOf(rows) as DailyOrchestratorRun[];
}

function dailyField(source: unknown, keys: string[]): unknown {
  const root = recordOf(source);
  return readFirst(root, keys);
}

function dailyNumber(source: unknown, keys: string[]): number {
  return readNumber(dailyField(source, keys));
}

function dailyList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  const rows = rowsOf<unknown>(value);
  if (rows.length > 0) return rows;
  return [value];
}

function dailyStatusList(source: AnyRecord, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = dailyField(source, [key]);
    const list = dailyList(value);
    if (list.length > 0) return list;
  }
  return [];
}

function formatDailyListItem(item: unknown): string {
  if (item === null || item === undefined || item === "") return "No details provided.";
  if (typeof item !== "object") return String(item);
  const row = recordOf(item);
  const preferred = row.message ?? row.title ?? row.recommendation ?? row.recommendedAction ?? row.reason ?? row.summary ?? row.description;
  if (preferred !== undefined && preferred !== null && preferred !== "") return String(preferred);
  return JSON.stringify(row);
}

function readinessLabel(value: unknown): string {
  if (typeof value === "boolean") return value ? "READY" : "NOT_READY";
  if (typeof value === "number") return value > 0 ? "READY" : "NOT_READY";
  const normalized = normalizeState(value).replace(/\s+/g, "_");
  if (!normalized) return "UNKNOWN";
  if (["TRUE", "YES", "Y", "1", "READY", "PASS", "PASSED", "GOOD", "AVAILABLE", "COMPLETE", "COMPLETED", "CONNECTED", "OK"].includes(normalized)) {
    return "READY";
  }
  if (["PARTIAL", "WARNING", "WARN", "WATCH", "INCOMPLETE", "NEEDS_INPUT", "NEEDS_COST_DATA", "MISSING_COST_DATA"].includes(normalized)) {
    return "PARTIAL";
  }
  if (["FALSE", "NO", "N", "0", "NOT_READY", "UNREADY", "MISSING", "FAILED", "ERROR", "DISCONNECTED", "BLOCKED", "UNAVAILABLE"].includes(normalized)) {
    return "NOT_READY";
  }
  return normalized;
}

function ReadinessBadge({ value }: { value: unknown }) {
  const label = readinessLabel(value);
  const tone = label === "READY" ? "good" : label === "PARTIAL" || label === "UNKNOWN" ? "watch" : "risk";
  return <Badge tone={tone}>{label}</Badge>;
}

function DailyAiCgoPage({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const status = useApi<DailyOrchestratorStatus>(() => getJson(`/api/daily-orchestrator/status?sellerId=${SELLER_ID}`));
  const runs = useApi<unknown>(() => getJson(`/api/daily-orchestrator/runs?sellerId=${SELLER_ID}&limit=20`));
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<DailyOrchestratorRun | null>(null);
  const [runError, setRunError] = useState("");
  const [approvalRefreshMessage, setApprovalRefreshMessage] = useState("");

  const statusRoot = dailyRoot(status.data);
  const statusCounts = recordOf(statusRoot.counts);
  const dataReadiness = recordOf(statusRoot.dataReadiness);
  const recentRuns = useMemo(() => dailyRunRowsOf(runs.data), [runs.data]);
  const warnings = dailyStatusList(statusRoot, ["warnings"]);
  const mode = dailyField(statusRoot, ["mode", "executionMode", "runMode"]) ?? "SHADOW";
  const statusCards = [
    { label: "Mode", value: <StatusBadge value={mode} /> },
    { label: "Total Engines", value: status.loading && !status.data ? "..." : dailyNumber(statusCounts, ["totalEngines"]) },
    { label: "Enabled Engines", value: status.loading && !status.data ? "..." : dailyNumber(statusCounts, ["enabledEngines"]) },
    { label: "Pending Approvals", value: status.loading && !status.data ? "..." : dailyNumber(statusCounts, ["pendingApprovals"]) },
    { label: "Last 24h Engine Runs", value: status.loading && !status.data ? "..." : dailyNumber(statusCounts, ["last24hEngineRuns"]) },
    { label: "Last 24h Actions Created", value: status.loading && !status.data ? "..." : dailyNumber(statusCounts, ["last24hActionsCreated"]) },
    { label: "Product Passport Ready", value: <ReadinessBadge value={dailyField(dataReadiness, ["productPassportAvailable"])} /> },
    { label: "Product Economics Ready", value: <ReadinessBadge value={dailyField(dataReadiness, ["productEconomicsAvailable"])} /> },
    { label: "Approval Center Ready", value: <ReadinessBadge value={dailyField(dataReadiness, ["approvalCenterReady"])} /> }
  ];

  async function refreshApprovalSummaryIfAvailable() {
    try {
      const data = await fetchActionLedgerData();
      setApprovalRefreshMessage(`Approval Center refreshed. Pending approvals: ${readNumber(data.summary.pendingCount)}.`);
    } catch {
      setApprovalRefreshMessage("");
    }
  }

  async function runDailyAiCgo() {
    const confirmed = window.confirm("Run Daily AI-CGO in shadow mode? No external action will be executed.");
    if (!confirmed) return;

    setRunning(true);
    setRunError("");
    setApprovalRefreshMessage("");
    try {
      const response = await postJson<unknown>("/api/daily-orchestrator/run", {
        sellerId: SELLER_ID,
        actor: "founder",
        limit: 25,
        runType: "MANUAL"
      });
      setRunResult(dailyRunResultOf(response));
      status.reload();
      runs.reload();
      await refreshApprovalSummaryIfAvailable();
    } catch {
      setRunError("Could not run daily AI-CGO");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page daily-ai-cgo">
      <PageHeader
        title="Daily AI-CGO"
        subtitle="Run the daily AI growth operating system in shadow mode. Recommendations go to Approval Center only."
      />
      <div className="warning-card approval-warning daily-safety-banner">
        <p>Shadow mode active. No Amazon, Ads, Listing, Image, A+, Store, or Social action is executed.</p>
      </div>

      {status.loading && !status.data ? <LoadingBlock text="Loading daily AI-CGO status..." /> : null}
      {status.error ? <ErrorBlock text="Could not load daily status" /> : null}

      <div className="summary-strip daily-status-grid" aria-label="Daily AI-CGO status">
        {statusCards.map((card) => (
          <MetricTile key={card.label} label={card.label} value={card.value} />
        ))}
      </div>

      <div className="daily-command-grid">
        <Card
          title="Run Daily AI-CGO"
          action={(
            <button type="button" onClick={runDailyAiCgo} disabled={running}>
              {running ? "Running daily AI-CGO..." : "Run Daily AI-CGO"}
            </button>
          )}
        >
          <p className="section-note">This creates approval-first recommendations only. No external action executed.</p>
          {running ? <div className="soft-state compact-state">Running daily AI-CGO...</div> : null}
          {runError ? <div className="soft-state error-state compact-state">{runError}</div> : null}
          {approvalRefreshMessage ? <div className="soft-state success-state compact-state">{approvalRefreshMessage}</div> : null}
        </Card>

        <Card title="Quick Links">
          <div className="quick-link-grid">
            <button type="button" onClick={() => setActiveTab("Approval Center")}>Open Approval Center</button>
            <button type="button" onClick={() => setActiveTab("Engine Command Center")}>Open Engine Command Center</button>
            <button type="button" onClick={() => setActiveTab("Product Passport")}>Open Product Passport Cost Queue</button>
            <button type="button" onClick={() => setActiveTab("CEO Report")}>Open CEO Report</button>
          </div>
        </Card>
      </div>

      <Card title="Warnings">
        {status.loading && !status.data ? (
          <LoadingBlock text="Loading daily AI-CGO status..." />
        ) : status.error ? (
          <ErrorBlock text="Could not load daily status" />
        ) : warnings.length === 0 ? (
          <EmptyBlock text="No daily AI-CGO warnings right now." />
        ) : (
          <ul className="clean-list daily-list">
            {warnings.map((warning, index) => (
              <li key={index}>{formatDailyListItem(warning)}</li>
            ))}
          </ul>
        )}
      </Card>

      {runResult ? <DailyRunResultPanel result={runResult} /> : null}

      <Card
        title="Recent Runs"
        action={<button type="button" className="secondary" onClick={runs.reload}>Refresh Runs</button>}
      >
        {runs.loading ? <LoadingBlock text="Loading recent runs..." /> : runs.error ? (
          <ErrorBlock text="Could not load recent runs" />
        ) : recentRuns.length === 0 ? (
          <EmptyBlock text="No Daily AI-CGO runs yet." />
        ) : (
          <div className="daily-run-list">
            {recentRuns.map((run, index) => {
              const runId = dailyField(run, ["runId", "id", "dailyRunId", "run_id"]) ?? index;
              return (
                <article className="item-card daily-run-card" key={String(runId)}>
                  <div className="item-top">
                    <strong>{formatShortId(runId)}</strong>
                    <StatusBadge value={dailyField(run, ["runStatus", "status", "run_status"])} />
                  </div>
                  <div className="detail-grid">
                    <MetricRow label="Started At" value={formatLocalDateTime(dailyField(run, ["startedAt", "started_at"]))} />
                    <MetricRow label="Finished At" value={formatLocalDateTime(dailyField(run, ["finishedAt", "finished_at"]))} />
                    <MetricRow label="Run Type" value={formatEmpty(dailyField(run, ["runType", "run_type"]))} />
                    <MetricRow label="Engines Planned" value={formatEmpty(dailyField(run, ["enginesPlanned", "plannedEngines", "engines_planned"]))} />
                    <MetricRow label="Engines Run" value={formatEmpty(dailyField(run, ["enginesRun", "enginesRunCount", "engines_run"]))} />
                    <MetricRow label="Actions Created" value={formatEmpty(dailyField(run, ["actionsCreated", "actionsCreatedCount", "actions_created"]))} />
                    <MetricRow label="Skipped Count" value={formatEmpty(dailyField(run, ["skippedCount", "skipped", "skipped_count"]))} />
                    <MetricRow label="Failed Count" value={formatEmpty(dailyField(run, ["failedCount", "failed", "failed_count"]))} />
                    <MetricRow label="Approval Pending Before" value={formatEmpty(dailyField(run, ["approvalPendingBefore", "pendingBefore", "approval_pending_before"]))} />
                    <MetricRow label="Approval Pending After" value={formatEmpty(dailyField(run, ["approvalPendingAfter", "pendingAfter", "approval_pending_after"]))} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function DailyRunResultPanel({ result }: { result: DailyOrchestratorRun }) {
  const actionsCreated = dailyNumber(result, ["actionsCreated", "actionsCreatedCount", "actions_created"]);
  const warnings = dailyStatusList(result, ["warnings", "warningMessages", "alerts"]);
  const recommendations = dailyStatusList(result, ["recommendations", "recommendedActions", "topRecommendations"]);
  const message = dailyField(result, ["message", "summary", "statusMessage"]);
  const rows: Array<[string, ReactNode]> = [
    ["runId", formatEmpty(dailyField(result, ["runId", "id", "dailyRunId", "run_id"]))],
    ["runStatus", <StatusBadge key="run-status" value={dailyField(result, ["runStatus", "status", "run_status"])} />],
    ["mode", <StatusBadge key="mode" value={dailyField(result, ["mode", "executionMode", "runMode"]) ?? "SHADOW"} />],
    ["enginesPlanned", formatEmpty(dailyField(result, ["enginesPlanned", "plannedEngines", "engines_planned"]))],
    ["enginesRun", formatEmpty(dailyField(result, ["enginesRun", "enginesRunCount", "engines_run"]))],
    ["actionsCreated", formatEmpty(dailyField(result, ["actionsCreated", "actionsCreatedCount", "actions_created"]))],
    ["skippedCount", formatEmpty(dailyField(result, ["skippedCount", "skipped", "skipped_count"]))],
    ["failedCount", formatEmpty(dailyField(result, ["failedCount", "failed", "failed_count"]))],
    ["approvalPendingBefore", formatEmpty(dailyField(result, ["approvalPendingBefore", "pendingBefore", "approval_pending_before"]))],
    ["approvalPendingAfter", formatEmpty(dailyField(result, ["approvalPendingAfter", "pendingAfter", "approval_pending_after"]))]
  ];

  return (
    <Card title="Run Result">
      <div className="soft-state success-state daily-shadow-note">No external action executed.</div>
      {actionsCreated === 0 ? (
        <div className="soft-state compact-state">No new actions were created. Existing pending recommendations may already cover today's risks.</div>
      ) : null}
      <div className="detail-grid daily-result-grid">
        {rows.map(([label, value]) => (
          <MetricRow key={label} label={label} value={value} />
        ))}
      </div>
      <div className="daily-result-sections">
        <DailyTextList title="Warnings" rows={warnings} emptyText="No warnings returned for this run." />
        <DailyTextList title="Recommendations" rows={recommendations} emptyText="No recommendations returned for this run." />
      </div>
      {message ? <p className="section-note daily-message">{formatEmpty(message)}</p> : null}
    </Card>
  );
}

function DailyTextList({ title, rows, emptyText }: { title: string; rows: unknown[]; emptyText: string }) {
  return (
    <div className="daily-text-list">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="section-note">{emptyText}</p>
      ) : (
        <ul className="clean-list daily-list">
          {rows.map((item, index) => (
            <li key={index}>{formatDailyListItem(item)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProductPassportPage() {
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const readiness = useApi<AnyRecord>(() => getJson(`/api/product-passports/readiness/summary?sellerId=${SELLER_ID}`));
  const readinessRef = useRef<HTMLDivElement | null>(null);
  const [section, setSection] = useState<ProductPassportSection>("COST_COMPLETION");
  const [openForm, setOpenForm] = useState(false);
  const [selectedPassport, setSelectedPassport] = useState<ProductPassport | null>(null);
  const [detail, setDetail] = useState<LoadState<AnyRecord>>({ data: null, loading: false, error: null });
  const [form, setForm] = useState({
    productName: "",
    brand: "Leafy Dew",
    category: "",
    subCategory: "",
    productType: "",
    sellingPrice: "",
    targetCustomer: "",
    useCase: "",
    material: "",
    color: "",
    dimensions: "",
    weight: "",
    packageContents: "",
    brandPositioning: ""
  });

  const summary = recordOf(readiness.data?.summary);
  const rows = rowsOf<ProductPassport>(passports.data);

  async function loadReadiness(row: ProductPassport) {
    setSelectedPassport(row);
    setDetail({ data: null, loading: true, error: null });
    window.setTimeout(() => {
      readinessRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      readinessRef.current?.focus({ preventScroll: true });
    }, 0);
    try {
      const data = await getJson<AnyRecord>(`/api/product-passports/${row.id}/readiness`);
      setDetail({ data, loading: false, error: null });
    } catch {
      setDetail({ data: null, loading: false, error: "Unable to load this section." });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await postJson("/api/product-passports", {
      sellerId: SELLER_ID,
      ...form,
      sellingPrice: asInputNumber(form.sellingPrice)
    });
    setOpenForm(false);
    setForm({ ...form, productName: "", sku: "" } as typeof form);
    passports.reload();
    readiness.reload();
  }

  return (
    <div className="page">
      <PageHeader title="Product Passport" subtitle="Keep product truth, listing readiness, and founder context in one place." />

      <div className="product-passport-tabs segmented" aria-label="Product Passport sections">
        <button
          type="button"
          className={section === "READINESS" ? "active" : ""}
          onClick={() => setSection("READINESS")}
        >
          Product Readiness
        </button>
        <button
          type="button"
          className={section === "COST_COMPLETION" ? "active" : ""}
          onClick={() => setSection("COST_COMPLETION")}
        >
          Cost Completion Queue
        </button>
      </div>

      {section === "READINESS" ? (
        <section className="product-passport-section" aria-labelledby="product-readiness-heading">
          <div className="page-section-label" id="product-readiness-heading">Product Readiness</div>
          <div className="summary-strip">
            <MetricTile label="Product count" value={readNumber(readiness.data?.productCount ?? summary.productCount ?? rows.length)} />
            <MetricTile label="Ready count" value={readNumber(summary.readyCount)} />
            <MetricTile label="Needs fix count" value={readNumber(summary.needsFixCount)} />
            <MetricTile label="Missing economics" value={readNumber(summary.missingEconomicsCount)} />
          </div>
          <Card title="Products" action={<button type="button" onClick={() => setOpenForm((value) => !value)}>Add Product</button>}>
            {openForm ? (
              <form className="form-grid" onSubmit={submit}>
                {Object.entries(form).map(([key, value]) =>
                  key === "brandPositioning" || key === "targetCustomer" || key === "useCase" ? (
                    <TextArea key={key} label={labelize(key)} value={value} onChange={(next) => setForm({ ...form, [key]: next })} />
                  ) : (
                    <TextInput
                      key={key}
                      label={labelize(key)}
                      value={value}
                      type={key === "sellingPrice" ? "number" : "text"}
                      onChange={(next) => setForm({ ...form, [key]: next })}
                    />
                  )
                )}
                <button type="submit">Save Product</button>
              </form>
            ) : null}
            {passports.loading ? <LoadingBlock /> : passports.error ? <ErrorBlock /> : rows.length === 0 ? <EmptyBlock /> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>SKU</th>
                      <th>ASIN</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>{formatEmpty(row.productName)}</td>
                        <td>{formatEmpty(row.sku)}</td>
                        <td>{formatEmpty(row.asin)}</td>
                        <td>{formatEmpty(row.category)}</td>
                        <td><StatusBadge value={row.status} /></td>
                        <td><button type="button" onClick={() => loadReadiness(row)}>View Readiness</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <div ref={readinessRef} tabIndex={-1} className="readiness-detail-anchor">
            <Card title="Readiness Details">
              {detail.loading ? <LoadingBlock text="Loading readiness..." /> : detail.error ? <ErrorBlock /> : detail.data ? (
                <ReadinessDetail data={detail.data} product={selectedPassport} />
              ) : (
                <EmptyBlock text="Choose a product to view readiness." />
              )}
            </Card>
          </div>
        </section>
      ) : (
        <CostCompletionQueueSection />
      )}
    </div>
  );
}

function ReadinessDetail({ data, product }: { data: AnyRecord; product: ProductPassport | null }) {
  const row = recordOf(data.row ?? data.readiness ?? data);
  const missing = normalizeMissingFields(row.missingFields);
  return (
    <div className="detail-grid">
      <MetricRow label="SKU" value={formatEmpty(row.sku ?? product?.sku)} />
      <MetricRow label="ASIN" value={formatEmpty(row.asin ?? product?.asin)} />
      <MetricRow label="Product name" value={formatEmpty(row.productName ?? row.title ?? product?.productName)} />
      <MetricRow label="Passport score" value={formatEmpty(row.passportScore ?? row.score)} />
      <MetricRow label="Economics status" value={<StatusBadge value={row.economicsStatus} />} />
      <MetricRow label="Profit status" value={<StatusBadge value={row.profitStatus} />} />
      <MetricRow label="Ad readiness status" value={<StatusBadge value={row.adReadinessStatus ?? row.readinessStatus} />} />
      <MetricRow label="Next best action" value={formatEmpty(recordOf(row.nextBestAction).title ?? row.nextBestAction)} />
      <MetricRow label="Missing fields" value={missing.length ? missing.map(String).join(", ") : "—"} />
    </div>
  );
}

type CostCompletionSummary = {
  totalSkus?: number | string | null;
  completeCount?: number | string | null;
  incompleteCount?: number | string | null;
  missingCostCount?: number | string | null;
  missingRequiredProfitCount?: number | string | null;
  missingSubcategoryCount?: number | string | null;
  pendingCostActionCount?: number | string | null;
};

type CostQueueFilter = "ALL" | "INCOMPLETE" | "COMPLETE" | "MISSING_COST" | "MISSING_REQUIRED_PROFIT" | "MISSING_SUBCATEGORY";

const costQueueFilterOptions: Array<{ id: CostQueueFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "INCOMPLETE", label: "Incomplete" },
  { id: "COMPLETE", label: "Complete" },
  { id: "MISSING_COST", label: "Missing Cost" },
  { id: "MISSING_REQUIRED_PROFIT", label: "Missing Required Profit" },
  { id: "MISSING_SUBCATEGORY", label: "Missing Subcategory" }
];

const editableCostFields = [
  "productCost",
  "landedCost",
  "packagingCost",
  "shippingCost",
  "otherCost",
  "requiredProfit",
  "subcategory"
] as const;

type EditableCostField = (typeof editableCostFields)[number];
type CostEditState = Record<EditableCostField, string>;
type DirtyCostFields = Partial<Record<EditableCostField, true>>;

type NormalizedCostCompletionRow = {
  key: string;
  sku: string;
  asin: string;
  productName: string;
  title: string;
  subcategory: unknown;
  sellingPrice: unknown;
  productCost: unknown;
  landedCost: unknown;
  packagingCost: unknown;
  shippingCost: unknown;
  otherCost: unknown;
  requiredProfit: unknown;
  missingFields: string[];
  costStatus: unknown;
  currentProfitStatus: unknown;
  targetAcos: unknown;
  breakEvenAcos: unknown;
};

type CostCompletionPayloadItem = {
  sku: string | null;
  asin: string | null;
  productCost: number | null;
  landedCost: number | null;
  packagingCost: number | null;
  shippingCost: number | null;
  otherCost: number | null;
  requiredProfit: number | null;
  subcategory: string | null;
};

const COST_COMPLETION_PAGE_SIZE = 25;

function costCompletionRowsOf(value: unknown): CostCompletionQueueItem[] {
  if (Array.isArray(value)) return value as CostCompletionQueueItem[];
  const rows = rowsOf<CostCompletionQueueItem>(value);
  if (rows.length > 0) return rows;
  const root = recordOf(value);
  const result = recordOf(root.result);
  const nestedData = recordOf(root.data);
  return arrayOf(
    root.items ??
    root.queue ??
    root.products ??
    root.updatedRows ??
    root.rows ??
    result.items ??
    result.queue ??
    result.products ??
    result.updatedRows ??
    result.rows ??
    nestedData.items ??
    nestedData.queue ??
    nestedData.products ??
    nestedData.updatedRows ??
    nestedData.rows
  ) as CostCompletionQueueItem[];
}

function normalizeMissingFields(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeCostCompletionRow(item: CostCompletionQueueItem, index: number): NormalizedCostCompletionRow {
  const raw = item as unknown as AnyRecord;
  const economics = recordOf(raw.economics);
  const sku = String(readFirst(raw, ["sku", "sellerSku", "seller_sku"]) ?? "");
  const asin = String(readFirst(raw, ["asin"]) ?? "");
  const key = String(readFirst(raw, ["key", "id"]) ?? (sku ? `sku:${sku}` : asin ? `asin:${asin}` : `row:${index}`));

  return {
    key,
    sku,
    asin,
    productName: String(readFirst(raw, ["productName", "product_name", "itemName"]) ?? readFirst(economics, ["productName", "product_name"]) ?? readFirst(raw, ["title"]) ?? ""),
    title: String(readFirst(raw, ["title", "itemName"]) ?? readFirst(raw, ["productName", "product_name"]) ?? readFirst(economics, ["productName", "product_name"]) ?? ""),
    subcategory: readFirst(raw, ["subcategory", "subCategory", "sub_category"]) ?? readFirst(economics, ["subcategory", "subCategory", "sub_category"]),
    sellingPrice: readFirst(raw, ["sellingPrice", "selling_price", "price"]) ?? readFirst(economics, ["sellingPrice", "selling_price"]),
    productCost: readFirst(raw, ["productCost", "product_cost", "buyingCost", "buying_cost"]) ?? readFirst(economics, ["productCost", "product_cost", "buyingCost", "buying_cost"]),
    landedCost: readFirst(raw, ["landedCost", "landed_cost"]) ?? readFirst(economics, ["landedCost", "landed_cost"]),
    packagingCost: readFirst(raw, ["packagingCost", "packaging_cost"]) ?? readFirst(economics, ["packagingCost", "packaging_cost"]),
    shippingCost: readFirst(raw, ["shippingCost", "shipping_cost"]) ?? readFirst(economics, ["shippingCost", "shipping_cost"]),
    otherCost: readFirst(raw, ["otherCost", "other_cost", "otherCostPerUnit", "other_cost_per_unit", "otherFees", "other_fees"]) ?? readFirst(economics, ["otherCost", "other_cost", "otherCostPerUnit", "other_cost_per_unit", "otherFees", "other_fees"]),
    requiredProfit: readFirst(raw, ["requiredProfit", "required_profit", "targetProfit", "target_profit"]) ?? readFirst(economics, ["requiredProfit", "required_profit", "targetProfit", "target_profit"]),
    missingFields: normalizeMissingFields(readFirst(raw, ["missingFields", "missing_fields"])),
    costStatus: readFirst(raw, ["costStatus", "cost_status", "costDataStatus", "profitDataStatus", "profitData_status", "currentProfitStatus", "current_profit_status", "status"]) ?? readFirst(economics, ["costStatus", "cost_status", "profitDataStatus", "profit_data_status", "currentProfitStatus", "current_profit_status"]),
    currentProfitStatus: readFirst(raw, ["currentProfitStatus", "current_profit_status", "profitStatus", "profit_status"]) ?? readFirst(economics, ["currentProfitStatus", "current_profit_status", "profitStatus", "profit_status"]),
    targetAcos: readFirst(raw, ["targetAcos", "target_acos"]) ?? readFirst(economics, ["targetAcos", "target_acos"]),
    breakEvenAcos: readFirst(raw, ["breakEvenAcos", "break_even_acos"]) ?? readFirst(economics, ["breakEvenAcos", "break_even_acos"])
  };
}

function inputValueOf(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function editStateForRow(row: NormalizedCostCompletionRow): CostEditState {
  return {
    productCost: inputValueOf(row.productCost),
    landedCost: inputValueOf(row.landedCost),
    packagingCost: inputValueOf(row.packagingCost),
    shippingCost: inputValueOf(row.shippingCost),
    otherCost: inputValueOf(row.otherCost),
    requiredProfit: inputValueOf(row.requiredProfit),
    subcategory: inputValueOf(row.subcategory)
  };
}

function normalizedMissingToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rowMissingField(row: NormalizedCostCompletionRow, field: "cost" | "requiredProfit" | "subcategory"): boolean {
  const missingTokens = row.missingFields.map(normalizedMissingToken);
  if (field === "requiredProfit") {
    return missingTokens.includes("requiredprofit");
  }
  if (field === "subcategory") {
    return missingTokens.includes("subcategory") || missingTokens.includes("category");
  }
  return missingTokens.includes("productcost") || missingTokens.includes("landedcost");
}

function isCostRowComplete(row: NormalizedCostCompletionRow): boolean {
  return normalizeState(row.costStatus) === "COMPLETE";
}

function filterCostCompletionRows(rows: NormalizedCostCompletionRow[], filter: CostQueueFilter): NormalizedCostCompletionRow[] {
  if (filter === "ALL") return rows;
  if (filter === "COMPLETE") return rows.filter(isCostRowComplete);
  if (filter === "INCOMPLETE") return rows.filter((row) => ["INCOMPLETE", "PARTIAL"].includes(normalizeState(row.costStatus)));
  if (filter === "MISSING_COST") return rows.filter((row) => rowMissingField(row, "cost"));
  if (filter === "MISSING_REQUIRED_PROFIT") return rows.filter((row) => rowMissingField(row, "requiredProfit"));
  return rows.filter((row) => rowMissingField(row, "subcategory"));
}

function searchCostCompletionRows(rows: NormalizedCostCompletionRow[], query: string): NormalizedCostCompletionRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return rows;
  return rows.filter((row) => [
    row.sku,
    row.asin,
    row.productName,
    row.title,
    row.subcategory,
    row.missingFields.join(" "),
    row.costStatus
  ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery)));
}

function parseNullableNumber(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value);
  if (text.trim() === "") return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return numeric;
}

function editedFieldValue(row: NormalizedCostCompletionRow, edits: CostEditState, dirtyFields: DirtyCostFields, field: EditableCostField): unknown {
  if (dirtyFields[field]) return edits[field];
  return row[field];
}

function nullableTextValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function buildCostPayload(row: NormalizedCostCompletionRow, edits: CostEditState, dirtyFields: DirtyCostFields = {}): CostCompletionPayloadItem {
  return {
    sku: row.sku || null,
    asin: row.asin || null,
    productCost: parseNullableNumber(editedFieldValue(row, edits, dirtyFields, "productCost"), "Product Cost"),
    landedCost: parseNullableNumber(editedFieldValue(row, edits, dirtyFields, "landedCost"), "Landed Cost"),
    packagingCost: parseNullableNumber(editedFieldValue(row, edits, dirtyFields, "packagingCost"), "Packaging Cost"),
    shippingCost: parseNullableNumber(editedFieldValue(row, edits, dirtyFields, "shippingCost"), "Shipping Cost"),
    otherCost: parseNullableNumber(editedFieldValue(row, edits, dirtyFields, "otherCost"), "Other Cost"),
    requiredProfit: parseNullableNumber(editedFieldValue(row, edits, dirtyFields, "requiredProfit"), "Required Profit"),
    subcategory: nullableTextValue(editedFieldValue(row, edits, dirtyFields, "subcategory"))
  };
}

function readOptionalCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolvedCostActionCount(response: unknown): number | null {
  const root = recordOf(response);
  const result = recordOf(root.result);
  const candidates = [
    root.resolvedActionCount,
    root.actionsResolvedCount,
    root.costDataRequiredActionsResolved,
    root.resolvedCostActionCount,
    result.resolvedActionCount,
    result.actionsResolvedCount,
    result.costDataRequiredActionsResolved,
    result.resolvedCostActionCount
  ];
  for (const candidate of candidates) {
    const count = readOptionalCount(candidate);
    if (count !== null) return count;
  }

  const arrayCandidates = [
    root.resolvedActions,
    root.resolvedActionIds,
    root.autoResolvedActions,
    result.resolvedActions,
    result.resolvedActionIds,
    result.autoResolvedActions
  ];
  for (const candidate of arrayCandidates) {
    if (Array.isArray(candidate)) return candidate.length;
  }

  return null;
}

function costCompletionSaveMessage(savedCount: number, response: unknown): string {
  const resolvedCount = resolvedCostActionCount(response) ?? 0;
  if (resolvedCount === 0) return `Saved ${savedCount} row(s). No related pending cost actions were found.`;
  return `Saved ${savedCount} row(s). Resolved ${resolvedCount} related COST_DATA_REQUIRED approval action(s).`;
}

function CostCompletionQueueSection() {
  const summary = useApi<AnyRecord>(() => getJson(`/api/product-passport/cost-completion/summary?sellerId=${SELLER_ID}`));
  const queue = useApi<unknown>(() => getJson(`/api/product-passport/cost-completion?sellerId=${SELLER_ID}&limit=200`));
  const [filter, setFilter] = useState<CostQueueFilter>("INCOMPLETE");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState<Record<string, CostEditState>>({});
  const [dirtyRows, setDirtyRows] = useState<Record<string, DirtyCostFields>>({});
  const [savedOverrides, setSavedOverrides] = useState<Record<string, Partial<NormalizedCostCompletionRow>>>({});
  const [lastSavedRows, setLastSavedRows] = useState<Record<string, CostCompletionPayloadItem>>({});
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [savingKeys, setSavingKeys] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [moveMessage, setMoveMessage] = useState("");
  const [error, setError] = useState("");
  const [completeRefetchTried, setCompleteRefetchTried] = useState(false);

  const summaryRoot = recordOf(summary.data?.summary ?? summary.data) as CostCompletionSummary;
  const summaryValue = (value: unknown) => summary.loading ? "..." : readNumber(value);
  const rows = useMemo(
    () => costCompletionRowsOf(queue.data).map((item, index) => {
      const row = normalizeCostCompletionRow(item, index);
      const override = savedOverrides[row.key];
      if (!override) return row;
      return {
        ...row,
        ...override
      };
    }),
    [queue.data, savedOverrides]
  );
  const filteredRows = useMemo(
    () => searchCostCompletionRows(filterCostCompletionRows(rows, filter), search),
    [filter, rows, search]
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / COST_COMPLETION_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * COST_COMPLETION_PAGE_SIZE, safePage * COST_COMPLETION_PAGE_SIZE);
  const editedRowKeys = Object.keys(dirtyRows).filter((key) => Object.keys(dirtyRows[key] ?? {}).length > 0);
  const editedRows = rows.filter((row) => editedRowKeys.includes(row.key));
  const showingStart = filteredRows.length === 0 ? 0 : (safePage - 1) * COST_COMPLETION_PAGE_SIZE + 1;
  const showingEnd = Math.min(safePage * COST_COMPLETION_PAGE_SIZE, filteredRows.length);
  const completeCount = readNumber(summaryRoot.completeCount);
  const loadedCompleteRows = filterCostCompletionRows(rows, "COMPLETE");
  const completeRowsMissingFromQueue =
    filter === "COMPLETE" &&
    completeCount > 0 &&
    loadedCompleteRows.length === 0 &&
    completeRefetchTried &&
    !queue.loading;

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  useEffect(() => {
    if (filter !== "COMPLETE") {
      setCompleteRefetchTried(false);
      return;
    }
    if (completeCount > 0 && loadedCompleteRows.length === 0 && !queue.loading && !completeRefetchTried) {
      setCompleteRefetchTried(true);
      queue.reload();
    }
  }, [completeCount, completeRefetchTried, filter, loadedCompleteRows.length, queue.loading]);

  useEffect(() => {
    setSavedOverrides({});
  }, [queue.data]);

  function viewAllRows() {
    setFilter("ALL");
    setPage(1);
  }

  function clearFilters() {
    setFilter("ALL");
    setSearch("");
    setPage(1);
  }

  function showCompleteRows() {
    setSearch("");
    setFilter("COMPLETE");
    setPage(1);
  }

  function currentEditState(row: NormalizedCostCompletionRow): CostEditState {
    return edits[row.key] ?? editStateForRow(row);
  }

  function setField(row: NormalizedCostCompletionRow, field: EditableCostField, value: string) {
    setMessage("");
    setMoveMessage("");
    setError("");
    setEdits((current) => ({
      ...current,
      [row.key]: {
        ...currentEditState(row),
        ...current[row.key],
        [field]: value
      }
    }));
    setDirtyRows((current) => ({
      ...current,
      [row.key]: {
        ...(current[row.key] ?? {}),
        [field]: true
      }
      }));
  }

  function resetRow(row: NormalizedCostCompletionRow) {
    setMessage("");
    setMoveMessage("");
    setError("");
    setEdits((current) => {
      const next = { ...current };
      delete next[row.key];
      return next;
    });
    setDirtyRows((current) => {
      const next = { ...current };
      delete next[row.key];
      return next;
    });
  }

  function clearSavedRows(keys: string[]) {
    setEdits((current) => {
      const next = { ...current };
      keys.forEach((key) => {
        delete next[key];
      });
      return next;
    });
    setDirtyRows((current) => {
      const next = { ...current };
      keys.forEach((key) => {
        delete next[key];
      });
      return next;
    });
  }

  async function saveRows(targetRows: NormalizedCostCompletionRow[]) {
    if (targetRows.length === 0) return;
    const targetKeys = targetRows.map((row) => row.key);
    const isBulk = targetRows.length > 1;
    setMessage("");
    setMoveMessage("");
    setError("");
    if (isBulk) {
      setBulkSaving(true);
    } else {
      setSavingKeys((current) => Array.from(new Set([...current, ...targetKeys])));
    }

    try {
      const items = targetRows.map((row) => buildCostPayload(row, currentEditState(row), dirtyRows[row.key] ?? {}));
      const response = await postJson<AnyRecord>("/api/product-passport/cost-completion/bulk-update", {
        sellerId: SELLER_ID,
        autoResolveActions: true,
        items
      });
      const responseRows = costCompletionRowsOf(response).map(normalizeCostCompletionRow);
      const savedComplete = responseRows.some(isCostRowComplete);
      setSavedOverrides((current) => {
        const next = { ...current };
        targetRows.forEach((row, index) => {
          const responseRow = responseRows.find((candidate) => candidate.key === row.key || (candidate.sku && candidate.sku === row.sku) || (candidate.asin && candidate.asin === row.asin));
          next[row.key] = responseRow ?? {
            productCost: items[index].productCost,
            landedCost: items[index].landedCost,
            packagingCost: items[index].packagingCost,
            shippingCost: items[index].shippingCost,
            otherCost: items[index].otherCost,
            requiredProfit: items[index].requiredProfit,
            subcategory: items[index].subcategory
          };
        });
        return next;
      });
      setSavedKeys(targetKeys);
      window.setTimeout(() => {
        setSavedKeys((current) => current.filter((key) => !targetKeys.includes(key)));
      }, 4500);
      setLastSavedRows((current) => {
        const next = { ...current };
        targetRows.forEach((row, index) => {
          const responseRow = responseRows.find((candidate) => candidate.key === row.key || (candidate.sku && candidate.sku === row.sku) || (candidate.asin && candidate.asin === row.asin));
          next[row.key] = responseRow ? buildCostPayload(responseRow, editStateForRow(responseRow)) : items[index];
        });
        return next;
      });
      clearSavedRows(targetKeys);
      summary.reload();
      queue.reload();
      setMessage(costCompletionSaveMessage(items.length, response));
      if (!["ALL", "COMPLETE"].includes(filter)) {
        setMoveMessage(savedComplete ? "Saved successfully. The row moved to Complete." : "Saved successfully. The row may have moved because its cost status changed.");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? sanitizeActionError(saveError) : "Could not save cost data. Please try again.");
    } finally {
      if (isBulk) {
        setBulkSaving(false);
      } else {
        setSavingKeys((current) => current.filter((key) => !targetKeys.includes(key)));
      }
    }
  }

  return (
    <section className="cost-completion-section" aria-labelledby="cost-completion-heading">
      <div className="page-title cost-section-title">
        <h1 id="cost-completion-heading">Cost Completion Queue</h1>
        <p>Fill the missing business fields while Amazon-provided SKU, ASIN, product name, and selling price stay read-only.</p>
      </div>

      {summary.loading ? <LoadingBlock text="Loading summary..." /> : null}
      <div className="summary-strip cost-summary-strip">
        <MetricTile label="Total SKUs" value={summaryValue(summaryRoot.totalSkus)} />
        <MetricTile label="Complete" value={summaryValue(summaryRoot.completeCount)} />
        <MetricTile label="Incomplete" value={summaryValue(summaryRoot.incompleteCount)} />
        <MetricTile label="Missing Cost" value={summaryValue(summaryRoot.missingCostCount)} />
        <MetricTile label="Missing Required Profit" value={summaryValue(summaryRoot.missingRequiredProfitCount)} />
        <MetricTile label="Missing Subcategory" value={summaryValue(summaryRoot.missingSubcategoryCount)} />
        <MetricTile label="Pending Cost Actions" value={summaryValue(summaryRoot.pendingCostActionCount)} />
      </div>

      <div className="cost-completion-toolbar">
        <p className="section-note cost-helper-note">
          Completing cost data will automatically resolve related COST_DATA_REQUIRED approval actions. No Amazon or Ads action is executed.
        </p>
        <div className="queue-controls">
          <div className="segmented cost-filter-tabs">
            {costQueueFilterOptions.map((option) => (
              <button
                type="button"
                key={option.id}
                className={filter === option.id ? "active" : ""}
                onClick={() => {
                  setFilter(option.id);
                  setPage(1);
                }}
                disabled={bulkSaving}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="field queue-search">
            <span>Search</span>
            <input
              type="search"
              value={search}
              placeholder="SKU, ASIN, product name, subcategory"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="queue-save-control">
            <button type="button" onClick={() => saveRows(editedRows)} disabled={bulkSaving || editedRows.length === 0}>
              {bulkSaving ? "Saving..." : `Save Edited Rows${editedRows.length ? ` (${editedRows.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>

      <Card title="Queue">

        {message ? <div className="soft-state success-state queue-message">{message}</div> : null}
        {moveMessage ? (
          <div className="soft-state success-state queue-message queue-move-message">
            <span>{moveMessage}</span>
            <div className="button-row compact">
              <button type="button" className="secondary" onClick={showCompleteRows}>View Complete rows</button>
              <button type="button" className="secondary" onClick={viewAllRows}>View All rows</button>
              <button type="button" className="secondary" onClick={clearFilters}>Clear filters</button>
            </div>
          </div>
        ) : null}
        {completeRowsMissingFromQueue ? (
          <div className="soft-state error-state queue-message">Complete count exists, but complete rows are not loaded. Please refresh.</div>
        ) : null}
        {error ? <div className="soft-state error-state queue-message">{error}</div> : null}
        {summary.error ? <ErrorBlock text="Could not load cost summary. Backend may still be deploying." /> : null}

        {queue.loading ? <LoadingBlock text="Loading cost queue..." /> : queue.error ? (
          <ErrorBlock text="Could not load cost completion queue. Backend may still be deploying." />
        ) : rows.length === 0 ? (
          <EmptyBlock text="No cost completion rows yet." />
        ) : filteredRows.length === 0 ? (
          <div className="soft-state">
            <p>No rows match this filter or search.</p>
            <div className="button-row compact">
              <button type="button" className="secondary" onClick={clearFilters}>Clear filters</button>
            </div>
          </div>
        ) : (
          <>
            <div className="queue-pagination">
              <span>Showing {showingStart}-{showingEnd} of {filteredRows.length}</span>
              <div className="button-row compact">
                <button type="button" className="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1 || bulkSaving}>Previous</button>
                <button type="button" className="secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages || bulkSaving}>Next</button>
              </div>
            </div>
            <datalist id="cost-subcategory-options">
              {referralFeeSubcategories.map((option) => <option key={option} value={option} />)}
            </datalist>
            <div className="cost-card-list">
              {pageRows.map((row) => {
                const rowEdits = currentEditState(row);
                const isEdited = Boolean(dirtyRows[row.key] && Object.keys(dirtyRows[row.key] ?? {}).length > 0);
                const rowSaving = savingKeys.includes(row.key) || bulkSaving;
                const displayName = row.productName || row.title;
                const lastSaved = lastSavedRows[row.key];
                const isSaved = savedKeys.includes(row.key);
                const rowLabel = row.sku || row.asin || displayName;

                return (
                  <article key={row.key} className={`cost-completion-card ${isEdited ? "edited-row" : ""} ${isSaved ? "saved-row" : ""}`}>
                    <div className="cost-card-head">
                      <div className="cost-card-title">
                        <h3>{formatEmpty(displayName)}</h3>
                        <div className="cost-card-meta">
                          <span><strong>SKU</strong> {formatEmpty(row.sku)}</span>
                          <span><strong>ASIN</strong> {formatEmpty(row.asin)}</span>
                        </div>
                      </div>
                      <div className="badge-row cost-card-badges">
                        <StatusBadge value={row.costStatus ?? "NEEDS_INPUT"} />
                        <StatusBadge value={row.currentProfitStatus ?? "NEEDS_INPUT"} />
                      </div>
                    </div>

                    <div className="cost-card-readonly">
                      <MetricRow label="Selling Price" value={formatMoney(row.sellingPrice)} />
                      <MetricRow label="Missing Fields" value={row.missingFields.length ? row.missingFields.map(labelize).join(", ") : "None"} />
                    </div>

                    <div className="cost-edit-grid">
                      <label className="field">
                        <span>Subcategory</span>
                        <input
                          list="cost-subcategory-options"
                          value={rowEdits.subcategory}
                          aria-label={`Subcategory for ${rowLabel}`}
                          onChange={(event) => setField(row, "subcategory", event.target.value)}
                        />
                      </label>
                      <TextInput label="Product Cost" type="number" value={rowEdits.productCost} onChange={(value) => setField(row, "productCost", value)} />
                      <TextInput label="Landed Cost" type="number" value={rowEdits.landedCost} onChange={(value) => setField(row, "landedCost", value)} />
                      <TextInput label="Packaging Cost" type="number" value={rowEdits.packagingCost} onChange={(value) => setField(row, "packagingCost", value)} />
                      <TextInput label="Shipping Cost" type="number" value={rowEdits.shippingCost} onChange={(value) => setField(row, "shippingCost", value)} />
                      <TextInput label="Other Cost" type="number" value={rowEdits.otherCost} onChange={(value) => setField(row, "otherCost", value)} />
                      <TextInput label="Required Profit" type="number" value={rowEdits.requiredProfit} onChange={(value) => setField(row, "requiredProfit", value)} />
                    </div>

                    <div className="cost-card-footer">
                      <div className="cost-card-state">
                        {isEdited ? <span className="unsaved-label">Unsaved changes</span> : null}
                        {!isEdited && (lastSaved || isSaved) ? <span className="last-saved-label">{isSaved ? "Saved" : "Last saved values"}</span> : null}
                      </div>
                      <div className="button-row compact">
                        <button type="button" onClick={() => saveRows([row])} disabled={rowSaving || !isEdited}>
                          {rowSaving ? "Saving..." : "Save Row"}
                        </button>
                        <button type="button" className="secondary" onClick={() => resetRow(row)} disabled={rowSaving || !isEdited}>
                          Reset Row
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="queue-pagination bottom">
              <span>Page {safePage} of {totalPages}</span>
              <div className="button-row compact">
                <button type="button" className="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1 || bulkSaving}>Previous</button>
                <button type="button" className="secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages || bulkSaving}>Next</button>
              </div>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

type ListingReadinessRow = {
  productPassportId: string;
  sku: string | null;
  asin: string | null;
  productName: string;
  category: string | null;
  status: string;
  overallScore: number;
  readinessStatus: string;
  profitStatus: unknown;
  topMissingItems: string[];
  nextBestAction: string;
};

type ListingReadinessSummary = {
  ok: boolean;
  sellerId: string;
  count: number;
  summary: { readyCount: number; needsFixCount: number; poorCount: number };
  rows: ListingReadinessRow[];
};

function ListingReadinessPage({ navigate }: { navigate: FounderNavigate }) {
  const readiness = useApi<ListingReadinessSummary>(() => getJson(`/api/listing-readiness?sellerId=${SELLER_ID}`));
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const [statusFilter, setStatusFilter] = useState("All");

  const products = mergeFounderProducts(passports.data, economics.data);
  const rows = readiness.data?.rows ?? [];
  const summary = readiness.data?.summary;
  const loading = readiness.loading || passports.loading || economics.loading;

  const filteredRows = statusFilter === "All" ? rows : rows.filter((row) => row.readinessStatus === statusFilter);

  function findMatchingProduct(row: ListingReadinessRow): FounderProduct | null {
    if (row.sku) {
      const bySku = products.find((product) => product.sku === row.sku);
      if (bySku) return bySku;
    }
    if (row.asin) {
      const byAsin = products.find((product) => product.asin === row.asin);
      if (byAsin) return byAsin;
    }
    return null;
  }

  return (
    <div className="page founder-page">
      <PageHeader title="Listing Readiness" subtitle="Per-SKU readiness score, what's missing, and the single next action." />
      <div className="summary-strip">
        <MetricTile label="Products scored" value={readiness.loading ? "..." : rows.length} />
        <MetricTile label="Ready" value={readiness.loading ? "..." : summary?.readyCount ?? 0} />
        <MetricTile label="Needs fix" value={readiness.loading ? "..." : summary?.needsFixCount ?? 0} />
        <MetricTile label="Poor" value={readiness.loading ? "..." : summary?.poorCount ?? 0} />
      </div>
      <div className="filter-pills">
        {["All", "READY", "NEEDS_FIX", "POOR"].map((label) => (
          <button type="button" key={label} className={statusFilter === label ? "active" : ""} onClick={() => setStatusFilter(label)}>
            {label === "All" ? "All" : label.replace("_", " ")}
          </button>
        ))}
      </div>
      <Card title="Listing Readiness">
        {loading ? (
          <LoadingBlock text="Loading listing readiness..." />
        ) : readiness.error ? (
          <ErrorBlock text="Could not load listing readiness. Backend may still be deploying." />
        ) : filteredRows.length === 0 ? (
          <EmptyBlock text="No products match this filter." />
        ) : (
          <div className="table-wrap economics-table">
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Profit Status</th>
                  <th>Top Missing</th>
                  <th>Next Best Action</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const matchedProduct = findMatchingProduct(row);
                  return (
                    <tr key={row.productPassportId}>
                      <td className="product-name-cell">{formatEmpty(row.productName)}</td>
                      <td className="identity-cell">{formatEmpty(row.sku)}</td>
                      <td>{row.overallScore}</td>
                      <td><StatusBadge value={row.readinessStatus} /></td>
                      <td><StatusBadge value={row.profitStatus ?? "NEEDS_INPUT"} /></td>
                      <td>{row.topMissingItems.length ? row.topMissingItems.join(", ") : "—"}</td>
                      <td>{formatEmpty(row.nextBestAction)}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          disabled={!matchedProduct}
                          onClick={() => matchedProduct && navigate("Product Detail", matchedProduct)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ProductEconomicsPage() {
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const rows = rowsOf<ProductEconomics>(economics.data);
  const [selectedId, setSelectedId] = useState("");
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const completeCount = rows.filter((row) => normalizeState(row.profitDataStatus).includes("COMPLETE") || normalizeState(row.profitDataStatus).includes("AVAILABLE")).length;
  const needsInputCount = rows.filter((row) => normalizeState(row.profitDataStatus).includes("MISSING") || normalizeState(row.profitDataStatus).includes("NEEDS") || normalizeState(row.profitDataStatus).includes("PARTIAL")).length;

  function economicsDetailRows(row: ProductEconomics): Array<[string, ReactNode]> {
    return [
      ["Selling Price", formatMoney(row.sellingPrice)],
      ["Buying Cost", formatMoney(row.buyingCost)],
      ["Landed Cost", formatMoney(row.landedCost)],
      ["Required Profit", formatMoney(row.requiredProfit)],
      ["Net Profit", formatMoney(row.netProfit)],
      ["Net Profit Before Ads", formatMoney(row.netProfitBeforeAds)],
      ["Profit Margin", formatPercent(row.profitMargin)],
      ["Target ACOS", formatPercent(row.targetAcos)],
      ["Break-even ACOS", formatPercent(row.breakEvenAcos)],
      ["Profit Status", <StatusBadge key="profit-status" value={row.profitStatus ?? "NEEDS_INPUT"} />],
      ["Data Status", <StatusBadge key="data-status" value={row.profitDataStatus ?? "NEEDS_INPUT"} />],
      ["Fee Rules Version", formatEmpty(row.feeRulesVersion)]
    ];
  }

  return (
    <div className="page">
      <PageHeader
        title="Product Economics"
        subtitle="Profitability, readiness, and calculated economics. Cost completion lives in Product Passport."
      />
      <div className="summary-strip">
        <MetricTile label="Economics rows" value={economics.loading ? "..." : rows.length} />
        <MetricTile label="Complete data" value={economics.loading ? "..." : completeCount} />
        <MetricTile label="Needs input" value={economics.loading ? "..." : needsInputCount} />
        <MetricTile label="Selected SKU" value={selectedRow ? formatEmpty(selectedRow.sku) : "-"} />
      </div>

      <Card title="Profitability Readiness">
        {economics.loading ? <LoadingBlock /> : economics.error ? (
          <ErrorBlock text="Could not load product economics. Backend may still be deploying." />
        ) : rows.length === 0 ? (
          <EmptyBlock text="No product economics rows yet. Complete cost data in Product Passport first." />
        ) : (
          <div className="table-wrap economics-table">
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>ASIN</th>
                  <th>Subcategory</th>
                  <th>Selling Price</th>
                  <th>Landed Cost</th>
                  <th>Required Profit</th>
                  <th>Profit Status</th>
                  <th>Target ACOS</th>
                  <th>Break-even ACOS</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const open = selectedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr className={open ? "edited-row" : ""}>
                        <td className="product-name-cell">{formatEmpty(row.productName)}</td>
                        <td className="identity-cell">{formatEmpty(row.sku)}</td>
                        <td className="identity-cell">{formatEmpty(row.asin)}</td>
                        <td>{formatEmpty(row.subCategory)}</td>
                        <td>{formatMoney(row.sellingPrice)}</td>
                        <td>{formatMoney(row.landedCost)}</td>
                        <td>{formatMoney(row.requiredProfit)}</td>
                        <td><StatusBadge value={row.profitStatus ?? row.profitDataStatus ?? "NEEDS_INPUT"} /></td>
                        <td>{formatPercent(row.targetAcos)}</td>
                        <td>{formatPercent(row.breakEvenAcos)}</td>
                        <td>
                          <button type="button" className="secondary" onClick={() => setSelectedId(open ? "" : row.id)}>
                            {open ? "Close Details" : "View Details"}
                          </button>
                        </td>
                      </tr>
                      {open ? (
                        <tr className="economics-inline-detail-row">
                          <td colSpan={11}>
                            <div className="economics-inline-detail">
                              <div className="approval-card-head">
                                <div className="approval-title-block">
                                  <strong>{formatEmpty(row.productName)}</strong>
                                  <span>{formatEmpty(row.sku)} / {formatEmpty(row.asin)}</span>
                                </div>
                                <button type="button" className="secondary" onClick={() => setSelectedId("")}>Close Details</button>
                              </div>
                              <div className="detail-grid">
                                {economicsDetailRows(row).map(([label, value]) => (
                                  <MetricRow key={label} label={label} value={value} />
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const referralFeeSubcategories = [
  "Mattresses",
  "Rugs and Doormats",
  "Clocks",
  "Wall Art",
  "Home - Fragrance & Candles",
  "Bedsheets, Blankets and covers",
  "Home furnishing",
  "Containers, Boxes, Bottles",
  "Home improvement - Accessories",
  "Home Storage",
  "Curtains and Accessories",
  "Cushion Covers",
  "Indoor Lighting",
  "Indoor Lighting - Others",
  "LED Bulbs and Battens",
  "Wall Paints and Tools",
  "Craft materials",
  "Safes and Lockers",
  "Home Decor Products",
  "Home - Other Products",
  "Home improvement - Other Products",
  "Kitchen - Glassware & Ceramicware",
  "Cookware, Tableware & Dinnerware"
];

function readFirst(source: unknown, keys: string[]): unknown {
  const root = recordOf(source);
  for (const key of keys) {
    const value = key.split(".").reduce<unknown>((current, part) => recordOf(current)[part], root);
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

function queueMissingFields(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => formatEmpty(item)).join(", ");
  return formatEmpty(value);
}

export function CostCompletionQueuePage({ title = "Product Economics" }: { title?: string }) {
  const queue = useApi<ApiRows<CostCompletionQueueItem>>(() => getJson(`/api/product-economics/cost-completion-queue?sellerId=${SELLER_ID}`));
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));
  const queueRows = useMemo(() => {
    const directRows = rowsOf<CostCompletionQueueItem>(queue.data);
    if (directRows.length > 0) return directRows;
    const dataRecord = recordOf(queue.data);
    return arrayOf(dataRecord.queue ?? dataRecord.items ?? dataRecord.products) as CostCompletionQueueItem[];
  }, [queue.data]);
  const economicsRows = rowsOf<ProductEconomics>(economics.data);
  const economicsBySku = useMemo(() => new Map(economicsRows.filter((row) => row.sku).map((row) => [String(row.sku), row])), [economicsRows]);
  const economicsByAsin = useMemo(() => new Map(economicsRows.filter((row) => row.asin).map((row) => [String(row.asin), row])), [economicsRows]);

  const products = useMemo(() => queueRows.map((item, index) => {
    const raw = item as unknown as AnyRecord;
    const sku = String(readFirst(raw, ["sku", "sellerSku"]) ?? "");
    const asin = String(readFirst(raw, ["asin"]) ?? "");
    const economicsRow = item.economics ?? (sku ? economicsBySku.get(sku) : undefined) ?? (asin ? economicsByAsin.get(asin) : undefined) ?? null;
    const key = String(readFirst(raw, ["key", "id"]) ?? (sku ? `sku:${sku}` : asin ? `asin:${asin}` : `row:${index}`));

    return {
      key,
      sku,
      asin,
      productName: String(readFirst(raw, ["productName", "product_name", "title"]) ?? economicsRow?.productName ?? ""),
      subCategory: String(readFirst(raw, ["subCategory", "sub_category"]) ?? economicsRow?.subCategory ?? ""),
      sellingPrice: readFirst(raw, ["sellingPrice", "price"]) ?? economicsRow?.sellingPrice,
      costStatus: String(readFirst(raw, ["costStatus", "status", "profitDataStatus"]) ?? economicsRow?.profitDataStatus ?? "NEEDS_INPUT"),
      missingFields: readFirst(raw, ["missingFields", "missing_fields"]) ?? [],
      profitStatus: String(readFirst(raw, ["profitStatus"]) ?? economicsRow?.profitStatus ?? ""),
      targetAcos: readFirst(raw, ["targetAcos"]) ?? economicsRow?.targetAcos,
      fulfillmentType: String(readFirst(raw, ["fulfillmentType", "fulfillmentChannel"]) ?? economicsRow?.fulfillmentType ?? ""),
      productType: String(readFirst(raw, ["productType"]) ?? economicsRow?.productType ?? ""),
      weightKg: readFirst(raw, ["weightKg"]) ?? economicsRow?.weightKg,
      volumeCuFt: readFirst(raw, ["volumeCuFt"]) ?? economicsRow?.volumeCuFt,
      productGstRatePercent: readFirst(raw, ["productGstRatePercent"]) ?? economicsRow?.productGstRatePercent,
      amazonFeeGstRatePercent: readFirst(raw, ["amazonFeeGstRatePercent"]) ?? economicsRow?.amazonFeeGstRatePercent,
      marketplaceId: String(readFirst(raw, ["marketplaceId"]) ?? economicsRow?.marketplaceId ?? ""),
      economics: economicsRow
    };
  }), [economicsByAsin, economicsBySku, queueRows]);

  const [selectedKey, setSelectedKey] = useState("");
  const [form, setForm] = useState({
    sellingPrice: "",
    buyingCost: "",
    requiredProfit: "",
    fulfillmentType: "FC",
    productType: "Standard",
    weightKg: "",
    volumeCuFt: "",
    otherFees: "",
    shippingRegion: "National",
    categoryException: "No",
    productGstRatePercent: "18",
    amazonFeeGstRatePercent: "18",
    subCategory: "",
    notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [calculatedResult, setCalculatedResult] = useState<AnyRecord | null>(null);
  const selectedProduct = products.find((product) => product.key === selectedKey) ?? null;
  const resultSource = calculatedResult ?? recordOf(selectedProduct?.economics);
  const profitBands = arrayOf(readFirst(resultSource, ["profitBands", "profit_bands"]));
  const hasFounderOverrideBand = profitBands.some((band) => {
    const record = recordOf(band);
    return String(record.approvalTier ?? record.approval_tier ?? "").toUpperCase() === "FOUNDER_OVERRIDE_REQUIRED";
  });

  function openCostForm(product: (typeof products)[number]) {
    const row = product.economics;
    setSelectedKey(product.key);
    setCalculatedResult(row ? (row as unknown as AnyRecord) : null);
    setSaveMessage("");
    setSaveError("");
    setForm({
      sellingPrice: row?.sellingPrice !== null && row?.sellingPrice !== undefined ? String(row.sellingPrice) : product.sellingPrice !== null && product.sellingPrice !== undefined ? String(product.sellingPrice) : "",
      buyingCost: row?.buyingCost !== null && row?.buyingCost !== undefined ? String(row.buyingCost) : row?.landedCost !== null && row?.landedCost !== undefined ? String(row.landedCost) : "",
      requiredProfit: row?.requiredProfit !== null && row?.requiredProfit !== undefined ? String(row.requiredProfit) : row?.targetProfit !== null && row?.targetProfit !== undefined ? String(row.targetProfit) : "",
      fulfillmentType: row?.fulfillmentType ?? product.fulfillmentType ?? "FC",
      productType: row?.productType ?? product.productType ?? "Standard",
      weightKg: row?.weightKg !== null && row?.weightKg !== undefined ? String(row.weightKg) : product.weightKg !== null && product.weightKg !== undefined ? String(product.weightKg) : "",
      volumeCuFt: row?.volumeCuFt !== null && row?.volumeCuFt !== undefined ? String(row.volumeCuFt) : product.volumeCuFt !== null && product.volumeCuFt !== undefined ? String(product.volumeCuFt) : "",
      otherFees: row?.otherFees !== null && row?.otherFees !== undefined ? String(row.otherFees) : row?.otherCostPerUnit !== null && row?.otherCostPerUnit !== undefined ? String(row.otherCostPerUnit) : "",
      shippingRegion: row?.shippingRegion ?? "National",
      categoryException: row?.categoryException === true ? "Yes" : row?.categoryException === false ? "No" : row?.categoryException ?? "No",
      productGstRatePercent: row?.productGstRatePercent !== null && row?.productGstRatePercent !== undefined ? String(row.productGstRatePercent) : product.productGstRatePercent !== null && product.productGstRatePercent !== undefined ? String(product.productGstRatePercent) : "18",
      amazonFeeGstRatePercent: row?.amazonFeeGstRatePercent !== null && row?.amazonFeeGstRatePercent !== undefined ? String(row.amazonFeeGstRatePercent) : product.amazonFeeGstRatePercent !== null && product.amazonFeeGstRatePercent !== undefined ? String(product.amazonFeeGstRatePercent) : "18",
      subCategory: product.subCategory,
      notes: row?.notes ?? ""
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedProduct) return;
    if (!selectedProduct.subCategory && !form.subCategory) {
      setSaveError("Choose a subcategory before saving cost data.");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const response = await postJson<AnyRecord>("/api/product-economics", {
        sellerId: SELLER_ID,
        sku: selectedProduct.sku,
        asin: selectedProduct.asin || null,
        marketplaceId: selectedProduct.marketplaceId || null,
        productName: selectedProduct.productName || selectedProduct.sku,
        subCategory: selectedProduct.subCategory || form.subCategory,
        sellingPrice: asInputNumber(form.sellingPrice) ?? 0,
        buyingCost: asInputNumber(form.buyingCost),
        requiredProfit: asInputNumber(form.requiredProfit) ?? 0,
        fulfillmentType: form.fulfillmentType,
        productType: form.productType,
        weightKg: asInputNumber(form.weightKg),
        volumeCuFt: asInputNumber(form.volumeCuFt),
        otherFees: asInputNumber(form.otherFees) ?? 0,
        otherCostPerUnit: asInputNumber(form.otherFees) ?? 0,
        shippingRegion: form.shippingRegion,
        categoryException: form.categoryException,
        productGstRatePercent: asInputNumber(form.productGstRatePercent) ?? 18,
        amazonFeeGstRatePercent: asInputNumber(form.amazonFeeGstRatePercent) ?? 18,
        notes: form.notes.trim() || null
      });

      const result = recordOf(response.economics ?? response.row ?? response.result ?? response.calculation ?? response);
      setCalculatedResult(result);
      setSaveMessage("Cost data saved. Amazon fee calculations refreshed.");
      queue.reload();
      economics.reload();
    } catch {
      setSaveError("Could not save cost data. Backend may still be deploying.");
    } finally {
      setSaving(false);
    }
  }

  const calculatedRows = [
    ["Net Revenue before GST", ["netRevenueBeforeGst", "net_revenue_before_gst"], "money"],
    ["Output GST on Sale", ["outputGstOnSale", "output_gst_on_sale"], "money"],
    ["Referral Fee %", ["referralFeePercent", "referral_fee_percent", "feeBreakdown.referralFeePercent"], "percent"],
    ["Referral Fee", ["referralFee", "referral_fee", "amazonFeeEstimate", "amazon_fee_estimate", "feeBreakdown.referralFee"], "money"],
    ["Closing Fee", ["closingFee", "closing_fee", "feeBreakdown.closingFee"], "money"],
    ["Shipping Fee", ["shippingFee", "shipping_fee", "shippingFeeEstimate", "shipping_fee_estimate", "feeBreakdown.shippingFee"], "money"],
    ["Pick & Pack Fee", ["pickAndPackFee", "pick_and_pack_fee", "feeBreakdown.pickAndPackFee"], "money"],
    ["Storage Fee", ["storageFee", "storage_fee", "feeBreakdown.storageFee"], "money"],
    ["Other Fees", ["otherFees", "other_fees", "otherCostPerUnit", "other_cost_per_unit"], "money"],
    ["Total Amazon Fees", ["totalAmazonFees", "total_amazon_fees", "feeBreakdown.totalAmazonFees"], "money"],
    ["GST on Amazon Fees", ["gstOnAmazonFees", "gst_on_amazon_fees", "feeBreakdown.gstOnAmazonFees"], "money"],
    ["Return Cost Provision", ["returnCostProvision", "return_cost_provision"], "money"],
    ["Gross Profit", ["grossProfit", "gross_profit"], "money"],
    ["Net Profit", ["netProfit", "net_profit"], "money"],
    ["Net Profit Before Ads", ["netProfitBeforeAds", "net_profit_before_ads"], "money"],
    ["Profit Margin %", ["profitMargin", "profit_margin", "profitMarginPercent", "profit_margin_percent"], "percent"],
    ["Max Allowable Ad Spend", ["maxAllowableAdSpend", "max_allowable_ad_spend"], "money"],
    ["Target ACOS", ["targetAcos", "target_acos"], "percent"],
    ["Break-even ACOS", ["breakEvenAcos", "break_even_acos"], "percent"],
    ["Fee Rules Version", ["feeRulesVersion", "fee_rules_version"], "text"]
  ] as const;

  return (
    <div className="page">
      <PageHeader
        title={title}
        subtitle="Review economics inputs, Amazon fee calculations, and profit readiness without changing Amazon or Ads."
      />

      <Card title="Economics Inputs">
        {queue.loading || economics.loading ? <LoadingBlock /> : queue.error || economics.error ? (
          <ErrorBlock text="Could not load cost queue. Backend may still be deploying." />
        ) : products.length === 0 ? (
          <EmptyBlock text="No products need cost completion right now." />
        ) : (
          <div className="table-wrap cost-table">
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>ASIN</th>
                  <th>Subcategory</th>
                  <th>Selling Price</th>
                  <th>Cost Status</th>
                  <th>Missing Fields</th>
                  <th>Profit Status</th>
                  <th>Target ACOS</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.key}>
                    <td>{formatEmpty(product.productName)}</td>
                    <td>{formatEmpty(product.sku)}</td>
                    <td>{formatEmpty(product.asin)}</td>
                    <td>{product.subCategory ? formatEmpty(product.subCategory) : <StatusBadge value="Subcategory missing" />}</td>
                    <td>{formatMoney(product.sellingPrice)}</td>
                    <td><StatusBadge value={product.costStatus} /></td>
                    <td>{queueMissingFields(product.missingFields)}</td>
                    <td><StatusBadge value={product.profitStatus || product.economics?.profitStatus || "NEEDS_INPUT"} /></td>
                    <td>{formatPercent(product.targetAcos ?? product.economics?.targetAcos)}</td>
                    <td><button type="button" onClick={() => openCostForm(product)}>{product.economics ? "Edit Cost" : "Complete Cost Data"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Cost Completion">
        {!selectedProduct ? (
          <EmptyBlock text="Choose Complete Cost Data or Edit Cost from the queue." />
        ) : (
          <form className="form-grid" onSubmit={submit}>
            <ReadOnlyField label="SKU" value={formatEmpty(selectedProduct.sku)} />
            <ReadOnlyField label="ASIN" value={formatEmpty(selectedProduct.asin)} />
            <ReadOnlyField label="Product Name" value={formatEmpty(selectedProduct.productName)} />
            {selectedProduct.subCategory ? (
              <ReadOnlyField label="Subcategory" value={formatEmpty(selectedProduct.subCategory)} />
            ) : (
              <label className="field">
                <span>Subcategory</span>
                <select value={form.subCategory} onChange={(event) => setForm({ ...form, subCategory: event.target.value })}>
                  <option value="">Subcategory missing</option>
                  {referralFeeSubcategories.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            )}
            <TextInput label="Selling Price" type="number" value={form.sellingPrice} onChange={(value) => setForm({ ...form, sellingPrice: value })} />
            <TextInput label="Product Cost / Buying Cost" type="number" value={form.buyingCost} onChange={(value) => setForm({ ...form, buyingCost: value })} />
            <TextInput label="Required Profit" type="number" value={form.requiredProfit} onChange={(value) => setForm({ ...form, requiredProfit: value })} />
            <SelectField label="Fulfillment Type" value={form.fulfillmentType} options={["FC", "Easy Ship", "Easy Ship Prime", "Self Ship", "Seller Flex"]} onChange={(value) => setForm({ ...form, fulfillmentType: value })} />
            <SelectField label="Product Type" value={form.productType} options={["Standard", "Oversize"]} onChange={(value) => setForm({ ...form, productType: value })} />
            <TextInput label="Weight kg" type="number" value={form.weightKg} onChange={(value) => setForm({ ...form, weightKg: value })} />
            <TextInput label="Volume cu ft" type="number" value={form.volumeCuFt} onChange={(value) => setForm({ ...form, volumeCuFt: value })} />
            <TextInput label="Other Fees" type="number" value={form.otherFees} onChange={(value) => setForm({ ...form, otherFees: value })} />
            <SelectField label="Shipping Region" value={form.shippingRegion} options={["National"]} onChange={(value) => setForm({ ...form, shippingRegion: value })} />
            <SelectField label="Category Exception" value={form.categoryException} options={["No", "Yes"]} onChange={(value) => setForm({ ...form, categoryException: value })} />
            <details className="advanced-settings field-wide">
              <summary>Advanced Tax Settings</summary>
              <div className="advanced-settings-grid">
                <TextInput label="Product GST Rate %" type="number" value={form.productGstRatePercent} onChange={(value) => setForm({ ...form, productGstRatePercent: value })} />
                <TextInput label="Amazon Fee GST Rate %" type="number" value={form.amazonFeeGstRatePercent} onChange={(value) => setForm({ ...form, amazonFeeGstRatePercent: value })} />
              </div>
            </details>
            <TextArea label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
            <div className="field-wide cost-form-actions">
              <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Cost Data"}</button>
              {saveMessage ? <span className="save-message">{saveMessage}</span> : null}
              {saveError ? <span className="save-error">{saveError}</span> : null}
            </div>
          </form>
        )}
      </Card>

      {selectedProduct && Object.keys(resultSource).length > 0 ? (
        <Card title="Calculated Result">
          <div className="calculated-grid">
            {calculatedRows.map(([label, keys, format]) => {
              const value = readFirst(resultSource, [...keys]);
              const display = format === "money" ? formatMoney(value) : format === "percent" ? formatPercent(value) : formatEmpty(value);
              return <MetricRow key={label} label={label} value={display} />;
            })}
            <MetricRow label="Profit Status" value={<StatusBadge value={readFirst(resultSource, ["profitStatus", "profit_status"]) ?? "NEEDS_INPUT"} />} />
          </div>
        </Card>
      ) : null}

      {selectedProduct && profitBands.length > 0 ? (
        <Card title="Profit Flex Options">
          <p className="section-note">Lower profit bands are approval-only. This screen does not auto-apply any lower profit target.</p>
          {hasFounderOverrideBand ? (
            <div className="warning-card profit-band-warning">
              <StatusBadge value="FOUNDER_OVERRIDE_REQUIRED" />
              <p>This profit band is too far below target. Founder override required.</p>
            </div>
          ) : null}
          <div className="table-wrap profit-band-table">
            <table>
              <thead>
                <tr>
                  <th>Profit Band</th>
                  <th>Target ACOS</th>
                  <th>Max Allowable Ad Spend</th>
                  <th>Risk Level</th>
                  <th>Approval Required</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {profitBands.map((band, index) => {
                  const bandRecord = recordOf(band);
                  const approvalRequired = Boolean(readFirst(bandRecord, ["approvalRequired", "approval_required"]));
                  const approvalTier = String(readFirst(bandRecord, ["approvalTier", "approval_tier"]) ?? "");
                  const bandWarning = String(readFirst(bandRecord, ["warning"]) ?? "");
                  const status = approvalTier || (approvalRequired ? "APPROVAL_REQUIRED" : "AVAILABLE");
                  const needsFounderOverride =
                    approvalTier.toUpperCase() === "FOUNDER_OVERRIDE_REQUIRED" ||
                    bandWarning.toLowerCase().includes("significantly below") ||
                    bandWarning.toLowerCase().includes("too far");

                  return (
                    <tr key={String(readFirst(bandRecord, ["bandLabel", "band_label"]) ?? index)}>
                      <td>
                        <strong>{formatEmpty(readFirst(bandRecord, ["bandLabel", "band_label"]))}</strong>
                        {needsFounderOverride ? <p className="table-warning">Founder override required.</p> : null}
                      </td>
                      <td>{formatPercent(readFirst(bandRecord, ["targetAcos", "target_acos"]))}</td>
                      <td>{formatMoney(readFirst(bandRecord, ["maxAllowableAdSpend", "max_allowable_ad_spend"]))}</td>
                      <td><StatusBadge value={readFirst(bandRecord, ["riskLevel", "risk_level"])} /></td>
                      <td>{approvalRequired ? "Approval Required" : "No Approval Required"}</td>
                      <td><StatusBadge value={status} /></td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setSaveMessage("Profit band approval request noted for review. No lower profit band was applied automatically.")}
                        >
                          Request Approval for This Profit Band
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function PpcRecommendationsPage({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const live = useApi<AnyRecord>(() => getJson(`/api/amazon-ads/ppc-recommendations?sellerId=${SELLER_ID}&days=30&targetAcos=35`));
  const saved = useApi<ApiRows<Recommendation>>(() => getJson(`/api/recommendations?sellerId=${SELLER_ID}`));
  const [saving, setSaving] = useState(false);

  const liveData = live.data ?? {};
  const scale = [
    ...arrayOf(liveData.scaleOpportunities),
    ...arrayOf(liveData.exactMatchOpportunities),
    ...arrayOf(liveData.productTargetingOpportunities)
  ];
  const watchlist = [...arrayOf(liveData.watchlistRisks), ...arrayOf(liveData.watchlistWasteTerms)];
  const listingWarnings = arrayOf(liveData.listingCheckWarnings ?? liveData.productPageCheckWarnings);
  const savedRows = rowsOf<Recommendation>(saved.data).filter((row) => row.status === "NEW").slice(0, 10);

  async function generateAndSave() {
    setSaving(true);
    try {
      await getJson(`/api/amazon-ads/ppc-recommendations?sellerId=${SELLER_ID}&days=30&targetAcos=35&save=true`);
      saved.reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="PPC Recommendations" subtitle="Shadow-mode ideas only. No Amazon action is executed here." />
      <div className="button-row">
        <button type="button" disabled={saving} onClick={generateAndSave}>{saving ? "Saving..." : "Generate & Save Recommendations"}</button>
        <button type="button" onClick={() => setActiveTab("Approval Center")}>View in Approval Center</button>
      </div>
      {live.loading ? <LoadingBlock /> : live.error ? <ErrorBlock /> : (
        <div className="stack">
          <RecommendationSection title="Scale Opportunities" rows={scale} footer={<button type="button" onClick={() => setActiveTab("Approval Center")}>View in Approval Center</button>} />
          <RecommendationSection title="Watchlist Risks" rows={watchlist} footer={<button type="button" onClick={() => setActiveTab("Approval Center")}>View in Approval Center</button>} />
          <RecommendationSection title="Listing Check Warnings" rows={listingWarnings} footer={<button type="button" onClick={() => setActiveTab("Approval Center")}>View in Approval Center</button>} />
        </div>
      )}
      <RecommendationSection title="Pending Saved Recommendations" rows={savedRows as unknown as AnyRecord[]} footer={<button type="button" onClick={() => setActiveTab("Approval Center")}>View in Approval Center</button>} loading={saved.loading} error={saved.error} />
    </div>
  );
}

function RecommendationSection({ title, rows, footer, loading, error }: { title: string; rows: AnyRecord[]; footer?: ReactNode; loading?: boolean; error?: string | null }) {
  return (
    <Card title={title}>
      {loading ? <LoadingBlock /> : error ? <ErrorBlock /> : rows.length === 0 ? <EmptyBlock /> : (
        <div className="card-list">
          {rows.slice(0, 8).map((row, index) => (
            <RecommendationCard key={String(row.id ?? row.entityValue ?? index)} item={row} footer={footer} />
          ))}
        </div>
      )}
    </Card>
  );
}

type EngineSortMode = "PRIORITY_FIRST" | "RISK_HIGH_FIRST" | "CATEGORY" | "LAST_RUN_NEWEST" | "LAST_RUN_OLDEST";

const engineCategories = [
  "All",
  "DATA_QUALITY",
  "PRODUCT_ECONOMICS",
  "PPC",
  "LISTING_SEO",
  "LISTING_CONVERSION",
  "INVENTORY",
  "PRICING",
  "ACCOUNT_HEALTH",
  "RETURNS_REVIEWS",
  "COMPETITOR_INTELLIGENCE",
  "SEASONALITY",
  "CONTENT_A_PLUS",
  "IMAGE_CREATIVE",
  "BRAND_STORE",
  "SOCIAL_CONTENT"
];
const engineSortOptions = ["Priority First", "Risk High First", "Category", "Last Run Newest", "Last Run Oldest"];
const ENGINE_REGISTRY_PAGE_SIZE = 25;

function firstRecordRows<T extends AnyRecord>(...sources: unknown[]): T[] {
  for (const source of sources) {
    const rows = recordsOf(source);
    if (rows.length > 0) return rows as T[];
  }
  return [];
}

function engineRegistryRowsOf(value: unknown): EngineRegistryItem[] {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  const registry = recordOf(root.registry);
  return firstRecordRows<EngineRegistryItem>(
    value,
    root.engines,
    root.registry,
    root.items,
    root.data,
    data.engines,
    data.registry,
    data.items,
    result.engines,
    registry.engines
  );
}

function engineRunLogsOf(value: unknown): EngineRunLog[] {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return firstRecordRows<EngineRunLog>(
    value,
    root.logs,
    root.runLogs,
    root.items,
    root.data,
    data.logs,
    data.runLogs,
    result.logs,
    result.runLogs
  );
}

function engineNestedRecord(row: AnyRecord): AnyRecord {
  return recordOf(row.engine ?? row.registryEntry ?? row.registry ?? row.engineRegistry ?? row.definition);
}

function engineField(row: AnyRecord, keys: string[]): unknown {
  const direct = readFirst(row, keys);
  if (direct !== undefined) return direct;
  return readFirst(engineNestedRecord(row), keys);
}

function engineKeyOf(row: AnyRecord): string {
  return String(engineField(row, ["engineKey", "key", "id", "engine_key"]) ?? "");
}

function engineNameOf(row: AnyRecord): string {
  return String(engineField(row, ["engineName", "name", "displayName", "title", "engine_name"]) ?? engineKeyOf(row));
}

function engineLastRun(row: AnyRecord): AnyRecord {
  return recordOf(engineField(row, ["lastRun", "lastRunLog", "latestRun", "last_run"]));
}

function engineLastRunField(row: AnyRecord, keys: string[]): unknown {
  const direct = engineField(row, keys);
  if (direct !== undefined) return direct;
  return readFirst(engineLastRun(row), keys);
}

function engineEnabled(row: AnyRecord): boolean {
  const value = engineField(row, ["enabled", "isEnabled", "is_enabled"]);
  if (value === undefined) return normalizeState(engineField(row, ["status"])) !== "DISABLED";
  return readBoolean(value);
}

function engineShadowMode(row: AnyRecord): boolean {
  const value = engineField(row, ["shadowMode", "isShadowMode", "previewOnly", "shadow_mode"]);
  if (value !== undefined) return readBoolean(value);
  const mode = normalizeState(engineField(row, ["mode", "executionMode", "runMode"]));
  return mode === "" || mode.includes("SHADOW") || mode.includes("PREVIEW");
}

function engineRequiresApproval(row: AnyRecord): boolean {
  const value = engineField(row, ["requiresApproval", "approvalRequired", "requires_approval", "approval_required"]);
  return value === undefined ? true : readBoolean(value);
}

function enginePriority(row: AnyRecord): number {
  return readNumber(engineField(row, ["priorityScore", "priority_score", "priority", "score"]));
}

function engineLastRunTimestamp(row: AnyRecord): number | null {
  const value = engineLastRunField(row, ["lastRunAt", "last_run_at", "finishedAt", "finished_at", "startedAt", "started_at", "createdAt", "created_at"]);
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function engineRiskPriority(row: AnyRecord): number {
  const risk = normalizeState(engineField(row, ["riskLevel", "risk_level", "risk"]));
  if (["HIGH", "CRITICAL", "VERY_HIGH"].includes(risk)) return 0;
  if (risk === "MEDIUM") return 1;
  if (risk === "LOW") return 2;
  return 3;
}

function engineCategoryOf(row: AnyRecord): string {
  return String(engineField(row, ["category"]) ?? "");
}

function engineSearchText(row: AnyRecord): string {
  return [
    engineKeyOf(row),
    engineNameOf(row),
    engineCategoryOf(row),
    engineField(row, ["subcategory", "subCategory", "sub_category"]),
    engineField(row, ["outputActionType", "actionType", "output_action_type"]),
    engineField(row, ["ruleTemplate", "rule_template"]),
    engineField(row, ["ownerModule", "owner_module"])
  ].map((value) => String(value ?? "").toLowerCase()).join(" ");
}

function sortEngineRows(rows: EngineRegistryItem[], sortMode: EngineSortMode): EngineRegistryItem[] {
  return [...rows].sort((a, b) => {
    if (sortMode === "RISK_HIGH_FIRST") {
      return engineRiskPriority(a) - engineRiskPriority(b) || enginePriority(b) - enginePriority(a) || engineKeyOf(a).localeCompare(engineKeyOf(b));
    }
    if (sortMode === "CATEGORY") {
      return engineCategoryOf(a).localeCompare(engineCategoryOf(b)) || enginePriority(b) - enginePriority(a) || engineKeyOf(a).localeCompare(engineKeyOf(b));
    }
    if (sortMode === "LAST_RUN_NEWEST") {
      const aTime = engineLastRunTimestamp(a);
      const bTime = engineLastRunTimestamp(b);
      if (aTime === null && bTime === null) return enginePriority(b) - enginePriority(a) || engineKeyOf(a).localeCompare(engineKeyOf(b));
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      return bTime - aTime || enginePriority(b) - enginePriority(a) || engineKeyOf(a).localeCompare(engineKeyOf(b));
    }
    if (sortMode === "LAST_RUN_OLDEST") {
      const aTime = engineLastRunTimestamp(a);
      const bTime = engineLastRunTimestamp(b);
      if (aTime === null && bTime === null) return enginePriority(b) - enginePriority(a) || engineKeyOf(a).localeCompare(engineKeyOf(b));
      if (aTime === null) return -1;
      if (bTime === null) return 1;
      return aTime - bTime || enginePriority(b) - enginePriority(a) || engineKeyOf(a).localeCompare(engineKeyOf(b));
    }
    return enginePriority(b) - enginePriority(a) || engineRiskPriority(a) - engineRiskPriority(b) || engineKeyOf(a).localeCompare(engineKeyOf(b));
  });
}

function engineSortModeFromLabel(label: string): EngineSortMode {
  if (label === "Risk High First") return "RISK_HIGH_FIRST";
  if (label === "Category") return "CATEGORY";
  if (label === "Last Run Newest") return "LAST_RUN_NEWEST";
  if (label === "Last Run Oldest") return "LAST_RUN_OLDEST";
  return "PRIORITY_FIRST";
}

function engineSortLabel(sortMode: EngineSortMode): string {
  if (sortMode === "RISK_HIGH_FIRST") return "Risk High First";
  if (sortMode === "CATEGORY") return "Category";
  if (sortMode === "LAST_RUN_NEWEST") return "Last Run Newest";
  if (sortMode === "LAST_RUN_OLDEST") return "Last Run Oldest";
  return "Priority First";
}

function summaryNumber(source: unknown, keys: string[], fallback = 0): number {
  const value = readFirst(source, keys);
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function responseCount(value: unknown, keys: string[]): number {
  const root = recordOf(value);
  const result = recordOf(root.result);
  const summary = recordOf(root.summary);
  return summaryNumber(root, keys, summaryNumber(result, keys, summaryNumber(summary, keys, 0)));
}

function runLogField(row: EngineRunLog, keys: string[]): unknown {
  return readFirst(row, keys);
}

function EngineCommandCenterPage() {
  const registrySummary = useApi<AnyRecord>(() => getJson("/api/engine-registry/summary"));
  const routerSummary = useApi<AnyRecord>(() => getJson(`/api/engine-router/summary?sellerId=${SELLER_ID}`));
  const registry = useApi<unknown>(() => getJson("/api/engine-registry?limit=300"));
  const dailyPlan = useApi<unknown>(() => getJson(`/api/engine-router/daily-plan?sellerId=${SELLER_ID}&limit=25`));
  const runLogs = useApi<unknown>(() => getJson(`/api/engine-router/run-logs?sellerId=${SELLER_ID}&limit=50`));
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<EngineSortMode>("PRIORITY_FIRST");
  const [enginePage, setEnginePage] = useState(1);
  const [runningEngineKey, setRunningEngineKey] = useState<string | null>(null);
  const [togglingEngineKey, setTogglingEngineKey] = useState<string | null>(null);
  const [runningDaily, setRunningDaily] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const engineRows = useMemo(() => engineRegistryRowsOf(registry.data), [registry.data]);
  const dailyPlanRows = useMemo(() => engineRegistryRowsOf(dailyPlan.data).slice(0, 25), [dailyPlan.data]);
  const logRows = useMemo(() => engineRunLogsOf(runLogs.data), [runLogs.data]);
  const registrySummaryRoot = recordOf(registrySummary.data?.summary ?? registrySummary.data?.data ?? registrySummary.data);
  const routerSummaryRoot = recordOf(routerSummary.data?.summary ?? routerSummary.data?.data ?? routerSummary.data);
  const filteredEngines = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const rows = engineRows.filter((row) => {
      const categoryMatches = categoryFilter === "All" || normalizeState(engineCategoryOf(row)) === categoryFilter;
      const searchMatches = !normalizedSearch || engineSearchText(row).includes(normalizedSearch);
      return categoryMatches && searchMatches;
    });
    return sortEngineRows(rows, sortMode);
  }, [categoryFilter, engineRows, searchQuery, sortMode]);
  const enginePageCount = Math.max(1, Math.ceil(filteredEngines.length / ENGINE_REGISTRY_PAGE_SIZE));
  const currentEnginePage = Math.min(enginePage, enginePageCount);
  const enginePageStartIndex = filteredEngines.length === 0 ? 0 : (currentEnginePage - 1) * ENGINE_REGISTRY_PAGE_SIZE;
  const enginePageEndIndex = Math.min(enginePageStartIndex + ENGINE_REGISTRY_PAGE_SIZE, filteredEngines.length);
  const visibleEngines = filteredEngines.slice(enginePageStartIndex, enginePageEndIndex);
  const filtersActive = categoryFilter !== "All" || searchQuery.trim().length > 0;
  const controlsDisabled = Boolean(runningEngineKey || togglingEngineKey || runningDaily);

  useEffect(() => {
    if (enginePage > enginePageCount) {
      setEnginePage(enginePageCount);
    }
  }, [enginePage, enginePageCount]);

  const summaryCards = [
    {
      label: "Total Engines",
      value: registrySummary.loading && !registrySummary.data ? "..." : summaryNumber(registrySummaryRoot, ["totalEngines", "engineCount", "total", "count"], engineRows.length)
    },
    {
      label: "Enabled Engines",
      value: registrySummary.loading && !registrySummary.data ? "..." : summaryNumber(registrySummaryRoot, ["enabledEngines", "enabledCount"], engineRows.filter(engineEnabled).length)
    },
    {
      label: "Shadow Mode Engines",
      value: registrySummary.loading && !registrySummary.data ? "..." : summaryNumber(registrySummaryRoot, ["shadowModeEngines", "shadowModeCount", "previewOnlyCount"], engineRows.filter(engineShadowMode).length)
    },
    {
      label: "Approval Required",
      value: registrySummary.loading && !registrySummary.data ? "..." : summaryNumber(registrySummaryRoot, ["approvalRequired", "approvalRequiredEngines", "approvalRequiredCount", "requiresApprovalCount"], engineRows.filter(engineRequiresApproval).length)
    },
    {
      label: "Last 24h Runs",
      value: routerSummary.loading && !routerSummary.data ? "..." : summaryNumber(routerSummaryRoot, ["last24hRuns", "runsLast24h", "last24HoursRuns"], 0)
    },
    {
      label: "Actions Created",
      value: routerSummary.loading && !routerSummary.data ? "..." : summaryNumber(routerSummaryRoot, ["last24hActionsCreated", "actionsCreated", "actionsCreatedCount", "totalActionsCreated"], 0)
    },
    {
      label: "Failed Runs",
      value: routerSummary.loading && !routerSummary.data ? "..." : summaryNumber(routerSummaryRoot, ["failedRuns", "failedRunCount"], 0)
    },
    {
      label: "Preview Runs",
      value: routerSummary.loading && !routerSummary.data ? "..." : summaryNumber(routerSummaryRoot, ["previewOnlyRuns", "previewRuns", "previewRunCount"], 0)
    }
  ];

  function refreshEngineData() {
    registrySummary.reload();
    routerSummary.reload();
    registry.reload();
    dailyPlan.reload();
    runLogs.reload();
  }

  async function runEnginePreview(engineKey: string) {
    setRunningEngineKey(engineKey);
    setMessage(null);
    try {
      await postJson(`/api/engine-router/run-engine/${encodeURIComponent(engineKey)}`, {
        sellerId: SELLER_ID,
        actor: "founder"
      });
      refreshEngineData();
      setMessage({ type: "success", text: "Preview run completed. No external action executed." });
    } catch {
      setMessage({ type: "error", text: "Could not run preview." });
    } finally {
      setRunningEngineKey(null);
    }
  }

  async function toggleEngine(row: EngineRegistryItem) {
    const engineKey = engineKeyOf(row);
    const enabled = !engineEnabled(row);
    setTogglingEngineKey(engineKey);
    setMessage(null);
    try {
      await postJson(`/api/engine-registry/${encodeURIComponent(engineKey)}/toggle`, {
        enabled,
        actor: "founder",
        note: "Toggled from Engine Command Center"
      });
      registrySummary.reload();
      routerSummary.reload();
      registry.reload();
      setMessage({ type: "success", text: `${engineNameOf(row)} ${enabled ? "enabled" : "disabled"}.` });
    } catch {
      setMessage({ type: "error", text: "Could not update engine status." });
    } finally {
      setTogglingEngineKey(null);
    }
  }

  async function runDailyPreview() {
    setRunningDaily(true);
    setMessage(null);
    try {
      const response = await postJson<AnyRecord>("/api/engine-router/run-preview", {
        sellerId: SELLER_ID,
        limit: 25,
        actor: "founder"
      });
      refreshEngineData();
      const enginesRun = responseCount(response, ["enginesRun", "enginesRunCount", "runCount"]);
      const actionsCreated = responseCount(response, ["actionsCreated", "actionsCreatedCount"]);
      const skippedCount = responseCount(response, ["skippedCount", "enginesSkipped", "skipped"]);
      setMessage({
        type: "success",
        text: `Daily preview completed. Engines run: ${enginesRun}. Actions created: ${actionsCreated}. Skipped: ${skippedCount}. No external action executed.`
      });
    } catch {
      setMessage({ type: "error", text: "Could not run preview." });
    } finally {
      setRunningDaily(false);
    }
  }

  return (
    <div className="page engine-command-center">
      <PageHeader
        title="Engine Command Center"
        subtitle="300-engine AI-CGO foundation. Shadow mode active. No Amazon or Ads action is executed."
      />
      <div className="warning-card approval-warning engine-safety-banner">
        <p>All engines are running in preview/shadow mode. Recommendations go to Approval Center only. No external Amazon, Ads, Listing, Image, A+, Store, or Social action is executed.</p>
      </div>
      <div className="summary-strip engine-summary" aria-label="Engine summary">
        {summaryCards.map((card) => (
          <MetricTile key={card.label} label={card.label} value={card.value} />
        ))}
      </div>
      {registrySummary.error || routerSummary.error ? (
        <ErrorBlock text="Could not load engine registry" />
      ) : null}
      {message ? <div className={`soft-state ${message.type === "error" ? "error-state" : "success-state"} engine-message`}>{message.text}</div> : null}

      <Card title="Engine Registry">
        <div className="engine-controls">
          <TextInput
            label="Search engines"
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setEnginePage(1);
            }}
          />
          <SelectField
            label="Sort"
            value={engineSortLabel(sortMode)}
            options={engineSortOptions}
            onChange={(value) => setSortMode(engineSortModeFromLabel(value))}
          />
        </div>
        <div className="segmented engine-category-filter" aria-label="Engine categories">
          {engineCategories.map((category) => (
            <button
              key={category}
              type="button"
              className={categoryFilter === category ? "active" : ""}
              onClick={() => {
                setCategoryFilter(category);
                setEnginePage(1);
              }}
            >
              {category}
            </button>
          ))}
        </div>
        {!registry.loading && !registry.error ? (
          <div className="approval-pagination engine-pagination" aria-label="Engine registry pagination">
            <span>
              {filteredEngines.length === 0 ? (
                <>Showing 0 of {engineRows.length} loaded engines{filtersActive ? " after filters" : ""}</>
              ) : filtersActive ? (
                <>Showing {enginePageStartIndex + 1}-{enginePageEndIndex} of {filteredEngines.length} matching engines ({engineRows.length} loaded)</>
              ) : (
                <>Showing {enginePageStartIndex + 1}-{enginePageEndIndex} of {engineRows.length} loaded engines</>
              )}
            </span>
            <div className="button-row compact engine-pagination-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setEnginePage((page) => Math.max(1, page - 1))}
                disabled={currentEnginePage <= 1}
              >
                Previous
              </button>
              <span>Page {currentEnginePage} of {enginePageCount}</span>
              <button
                type="button"
                className="secondary"
                onClick={() => setEnginePage((page) => Math.min(enginePageCount, page + 1))}
                disabled={currentEnginePage >= enginePageCount}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
        {registry.loading ? <LoadingBlock text="Loading engines..." /> : registry.error ? (
          <ErrorBlock text="Could not load engine registry" />
        ) : engineRows.length === 0 ? (
          <EmptyBlock text="No engines returned from registry." />
        ) : filteredEngines.length === 0 ? (
          <EmptyBlock text="No engines match this filter." />
        ) : (
          <>
            <div className="engine-card-list">
              {visibleEngines.map((row, index) => {
                const engineKey = engineKeyOf(row) || `engine-${enginePageStartIndex + index}`;
                const enabled = engineEnabled(row);
                const lastRunStatus = engineLastRunField(row, ["lastRunStatus", "runStatus", "status", "last_run_status"]);
                const lastRunSummary = engineLastRunField(row, ["lastRunSummary", "summary", "message", "last_run_summary"]);
                const lastRunAt = engineLastRunField(row, ["lastRunAt", "last_run_at", "finishedAt", "finished_at", "startedAt", "started_at", "createdAt", "created_at"]);

                return (
                  <article className="item-card engine-card" key={engineKey}>
                    <div className="approval-card-head engine-card-head">
                      <div className="approval-title-block">
                        <strong>{formatEmpty(engineNameOf(row))}</strong>
                        <span>{formatEmpty(engineKey)}</span>
                      </div>
                      <div className="badge-row approval-badges engine-badges">
                        <StatusBadge value={engineCategoryOf(row) || "UNCATEGORIZED"} />
                        <StatusBadge value={engineField(row, ["riskLevel", "risk_level", "risk"]) ?? "LOW"} />
                        <StatusBadge value={enabled ? "ENABLED" : "DISABLED"} />
                        {engineShadowMode(row) ? <StatusBadge value="SHADOW" /> : null}
                        {engineRequiresApproval(row) ? <StatusBadge value="APPROVAL_REQUIRED" /> : null}
                      </div>
                    </div>
                    <div className="detail-grid engine-detail-grid">
                      <MetricRow label="Category" value={formatEmpty(engineCategoryOf(row))} />
                      <MetricRow label="Subcategory" value={formatEmpty(engineField(row, ["subcategory", "subCategory", "sub_category"]))} />
                      <MetricRow label="Rule Template" value={formatEmpty(engineField(row, ["ruleTemplate", "rule_template"]))} />
                      <MetricRow label="Output Action Type" value={formatEmpty(engineField(row, ["outputActionType", "actionType", "output_action_type"]))} />
                      <MetricRow label="Cost Level" value={<StatusBadge value={engineField(row, ["costLevel", "cost_level"]) ?? "LOW"} />} />
                      <MetricRow label="Priority Score" value={formatEmpty(engineField(row, ["priorityScore", "priority_score", "priority", "score"]))} />
                      <MetricRow label="Last Run Status" value={<StatusBadge value={lastRunStatus ?? "NOT_RUN"} />} />
                      <MetricRow label="Last Run At" value={formatLocalDateTime(lastRunAt)} />
                    </div>
                    <p className="section-note engine-run-summary">{formatEmpty(lastRunSummary)}</p>
                    <div className="button-row compact">
                      <button type="button" onClick={() => runEnginePreview(engineKey)} disabled={controlsDisabled || !engineKey}>
                        {runningEngineKey === engineKey ? "Running..." : "Run Preview"}
                      </button>
                      <button type="button" className="secondary" onClick={() => toggleEngine(row)} disabled={controlsDisabled || !engineKey}>
                        {togglingEngineKey === engineKey ? "Saving..." : enabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <div className="engine-section-grid">
        <Card
          title="Daily Plan"
          action={(
            <div className="button-row compact">
              <button type="button" className="secondary" onClick={dailyPlan.reload} disabled={controlsDisabled}>Refresh Daily Plan</button>
              <button type="button" onClick={runDailyPreview} disabled={controlsDisabled}>
                {runningDaily ? "Running..." : "Run Daily Preview"}
              </button>
            </div>
          )}
        >
          <p className="section-note">Engines do not directly change Amazon. They create approval items in Approval Center.</p>
          {dailyPlan.loading ? <LoadingBlock text="Loading daily plan..." /> : dailyPlan.error ? (
            <ErrorBlock text="Loading daily plan failed." />
          ) : dailyPlanRows.length === 0 ? (
            <EmptyBlock text="No daily plan engines returned." />
          ) : (
            <div className="table-wrap engine-table">
              <table>
                <thead>
                  <tr>
                    <th>Engine</th>
                    <th>Priority</th>
                    <th>Risk</th>
                    <th>Category</th>
                    <th>Last Run</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyPlanRows.map((row, index) => (
                    <tr key={engineKeyOf(row) || index}>
                      <td className="product-name-cell">
                        <strong>{formatEmpty(engineNameOf(row))}</strong>
                        <span className="engine-key-line">{formatEmpty(engineKeyOf(row))}</span>
                      </td>
                      <td>{formatEmpty(engineField(row, ["priorityScore", "priority_score", "priority", "score"]))}</td>
                      <td><StatusBadge value={engineField(row, ["riskLevel", "risk_level", "risk"]) ?? "LOW"} /></td>
                      <td>{formatEmpty(engineCategoryOf(row))}</td>
                      <td><StatusBadge value={engineLastRunField(row, ["lastRunStatus", "runStatus", "status", "last_run_status"]) ?? "NOT_RUN"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Recent Run Logs">
          {runLogs.loading ? <LoadingBlock text="Loading run logs..." /> : runLogs.error ? (
            <ErrorBlock text="Loading run logs failed." />
          ) : logRows.length === 0 ? (
            <EmptyBlock text="No engine run logs yet." />
          ) : (
            <div className="table-wrap engine-table engine-log-table">
              <table>
                <thead>
                  <tr>
                    <th>Engine Key</th>
                    <th>Status</th>
                    <th>Run Type</th>
                    <th>Actions</th>
                    <th>Error</th>
                    <th>Started</th>
                    <th>Finished</th>
                  </tr>
                </thead>
                <tbody>
                  {logRows.map((row, index) => (
                    <tr key={String(runLogField(row, ["id", "runId", "run_id"]) ?? `${runLogField(row, ["engineKey", "engine_key"]) ?? "run"}-${index}`)}>
                      <td className="identity-cell">{formatEmpty(runLogField(row, ["engineKey", "engine_key"]))}</td>
                      <td><StatusBadge value={runLogField(row, ["runStatus", "run_status", "status"])} /></td>
                      <td>{formatEmpty(runLogField(row, ["runType", "run_type"]))}</td>
                      <td>{formatEmpty(runLogField(row, ["actionsCreatedCount", "actions_created_count", "actionsCreated"]))}</td>
                      <td>{formatEmpty(runLogField(row, ["errorMessage", "error_message"]))}</td>
                      <td>{formatLocalDateTime(runLogField(row, ["startedAt", "started_at"]))}</td>
                      <td>{formatLocalDateTime(runLogField(row, ["finishedAt", "finished_at"]))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

type ApprovalFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "MONITORING" | "COMPLETED";
type LedgerAction = "approve" | "reject" | "monitor" | "complete";
type BatchLedgerAction = "reject" | "monitor" | "complete";
type QuickViewFilter = "ALL" | "NEEDS_COST_DATA" | "ACCOUNT_RISK" | "PPC_GUARDRAILS" | "PROFIT_BAND_APPROVALS" | "HIGH_RISK_ONLY" | "FOUNDER_OVERRIDE";
type ApprovalSortMode = "PRIORITY_FIRST" | "NEWEST_FIRST" | "OLDEST_FIRST" | "RISK_HIGH_FIRST";
type WorkflowEvent = AnyRecord;
type WorkflowHistory = {
  actionId: string;
  currentState: string;
  currentApprovalStatus: string;
  events: WorkflowEvent[];
};
type RollbackPreview = {
  canRollback: boolean;
  message: string;
  rollbackSnapshot?: unknown;
};
type RollbackPreviewState = {
  data: RollbackPreview | null;
  loading: boolean;
  error: string | null;
};
type WorkflowPanelState = {
  open: boolean;
  data: WorkflowHistory | null;
  loading: boolean;
  error: string | null;
  rollback: RollbackPreviewState;
};
type BatchActionResult = {
  updatedCount?: number | string | null;
  skippedCount?: number | string | null;
  result?: {
    updatedCount?: number | string | null;
    skippedCount?: number | string | null;
  } | null;
};

const approvalFilters: ApprovalFilter[] = ["ALL", "PENDING", "APPROVED", "REJECTED", "MONITORING", "COMPLETED"];
const defaultSourceFilters = ["ALL SOURCES", "CEO_REPORT", "PRODUCT_ECONOMICS", "PPC_RECOMMENDATIONS"];
const defaultActionTypeFilters = [
  "ALL ACTION TYPES",
  "COST_DATA_REQUIRED",
  "ACCOUNT_HEALTH_REVIEW",
  "PPC_GUARDRAIL_REVIEW",
  "PROFIT_BAND_APPROVAL",
  "ADD_EXACT_KEYWORD_AFTER_APPROVAL",
  "ADD_PRODUCT_TARGET_AFTER_APPROVAL",
  "CHECK_LISTING_BEFORE_NEGATIVE"
];
const quickViewFilters: Array<{ id: QuickViewFilter; label: string }> = [
  { id: "ALL", label: "All Review" },
  { id: "NEEDS_COST_DATA", label: "Needs Cost Data" },
  { id: "ACCOUNT_RISK", label: "Account Risk" },
  { id: "PPC_GUARDRAILS", label: "PPC Guardrails" },
  { id: "PROFIT_BAND_APPROVALS", label: "Profit Band Approvals" },
  { id: "HIGH_RISK_ONLY", label: "High Risk Only" },
  { id: "FOUNDER_OVERRIDE", label: "Founder Override" }
];
const approvalSortOptions = ["Priority First", "Newest First", "Oldest First", "Risk High First"];
const APPROVAL_PAGE_SIZE = 25;
const ACTION_LEDGER_FETCH_LIMIT = 200;
const workflowEventLabels: Record<string, string> = {
  INITIAL_STATE_CAPTURE: "Initial state captured",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  MOVED_TO_MONITORING: "Moved to monitoring",
  COMPLETED: "Completed",
  BATCH_REJECTED: "Batch rejected",
  BATCH_MONITORING: "Batch moved to monitoring",
  BATCH_COMPLETED: "Batch completed",
  COST_DATA_COMPLETED_AUTO_RESOLVE: "Cost data completed automatically",
  REOPEN: "Reopened"
};

const emptyRollbackPreviewState = (): RollbackPreviewState => ({ data: null, loading: false, error: null });

function normalizeState(value: unknown): string {
  return String(value ?? "").toUpperCase();
}

function recordsOf(value: unknown): AnyRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is AnyRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  }
  return rowsOf<AnyRecord>(value);
}

function readBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "yes", "1", "y"].includes(normalized);
}

function formatLocalDateTime(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return formatEmpty(value);
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return raw;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function formatWorkflowEventType(value: unknown): string {
  const eventType = normalizeState(value);
  if (!eventType) return "Unknown event";
  return workflowEventLabels[eventType] ?? labelize(eventType);
}

function workflowHistoryOf(value: unknown, row: ActionLedgerRow): WorkflowHistory {
  const root = recordOf(value);
  const workflow = recordOf(root.workflow ?? root.data ?? root.result ?? root);
  const action = recordOf(workflow.action ?? workflow.actionLedger ?? workflow.row ?? root.action ?? root.actionLedger);
  const eventSource = workflow.events ?? workflow.auditEvents ?? workflow.history ?? root.events ?? root.auditEvents ?? root.history;

  return {
    actionId: String(workflow.actionId ?? workflow.id ?? action.id ?? row.id),
    currentState: String(workflow.currentState ?? workflow.state ?? action.state ?? row.state ?? "UNKNOWN"),
    currentApprovalStatus: String(
      workflow.currentApprovalStatus ?? workflow.approvalStatus ?? action.approvalStatus ?? row.approvalStatus ?? "UNKNOWN"
    ),
    events: recordsOf(eventSource)
  };
}

function rollbackPreviewOf(value: unknown): RollbackPreview {
  const root = recordOf(value);
  const preview = recordOf(root.preview ?? root.rollbackPreview ?? root.data ?? root.result ?? root);
  const rollback = recordOf(preview.rollback);
  const rollbackSnapshot =
    preview.rollbackSnapshot ??
    preview.rollback_snapshot ??
    preview.snapshot ??
    preview.snapshotBefore ??
    preview.restoreSnapshot ??
    rollback.snapshot;
  const canRollback = readBoolean(preview.canRollback ?? preview.allowed ?? preview.rollbackAllowed);

  return {
    canRollback,
    message: String(preview.message ?? root.message ?? (canRollback ? "Rollback preview is available." : "Rollback is not available.")),
    rollbackSnapshot
  };
}

function canReopenAction(row: ActionLedgerRow): boolean {
  const approvalStatus = normalizeState(row.approvalStatus);
  return approvalStatus === "REJECTED" || isCompletedAction(row);
}

function workflowEventField(event: WorkflowEvent, keys: string[]): unknown {
  for (const key of keys) {
    if (event[key] !== undefined && event[key] !== null && event[key] !== "") return event[key];
  }
  return undefined;
}

function workflowEventHasSnapshot(event: WorkflowEvent): boolean {
  return workflowEventField(event, ["snapshotBefore", "snapshot_before"]) !== undefined
    || workflowEventField(event, ["snapshotAfter", "snapshot_after"]) !== undefined;
}

function uniqueSortedValues(rows: ActionLedgerRow[], field: keyof ActionLedgerRow): string[] {
  return Array.from(
    new Set(rows.map((row) => String(row[field] ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

function isMonitoringAction(row: ActionLedgerRow): boolean {
  return ["MONITOR", "MONITORING"].includes(normalizeState(row.state));
}

function isCompletedAction(row: ActionLedgerRow): boolean {
  return ["COMPLETED", "COMPLETED_MANUALLY"].includes(normalizeState(row.state));
}

function isPendingBatchAction(row: ActionLedgerRow): boolean {
  return normalizeState(row.approvalStatus) === "PENDING" && !isMonitoringAction(row) && !isCompletedAction(row);
}

function isSelectableBatchAction(row: ActionLedgerRow): boolean {
  const approvalStatus = normalizeState(row.approvalStatus);
  if (isCompletedAction(row) || approvalStatus === "APPROVED" || approvalStatus === "REJECTED") return false;
  return isPendingBatchAction(row) || isMonitoringAction(row);
}

function filterActionLedgerRows(rows: ActionLedgerRow[], filter: ApprovalFilter): ActionLedgerRow[] {
  if (filter === "ALL") return rows;
  if (filter === "PENDING") return rows.filter((row) => normalizeState(row.approvalStatus) === "PENDING");
  if (filter === "APPROVED") return rows.filter((row) => normalizeState(row.approvalStatus) === "APPROVED");
  if (filter === "REJECTED") return rows.filter((row) => normalizeState(row.approvalStatus) === "REJECTED");
  if (filter === "MONITORING") return rows.filter(isMonitoringAction);
  return rows.filter(isCompletedAction);
}

function filterByQuickView(rows: ActionLedgerRow[], quickView: QuickViewFilter): ActionLedgerRow[] {
  if (quickView === "ALL") return rows;
  if (quickView === "NEEDS_COST_DATA") return rows.filter((row) => normalizeState(row.actionType) === "COST_DATA_REQUIRED");
  if (quickView === "ACCOUNT_RISK") return rows.filter((row) => normalizeState(row.actionType) === "ACCOUNT_HEALTH_REVIEW");
  if (quickView === "PPC_GUARDRAILS") {
    return rows.filter((row) => normalizeState(row.actionType).includes("PPC") || normalizeState(row.source) === "PPC_RECOMMENDATIONS");
  }
  if (quickView === "PROFIT_BAND_APPROVALS") return rows.filter((row) => normalizeState(row.actionType) === "PROFIT_BAND_APPROVAL");
  if (quickView === "HIGH_RISK_ONLY") return rows.filter((row) => ["HIGH", "CRITICAL"].includes(normalizeState(row.riskLevel)));
  return rows.filter((row) => normalizeState(row.approvalTier) === "FOUNDER_OVERRIDE");
}

function filterBySearch(rows: ActionLedgerRow[], query: string): ActionLedgerRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return rows;
  return rows.filter((row) => [
    row.title,
    row.summary,
    row.recommendedAction,
    row.sku,
    row.asin,
    row.actionType,
    row.source,
    row.entityId,
    row.id,
    formatShortId(row.id)
  ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery)));
}

function actionRiskPriority(row: ActionLedgerRow): number {
  const riskLevel = normalizeState(row.riskLevel);
  if (riskLevel === "CRITICAL") return 0;
  if (riskLevel === "HIGH") return 1;
  return 2;
}

function actionTierPriority(row: ActionLedgerRow): number {
  return normalizeState(row.approvalTier).includes("FOUNDER_OVERRIDE") ? 0 : 1;
}

function actionSourcePriority(row: ActionLedgerRow): number {
  const source = normalizeState(row.source);
  if (source === "CEO_REPORT") return 0;
  if (source === "PRODUCT_ECONOMICS") return 1;
  if (source === "PPC_RECOMMENDATIONS") return 2;
  return 3;
}

function actionCreatedAtValue(row: ActionLedgerRow): number {
  const parsed = Date.parse(String(row.createdAt ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortActionLedgerRowsByPriority(rows: ActionLedgerRow[]): ActionLedgerRow[] {
  return [...rows].sort((a, b) => (
    actionRiskPriority(a) - actionRiskPriority(b)
    || actionTierPriority(a) - actionTierPriority(b)
    || actionSourcePriority(a) - actionSourcePriority(b)
    || actionCreatedAtValue(b) - actionCreatedAtValue(a)
    || String(a.id).localeCompare(String(b.id))
  ));
}

function sortActionLedgerRows(rows: ActionLedgerRow[], sortMode: ApprovalSortMode): ActionLedgerRow[] {
  if (sortMode === "NEWEST_FIRST") return [...rows].sort((a, b) => actionCreatedAtValue(b) - actionCreatedAtValue(a) || String(a.id).localeCompare(String(b.id)));
  if (sortMode === "OLDEST_FIRST") return [...rows].sort((a, b) => actionCreatedAtValue(a) - actionCreatedAtValue(b) || String(a.id).localeCompare(String(b.id)));
  if (sortMode === "RISK_HIGH_FIRST") return [...rows].sort((a, b) => actionRiskPriority(a) - actionRiskPriority(b) || actionCreatedAtValue(b) - actionCreatedAtValue(a) || String(a.id).localeCompare(String(b.id)));
  return sortActionLedgerRowsByPriority(rows);
}

function sortModeFromLabel(label: string): ApprovalSortMode {
  if (label === "Newest First") return "NEWEST_FIRST";
  if (label === "Oldest First") return "OLDEST_FIRST";
  if (label === "Risk High First") return "RISK_HIGH_FIRST";
  return "PRIORITY_FIRST";
}

function labelFromSortMode(sortMode: ApprovalSortMode): string {
  if (sortMode === "NEWEST_FIRST") return "Newest First";
  if (sortMode === "OLDEST_FIRST") return "Oldest First";
  if (sortMode === "RISK_HIGH_FIRST") return "Risk High First";
  return "Priority First";
}

async function fetchActionLedgerData(): Promise<{ summary: ActionLedgerSummary; rows: ActionLedgerRow[] }> {
  const [summaryResponse, rowsResponse] = await Promise.all([
    getJson<AnyRecord>(`/api/action-ledger/summary?sellerId=${SELLER_ID}`),
    getJson<unknown>(`/api/action-ledger?sellerId=${SELLER_ID}&limit=${ACTION_LEDGER_FETCH_LIMIT}`)
  ]);
  const summaryRoot = recordOf(summaryResponse);
  return {
    summary: recordOf(summaryRoot.summary ?? summaryRoot) as ActionLedgerSummary,
    rows: actionLedgerRowsOf(rowsResponse)
  };
}

function formatBatchCounts(value: unknown): string {
  const root = recordOf(value);
  const nested = recordOf(root.result);
  const updatedCount = readNumber(root.updatedCount ?? nested.updatedCount);
  const skippedCount = readNumber(root.skippedCount ?? nested.skippedCount);
  return `Updated ${updatedCount}, skipped ${skippedCount}.`;
}

function WorkflowHistoryPanel({
  row,
  panel,
  onRollbackPreview,
  onReopen,
  disabled,
  reopening
}: {
  row: ActionLedgerRow;
  panel: WorkflowPanelState;
  onRollbackPreview: (row: ActionLedgerRow) => void;
  onReopen: (row: ActionLedgerRow) => void;
  disabled: boolean;
  reopening: boolean;
}) {
  const data = panel.data;
  const rollback = panel.rollback;
  const snapshot = rollback.data?.rollbackSnapshot;
  const hasRollbackSnapshot = snapshot !== undefined && snapshot !== null && snapshot !== "";

  return (
    <section className="workflow-panel" aria-label={`Workflow history for action ${formatShortId(row.id)}`}>
      <div className="workflow-panel-head">
        <div>
          <h3>Workflow History</h3>
          <span>Action {formatShortId(data?.actionId ?? row.id)}</span>
        </div>
        <div className="button-row compact workflow-panel-actions">
          <button type="button" className="secondary tiny-button" onClick={() => onRollbackPreview(row)} disabled={disabled || rollback.loading}>
            Rollback Preview
          </button>
          {canReopenAction(row) ? (
            <button type="button" className="secondary tiny-button" onClick={() => onReopen(row)} disabled={disabled}>
              {reopening ? "Reopening..." : "Reopen"}
            </button>
          ) : null}
        </div>
      </div>

      {panel.loading ? (
        <div className="soft-state compact-state">Loading workflow history...</div>
      ) : panel.error ? (
        <div className="soft-state error-state compact-state">Could not load workflow history.</div>
      ) : data ? (
        <>
          <div className="workflow-status-row">
            <MetricRow label="Current State" value={<StatusBadge value={data.currentState} />} />
            <MetricRow label="Approval Status" value={<StatusBadge value={data.currentApprovalStatus} />} />
          </div>
          {data.events.length === 0 ? (
            <div className="soft-state compact-state">No workflow events yet.</div>
          ) : (
            <ol className="workflow-timeline">
              {data.events.map((event, index) => {
                const eventType = workflowEventField(event, ["eventType", "event_type", "type"]);
                const createdAt = workflowEventField(event, ["createdAt", "created_at", "timestamp", "time"]);
                const fromState = workflowEventField(event, ["fromState", "from_state", "previousState", "from"]);
                const toState = workflowEventField(event, ["toState", "to_state", "nextState", "to"]);
                const actor = workflowEventField(event, ["actor", "actorType", "createdBy", "created_by", "user"]);
                const note = workflowEventField(event, ["note", "message", "reason"]);

                return (
                  <li key={String(event.id ?? `${row.id}-${index}`)} className="workflow-event">
                    <div className="workflow-event-main">
                      <span className="workflow-event-date">{formatLocalDateTime(createdAt)}</span>
                      <strong>{formatWorkflowEventType(eventType)}</strong>
                    </div>
                    <div className="workflow-event-meta">
                      <span>{formatEmpty(fromState)} to {formatEmpty(toState)}</span>
                      <span>Actor: {formatEmpty(actor)}</span>
                      {workflowEventHasSnapshot(event) ? <span className="snapshot-pill">Snapshot available</span> : null}
                    </div>
                    {note ? <p>{formatEmpty(note)}</p> : null}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : null}

      {rollback.loading ? <div className="soft-state compact-state">Loading rollback preview...</div> : null}
      {rollback.error ? <div className="soft-state error-state compact-state">{rollback.error}</div> : null}
      {rollback.data ? (
        <div className="rollback-preview">
          <MetricRow label="Can Rollback" value={rollback.data.canRollback ? "Yes" : "No"} />
          <MetricRow label="Message" value={rollback.data.message} />
          {hasRollbackSnapshot ? (
            <pre>{JSON.stringify(snapshot, null, 2)}</pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ActionLedgerCard({
  row,
  selected,
  processing,
  batchProcessing,
  workflowPanel,
  reopening,
  actionsDisabled,
  onAction,
  onCopy,
  onToggleSelected,
  onToggleWorkflow,
  onRollbackPreview,
  onReopen
}: {
  row: ActionLedgerRow;
  selected: boolean;
  processing: { id: string; action: LedgerAction } | null;
  batchProcessing: BatchLedgerAction | "daily-priorities" | "dismiss-low-priority" | null;
  workflowPanel?: WorkflowPanelState;
  reopening: boolean;
  actionsDisabled: boolean;
  onAction: (row: ActionLedgerRow, action: LedgerAction) => void;
  onCopy: (id: string) => void;
  onToggleSelected: (row: ActionLedgerRow) => void;
  onToggleWorkflow: (row: ActionLedgerRow) => void;
  onRollbackPreview: (row: ActionLedgerRow) => void;
  onReopen: (row: ActionLedgerRow) => void;
}) {
  const approvalStatus = normalizeState(row.approvalStatus);
  const completed = isCompletedAction(row);
  const monitoring = isMonitoringAction(row);
  const selectable = isSelectableBatchAction(row);
  const buttonDisabled = Boolean(processing || batchProcessing || actionsDisabled);
  const showProductThumbnail = hasProductContext(row);
  const imageDebugFields = productImageDebugFields(row);
  const importantFields: Array<[string, ReactNode]> = [
    ["Recommended Action", formatEmpty(row.recommendedAction)],
    ["SKU", formatEmpty(row.sku)],
    ["ASIN", formatEmpty(row.asin)],
    ["Entity", `${formatEmpty(row.entityType)} / ${formatEmpty(row.entityId)}`],
    ["Created At", formatEmpty(row.createdAt)]
  ];
  const detailFields: Array<[string, ReactNode]> = [
    ["Full Action ID", row.id],
    ["Confidence", <StatusBadge key="confidence-label" value={row.confidenceLabel ?? "LOW"} />],
    ["Approval Tier", formatEmpty(row.approvalTier)],
    ["State", <StatusBadge key="state" value={row.state ?? "UNKNOWN"} />],
    ["Source", formatEmpty(row.source)],
    ["Action Type", formatEmpty(row.actionType)]
  ];

  let footer: ReactNode = null;
  if (completed) {
    footer = <p className="approval-status-note">Completed manually.</p>;
  } else if (approvalStatus === "REJECTED") {
    footer = <p className="approval-status-note">Rejected. No action executed.</p>;
  } else if (monitoring) {
    footer = (
      <div className="button-row compact">
        <button type="button" onClick={() => onAction(row, "complete")} disabled={buttonDisabled}>
          {processing?.id === row.id && processing.action === "complete" ? "Completing..." : "Complete"}
        </button>
      </div>
    );
  } else if (approvalStatus === "APPROVED") {
    footer = <p className="approval-status-note">Approved in shadow mode. No external action executed.</p>;
  } else if (approvalStatus === "PENDING") {
    footer = (
      <div className="button-row compact">
        <button type="button" onClick={() => onAction(row, "approve")} disabled={buttonDisabled}>
          {processing?.id === row.id && processing.action === "approve" ? "Approving..." : "Approve"}
        </button>
        <button type="button" onClick={() => onAction(row, "reject")} disabled={buttonDisabled}>
          {processing?.id === row.id && processing.action === "reject" ? "Rejecting..." : "Reject"}
        </button>
        <button type="button" onClick={() => onAction(row, "monitor")} disabled={buttonDisabled}>
          {processing?.id === row.id && processing.action === "monitor" ? "Moving..." : "Monitor"}
        </button>
      </div>
    );
  }

  return (
    <article className={`item-card action-ledger-card ${selected ? "selected" : ""}`}>
      <div className="approval-card-head">
        <div className="approval-card-title-row">
          {selectable ? (
            <label className="batch-checkbox" aria-label={`Select action ${formatShortId(row.id)}`}>
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelected(row)}
                disabled={buttonDisabled}
              />
            </label>
          ) : null}
          {showProductThumbnail ? <ProductThumb product={row} className="action-ledger-thumb" variant="small" /> : null}
          <div className="approval-title-block">
            <strong>{formatEmpty(row.title)}</strong>
            <span>Action ID {formatShortId(row.id)}</span>
          </div>
        </div>
        <div className="badge-row approval-badges">
          <StatusBadge value={row.source ?? "UNKNOWN_SOURCE"} />
          <StatusBadge value={row.actionType ?? "UNKNOWN_ACTION"} />
          <StatusBadge value={row.riskLevel ?? "LOW"} />
          <StatusBadge value={row.approvalStatus ?? row.state ?? "PENDING"} />
        </div>
      </div>
      <p className="approval-summary-text">{formatEmpty(row.summary)}</p>
      <div className="approval-id-row">
        <span>{formatEmpty(row.source)} priority review</span>
        <div className="approval-id-actions">
          <button type="button" className="secondary tiny-button" onClick={() => onCopy(row.id)} disabled={buttonDisabled}>Copy ID</button>
          <button
            type="button"
            className="secondary tiny-button"
            onClick={() => onToggleWorkflow(row)}
            disabled={buttonDisabled}
            aria-expanded={Boolean(workflowPanel?.open)}
          >
            Workflow History
          </button>
        </div>
      </div>
      <div className="detail-grid approval-detail-grid">
        {importantFields.map(([label, value]) => (
          <MetricRow key={label} label={label} value={value} />
        ))}
      </div>
      <details className="approval-more-details">
        <summary>More details</summary>
        <div className="detail-grid approval-detail-grid">
          {detailFields.map(([label, value]) => (
            <MetricRow key={label} label={label} value={value} />
          ))}
          {imageDebugFields.map(([label, value]) => (
            <MetricRow key={label} label={label} value={value} />
          ))}
        </div>
        <ProductImageDebug product={row} compact />
      </details>
      {footer}
      {workflowPanel?.open ? (
        <WorkflowHistoryPanel
          row={row}
          panel={workflowPanel}
          onRollbackPreview={onRollbackPreview}
          onReopen={onReopen}
          disabled={buttonDisabled}
          reopening={reopening}
        />
      ) : null}
    </article>
  );
}

function ApprovalCenterPage() {
  const [activeFilter, setActiveFilter] = useState<ApprovalFilter>("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL SOURCES");
  const [actionTypeFilter, setActionTypeFilter] = useState("ALL ACTION TYPES");
  const [quickView, setQuickView] = useState<QuickViewFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<ApprovalSortMode>("PRIORITY_FIRST");
  const [page, setPage] = useState(1);
  const [processing, setProcessing] = useState<{ id: string; action: LedgerAction } | null>(null);
  const [batchProcessing, setBatchProcessing] = useState<BatchLedgerAction | "daily-priorities" | "dismiss-low-priority" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [dailyPriorityRows, setDailyPriorityRows] = useState<ActionLedgerRow[] | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [summaryState, setSummaryState] = useState<LoadState<ActionLedgerSummary>>(emptyState<ActionLedgerSummary>());
  const [rowsState, setRowsState] = useState<LoadState<ActionLedgerRow[]>>(emptyState<ActionLedgerRow[]>());
  const [workflowPanels, setWorkflowPanels] = useState<Record<string, WorkflowPanelState>>({});
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  async function refreshApprovalData(): Promise<{ summary: ActionLedgerSummary; rows: ActionLedgerRow[] }> {
    setSummaryState((current) => ({ ...current, loading: true, error: null }));
    setRowsState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await fetchActionLedgerData();
      setSummaryState({ data: data.summary, loading: false, error: null });
      setRowsState({ data: data.rows, loading: false, error: null });
      return data;
    } catch (error) {
      const safeMessage = sanitizeActionError(error);
      setSummaryState({ data: null, loading: false, error: safeMessage });
      setRowsState({ data: null, loading: false, error: safeMessage });
      throw error;
    }
  }

  useEffect(() => {
    let alive = true;
    setSummaryState((current) => ({ ...current, loading: true, error: null }));
    setRowsState((current) => ({ ...current, loading: true, error: null }));

    fetchActionLedgerData()
      .then((data) => {
        if (!alive) return;
        setSummaryState({ data: data.summary, loading: false, error: null });
        setRowsState({ data: data.rows, loading: false, error: null });
      })
      .catch((error) => {
        if (!alive) return;
        const safeMessage = sanitizeActionError(error);
        setSummaryState({ data: null, loading: false, error: safeMessage });
        setRowsState({ data: null, loading: false, error: safeMessage });
      });

    return () => {
      alive = false;
    };
  }, []);

  const loadedRows = rowsState.data ?? [];
  const allRows = dailyPriorityRows ?? loadedRows;
  const sourceOptions = useMemo(() => (
    Array.from(new Set([...defaultSourceFilters, ...uniqueSortedValues(loadedRows, "source")]))
  ), [loadedRows]);
  const actionTypeOptions = useMemo(() => (
    Array.from(new Set([...defaultActionTypeFilters, ...uniqueSortedValues(loadedRows, "actionType")]))
  ), [loadedRows]);
  const rows = useMemo(() => {
    const statusRows = filterActionLedgerRows(allRows, activeFilter);
    const sourceRows = sourceFilter === "ALL SOURCES"
      ? statusRows
      : statusRows.filter((row) => normalizeState(row.source) === normalizeState(sourceFilter));
    const actionTypeRows = actionTypeFilter === "ALL ACTION TYPES"
      ? sourceRows
      : sourceRows.filter((row) => normalizeState(row.actionType) === normalizeState(actionTypeFilter));
    const quickViewRows = filterByQuickView(actionTypeRows, quickView);
    return sortActionLedgerRows(filterBySearch(quickViewRows, searchQuery), sortMode);
  }, [allRows, activeFilter, sourceFilter, actionTypeFilter, quickView, searchQuery, sortMode]);
  const totalPages = Math.max(1, Math.ceil(rows.length / APPROVAL_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStartIndex = rows.length === 0 ? 0 : (safePage - 1) * APPROVAL_PAGE_SIZE;
  const pageRows = rows.slice(pageStartIndex, pageStartIndex + APPROVAL_PAGE_SIZE);
  const showingStart = rows.length === 0 ? 0 : pageStartIndex + 1;
  const showingEnd = rows.length === 0 ? 0 : pageStartIndex + pageRows.length;
  const selectedRows = useMemo(() => (
    allRows.filter((row) => selectedIds.has(row.id) && isSelectableBatchAction(row))
  ), [allRows, selectedIds]);
  const selectedCount = selectedRows.length;
  const selectedPendingOnly = selectedCount > 0 && selectedRows.every(isPendingBatchAction);
  const selectedMonitoringOnly = selectedCount > 0 && selectedRows.every(isMonitoringAction);
  const hasSelectablePageRows = pageRows.some(isSelectableBatchAction);
  const costDataDismissVisible = quickView === "NEEDS_COST_DATA" || normalizeState(actionTypeFilter) === "COST_DATA_REQUIRED";
  const controlsDisabled = Boolean(processing || batchProcessing || reopeningId);
  const summaryData = summaryState.data ?? {};
  const loading = rowsState.loading || summaryState.loading;
  const loadError = rowsState.error ?? summaryState.error;
  const summaryCounts = {
    pending: readNumber(summaryData.pendingCount),
    approved: readNumber(summaryData.approvedCount),
    rejected: readNumber(summaryData.rejectedCount),
    monitoring: readNumber(summaryData.monitoringCount),
    completed: readNumber(summaryData.completedCount),
    highRisk: readNumber(summaryData.highRiskCount),
    founderOverride: readNumber(summaryData.founderOverrideCount)
  };

  useEffect(() => {
    setSelectedIds((current) => {
      const allowedIds = new Set(rows.filter(isSelectableBatchAction).map((row) => row.id));
      const next = new Set(Array.from(current).filter((id) => allowedIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [rows]);

  function resetPagedView() {
    setPage(1);
  }

  function resetPagedViewAndSelection() {
    resetPagedView();
    setSelectedIds(new Set());
  }

  function toggleSelectedRow(row: ActionLedgerRow) {
    if (!isSelectableBatchAction(row)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
  }

  function selectCurrentPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      pageRows.filter(isSelectableBatchAction).forEach((row) => next.add(row.id));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function syncDailyPriorityRows(refreshedRows: ActionLedgerRow[]) {
    setDailyPriorityRows((current) => {
      if (!current) return current;
      const rowsById = new Map(refreshedRows.map((row) => [row.id, row]));
      return current.map((row) => rowsById.get(row.id) ?? row);
    });
  }

  async function refreshDailyPriorityRows(refreshedRows: ActionLedgerRow[]) {
    if (!dailyPriorityRows) return;
    try {
      const response = await getJson<unknown>(`/api/action-ledger/daily-priorities?sellerId=${SELLER_ID}&limit=25`);
      setDailyPriorityRows(actionLedgerRowsOf(response));
    } catch {
      syncDailyPriorityRows(refreshedRows);
    }
  }

  async function fetchWorkflowPanel(row: ActionLedgerRow, preserveRollback = false) {
    const id = row.id;
    setWorkflowPanels((current) => {
      const existing = current[id];
      return {
        ...current,
        [id]: {
          open: true,
          data: existing?.data ?? null,
          loading: true,
          error: null,
          rollback: preserveRollback ? existing?.rollback ?? emptyRollbackPreviewState() : emptyRollbackPreviewState()
        }
      };
    });

    try {
      const response = await getJson<unknown>(`/api/action-ledger/${id}/workflow?sellerId=${SELLER_ID}`);
      const data = workflowHistoryOf(response, row);
      setWorkflowPanels((current) => {
        const existing = current[id];
        return {
          ...current,
          [id]: {
            open: true,
            data,
            loading: false,
            error: null,
            rollback: preserveRollback ? existing?.rollback ?? emptyRollbackPreviewState() : emptyRollbackPreviewState()
          }
        };
      });
    } catch (error) {
      setWorkflowPanels((current) => {
        const existing = current[id];
        return {
          ...current,
          [id]: {
            open: true,
            data: existing?.data ?? null,
            loading: false,
            error: sanitizeActionError(error),
            rollback: preserveRollback ? existing?.rollback ?? emptyRollbackPreviewState() : emptyRollbackPreviewState()
          }
        };
      });
    }
  }

  function toggleWorkflowPanel(row: ActionLedgerRow) {
    const current = workflowPanels[row.id];
    if (current?.open) {
      setWorkflowPanels((panels) => ({
        ...panels,
        [row.id]: { ...current, open: false }
      }));
      return;
    }
    void fetchWorkflowPanel(row);
  }

  async function loadRollbackPreview(row: ActionLedgerRow) {
    const id = row.id;
    setWorkflowPanels((current) => {
      const existing = current[id] ?? {
        open: true,
        data: null,
        loading: false,
        error: null,
        rollback: emptyRollbackPreviewState()
      };
      return {
        ...current,
        [id]: {
          ...existing,
          open: true,
          rollback: { data: null, loading: true, error: null }
        }
      };
    });

    try {
      const response = await getJson<unknown>(`/api/action-ledger/${id}/rollback-preview?sellerId=${SELLER_ID}`);
      const data = rollbackPreviewOf(response);
      setWorkflowPanels((current) => {
        const existing = current[id] ?? {
          open: true,
          data: null,
          loading: false,
          error: null,
          rollback: emptyRollbackPreviewState()
        };
        return {
          ...current,
          [id]: {
            ...existing,
            open: true,
            rollback: { data, loading: false, error: null }
          }
        };
      });
    } catch (error) {
      setWorkflowPanels((current) => {
        const existing = current[id] ?? {
          open: true,
          data: null,
          loading: false,
          error: null,
          rollback: emptyRollbackPreviewState()
        };
        return {
          ...current,
          [id]: {
            ...existing,
            open: true,
            rollback: {
              data: null,
              loading: false,
              error: `Could not load rollback preview: ${sanitizeActionError(error)}`
            }
          }
        };
      });
    }
  }

  async function copyActionId(id: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = id;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!copied) throw new Error("Clipboard copy was not available.");
      }
      setMessage({ type: "success", text: `Copied action ID ${formatShortId(id)} for debugging.` });
    } catch (error) {
      setMessage({ type: "error", text: `Copy failed: ${sanitizeActionError(error)}` });
    }
  }

  async function act(row: ActionLedgerRow, action: LedgerAction) {
    const id = row.id;
    const actions = {
      approve: {
        path: `/api/action-ledger/${id}/approve`,
        body: { note: "Approved from Approval Center", approvedBy: "founder" }
      },
      reject: {
        path: `/api/action-ledger/${id}/reject`,
        body: { note: "Rejected from Approval Center" }
      },
      monitor: {
        path: `/api/action-ledger/${id}/monitor`,
        body: { note: "Moved to monitoring from Approval Center" }
      },
      complete: {
        path: `/api/action-ledger/${id}/complete`,
        body: { note: "Completed from Approval Center" }
      }
    };
    setProcessing({ id, action });
    setMessage(null);
    try {
      await postJson(actions[action].path, actions[action].body);
      const refreshed = await refreshApprovalData();
      await refreshDailyPriorityRows(refreshed.rows);
      if (workflowPanels[id]?.open) {
        await fetchWorkflowPanel(refreshed.rows.find((refreshedRow) => refreshedRow.id === id) ?? row);
      }
      setMessage({ type: "success", text: `${labelize(action)} saved for action ${formatShortId(id)}.` });
    } catch (error) {
      setMessage({ type: "error", text: `Action failed: ${sanitizeActionError(error)}` });
    } finally {
      setProcessing(null);
    }
  }

  async function reopenAction(row: ActionLedgerRow) {
    if (!canReopenAction(row)) return;
    const confirmed = window.confirm("Reopen this action and move it back to Waiting for Approval?");
    if (!confirmed) return;

    const id = row.id;
    setReopeningId(id);
    setMessage(null);
    try {
      await postJson(`/api/action-ledger/${id}/reopen`, {
        sellerId: SELLER_ID,
        note: "Reopened from Approval Center",
        actor: "founder"
      });
      const refreshed = await refreshApprovalData();
      await refreshDailyPriorityRows(refreshed.rows);
      if (workflowPanels[id]?.open) {
        await fetchWorkflowPanel(refreshed.rows.find((refreshedRow) => refreshedRow.id === id) ?? row);
      }
      setMessage({ type: "success", text: `Action ${formatShortId(id)} reopened and moved back to Waiting for Approval.` });
    } catch (error) {
      setMessage({ type: "error", text: `Reopen failed: ${sanitizeActionError(error)}` });
    } finally {
      setReopeningId(null);
    }
  }

  async function batchAct(action: BatchLedgerAction) {
    const ids = selectedRows.map((row) => row.id);
    if (ids.length === 0) return;

    const actions: Record<BatchLedgerAction, { path: string; body: Record<string, unknown>; label: string }> = {
      reject: {
        path: "/api/action-ledger/batch/reject",
        body: {
          sellerId: SELLER_ID,
          ids,
          note: "Rejected in batch from Approval Center",
          rejectedBy: "founder"
        },
        label: "Batch reject"
      },
      monitor: {
        path: "/api/action-ledger/batch/monitor",
        body: {
          sellerId: SELLER_ID,
          ids,
          note: "Moved to monitoring in batch from Approval Center"
        },
        label: "Batch monitor"
      },
      complete: {
        path: "/api/action-ledger/batch/complete",
        body: {
          sellerId: SELLER_ID,
          ids,
          note: "Completed in batch from Approval Center"
        },
        label: "Batch complete"
      }
    };

    setBatchProcessing(action);
    setMessage(null);
    try {
      const response = await postJson<BatchActionResult>(actions[action].path, actions[action].body);
      setSelectedIds(new Set());
      const refreshed = await refreshApprovalData();
      await refreshDailyPriorityRows(refreshed.rows);
      setMessage({ type: "success", text: `${actions[action].label} finished. ${formatBatchCounts(response)}` });
    } catch (error) {
      setMessage({ type: "error", text: `${actions[action].label} failed: ${sanitizeActionError(error)}` });
    } finally {
      setBatchProcessing(null);
    }
  }

  async function loadDailyPriorities() {
    setBatchProcessing("daily-priorities");
    setMessage(null);
    try {
      const response = await getJson<unknown>(`/api/action-ledger/daily-priorities?sellerId=${SELLER_ID}&limit=25`);
      setDailyPriorityRows(actionLedgerRowsOf(response));
      setSelectedIds(new Set());
      resetPagedView();
      setMessage({ type: "success", text: "Daily Priorities Mode loaded." });
    } catch (error) {
      setMessage({ type: "error", text: `Daily priorities failed: ${sanitizeActionError(error)}` });
    } finally {
      setBatchProcessing(null);
    }
  }

  function clearDailyPriorities() {
    setDailyPriorityRows(null);
    setSelectedIds(new Set());
    resetPagedView();
  }

  async function dismissLowPriorityCostActions() {
    const confirmed = window.confirm(
      "This will reject low-priority pending cost-data actions only. High-risk and Founder Override actions will not be dismissed. Continue?"
    );
    if (!confirmed) return;

    setBatchProcessing("dismiss-low-priority");
    setMessage(null);
    try {
      const response = await postJson<BatchActionResult>("/api/action-ledger/batch/dismiss-low-priority", {
        sellerId: SELLER_ID,
        source: "PRODUCT_ECONOMICS",
        actionType: "COST_DATA_REQUIRED",
        limit: 50,
        note: "Dismissed low-priority duplicate cost-data actions from Approval Center"
      });
      setSelectedIds(new Set());
      const refreshed = await refreshApprovalData();
      await refreshDailyPriorityRows(refreshed.rows);
      setMessage({ type: "success", text: `Low-priority cost actions dismissed. ${formatBatchCounts(response)}` });
    } catch (error) {
      setMessage({ type: "error", text: `Dismiss low-priority failed: ${sanitizeActionError(error)}` });
    } finally {
      setBatchProcessing(null);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Approval Center" subtitle="Shadow mode active. No Amazon action is executed." />
      <div className="warning-card approval-warning">
        <p>Approval Center works in shadow mode. No external Amazon, Ads, Store, Image, A+, or Social action is executed yet.</p>
      </div>
      <div className="summary-strip approval-summary" aria-label="Approval summary">
        <MetricTile label="Pending" value={summaryState.loading && !summaryState.data ? "..." : summaryCounts.pending} />
        <MetricTile label="Approved" value={summaryState.loading && !summaryState.data ? "..." : summaryCounts.approved} />
        <MetricTile label="Rejected" value={summaryState.loading && !summaryState.data ? "..." : summaryCounts.rejected} />
        <MetricTile label="Monitoring" value={summaryState.loading && !summaryState.data ? "..." : summaryCounts.monitoring} />
        <MetricTile label="Completed" value={summaryState.loading && !summaryState.data ? "..." : summaryCounts.completed} />
        <MetricTile label="High Risk" value={summaryState.loading && !summaryState.data ? "..." : summaryCounts.highRisk} />
        <MetricTile label="Founder Override" value={summaryState.loading && !summaryState.data ? "..." : summaryCounts.founderOverride} />
      </div>
      {message ? <div className={`soft-state ${message.type === "error" ? "error-state" : "success-state"}`}>{message.text}</div> : null}
      <div className="segmented">
        {approvalFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={activeFilter === filter ? "active" : ""}
            onClick={() => {
              setActiveFilter(filter);
              resetPagedViewAndSelection();
            }}
            disabled={controlsDisabled}
          >
            {filter}
          </button>
        ))}
      </div>
      <div className="approval-controls">
        <SelectField
          label="Source"
          value={sourceFilter}
          options={sourceOptions}
          onChange={(value) => {
            setSourceFilter(value);
            resetPagedViewAndSelection();
          }}
        />
        <SelectField
          label="Action Type"
          value={actionTypeFilter}
          options={actionTypeOptions}
          onChange={(value) => {
            setActionTypeFilter(value);
            resetPagedViewAndSelection();
          }}
        />
        <TextInput
          label="Search"
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            resetPagedViewAndSelection();
          }}
        />
        <SelectField
          label="Sort"
          value={labelFromSortMode(sortMode)}
          options={approvalSortOptions}
          onChange={(value) => {
            setSortMode(sortModeFromLabel(value));
            resetPagedViewAndSelection();
          }}
        />
      </div>
      <div className="approval-quick-views" aria-label="Quick views">
        {quickViewFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`secondary ${quickView === filter.id ? "active" : ""}`}
            onClick={() => {
              setQuickView(filter.id);
              resetPagedViewAndSelection();
            }}
            disabled={controlsDisabled}
          >
            {filter.label}
          </button>
        ))}
        <button type="button" className="secondary" onClick={loadDailyPriorities} disabled={controlsDisabled}>
          {batchProcessing === "daily-priorities" ? "Loading Priorities..." : "Daily Priorities"}
        </button>
        {dailyPriorityRows ? (
          <button type="button" className="secondary" onClick={clearDailyPriorities} disabled={controlsDisabled}>
            Clear Daily Priorities
          </button>
        ) : null}
        {costDataDismissVisible ? (
          <button
            type="button"
            className="secondary danger-button"
            onClick={dismissLowPriorityCostActions}
            disabled={controlsDisabled}
          >
            {batchProcessing === "dismiss-low-priority" ? "Dismissing..." : "Dismiss Low-Priority Cost Actions"}
          </button>
        ) : null}
      </div>
      {dailyPriorityRows ? (
        <div className="daily-priority-label">
          Daily Priorities Mode: Top 25 pending actions
        </div>
      ) : null}
      {selectedCount > 0 ? (
        <div className="batch-action-bar" aria-label="Batch actions">
          <div>
            <strong>Selected: {selectedCount}</strong>
            <span>Batch approve is disabled. Only reject, monitor, or complete are allowed in batch.</span>
          </div>
          <div className="button-row compact">
            <button type="button" onClick={() => batchAct("reject")} disabled={!selectedPendingOnly || controlsDisabled}>
              {batchProcessing === "reject" ? "Rejecting..." : "Batch Reject Selected"}
            </button>
            <button type="button" onClick={() => batchAct("monitor")} disabled={!selectedPendingOnly || controlsDisabled}>
              {batchProcessing === "monitor" ? "Moving..." : "Batch Monitor Selected"}
            </button>
            <button type="button" onClick={() => batchAct("complete")} disabled={!selectedMonitoringOnly || controlsDisabled}>
              {batchProcessing === "complete" ? "Completing..." : "Batch Complete Selected"}
            </button>
            <button type="button" className="secondary" onClick={clearSelection} disabled={controlsDisabled}>
              Clear Selection
            </button>
          </div>
        </div>
      ) : null}
      {loading && !rowsState.data ? <LoadingBlock /> : loadError ? (
        <ErrorBlock text={`Could not load approval actions: ${loadError}`} />
      ) : allRows.length === 0 ? (
        <EmptyBlock text="No approval actions yet. AI recommendations will appear here before execution." />
      ) : rows.length === 0 ? (
        <EmptyBlock text="No actions match this filter." />
      ) : (
        <>
          <p className="approval-count-line">Showing {rows.length} of {allRows.length} loaded actions</p>
          <div className="approval-pagination">
            <span>Showing {showingStart}-{showingEnd} of {rows.length}</span>
            <div className="button-row compact">
              <button type="button" className="secondary" onClick={selectCurrentPage} disabled={!hasSelectablePageRows || controlsDisabled}>Select Current Page</button>
              <button type="button" className="secondary" onClick={clearSelection} disabled={selectedCount === 0 || controlsDisabled}>Clear Selection</button>
              <button type="button" className="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1 || controlsDisabled}>Previous</button>
              <button type="button" className="secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages || controlsDisabled}>Next</button>
            </div>
          </div>
          <div className="card-list">
            {pageRows.map((row) => (
              <ActionLedgerCard
                key={row.id}
                row={row}
                selected={selectedIds.has(row.id)}
                processing={processing}
                batchProcessing={batchProcessing}
                workflowPanel={workflowPanels[row.id]}
                reopening={reopeningId === row.id}
                actionsDisabled={controlsDisabled}
                onAction={act}
                onCopy={copyActionId}
                onToggleSelected={toggleSelectedRow}
                onToggleWorkflow={toggleWorkflowPanel}
                onRollbackPreview={loadRollbackPreview}
                onReopen={reopenAction}
              />
            ))}
          </div>
          <div className="approval-pagination bottom">
            <span>Showing {showingStart}-{showingEnd} of {rows.length}</span>
            <div className="button-row compact">
              <button type="button" className="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1 || controlsDisabled}>Previous</button>
              <button type="button" className="secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages || controlsDisabled}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function jsonText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "UNKNOWN";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function JsonSnippet({ value }: { value: unknown }) {
  return <code className="json-snippet">{jsonText(value)}</code>;
}

function safeBooleanLabel(value: unknown, trueLabel = "WARNING", falseLabel = "SAFE") {
  return readBoolean(value) ? trueLabel : falseLabel;
}

function SafetyControlPage() {
  const status = useApi<SafetyControlStatus>(() => safetyControlApi.status(SELLER_ID));
  const audits = useApi<ApiRows<SafetyAuditEvent>>(() => safetyControlApi.auditEvents(SELLER_ID));
  const data = safetyControlStatusOf(status.data);
  const settingsValue = readFirst(data, ["settings", "safetySettings", "controlSettings"]);
  const settings = recordOf(settingsValue);
  const hasSettings = settingsValue !== null && settingsValue !== undefined && Object.keys(settings).length > 0;
  const auditRows = safetyAuditRowsOf(audits.data);
  const [form, setForm] = useState({
    maxDailyEngineRuns: "3",
    maxDailyExecutionAttempts: "10",
    maxDailyAiCost: "0",
    safetyNotes: ""
  });
  const [actionState, setActionState] = useState({ loading: false, message: "", error: "" });

  useEffect(() => {
    if (!hasSettings) return;
    setForm({
      maxDailyEngineRuns: String(readFirst(settings, ["maxDailyEngineRuns"]) ?? 3),
      maxDailyExecutionAttempts: String(readFirst(settings, ["maxDailyExecutionAttempts"]) ?? 10),
      maxDailyAiCost: String(readFirst(settings, ["maxDailyAiCost"]) ?? 0),
      safetyNotes: String(readFirst(settings, ["safetyNotes", "notes"]) ?? "")
    });
  }, [hasSettings, status.data]);

  async function initialize() {
    setActionState({ loading: true, message: "", error: "" });
    try {
      await safetyControlApi.initialize(SELLER_ID);
      setActionState({ loading: false, message: "Safety Control initialized.", error: "" });
      status.reload();
      audits.reload();
    } catch {
      setActionState({ loading: false, message: "", error: "Could not initialize safety control" });
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setActionState({ loading: true, message: "", error: "" });
    try {
      await safetyControlApi.saveSettings(SELLER_ID, {
        maxDailyEngineRuns: asInputNumber(form.maxDailyEngineRuns),
        maxDailyExecutionAttempts: asInputNumber(form.maxDailyExecutionAttempts),
        maxDailyAiCost: asInputNumber(form.maxDailyAiCost),
        safetyNotes: form.safetyNotes
      });
      setActionState({ loading: false, message: "Safety settings saved.", error: "" });
      status.reload();
      audits.reload();
    } catch {
      setActionState({ loading: false, message: "", error: "Could not save safety settings" });
    }
  }

  const statusCards = [
    { label: "Global Mode", value: <StatusBadge value={readFirst(settings, ["globalMode", "mode"]) ?? "SHADOW"} /> },
    { label: "Live Execution Enabled", value: <StatusBadge value={safeBooleanLabel(readFirst(settings, ["liveExecutionEnabled"]), "WARNING", "SAFE")} /> },
    { label: "PPC Live Execution", value: <StatusBadge value={safeBooleanLabel(readFirst(settings, ["ppcLiveExecution", "ppcLiveExecutionEnabled"]), "WARNING", "SAFE")} /> },
    { label: "Listing Live Execution", value: <StatusBadge value={safeBooleanLabel(readFirst(settings, ["listingLiveExecution", "listingLiveExecutionEnabled"]), "WARNING", "SAFE")} /> },
    { label: "Image Live Execution", value: <StatusBadge value={safeBooleanLabel(readFirst(settings, ["imageLiveExecution", "imageLiveExecutionEnabled"]), "WARNING", "SAFE")} /> },
    { label: "A+ Live Execution", value: <StatusBadge value={safeBooleanLabel(readFirst(settings, ["aplusLiveExecution", "aPlusLiveExecution", "aplusLiveExecutionEnabled"]), "WARNING", "SAFE")} /> },
    { label: "Social Live Execution", value: <StatusBadge value={safeBooleanLabel(readFirst(settings, ["socialLiveExecution", "socialLiveExecutionEnabled"]), "WARNING", "SAFE")} /> },
    { label: "AI Calls Enabled", value: <StatusBadge value={safeBooleanLabel(readFirst(settings, ["aiCallsEnabled"]), "WARNING", "DISABLED")} /> },
    { label: "Approval Required", value: <StatusBadge value={safeBooleanLabel(readFirst(settings, ["approvalRequired"]), "REQUIRED", "WARNING")} /> },
    { label: "Founder Approval Required", value: <StatusBadge value={safeBooleanLabel(readFirst(settings, ["founderApprovalRequired"]), "REQUIRED", "WARNING")} /> },
    { label: "Max Daily Engine Runs", value: formatEmpty(readFirst(settings, ["maxDailyEngineRuns"])) },
    { label: "Max Daily Execution Attempts", value: formatEmpty(readFirst(settings, ["maxDailyExecutionAttempts"])) },
    { label: "Max Daily AI Cost", value: formatMoney(readFirst(settings, ["maxDailyAiCost"])) }
  ];

  return (
    <div className="page">
      <PageHeader title="Safety Control Center" subtitle="Control automation mode, approval rules, AI usage, and execution safety." />
      <SafetyBanner text="Live execution is blocked in V1. Shadow mode and founder approval remain required." />
      {status.loading || status.error ? (
        <div className="stack">
          <Card title="Locked Execution Controls">
            <div className="readiness-grid">
              {["Marketplace live execution", "Ads live execution", "Listing updates", "Image uploads", "A+ uploads", "External notifications", "AI calls"].map((label) => (
                <div className="readiness-item" key={label}>
                  <span>{label}</span>
                  <Badge tone="good">Locked in V1</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Edit Safe Settings">
            <form className="form-grid" onSubmit={save}>
              <TextInput label="Max Daily Engine Runs" type="number" value={form.maxDailyEngineRuns} onChange={(value) => setForm({ ...form, maxDailyEngineRuns: value })} />
              <TextInput label="Max Daily Execution Attempts" type="number" value={form.maxDailyExecutionAttempts} onChange={(value) => setForm({ ...form, maxDailyExecutionAttempts: value })} />
              <TextInput label="Max Daily AI Cost" type="number" value={form.maxDailyAiCost} onChange={(value) => setForm({ ...form, maxDailyAiCost: value })} />
              <TextArea label="Safety Notes" value={form.safetyNotes} onChange={(value) => setForm({ ...form, safetyNotes: value })} />
              <div className="button-row"><button type="submit" disabled>Save Safety Settings</button></div>
            </form>
          </Card>
        </div>
      ) : null}
      {status.loading ? <LoadingBlock text="Loading safety control..." /> : status.error ? <ErrorBlock text="Could not load safety control" /> : (
        <div className="stack">
          {!hasSettings ? (
            <Card title="Initialize Safety Control" action={<button type="button" onClick={initialize} disabled={actionState.loading}>Initialize Safety Control</button>}>
              <p className="section-note">Safety Control settings are not initialized yet. V1 remains blocked until founder-safe defaults are created.</p>
            </Card>
          ) : null}
          <div className="summary-strip command-summary">
            {statusCards.map((card) => <MetricTile key={card.label} label={card.label} value={card.value} />)}
          </div>
          <Card title="Locked Execution Controls">
            <div className="readiness-grid">
              {["Marketplace live execution", "Ads live execution", "Listing updates", "Image uploads", "A+ uploads", "External notifications", "AI calls"].map((label) => (
                <div className="readiness-item" key={label}>
                  <span>{label}</span>
                  <Badge tone="good">Locked in V1</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Edit Safe Settings">
            <form className="form-grid" onSubmit={save}>
              <TextInput label="Max Daily Engine Runs" type="number" value={form.maxDailyEngineRuns} onChange={(value) => setForm({ ...form, maxDailyEngineRuns: value })} />
              <TextInput label="Max Daily Execution Attempts" type="number" value={form.maxDailyExecutionAttempts} onChange={(value) => setForm({ ...form, maxDailyExecutionAttempts: value })} />
              <TextInput label="Max Daily AI Cost" type="number" value={form.maxDailyAiCost} onChange={(value) => setForm({ ...form, maxDailyAiCost: value })} />
              <TextArea label="Safety Notes" value={form.safetyNotes} onChange={(value) => setForm({ ...form, safetyNotes: value })} />
              <div className="button-row">
                <button type="submit" disabled={actionState.loading || !hasSettings}>Save Safety Settings</button>
                {actionState.message ? <span className="save-message">{actionState.message}</span> : null}
                {actionState.error ? <span className="save-error">{actionState.error}</span> : null}
              </div>
            </form>
          </Card>
          <Card title="Audit Events">
            {audits.loading ? <LoadingBlock text="Loading safety audit events..." /> : audits.error ? <ErrorBlock text="Could not load safety audit events." /> : auditRows.length === 0 ? <EmptyBlock text="No safety audit events yet." /> : (
              <div className="table-wrap command-table">
                <table>
                  <thead>
                    <tr>
                      <th>Created At</th>
                      <th>Event Type</th>
                      <th>Actor</th>
                      <th>Note</th>
                      <th>Before State</th>
                      <th>After State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.map((row, index) => (
                      <tr key={String(row.id ?? index)}>
                        <td>{formatLocalDateTime(row.createdAt)}</td>
                        <td>{formatEmpty(row.eventType)}</td>
                        <td>{formatEmpty(row.actor)}</td>
                        <td className="wrap-cell">{formatEmpty(row.note)}</td>
                        <td><JsonSnippet value={row.beforeState} /></td>
                        <td><JsonSnippet value={row.afterState} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function AlertCenterPage({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const summary = useApi<AlertSummary>(() => alertCenterApi.summary(SELLER_ID));
  const events = useApi<ApiRows<AlertEvent>>(() => alertCenterApi.events(SELLER_ID));
  const data = alertSummaryOf(summary.data);
  const rows = alertRowsOf(events.data);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [actionState, setActionState] = useState({ id: "", message: "", error: "" });

  const filteredRows = rows.filter((row) => {
    const matchesStatus = statusFilter === "ALL" || normalizeState(row.status) === statusFilter;
    const matchesSeverity = severityFilter === "ALL" || normalizeState(row.severity) === severityFilter;
    const matchesCategory = categoryFilter === "ALL" || normalizeState(row.category) === categoryFilter;
    const haystack = `${row.title ?? ""} ${row.message ?? ""} ${row.sku ?? ""} ${row.asin ?? ""}`.toLowerCase();
    return matchesStatus && matchesSeverity && matchesCategory && haystack.includes(query.trim().toLowerCase());
  });

  async function runAction(id: string, action: "acknowledge" | "resolve") {
    if (action === "resolve" && !window.confirm("Resolve this internal alert?")) return;
    setActionState({ id, message: "", error: "" });
    try {
      if (action === "acknowledge") await alertCenterApi.acknowledge(id);
      else await alertCenterApi.resolve(id);
      setActionState({ id: "", message: `Alert ${action}d.`, error: "" });
      summary.reload();
      events.reload();
    } catch {
      setActionState({ id: "", message: "", error: `Could not ${action} alert.` });
    }
  }

  async function seedRules() {
    setActionState({ id: "seed", message: "", error: "" });
    try {
      await alertCenterApi.seedRules(SELLER_ID);
      setActionState({ id: "", message: "Default alert rules seeded.", error: "" });
      summary.reload();
      events.reload();
    } catch {
      setActionState({ id: "", message: "", error: "Could not seed default alert rules." });
    }
  }

  async function generateAlerts() {
    setActionState({ id: "generate", message: "", error: "" });
    try {
      await alertCenterApi.generate(SELLER_ID);
      setActionState({ id: "", message: "Alerts generated.", error: "" });
      summary.reload();
      events.reload();
    } catch {
      setActionState({ id: "", message: "", error: "Could not generate alerts." });
    }
  }

  return (
    <div className="page">
      <PageHeader title="Alert Center" subtitle="Internal founder alerts for risks, stale data, approvals, and blocked execution." />
      <SafetyBanner text="Alerts are internal only. No email, WhatsApp, Slack, or external notification is sent." />
      <div className="stack">
        <div className="button-row">
          <button type="button" onClick={seedRules} disabled={actionState.id !== ""}>Seed Default Rules</button>
          <button type="button" onClick={generateAlerts} disabled={actionState.id !== ""}>Generate Alerts</button>
          <button type="button" className="secondary" onClick={() => { summary.reload(); events.reload(); }}>Refresh Alerts</button>
          {actionState.message ? <span className="save-message">{actionState.message}</span> : null}
          {actionState.error ? <span className="save-error">{actionState.error}</span> : null}
        </div>
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock text="Could not load alert summary." /> : (
          <div className="summary-strip command-summary">
            <MetricTile label="Open Alerts" value={summaryNumber(data, ["openAlerts", "openCount"])} />
            <MetricTile label="High Alerts" value={summaryNumber(data, ["highAlerts", "highCount"])} />
            <MetricTile label="Critical Alerts" value={summaryNumber(data, ["criticalAlerts", "criticalCount"])} />
            <MetricTile label="Acknowledged Alerts" value={summaryNumber(data, ["acknowledgedAlerts", "acknowledgedCount"])} />
            <MetricTile label="Resolved Alerts" value={summaryNumber(data, ["resolvedAlerts", "resolvedCount"])} />
          </div>
        )}
        <Card title="Alert Filters">
          <div className="form-grid filters-grid">
            <SelectField label="Status" value={statusFilter} options={["ALL", ...uniqueTextValues(rows.map((row) => normalizeState(row.status)))]} onChange={setStatusFilter} />
            <SelectField label="Severity" value={severityFilter} options={["ALL", ...uniqueTextValues(rows.map((row) => normalizeState(row.severity)))]} onChange={setSeverityFilter} />
            <SelectField label="Category" value={categoryFilter} options={["ALL", ...uniqueTextValues(rows.map((row) => normalizeState(row.category)))]} onChange={setCategoryFilter} />
            <TextInput label="Search Title, Message, SKU, ASIN" value={query} onChange={setQuery} />
          </div>
        </Card>
        <Card title="Alerts">
          {events.loading ? <LoadingBlock /> : events.error ? <ErrorBlock text="Could not load alert events." /> : filteredRows.length === 0 ? <EmptyBlock text="No founder alerts match these filters." /> : (
            <div className="card-list command-card-list">
              {filteredRows.map((row, index) => (
                <article className="item-card command-item-card" key={String(row.id ?? index)}>
                  <div className="item-top">
                    <strong>{formatEmpty(row.title ?? "Alert")}</strong>
                    <StatusBadge value={row.severity ?? "LOW"} />
                  </div>
                  <div className="badge-row">
                    <StatusBadge value={row.category ?? "GENERAL"} />
                    <StatusBadge value={row.status ?? "OPEN"} />
                  </div>
                  <p className="long-text">{formatEmpty(row.message)}</p>
                  <div className="detail-grid">
                    <MetricRow label="Created At" value={formatLocalDateTime(row.createdAt)} />
                    <MetricRow label="Entity Type" value={formatEmpty(row.entityType)} />
                    <MetricRow label="SKU" value={formatEmpty(row.sku)} />
                    <MetricRow label="ASIN" value={formatEmpty(row.asin)} />
                    <MetricRow label="Action ID" value={formatShortId(row.actionId)} />
                  </div>
                  <div className="button-row compact">
                    {normalizeState(row.status) !== "RESOLVED" ? <button type="button" onClick={() => runAction(row.id, "acknowledge")} disabled={actionState.id === row.id}>Acknowledge</button> : null}
                    {normalizeState(row.status) !== "RESOLVED" ? <button type="button" className="secondary" onClick={() => runAction(row.id, "resolve")} disabled={actionState.id === row.id}>Resolve</button> : null}
                    {row.actionId ? <button type="button" onClick={() => setActiveTab("Approval Center")}>Open Approval Center</button> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function CeoReportPage() {
  const report = useApi<AnyRecord>(() => getJson(`/api/ceo-report/daily?sellerId=${SELLER_ID}&days=30`));
  const data = report.data ?? {};

  return (
    <div className="page">
      <PageHeader title="CEO Report" subtitle="A calm daily operating report for the founder." />
      {report.loading ? <LoadingBlock /> : report.error ? <ErrorBlock /> : (
        <div className="stack">
          <ObjectCard title="Executive Summary" data={recordOf(data.executiveSummary)} />
          <ObjectCard title="Profit Guardrail" data={recordOf(data.profitGuardrail)} />
          <ObjectCard title="PPC Snapshot" data={recordOf(data.ppcSnapshot)} moneyKeys={["cost", "sales"]} percentKeys={["acos"]} />
          <ListCard title="Profit Risk Alerts" rows={arrayOf(data.profitRiskAlerts)} />
          <ListCard title="Today Top Actions" rows={arrayOf(data.todayTopActions ?? data.topActions)} />
          <ListCard title="Pending Approvals" rows={arrayOf(data.pendingApprovals)} />
          <ListCard title="Approved Shadow Actions" rows={arrayOf(data.approvedShadowActions)} />
          <ListCard title="Monitoring Items" rows={arrayOf(data.monitoringItems)} />
          <ListCard title="Search Term Highlights" rows={arrayOf(data.searchTermHighlights)} />
        </div>
      )}
    </div>
  );
}

function ExperimentsPage() {
  const summary = useApi<ExperimentSummary>(() => experimentsApi.summary(SELLER_ID));
  const experiments = useApi<ApiRows<Experiment>>(() => experimentsApi.list(SELLER_ID));
  const data = experimentSummaryOf(summary.data);
  const rows = experimentRowsOf(experiments.data);
  const [form, setForm] = useState({
    name: "",
    description: "",
    experimentType: "PPC_KEYWORD_TEST",
    sku: "",
    asin: "",
    hypothesis: "",
    priority: "MEDIUM"
  });
  const [fromActionId, setFromActionId] = useState("");
  const [completeForm, setCompleteForm] = useState({ id: "", resultStatus: "WON", resultSummary: "" });
  const [actionState, setActionState] = useState({ id: "", message: "", error: "" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setActionState({ id: "create", message: "", error: "" });
    try {
      await experimentsApi.create({
        sellerId: SELLER_ID,
        ...form,
        experimentName: form.name
      });
      setForm({ ...form, name: "", description: "", sku: "", asin: "", hypothesis: "" });
      setActionState({ id: "", message: "Experiment created.", error: "" });
      summary.reload();
      experiments.reload();
    } catch {
      setActionState({ id: "", message: "", error: "Could not create experiment." });
    }
  }

  async function createFromAction(event: FormEvent) {
    event.preventDefault();
    const actionId = fromActionId.trim();
    if (!actionId) return;
    setActionState({ id: "from-action", message: "", error: "" });
    try {
      await experimentsApi.createFromAction(actionId);
      setFromActionId("");
      setActionState({ id: "", message: "Experiment created from approval action.", error: "" });
      summary.reload();
      experiments.reload();
    } catch {
      setActionState({ id: "", message: "", error: "Could not create experiment from action." });
    }
  }

  async function action(id: string, name: "start" | "checkpoint" | "cancel") {
    if (name === "cancel" && !window.confirm("Cancel this experiment? This only changes tracking status.")) return;
    setActionState({ id, message: "", error: "" });
    try {
      if (name === "start") await experimentsApi.start(id);
      else if (name === "checkpoint") await experimentsApi.recordCheckpoint(id, { sellerId: SELLER_ID, note: "Checkpoint recorded from frontend.", metrics: {} });
      else await experimentsApi.cancel(id);
      setActionState({ id: "", message: name === "checkpoint" ? "Checkpoint recorded." : `Experiment ${name}ed.`, error: "" });
      summary.reload();
      experiments.reload();
    } catch {
      setActionState({ id: "", message: "", error: `Could not ${name} experiment.` });
    }
  }

  async function complete(event: FormEvent) {
    event.preventDefault();
    if (!completeForm.id) return;
    setActionState({ id: completeForm.id, message: "", error: "" });
    try {
      await experimentsApi.complete(completeForm.id, {
        sellerId: SELLER_ID,
        resultStatus: completeForm.resultStatus,
        resultSummary: completeForm.resultSummary
      });
      setCompleteForm({ id: "", resultStatus: "WON", resultSummary: "" });
      setActionState({ id: "", message: "Experiment completed.", error: "" });
      summary.reload();
      experiments.reload();
    } catch {
      setActionState({ id: "", message: "", error: "Could not complete experiment." });
    }
  }

  return (
    <div className="page">
      <PageHeader title="Experiments" subtitle="Track before/after outcomes for PPC, listing, pricing, image, and content changes." />
      <SafetyBanner text="Experiments track results only. They do not execute marketplace changes." />
      <p className="section-note">Tracking actions include Start, Record Checkpoint, Complete, and Cancel. They only update experiment status and outcomes.</p>
      {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock text="Could not load experiment summary." /> : (
        <div className="summary-strip command-summary">
          <MetricTile label="Total Experiments" value={summaryNumber(data, ["totalExperiments", "total"], rows.length)} />
          <MetricTile label="Draft Experiments" value={summaryNumber(data, ["draftExperiments", "draftCount"], rows.filter((row) => normalizeState(row.status).includes("DRAFT")).length)} />
          <MetricTile label="Running Experiments" value={summaryNumber(data, ["runningExperiments", "runningCount", "activeExperiments"], rows.filter((row) => ["RUNNING", "ACTIVE"].includes(normalizeState(row.status))).length)} />
          <MetricTile label="Completed Experiments" value={summaryNumber(data, ["completedExperiments", "completedCount"], rows.filter((row) => normalizeState(row.status) === "COMPLETED").length)} />
          <MetricTile label="Cancelled Experiments" value={summaryNumber(data, ["cancelledExperiments", "cancelledCount"], rows.filter((row) => normalizeState(row.status) === "CANCELLED").length)} />
          <MetricTile label="Won" value={summaryNumber(data, ["won", "wonCount"], rows.filter((row) => normalizeState(row.resultStatus) === "WON").length)} />
          <MetricTile label="Lost" value={summaryNumber(data, ["lost", "lostCount"], rows.filter((row) => normalizeState(row.resultStatus) === "LOST").length)} />
          <MetricTile label="Inconclusive" value={summaryNumber(data, ["inconclusive", "inconclusiveCount"], rows.filter((row) => normalizeState(row.resultStatus) === "INCONCLUSIVE").length)} />
        </div>
      )}
      <div className="stack">
        <Card title="Experiment List">
          {experiments.loading ? <LoadingBlock /> : experiments.error ? <ErrorBlock text="Could not load experiments." /> : rows.length === 0 ? <EmptyBlock text="No experiments yet. Create one from a safe tracking hypothesis or an approval action. Record Checkpoint controls appear after an experiment exists." /> : (
            <div className="card-list command-card-list">
              {rows.map((row) => {
                const rowName = row.name ?? row.experimentName;
                return (
                  <article className="item-card command-item-card" key={row.id}>
                    <div className="item-top"><strong>{formatEmpty(rowName)}</strong><StatusBadge value={row.status} /></div>
                    <div className="badge-row">
                      <StatusBadge value={row.experimentType ?? "OTHER"} />
                      {row.resultStatus ? <StatusBadge value={row.resultStatus} /> : null}
                      {row.priority ? <StatusBadge value={row.priority} /> : null}
                    </div>
                    <p className="long-text">{formatEmpty(row.hypothesis)}</p>
                    <div className="detail-grid">
                      <MetricRow label="SKU" value={formatEmpty(row.sku)} />
                      <MetricRow label="ASIN" value={formatEmpty(row.asin)} />
                      <MetricRow label="Result Summary" value={formatEmpty(row.resultSummary)} />
                      <MetricRow label="Started At" value={formatLocalDateTime(row.startedAt ?? row.startDate)} />
                      <MetricRow label="Ended At" value={formatLocalDateTime(row.endedAt ?? row.endDate)} />
                    </div>
                    {completeForm.id === row.id ? (
                      <form className="form-grid compact-form" onSubmit={complete}>
                        <SelectField label="Result Status" value={completeForm.resultStatus} options={["WON", "LOST", "INCONCLUSIVE"]} onChange={(value) => setCompleteForm({ ...completeForm, resultStatus: value })} />
                        <TextArea label="Result Summary" value={completeForm.resultSummary} onChange={(value) => setCompleteForm({ ...completeForm, resultSummary: value })} />
                        <div className="button-row">
                          <button type="submit" disabled={actionState.id === row.id}>Complete</button>
                          <button type="button" className="secondary" onClick={() => setCompleteForm({ id: "", resultStatus: "WON", resultSummary: "" })}>Cancel Form</button>
                        </div>
                      </form>
                    ) : null}
                    <div className="button-row compact">
                      <button type="button" onClick={() => action(row.id, "start")} disabled={actionState.id === row.id}>Start</button>
                      <button type="button" className="secondary" onClick={() => action(row.id, "checkpoint")} disabled={actionState.id === row.id}>Record Checkpoint</button>
                      <button type="button" className="secondary" onClick={() => setCompleteForm({ id: row.id, resultStatus: "WON", resultSummary: "" })}>Complete</button>
                      <button type="button" className="danger-button secondary" onClick={() => action(row.id, "cancel")} disabled={actionState.id === row.id}>Cancel</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Card>
        {actionState.message ? <div className="soft-state success-state">{actionState.message}</div> : null}
        {actionState.error ? <div className="soft-state error-state">{actionState.error}</div> : null}
      </div>
      <Card title="Create Experiment">
        <form className="form-grid" onSubmit={submit}>
          <TextInput label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <SelectField label="Experiment Type" value={form.experimentType} options={["PPC_BID_TEST", "PPC_KEYWORD_TEST", "LISTING_TITLE_TEST", "LISTING_IMAGE_TEST", "PRICING_TEST", "COUPON_TEST", "CONTENT_A_PLUS_TEST", "INVENTORY_REPLENISHMENT_TEST", "OTHER"]} onChange={(value) => setForm({ ...form, experimentType: value })} />
          <TextInput label="SKU Optional" value={form.sku} onChange={(value) => setForm({ ...form, sku: value })} />
          <TextInput label="ASIN Optional" value={form.asin} onChange={(value) => setForm({ ...form, asin: value })} />
          <SelectField label="Priority Optional" value={form.priority} options={["LOW", "MEDIUM", "HIGH"]} onChange={(value) => setForm({ ...form, priority: value })} />
          <TextArea label="Description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} />
          <TextArea label="Hypothesis" value={form.hypothesis} onChange={(value) => setForm({ ...form, hypothesis: value })} />
          <div className="button-row"><button type="submit" disabled={actionState.id === "create"}>Create Experiment</button></div>
        </form>
      </Card>
      <Card title="Create From Action">
        <form className="form-grid" onSubmit={createFromAction}>
          <TextInput label="Action ID" value={fromActionId} onChange={setFromActionId} />
          <div className="button-row"><button type="submit" disabled={actionState.id === "from-action"}>Create Experiment From Action</button></div>
        </form>
      </Card>
    </div>
  );
}

function DataFreshnessPage() {
  const summary = useApi<DataFreshnessSummary>(() => dataFreshnessApi.summary(SELLER_ID));
  const data = dataFreshnessSummaryOf(summary.data);
  const rows = dataFreshnessRowsOf(summary.data);
  const warnings = dailyList(readFirst(data, ["warnings"]));
  const [actionState, setActionState] = useState({ loading: false, message: "", error: "" });

  async function runCheck() {
    setActionState({ loading: true, message: "", error: "" });
    try {
      await dataFreshnessApi.check(SELLER_ID);
      setActionState({ loading: false, message: "Freshness check completed.", error: "" });
      summary.reload();
    } catch {
      setActionState({ loading: false, message: "", error: "Could not run freshness check." });
    }
  }

  return (
    <div className="page">
      <PageHeader title="Data Freshness Guardrails" subtitle="Check whether Amazon, Ads, Product Passport, Economics, Engines, and AI-CGO data are fresh." />
      <SafetyBanner text="No external sync is triggered here. This only checks freshness status." />
      <div className="stack">
        <div className="button-row">
          <button type="button" onClick={runCheck} disabled={actionState.loading}>Run Freshness Check</button>
          <button type="button" className="secondary" onClick={summary.reload}>Refresh Summary</button>
          {actionState.message ? <span className="save-message">{actionState.message}</span> : null}
          {actionState.error ? <span className="save-error">{actionState.error}</span> : null}
        </div>
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock text="Could not load data freshness summary." /> : (
          <>
            <div className="summary-strip command-summary">
              <MetricTile label="Total Sources" value={summaryNumber(data, ["totalSources", "total"], rows.length)} />
              <MetricTile label="Fresh Sources" value={summaryNumber(data, ["freshSources", "fresh"], rows.filter((row) => normalizeState(row.status) === "FRESH").length)} />
              <MetricTile label="Stale Sources" value={summaryNumber(data, ["staleSources", "stale"], rows.filter((row) => normalizeState(row.status) === "STALE").length)} />
              <MetricTile label="Unknown Sources" value={summaryNumber(data, ["unknownSources", "unknown"], rows.filter((row) => normalizeState(row.status) === "UNKNOWN").length)} />
              <MetricTile label="Error Sources" value={summaryNumber(data, ["errorSources", "errors"], rows.filter((row) => normalizeState(row.status) === "ERROR").length)} />
            </div>
            <Card title="Freshness Rows">
              {rows.length === 0 ? <EmptyBlock text="No data freshness rows returned yet." /> : (
                <div className="table-wrap command-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Data Source</th>
                        <th>Status</th>
                        <th>Last Success At</th>
                        <th>Last Attempt At</th>
                        <th>Freshness Minutes</th>
                        <th>Stale After Minutes</th>
                        <th>Last Error</th>
                        <th>Updated At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={String(row.id ?? row.dataSource ?? index)}>
                          <td>{formatEmpty(row.dataSource)}</td>
                          <td><StatusBadge value={row.status ?? "UNKNOWN"} /></td>
                          <td>{formatLocalDateTime(row.lastSuccessAt)}</td>
                          <td>{formatLocalDateTime(row.lastAttemptAt)}</td>
                          <td>{formatEmpty(row.freshnessMinutes)}</td>
                          <td>{formatEmpty(row.staleAfterMinutes)}</td>
                          <td className="wrap-cell">{formatEmpty(row.lastError)}</td>
                          <td>{formatLocalDateTime(row.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card title="Warnings">
              {warnings.length === 0 ? <EmptyBlock text="No freshness warnings returned." /> : (
                <ul className="clean-list">
                  {warnings.map((warning, index) => <li key={index}>{formatDailyListItem(warning)}</li>)}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function AiGatewayPage() {
  const status = useApi<AiGatewayStatus>(() => aiGatewayApi.status(SELLER_ID));
  const costSummary = useApi<AiCostSummary>(() => aiGatewayApi.costSummary(SELLER_ID));
  const ledger = useApi<ApiRows<AiLedgerRow>>(() => aiGatewayApi.ledger(SELLER_ID));
  const statusData = aiGatewayStatusOf(status.data);
  const costData = aiCostSummaryOf(costSummary.data);
  const ledgerRows = aiLedgerRowsOf(ledger.data);
  const [estimateForm, setEstimateForm] = useState({
    moduleName: "",
    purpose: "",
    estimatedInputTokens: "0",
    estimatedOutputTokens: "0",
    provider: "",
    modelName: ""
  });
  const [blockedForm, setBlockedForm] = useState({ moduleName: "", purpose: "", blockedReason: "AI calls disabled in V1." });
  const [generateForm, setGenerateForm] = useState({
    moduleName: "",
    purpose: "",
    estimatedInputTokens: "",
    estimatedOutputTokens: ""
  });
  const [estimateResult, setEstimateResult] = useState<AiCostEstimate | null>(null);
  const [generateResult, setGenerateResult] = useState<AnyRecord | null>(null);
  const [actionState, setActionState] = useState({ id: "", message: "", error: "" });

  async function estimate(event: FormEvent) {
    event.preventDefault();
    setActionState({ id: "estimate", message: "", error: "" });
    setEstimateResult(null);
    try {
      const result = await aiGatewayApi.estimate({
        sellerId: SELLER_ID,
        moduleName: estimateForm.moduleName,
        purpose: estimateForm.purpose,
        estimatedInputTokens: asInputNumber(estimateForm.estimatedInputTokens) ?? 0,
        estimatedOutputTokens: asInputNumber(estimateForm.estimatedOutputTokens) ?? 0,
        provider: estimateForm.provider || undefined,
        modelName: estimateForm.modelName || undefined
      });
      setEstimateResult(aiCostEstimateOf(result));
      setActionState({ id: "", message: "AI cost estimate calculated.", error: "" });
    } catch {
      setActionState({ id: "", message: "", error: "Could not estimate AI cost." });
    }
  }

  async function recordBlocked(event: FormEvent) {
    event.preventDefault();
    setActionState({ id: "blocked", message: "", error: "" });
    try {
      await aiGatewayApi.recordBlocked({ sellerId: SELLER_ID, ...blockedForm });
      setBlockedForm({ moduleName: "", purpose: "", blockedReason: "AI calls disabled in V1." });
      setActionState({ id: "", message: "Blocked AI attempt recorded.", error: "" });
      status.reload();
      costSummary.reload();
      ledger.reload();
    } catch {
      setActionState({ id: "", message: "", error: "Could not record blocked AI attempt." });
    }
  }

  async function testGenerateGuardrail(event: FormEvent) {
    event.preventDefault();
    setActionState({ id: "generate", message: "", error: "" });
    setGenerateResult(null);
    try {
      const response = await aiGatewayApi.generate({
        sellerId: SELLER_ID,
        moduleName: generateForm.moduleName,
        purpose: generateForm.purpose,
        prompt: generateForm.purpose,
        estimatedInputTokens: asInputNumber(generateForm.estimatedInputTokens),
        estimatedOutputTokens: asInputNumber(generateForm.estimatedOutputTokens)
      });
      setGenerateResult(hardeningResultOf(response));
      setActionState({
        id: "",
        message: responseWasBlocked(response) ? "AI generation blocked safely because AI calls are disabled." : "AI generate guardrail response received.",
        error: ""
      });
      status.reload();
      costSummary.reload();
      ledger.reload();
    } catch (requestError) {
      const sanitized = sanitizeActionError(requestError);
      const isDisabledBlock = normalizeState(sanitized).includes("AI_CALLS_DISABLED") || normalizeState(sanitized).includes("AI CALLS DISABLED");
      setActionState({
        id: "",
        message: isDisabledBlock ? "AI generation blocked safely because AI calls are disabled." : "",
        error: isDisabledBlock ? "" : sanitized
      });
    }
  }

  return (
    <div className="page">
      <PageHeader title="AI Gateway + Cost Ledger" subtitle="Cost-controlled AI usage foundation. AI calls are disabled in V1." />
      <SafetyBanner text="AI calls are disabled in V1. This page only estimates and records cost-control events." />
      <div className="stack">
        {status.loading || costSummary.loading ? <LoadingBlock /> : status.error || costSummary.error ? <ErrorBlock text="Could not load AI gateway status." /> : (
          <div className="summary-strip command-summary">
            <MetricTile label="AI Calls Enabled" value={<StatusBadge value={safeBooleanLabel(readFirst(statusData, ["aiCallsEnabled"]), "WARNING", "DISABLED")} />} />
            <MetricTile label="Daily Budget" value={formatMoney(readFirst(statusData, ["dailyBudget", "dailyAiBudget"]))} />
            <MetricTile label="Monthly Budget" value={formatMoney(readFirst(statusData, ["monthlyBudget", "monthlyAiBudget"]))} />
            <MetricTile label="Daily Cost" value={formatMoney(readFirst(costData, ["dailyCost", "costToday"]))} />
            <MetricTile label="Monthly Cost" value={formatMoney(readFirst(costData, ["monthlyCost", "costThisMonth"]))} />
            <MetricTile label="Requests Today" value={summaryNumber({ ...statusData, ...costData }, ["requestsToday"])} />
            <MetricTile label="Requests This Month" value={summaryNumber({ ...statusData, ...costData }, ["requestsThisMonth"])} />
          </div>
        )}
        <div className="dashboard-grid today">
          <Card title="Estimate Cost">
            <form className="form-grid" onSubmit={estimate}>
              <TextInput label="Module Name" value={estimateForm.moduleName} onChange={(value) => setEstimateForm({ ...estimateForm, moduleName: value })} />
              <TextInput label="Purpose" value={estimateForm.purpose} onChange={(value) => setEstimateForm({ ...estimateForm, purpose: value })} />
              <TextInput label="Estimated Input Tokens" type="number" value={estimateForm.estimatedInputTokens} onChange={(value) => setEstimateForm({ ...estimateForm, estimatedInputTokens: value })} />
              <TextInput label="Estimated Output Tokens" type="number" value={estimateForm.estimatedOutputTokens} onChange={(value) => setEstimateForm({ ...estimateForm, estimatedOutputTokens: value })} />
              <TextInput label="Provider Optional" value={estimateForm.provider} onChange={(value) => setEstimateForm({ ...estimateForm, provider: value })} />
              <TextInput label="Model Name Optional" value={estimateForm.modelName} onChange={(value) => setEstimateForm({ ...estimateForm, modelName: value })} />
              <div className="button-row"><button type="submit" disabled={actionState.id === "estimate"}>Estimate Cost</button></div>
            </form>
            {estimateResult ? (
              <div className="gateway-result">
                <MetricRow label="Estimated Cost" value={formatMoney(estimateResult.estimatedCost)} />
                <MetricRow label="Status" value={<StatusBadge value={estimateResult.status ?? "ESTIMATED"} />} />
                <MetricRow label="Blocked Reason" value={formatEmpty(estimateResult.blockedReason)} />
              </div>
            ) : null}
          </Card>
          <Card title="Record Blocked Attempt">
            <form className="form-grid" onSubmit={recordBlocked}>
              <TextInput label="Module Name" value={blockedForm.moduleName} onChange={(value) => setBlockedForm({ ...blockedForm, moduleName: value })} />
              <TextInput label="Purpose" value={blockedForm.purpose} onChange={(value) => setBlockedForm({ ...blockedForm, purpose: value })} />
              <TextArea label="Blocked Reason" value={blockedForm.blockedReason} onChange={(value) => setBlockedForm({ ...blockedForm, blockedReason: value })} />
              <div className="button-row"><button type="submit" disabled={actionState.id === "blocked"}>Record Blocked AI Attempt</button></div>
            </form>
          </Card>
          <Card title="Generate Guardrail Test">
            <form className="form-grid" onSubmit={testGenerateGuardrail}>
              <TextInput label="Module Name" value={generateForm.moduleName} onChange={(value) => setGenerateForm({ ...generateForm, moduleName: value })} />
              <TextArea label="Purpose / Prompt" value={generateForm.purpose} onChange={(value) => setGenerateForm({ ...generateForm, purpose: value })} />
              <TextInput label="Estimated Input Tokens Optional" type="number" value={generateForm.estimatedInputTokens} onChange={(value) => setGenerateForm({ ...generateForm, estimatedInputTokens: value })} />
              <TextInput label="Estimated Output Tokens Optional" type="number" value={generateForm.estimatedOutputTokens} onChange={(value) => setGenerateForm({ ...generateForm, estimatedOutputTokens: value })} />
              <div className="button-row"><button type="submit" disabled={actionState.id === "generate"}>Test AI Generate Guardrail</button></div>
            </form>
            <p className="section-note">Expected safe default: blocked AI_CALLS_DISABLED. This control is a guardrail test, not a real generation shortcut.</p>
            {generateResult ? <div className="gateway-result"><JsonSnippet value={generateResult} /></div> : null}
          </Card>
        </div>
        {actionState.message ? <div className="soft-state success-state">{actionState.message}</div> : null}
        {actionState.error ? <div className="soft-state error-state">{actionState.error}</div> : null}
        <Card title="Cost Ledger">
          {ledger.loading ? <LoadingBlock /> : ledger.error ? <ErrorBlock text="Could not load AI ledger." /> : ledgerRows.length === 0 ? <EmptyBlock text="No AI cost ledger rows yet." /> : (
            <div className="table-wrap command-table">
              <table>
                <thead>
                  <tr>
                    <th>Created At</th>
                    <th>Module Name</th>
                    <th>Purpose</th>
                    <th>Provider</th>
                    <th>Model Name</th>
                    <th>Input Tokens</th>
                    <th>Output Tokens</th>
                    <th>Estimated Cost</th>
                    <th>Status</th>
                    <th>Blocked Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.map((row, index) => (
                    <tr key={String(row.id ?? index)}>
                      <td>{formatLocalDateTime(row.createdAt)}</td>
                      <td>{formatEmpty(row.moduleName)}</td>
                      <td className="wrap-cell">{formatEmpty(row.purpose)}</td>
                      <td>{formatEmpty(row.provider)}</td>
                      <td>{formatEmpty(row.modelName)}</td>
                      <td>{formatEmpty(row.inputTokens)}</td>
                      <td>{formatEmpty(row.outputTokens)}</td>
                      <td>{formatMoney(row.estimatedCost)}</td>
                      <td><StatusBadge value={row.status ?? "UNKNOWN"} /></td>
                      <td className="wrap-cell">{formatEmpty(row.blockedReason)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ProductionHealthPage() {
  const summary = useApi<ProductionHealthSummary>(() => productionHealthApi.summary(SELLER_ID));
  const data = productionHealthSummaryOf(summary.data);
  const modules = productionHealthModulesOf(summary.data);
  const blockers = dailyList(readFirst(data, ["blockers"]));
  const warnings = dailyList(readFirst(data, ["warnings"]));
  const nextChecks = dailyList(readFirst(data, ["nextChecks"]));
  const overallStatus = readFirst(data, ["overallStatus", "status"]) ?? "UNKNOWN";
  const passModules = summaryNumber(data, ["modulesPassing", "passingModules", "passModules"], modules.filter((row) => normalizeState(row.status) === "PASS").length);
  const warnModules = summaryNumber(data, ["modulesWarning", "warningModules", "warnModules"], modules.filter((row) => ["WARN", "WARNING"].includes(normalizeState(row.status))).length);
  const failModules = summaryNumber(data, ["modulesFailing", "failingModules", "failModules"], modules.filter((row) => normalizeState(row.status) === "FAIL").length);
  const criticalBlockers = summaryNumber(data, ["criticalBlockers", "blockersCount"], blockers.length);
  const warningCount = summaryNumber(data, ["warningsCount"], warnings.length);
  const safetyFlags = recordOf(readFirst(data, ["safetyFlags", "safety", "flags"]));
  const moduleStatus = (keys: string[], fallback = "UNKNOWN") => {
    const match = modules.find((module) => {
      const normalizedKey = normalizeState(module.key ?? module.name).replace(/\s+/g, "_");
      return keys.some((key) => normalizedKey.includes(normalizeState(key).replace(/\s+/g, "_")));
    });
    return match?.status ?? readFirst(data, keys) ?? fallback;
  };
  const finalHealthModules = [
    { label: "Live Execution", value: moduleStatus(["liveExecution", "live_execution"], readBoolean(readFirst(data, ["liveExecutionEnabled"])) ? "WARN" : "SAFE") },
    { label: "Launch Gate", value: moduleStatus(["launchGate", "launch_gate"]) },
    { label: "Scheduler Control", value: moduleStatus(["schedulerControl", "scheduler_control", "scheduler"]) },
    { label: "Notification Outbox", value: moduleStatus(["notificationOutbox", "notification_outbox"]) },
    { label: "Security Guardrails", value: moduleStatus(["securityGuardrails", "security_guardrails"]) },
    { label: "Launch Checklist", value: moduleStatus(["launchChecklist", "launch_checklist"]) },
    { label: "AI Gateway Generate", value: readBoolean(readFirst(data, ["aiCallsEnabled", "aiGateway.aiCallsEnabled"])) ? moduleStatus(["aiGatewayGenerate", "ai_generate"], "WARN") : "DISABLED" },
    { label: "PPC Live Adapter", value: moduleStatus(["ppcLiveAdapter", "ppc_live_adapter"], readBoolean(readFirst(data, ["ppcLiveExecutionEnabled", "ppcLiveAdapterEnabled"])) ? "WARN" : "SAFE") },
    { label: "Listing Live Adapter", value: moduleStatus(["listingLiveAdapter", "listing_live_adapter"], readBoolean(readFirst(data, ["listingLiveExecutionEnabled", "listingLiveAdapterEnabled"])) ? "WARN" : "SAFE") }
  ];

  return (
    <div className="page">
      <PageHeader title="Production Health" subtitle="One health check across backend, data, engines, approvals, safety, and shadow execution." />
      <SafetyBanner text="Production Health does not execute changes. It only checks readiness." />
      <div className="stack">
        <div className="button-row"><button type="button" onClick={summary.reload}>Refresh Health</button></div>
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock text="Could not load production health." /> : (
          <>
            <div className="summary-strip command-summary">
              <MetricTile label="Overall Status" value={<StatusBadge value={overallStatus} />} />
              <MetricTile label="PASS Modules" value={passModules} />
              <MetricTile label="WARN Modules" value={warnModules} />
              <MetricTile label="FAIL Modules" value={failModules} />
              <MetricTile label="Critical Blockers" value={criticalBlockers} />
              <MetricTile label="Warnings" value={warningCount} />
              <MetricTile label="Live Execution Enabled" value={<StatusBadge value={safeBooleanLabel(readFirst(data, ["liveExecutionEnabled"]), "WARNING", "BLOCKED")} />} />
              <MetricTile label="AI Calls Enabled" value={<StatusBadge value={safeBooleanLabel(readFirst(data, ["aiCallsEnabled"]), "WARNING", "DISABLED")} />} />
            </div>
            {normalizeState(overallStatus) === "WARN" ? (
              <div className="soft-state compact-state">Warnings need attention, but system is reachable.</div>
            ) : null}
            <Card title="Safety State">
              <div className="readiness-grid">
                <div className="readiness-item"><span>Mode</span><StatusBadge value={readFirst(data, ["mode"]) ?? "SHADOW"} /></div>
                <div className="readiness-item"><span>Shadow Mode</span><StatusBadge value={safeBooleanLabel(readFirst(data, ["shadowMode"]), "SHADOW", "UNKNOWN")} /></div>
                <div className="readiness-item"><span>External Execution</span><StatusBadge value={readFirst(data, ["externalExecution"]) ?? "BLOCKED"} /></div>
                <div className="readiness-item"><span>Live Execution Enabled</span><StatusBadge value={safeBooleanLabel(readFirst(data, ["liveExecutionEnabled"]), "WARNING", "BLOCKED")} /></div>
                <div className="readiness-item"><span>AI Calls Enabled</span><StatusBadge value={safeBooleanLabel(readFirst(data, ["aiCallsEnabled"]), "WARNING", "DISABLED")} /></div>
                {Object.entries(safetyFlags).map(([key, value]) => (
                  <div className="readiness-item" key={key}>
                    <span>{labelize(key)}</span>
                    <StatusBadge value={typeof value === "boolean" ? safeBooleanLabel(value, "WARNING", "SAFE") : value} />
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Module Health">
              {modules.length === 0 ? <EmptyBlock text="No production health modules returned." /> : (
                <div className="card-list command-card-list">
                  {modules.map((module, index) => (
                    <article className="item-card command-item-card" key={String(module.key ?? module.name ?? index)}>
                      <div className="item-top">
                        <strong>{formatEmpty(module.name ?? module.key)}</strong>
                        <StatusBadge value={module.status ?? "UNKNOWN"} />
                      </div>
                      <p className="long-text">{formatEmpty(module.message)}</p>
                      <div className="detail-grid">
                        <MetricRow label="Key" value={formatEmpty(module.key)} />
                        <MetricRow label="Critical" value={readBoolean(module.critical) ? "Yes" : "No"} />
                        <MetricRow label="Counts" value={<JsonSnippet value={module.counts} />} />
                        <MetricRow label="Last Checked At" value={formatLocalDateTime(module.lastCheckedAt)} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>
            <div className="dashboard-grid today">
              <ListTextCard title="Blockers" rows={blockers} emptyText="No production blockers found." />
              <ListTextCard title="Warnings" rows={warnings} emptyText="No production warnings returned." />
            </div>
            <ListTextCard title="Next Checks" rows={nextChecks} emptyText="No next checks returned." />
          </>
        )}
        <Card title="Launch Control Health">
          <div className="readiness-grid">
            {finalHealthModules.map((item) => (
              <div className="readiness-item" key={item.label}>
                <span>{item.label}</span>
                <StatusBadge value={item.value} />
              </div>
            ))}
          </div>
          <p className="section-note">Disabled live execution is SAFE unless the launch objective explicitly requires live eligibility.</p>
        </Card>
      </div>
    </div>
  );
}

function LearningPage() {
  const summary = useApi<LearningSummary>(() => getJson(`/api/learning-loop/summary?sellerId=${SELLER_ID}`));
  const events = useApi<ApiRows<LearningEvent>>(() => getJson(`/api/learning-loop/events?sellerId=${SELLER_ID}&limit=100`));
  const [eventType, setEventType] = useState("ALL");
  const [engineQuery, setEngineQuery] = useState("");
  const [skuQuery, setSkuQuery] = useState("");
  const [noteForm, setNoteForm] = useState({ actionId: "", engineKey: "", note: "" });
  const [actionState, setActionState] = useState<{ loading: boolean; message: string; error: string }>({ loading: false, message: "", error: "" });
  const data = learningSummaryOf(summary.data);
  const eventRows = learningEventsOf(events.data);
  const filteredEvents = eventRows.filter((row) => {
    const matchesType = eventType === "ALL" || String(row.eventType ?? "") === eventType;
    const matchesEngine = String(row.engineKey ?? "").toLowerCase().includes(engineQuery.trim().toLowerCase());
    const skuText = `${row.sku ?? ""} ${row.asin ?? ""}`.toLowerCase();
    const matchesSku = skuText.includes(skuQuery.trim().toLowerCase());
    return matchesType && matchesEngine && matchesSku;
  });
  const eventTypes = ["ALL", ...uniqueTextValues(eventRows.map((row) => row.eventType))];

  async function rebuild() {
    setActionState({ loading: true, message: "", error: "" });
    try {
      await postJson(`/api/learning-loop/rebuild?sellerId=${SELLER_ID}`, {});
      setActionState({ loading: false, message: "Learning summary rebuilt.", error: "" });
      summary.reload();
      events.reload();
    } catch {
      setActionState({ loading: false, message: "", error: "Could not rebuild learning summary." });
    }
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!noteForm.note.trim()) {
      setActionState({ loading: false, message: "", error: "Learning note is required." });
      return;
    }
    setActionState({ loading: true, message: "", error: "" });
    try {
      await postJson("/api/learning-loop/manual-note", {
        sellerId: SELLER_ID,
        actionId: noteForm.actionId.trim() || undefined,
        engineKey: noteForm.engineKey.trim() || undefined,
        note: noteForm.note.trim()
      });
      setNoteForm({ actionId: "", engineKey: "", note: "" });
      setActionState({ loading: false, message: "Learning note added.", error: "" });
      summary.reload();
      events.reload();
    } catch {
      setActionState({ loading: false, message: "", error: "Could not add learning note." });
    }
  }

  return (
    <div className="page">
      <PageHeader title="Learning Loop" subtitle="Track how engines learn from approvals, rejections, completions, and outcomes." />
      <SafetyBanner text="Learning only records outcomes. It does not execute external actions." />
      {summary.error ? <ErrorBlock text="Could not load learning summary." /> : null}
      {events.error ? <ErrorBlock text="Could not load learning events." /> : null}
      <div className="stack">
        {summary.loading ? <LoadingBlock /> : (
          <div className="summary-strip command-summary">
            <MetricTile label="Total Learning Events" value={readNumber(readFirst(data, ["totalLearningEvents", "eventCount"]))} />
            <MetricTile label="Engines Tracked" value={readNumber(readFirst(data, ["enginesTracked", "trackedEngines"]))} />
            <MetricTile label="Approved Count" value={readNumber(readFirst(data, ["approvedCount", "approved"]))} />
            <MetricTile label="Rejected Count" value={readNumber(readFirst(data, ["rejectedCount", "rejected"]))} />
            <MetricTile label="Monitoring Count" value={readNumber(readFirst(data, ["monitoringCount", "monitoring"]))} />
            <MetricTile label="Completed Count" value={readNumber(readFirst(data, ["completedCount", "completed"]))} />
            <MetricTile label="No Action Count" value={readNumber(readFirst(data, ["noActionCount", "noAction"]))} />
            <MetricTile label="Failed Count" value={readNumber(readFirst(data, ["failedCount", "failed"]))} />
          </div>
        )}
        <div className="button-row">
          <button type="button" onClick={rebuild} disabled={actionState.loading}>Rebuild Learning Summary</button>
          {actionState.message ? <span className="save-message">{actionState.message}</span> : null}
          {actionState.error ? <span className="save-error">{actionState.error}</span> : null}
        </div>
        <LearningEngineSection title="Top Useful Engines" rows={learningEngineRows(data.topUsefulEngines)} mode="useful" />
        <LearningEngineSection title="Weakest Engines" rows={learningEngineRows(data.weakestEngines)} mode="weak" />
        <Card title="Recent Learning Events">
          <div className="form-grid filters-grid">
            <SelectField label="Event Type" value={eventType} options={eventTypes} onChange={setEventType} />
            <TextInput label="Engine Key Search" value={engineQuery} onChange={setEngineQuery} />
            <TextInput label="SKU Search" value={skuQuery} onChange={setSkuQuery} />
          </div>
          {events.loading ? <LoadingBlock /> : filteredEvents.length === 0 ? <EmptyBlock text="No learning events match these filters." /> : (
            <div className="table-wrap command-table">
              <table>
                <thead>
                  <tr>
                    <th>Created At</th>
                    <th>Event Type</th>
                    <th>Engine Key</th>
                    <th>Action Type</th>
                    <th>SKU</th>
                    <th>ASIN</th>
                    <th>Actor</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((row, index) => (
                    <tr key={String(row.id ?? `${row.createdAt}-${index}`)}>
                      <td>{formatEmpty(row.createdAt)}</td>
                      <td><StatusBadge value={row.eventType} /></td>
                      <td>{formatEmpty(row.engineKey)}</td>
                      <td>{formatEmpty(row.actionType)}</td>
                      <td>{formatEmpty(row.sku)}</td>
                      <td>{formatEmpty(row.asin)}</td>
                      <td>{formatEmpty(row.actor)}</td>
                      <td className="wrap-cell">{formatEmpty(row.note)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Manual Note">
          <form className="form-grid" onSubmit={addNote}>
            <TextInput label="Action ID Optional" value={noteForm.actionId} onChange={(value) => setNoteForm({ ...noteForm, actionId: value })} />
            <TextInput label="Engine Key Optional" value={noteForm.engineKey} onChange={(value) => setNoteForm({ ...noteForm, engineKey: value })} />
            <TextArea label="Note Required" value={noteForm.note} onChange={(value) => setNoteForm({ ...noteForm, note: value })} />
            <button type="submit" disabled={actionState.loading}>Add Learning Note</button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function ExecutionGatewayPage() {
  const status = useApi<ExecutionGatewayStatus>(() => getJson(`/api/execution-gateway/status?sellerId=${SELLER_ID}`));
  const attempts = useApi<ApiRows<ExecutionAttempt>>(() => getJson(`/api/execution-gateway/attempts?sellerId=${SELLER_ID}&limit=50`));
  const [actionId, setActionId] = useState("");
  const [result, setResult] = useState<AnyRecord | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const data = gatewayStatusOf(status.data);
  const rows = executionAttemptsOf(attempts.data);

  async function runGatewayAction(kind: "preview" | "shadow" | "live") {
    const trimmedId = actionId.trim();
    if (!trimmedId) {
      setError("Action ID is required.");
      setMessage("");
      return;
    }
    if (kind === "shadow" && !window.confirm("Run shadow execution? No external action will be executed.")) return;
    if (kind === "live" && !window.confirm("Live execution is blocked in V1. This will only test the block.")) return;
    setProcessing(true);
    setError("");
    setMessage("");
    try {
      const endpoint = kind === "preview" ? "preview" : kind === "shadow" ? "execute-shadow" : "execute-live";
      const response = await postJson<AnyRecord>(`/api/execution-gateway/${endpoint}/${encodeURIComponent(trimmedId)}`, {});
      const nextResult = gatewayActionResultOf(response);
      setResult(nextResult);
      const ok = response.ok !== false;
      setMessage(kind === "live" && !ok ? "Live execution safety block confirmed." : "Execution gateway response received.");
      attempts.reload();
      status.reload();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Execution Gateway" subtitle="Preview and shadow-execute approved actions safely. Live execution is blocked in V1." />
      <SafetyBanner text="Live execution is disabled. Shadow execution only. No external Amazon or Ads changes are made." />
      {status.error ? <ErrorBlock text="Could not load execution gateway status." /> : null}
      {attempts.error ? <ErrorBlock text="Could not load execution attempts." /> : null}
      <div className="stack">
        {status.loading ? <LoadingBlock /> : (
          <div className="summary-strip command-summary">
            <MetricTile label="Mode" value={formatEmpty(data.mode ?? "SHADOW")} />
            <MetricTile label="Live Execution Enabled" value={<StatusBadge value={readBoolean(data.liveExecutionEnabled) ? "ENABLED" : "BLOCKED"} />} />
            <MetricTile label="Message" value={formatEmpty(data.message ?? "Live execution blocked in V1")} />
            <MetricTile label="Total Attempts" value={readNumber(readFirst(data, ["totalAttempts", "attemptCount"]))} />
            <MetricTile label="Shadow Completed" value={readNumber(readFirst(data, ["shadowCompleted", "shadowExecutions"]))} />
            <MetricTile label="Live Blocked" value={readNumber(readFirst(data, ["liveBlocked", "liveBlockedCount"]))} />
            <MetricTile label="Failed Attempts" value={readNumber(readFirst(data, ["failedAttempts", "failedCount"]))} />
          </div>
        )}
        <Card title="Action Execution Test">
          <div className="form-grid">
            <TextInput label="Action ID" value={actionId} onChange={setActionId} />
            <div className="button-row gateway-buttons">
              <button type="button" onClick={() => runGatewayAction("preview")} disabled={processing}>Preview Action</button>
              <button type="button" onClick={() => runGatewayAction("shadow")} disabled={processing}>Execute Shadow</button>
              <button type="button" className="danger-button live-block-button" onClick={() => runGatewayAction("live")} disabled={processing}>Try Live Execution</button>
            </div>
          </div>
          <p className="section-note">Live execution remains blocked. The live test only confirms the safety block.</p>
          {message ? <div className="soft-state success-state compact-state">{message}</div> : null}
          {error ? <div className="soft-state error-state compact-state">{error}</div> : null}
          {result ? (
            <div className="detail-grid gateway-result">
              <MetricRow label="Execution Mode" value={formatObjectValue(result.executionMode)} />
              <MetricRow label="External Execution" value={formatObjectValue(result.externalExecution)} />
              <MetricRow label="Message" value={formatObjectValue(result.message)} />
              <MetricRow label="Planned Change" value={formatObjectValue(result.plannedChange)} />
              <MetricRow label="Safety Checks" value={formatObjectValue(result.safetyChecks)} />
              <MetricRow label="Blocked Reason" value={formatObjectValue(result.blockedReason)} />
              <MetricRow label="Result Message" value={formatObjectValue(result.resultMessage)} />
            </div>
          ) : null}
        </Card>
        <Card title="Recent Execution Attempts">
          {attempts.loading ? <LoadingBlock /> : rows.length === 0 ? <EmptyBlock text="No execution attempts yet." /> : (
            <div className="table-wrap command-table">
              <table>
                <thead>
                  <tr>
                    <th>Created At</th>
                    <th>Action ID</th>
                    <th>Action Type</th>
                    <th>Execution Mode</th>
                    <th>Execution Status</th>
                    <th>Actor</th>
                    <th>Blocked Reason</th>
                    <th>Result Message</th>
                    <th>Error Message</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={String(row.id ?? `${row.actionId}-${index}`)}>
                      <td>{formatEmpty(row.createdAt)}</td>
                      <td>{formatShortId(row.actionId)}</td>
                      <td>{formatEmpty(row.actionType)}</td>
                      <td><StatusBadge value={row.executionMode} /></td>
                      <td><StatusBadge value={row.executionStatus} /></td>
                      <td>{formatEmpty(row.actor)}</td>
                      <td className="wrap-cell">{formatEmpty(row.blockedReason)}</td>
                      <td className="wrap-cell">{formatEmpty(row.resultMessage)}</td>
                      <td className="wrap-cell">{formatEmpty(row.errorMessage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ListingDraftsPage({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const summary = useApi<ListingDraftSummary>(() => getJson(`/api/listing-drafts/summary?sellerId=${SELLER_ID}`));
  const drafts = useApi<ApiRows<ListingDraft>>(() => getJson(`/api/listing-drafts?sellerId=${SELLER_ID}&limit=100`));
  const [draftType, setDraftType] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const data = listingDraftSummaryOf(summary.data);
  const rows = listingDraftRowsOf(drafts.data);
  const filteredRows = rows.filter((row) => {
    const matchesType = draftType === "ALL" || String(row.draftType ?? "") === draftType;
    const matchesStatus = statusFilter === "ALL" || String(row.status ?? "") === statusFilter;
    const searchText = `${row.sku ?? ""} ${row.asin ?? ""} ${row.productName ?? ""}`.toLowerCase();
    return matchesType && matchesStatus && searchText.includes(query.trim().toLowerCase());
  });
  const draftTypeOptions = ["ALL", ...uniqueTextValues(rows.map((row) => row.draftType))];
  const statusOptions = ["ALL", ...uniqueTextValues(rows.map((row) => row.status))];

  async function generate() {
    setProcessingId("generate");
    setMessage("");
    setError("");
    try {
      await postJson(`/api/listing-drafts/generate?sellerId=${SELLER_ID}`, {});
      setMessage("Listing drafts generated.");
      summary.reload();
      drafts.reload();
    } catch {
      setError("Could not generate listing drafts.");
    } finally {
      setProcessingId("");
    }
  }

  async function createAction(id: string) {
    setProcessingId(id);
    setMessage("");
    setError("");
    try {
      await postJson(`/api/listing-drafts/${encodeURIComponent(id)}/create-action`, {});
      setMessage("Approval action created for listing draft.");
      summary.reload();
      drafts.reload();
    } catch {
      setError("Could not create approval action.");
    } finally {
      setProcessingId("");
    }
  }

  return (
    <div className="page">
      <PageHeader title="Listing Optimization Drafts" subtitle="Review deterministic title, bullet, backend keyword, and description drafts before approval." />
      <SafetyBanner text="Drafts only. No Amazon listing update is executed." />
      {summary.error ? <ErrorBlock text="Could not load listing draft summary." /> : null}
      {drafts.error ? <ErrorBlock text="Could not load listing drafts." /> : null}
      <div className="stack">
        {summary.loading ? <LoadingBlock /> : (
          <div className="summary-strip command-summary">
            <MetricTile label="Total Drafts" value={readNumber(readFirst(data, ["totalDrafts", "total"]))} />
            <MetricTile label="Drafted" value={readNumber(readFirst(data, ["drafted", "draftedCount"]))} />
            <MetricTile label="Action Created" value={readNumber(readFirst(data, ["actionCreated", "actionCreatedCount"]))} />
            <MetricTile label="Approved" value={readNumber(readFirst(data, ["approved", "approvedCount"]))} />
            <MetricTile label="Rejected" value={readNumber(readFirst(data, ["rejected", "rejectedCount"]))} />
            <MetricTile label="Title Drafts" value={readNumber(readFirst(data, ["titleDrafts", "titleCount"]))} />
            <MetricTile label="Bullet Drafts" value={readNumber(readFirst(data, ["bulletDrafts", "bulletCount"]))} />
            <MetricTile label="Backend Keyword Drafts" value={readNumber(readFirst(data, ["backendKeywordDrafts", "backendKeywordCount"]))} />
            <MetricTile label="Description Drafts" value={readNumber(readFirst(data, ["descriptionDrafts", "descriptionCount"]))} />
          </div>
        )}
        <div className="button-row">
          <button type="button" onClick={generate} disabled={processingId !== ""}>Generate Listing Drafts</button>
          <button type="button" className="secondary" onClick={() => { summary.reload(); drafts.reload(); }}>Refresh Drafts</button>
          {message ? <span className="save-message">{message}</span> : null}
          {error ? <span className="save-error">{error}</span> : null}
        </div>
        <Card title="Drafts">
          <div className="form-grid filters-grid">
            <SelectField label="Draft Type" value={draftType} options={draftTypeOptions} onChange={setDraftType} />
            <SelectField label="Status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
            <TextInput label="SKU or ASIN Search" value={query} onChange={setQuery} />
          </div>
          {drafts.loading ? <LoadingBlock /> : filteredRows.length === 0 ? <EmptyBlock text="No listing drafts match these filters." /> : (
            <div className="card-list command-card-list">
              {filteredRows.map((row) => (
                <article className="item-card command-item-card" key={row.id}>
                  <div className="item-top">
                    <strong>{formatEmpty(row.productName ?? row.sku ?? row.asin)}</strong>
                    <StatusBadge value={row.status ?? "DRAFTED"} />
                  </div>
                  <div className="badge-row">
                    <StatusBadge value={row.draftType} />
                    <StatusBadge value={row.confidenceLabel} />
                    <StatusBadge value={row.riskLevel} />
                  </div>
                  <div className="detail-grid">
                    <MetricRow label="SKU" value={formatEmpty(row.sku)} />
                    <MetricRow label="ASIN" value={formatEmpty(row.asin)} />
                    <MetricRow label="Action ID" value={formatShortId(row.actionId)} />
                  </div>
                  <TextDiffBlock current={row.currentValue} proposed={row.proposedValue} reason={row.reason} />
                  <div className="button-row compact">
                    {row.actionId ? (
                      <button type="button" onClick={() => setActiveTab("Approval Center")}>Open Approval Center</button>
                    ) : (
                      <button type="button" onClick={() => createAction(row.id)} disabled={processingId === row.id}>Create Approval Action</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function CreativeRecommendationsPage({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const summary = useApi<CreativeRecommendationSummary>(() => getJson(`/api/creative-recommendations/summary?sellerId=${SELLER_ID}`));
  const recommendations = useApi<ApiRows<CreativeRecommendation>>(() => getJson(`/api/creative-recommendations?sellerId=${SELLER_ID}&limit=100`));
  const [recommendationType, setRecommendationType] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const data = creativeSummaryOf(summary.data);
  const rows = creativeRecommendationRowsOf(recommendations.data);
  const filteredRows = rows.filter((row) => {
    const matchesType = recommendationType === "ALL" || String(row.recommendationType ?? "") === recommendationType;
    const matchesStatus = statusFilter === "ALL" || String(row.status ?? "") === statusFilter;
    const searchText = `${row.sku ?? ""} ${row.asin ?? ""} ${row.productName ?? ""}`.toLowerCase();
    return matchesType && matchesStatus && searchText.includes(query.trim().toLowerCase());
  });
  const typeOptions = ["ALL", ...uniqueTextValues(rows.map((row) => row.recommendationType))];
  const statusOptions = ["ALL", ...uniqueTextValues(rows.map((row) => row.status))];

  async function generate() {
    setProcessingId("generate");
    setMessage("");
    setError("");
    try {
      await postJson(`/api/creative-recommendations/generate?sellerId=${SELLER_ID}`, {});
      setMessage("Image + A+ recommendations generated.");
      summary.reload();
      recommendations.reload();
    } catch {
      setError("Could not generate creative recommendations.");
    } finally {
      setProcessingId("");
    }
  }

  async function createAction(id: string) {
    setProcessingId(id);
    setMessage("");
    setError("");
    try {
      await postJson(`/api/creative-recommendations/${encodeURIComponent(id)}/create-action`, {});
      setMessage("Approval action created for recommendation.");
      summary.reload();
      recommendations.reload();
    } catch {
      setError("Could not create approval action.");
    } finally {
      setProcessingId("");
    }
  }

  return (
    <div className="page">
      <PageHeader title="Image + A+ Recommendations" subtitle="Review image, infographic, lifestyle, size chart, A+, and brand story recommendations." />
      <SafetyBanner text="Recommendations only. No image upload or A+ content update is executed." />
      {summary.error ? <ErrorBlock text="Could not load creative recommendation summary." /> : null}
      {recommendations.error ? <ErrorBlock text="Could not load creative recommendations." /> : null}
      <div className="stack">
        {summary.loading ? <LoadingBlock /> : (
          <div className="summary-strip command-summary">
            <MetricTile label="Total Recommendations" value={readNumber(readFirst(data, ["totalRecommendations", "total"]))} />
            <MetricTile label="Drafted" value={readNumber(readFirst(data, ["drafted", "draftedCount"]))} />
            <MetricTile label="Action Created" value={readNumber(readFirst(data, ["actionCreated", "actionCreatedCount"]))} />
            <MetricTile label="Main Image Reviews" value={readNumber(readFirst(data, ["mainImageReviews", "mainImageCount"]))} />
            <MetricTile label="Infographic Reviews" value={readNumber(readFirst(data, ["infographicReviews", "infographicCount"]))} />
            <MetricTile label="Lifestyle Reviews" value={readNumber(readFirst(data, ["lifestyleReviews", "lifestyleCount"]))} />
            <MetricTile label="Size Chart Reviews" value={readNumber(readFirst(data, ["sizeChartReviews", "sizeChartCount"]))} />
            <MetricTile label="A+ Content Reviews" value={readNumber(readFirst(data, ["aplusContentReviews", "aPlusContentReviews", "aplusCount"]))} />
            <MetricTile label="Brand Story Reviews" value={readNumber(readFirst(data, ["brandStoryReviews", "brandStoryCount"]))} />
          </div>
        )}
        <div className="button-row">
          <button type="button" onClick={generate} disabled={processingId !== ""}>Generate Image + A+ Recommendations</button>
          <button type="button" className="secondary" onClick={() => { summary.reload(); recommendations.reload(); }}>Refresh Recommendations</button>
          {message ? <span className="save-message">{message}</span> : null}
          {error ? <span className="save-error">{error}</span> : null}
        </div>
        <Card title="Recommendations">
          <div className="form-grid filters-grid">
            <SelectField label="Recommendation Type" value={recommendationType} options={typeOptions} onChange={setRecommendationType} />
            <SelectField label="Status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
            <TextInput label="SKU or ASIN Search" value={query} onChange={setQuery} />
          </div>
          {recommendations.loading ? <LoadingBlock /> : filteredRows.length === 0 ? <EmptyBlock text="No creative recommendations match these filters." /> : (
            <div className="card-list command-card-list">
              {filteredRows.map((row) => (
                <article className="item-card command-item-card" key={row.id}>
                  <div className="item-top">
                    <strong>{formatEmpty(row.title ?? row.productName ?? row.sku ?? row.asin)}</strong>
                    <StatusBadge value={row.status ?? "DRAFTED"} />
                  </div>
                  <div className="badge-row">
                    <StatusBadge value={row.recommendationType} />
                    <StatusBadge value={row.confidenceLabel} />
                    <StatusBadge value={row.riskLevel} />
                  </div>
                  <div className="detail-grid">
                    <MetricRow label="SKU" value={formatEmpty(row.sku)} />
                    <MetricRow label="ASIN" value={formatEmpty(row.asin)} />
                    <MetricRow label="Product" value={formatEmpty(row.productName)} />
                    <MetricRow label="Action ID" value={formatShortId(row.actionId)} />
                  </div>
                  <p className="long-text">{formatEmpty(row.summary)}</p>
                  <MetricRow label="Recommended Action" value={formatEmpty(row.recommendedAction)} />
                  <div className="button-row compact">
                    {row.actionId ? (
                      <button type="button" onClick={() => setActiveTab("Approval Center")}>Open Approval Center</button>
                    ) : (
                      <button type="button" onClick={() => createAction(row.id)} disabled={processingId === row.id}>Create Approval Action</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function learningSummaryOf(value: unknown): LearningSummary {
  const root = recordOf(value);
  return recordOf(root.summary ?? root.data ?? root.result ?? root) as LearningSummary;
}

function learningEventsOf(value: unknown): LearningEvent[] {
  return firstRecordRows<LearningEvent>(value, recordOf(value).events, recordOf(value).learningEvents);
}

function learningEngineRows(value: unknown): LearningEngineSummary[] {
  return firstRecordRows<LearningEngineSummary>(value);
}

function LearningEngineSection({ title, rows, mode }: { title: string; rows: LearningEngineSummary[]; mode: "useful" | "weak" }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? <EmptyBlock text={`No ${title.toLowerCase()} yet.`} /> : (
        <div className="card-list command-card-list">
          {rows.map((row, index) => (
            <article className="item-card compact-card" key={String(row.engineKey ?? index)}>
              <div className="item-top">
                <strong>{formatEmpty(row.engineKey)}</strong>
                <StatusBadge value={mode === "useful" ? "USEFUL" : "WATCH"} />
              </div>
              <div className="detail-grid">
                <MetricRow label="Usefulness Score" value={formatEmpty(row.usefulnessScore)} />
                <MetricRow label="Confidence Score" value={formatEmpty(row.confidenceScore)} />
                {mode === "useful" ? (
                  <>
                    <MetricRow label="Approved" value={formatEmpty(row.approvedCount)} />
                    <MetricRow label="Completed" value={formatEmpty(row.completedCount)} />
                    <MetricRow label="Rejected" value={formatEmpty(row.rejectedCount)} />
                  </>
                ) : (
                  <>
                    <MetricRow label="Failed Count" value={formatEmpty(row.failedCount)} />
                    <MetricRow label="Rejected Count" value={formatEmpty(row.rejectedCount)} />
                    <MetricRow label="No Action Count" value={formatEmpty(row.noActionCount)} />
                  </>
                )}
                <MetricRow label="Last Event At" value={formatEmpty(row.lastEventAt)} />
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function gatewayStatusOf(value: unknown): ExecutionGatewayStatus {
  const root = recordOf(value);
  return recordOf(root.status ?? root.summary ?? root.data ?? root.result ?? root) as ExecutionGatewayStatus;
}

function executionAttemptsOf(value: unknown): ExecutionAttempt[] {
  return firstRecordRows<ExecutionAttempt>(value, recordOf(value).attempts, recordOf(value).executionAttempts);
}

function gatewayActionResultOf(value: unknown): AnyRecord {
  const root = recordOf(value);
  return recordOf(root.result ?? root.execution ?? root.preview ?? root.data ?? root);
}

function listingDraftSummaryOf(value: unknown): ListingDraftSummary {
  const root = recordOf(value);
  return recordOf(root.summary ?? root.data ?? root.result ?? root) as ListingDraftSummary;
}

function listingDraftRowsOf(value: unknown): ListingDraft[] {
  return firstRecordRows<ListingDraft>(value, recordOf(value).drafts, recordOf(value).listingDrafts);
}

function creativeSummaryOf(value: unknown): CreativeRecommendationSummary {
  const root = recordOf(value);
  return recordOf(root.summary ?? root.data ?? root.result ?? root) as CreativeRecommendationSummary;
}

function creativeRecommendationRowsOf(value: unknown): CreativeRecommendation[] {
  return firstRecordRows<CreativeRecommendation>(value, recordOf(value).recommendations, recordOf(value).creativeRecommendations);
}

function safetyControlStatusOf(value: unknown): SafetyControlStatus {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return recordOf(root.safetyControl ?? root.safety ?? data.safetyControl ?? result.safetyControl ?? data.status ?? result.status ?? root) as SafetyControlStatus;
}

function safetyAuditRowsOf(value: unknown): SafetyAuditEvent[] {
  const root = recordOf(value);
  const data = recordOf(root.data);
  return firstRecordRows<SafetyAuditEvent>(value, root.auditEvents, root.events, data.auditEvents, data.events);
}

function alertSummaryOf(value: unknown): AlertSummary {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return recordOf(root.summary ?? root.alertSummary ?? data.summary ?? result.summary ?? root) as AlertSummary;
}

function alertRowsOf(value: unknown): AlertEvent[] {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return firstRecordRows<AlertEvent>(value, root.events, root.alerts, data.events, data.alerts, result.events, result.alerts);
}

function experimentSummaryOf(value: unknown): ExperimentSummary {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return recordOf(root.summary ?? root.experimentSummary ?? data.summary ?? result.summary ?? root) as ExperimentSummary;
}

function experimentRowsOf(value: unknown): Experiment[] {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return firstRecordRows<Experiment>(value, root.experiments, root.items, data.experiments, data.items, result.experiments, result.items);
}

function dataFreshnessSummaryOf(value: unknown): DataFreshnessSummary {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return recordOf(root.summary ?? root.dataFreshness ?? data.summary ?? result.summary ?? root) as DataFreshnessSummary;
}

function dataFreshnessRowsOf(value: unknown): DataFreshnessRow[] {
  const root = recordOf(value);
  const summary = recordOf(root.summary);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return firstRecordRows<DataFreshnessRow>(
    value,
    root.rows,
    root.sources,
    root.dataSources,
    summary.rows,
    summary.sources,
    data.rows,
    data.sources,
    data.dataSources,
    result.rows,
    result.sources
  );
}

function aiGatewayStatusOf(value: unknown): AiGatewayStatus {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return recordOf(root.status ?? root.aiGatewayStatus ?? data.status ?? result.status ?? root) as AiGatewayStatus;
}

function aiCostSummaryOf(value: unknown): AiCostSummary {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return recordOf(root.summary ?? root.costSummary ?? data.summary ?? result.summary ?? root) as AiCostSummary;
}

function aiCostEstimateOf(value: unknown): AiCostEstimate {
  const root = recordOf(value);
  return recordOf(root.estimate ?? root.result ?? root.data ?? root) as AiCostEstimate;
}

function aiLedgerRowsOf(value: unknown): AiLedgerRow[] {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return firstRecordRows<AiLedgerRow>(value, root.ledger, root.rows, data.ledger, data.rows, result.ledger, result.rows);
}

function productionHealthSummaryOf(value: unknown): ProductionHealthSummary {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return recordOf(root.summary ?? root.health ?? data.summary ?? result.summary ?? root) as ProductionHealthSummary;
}

function productionHealthModulesOf(value: unknown): ProductionHealthModule[] {
  const root = recordOf(value);
  const summary = recordOf(root.summary);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return firstRecordRows<ProductionHealthModule>(root.modules, summary.modules, data.modules, result.modules);
}

function ListTextCard({ title, rows, emptyText }: { title: string; rows: unknown[]; emptyText: string }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? <EmptyBlock text={emptyText} /> : (
        <ul className="clean-list">
          {rows.map((row, index) => <li key={index}>{formatDailyListItem(row)}</li>)}
        </ul>
      )}
    </Card>
  );
}

function uniqueTextValues(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function TextDiffBlock({ current, proposed, reason }: { current: unknown; proposed: unknown; reason: unknown }) {
  return (
    <div className="text-diff">
      <div>
        <span>Current Value</span>
        <p>{formatEmpty(current)}</p>
      </div>
      <div>
        <span>Proposed Value</span>
        <p>{formatEmpty(proposed)}</p>
      </div>
      <div>
        <span>Reason</span>
        <p>{formatEmpty(reason)}</p>
      </div>
    </div>
  );
}

function SettingsPage() {
  const settings = useApi<AnyRecord>(() => getJson(`/api/automation-settings?sellerId=${SELLER_ID}`));
  const current = recordOf(settings.data?.settings);
  const [form, setForm] = useState({
    mode: "SHADOW",
    maxDailyRecommendations: "10",
    targetAcosDefault: "35",
    minProfitLowPrice: "60",
    minProfitMidPrice: "110",
    shadowModeDays: "60",
    notes: ""
  });

  useEffect(() => {
    if (!settings.data) return;
    const next = recordOf(settings.data.settings);
    setForm({
      mode: String(next.mode ?? "SHADOW"),
      maxDailyRecommendations: String(next.maxDailyRecommendations ?? 10),
      targetAcosDefault: String(next.targetAcosDefault ?? 35),
      minProfitLowPrice: String(next.minProfitLowPrice ?? 60),
      minProfitMidPrice: String(next.minProfitMidPrice ?? 110),
      shadowModeDays: String(next.shadowModeDays ?? 60),
      notes: String(next.notes ?? "")
    });
  }, [settings.data]);

  async function save(event: FormEvent) {
    event.preventDefault();
    await putJson("/api/automation-settings", {
      sellerId: SELLER_ID,
      mode: form.mode,
      maxDailyRecommendations: asInputNumber(form.maxDailyRecommendations),
      targetAcosDefault: asInputNumber(form.targetAcosDefault),
      minProfitLowPrice: asInputNumber(form.minProfitLowPrice),
      minProfitMidPrice: asInputNumber(form.minProfitMidPrice),
      shadowModeDays: asInputNumber(form.shadowModeDays),
      notes: form.notes
    });
    settings.reload();
  }

  async function reset() {
    await postJson(`/api/automation-settings/reset?sellerId=${SELLER_ID}`, {});
    settings.reload();
  }

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="V1 keeps risky Amazon execution disabled." />
      {settings.loading ? <LoadingBlock /> : settings.error ? <ErrorBlock /> : (
        <>
          <Card title="Current Safety Settings">
            <div className="detail-grid">
              <MetricRow label="Mode" value={<StatusBadge value={current.mode} />} />
              <MetricRow label="Max Daily Recommendations" value={formatEmpty(current.maxDailyRecommendations)} />
              <MetricRow label="Target ACOS Default" value={formatPercent(current.targetAcosDefault)} />
              <MetricRow label="Min Profit Low Price" value={formatMoney(current.minProfitLowPrice)} />
              <MetricRow label="Min Profit Mid Price" value={formatMoney(current.minProfitMidPrice)} />
              <MetricRow label="Approval Required For Tier 2" value={current.approvalRequiredForTier2 ? "Required" : "—"} />
              <MetricRow label="Approval Required For Tier 3" value={current.approvalRequiredForTier3 ? "Required" : "—"} />
              <MetricRow label="Shadow Mode Days" value={formatEmpty(current.shadowModeDays)} />
              {["allowAutoNegative", "allowAutoBidChange", "allowAutoBudgetChange", "allowAutoKeywordAdd", "allowAutoProductTargetAdd", "allowAutoListingChange", "allowAutoPriceChange"].map((key) => (
                <MetricRow key={key} label={labelize(key)} value={<StatusBadge value="OFF" />} />
              ))}
            </div>
          </Card>
          <Card title="Edit Safe Settings">
            <form className="form-grid" onSubmit={save}>
              <SelectField label="Mode" value={form.mode} options={["SHADOW", "APPROVAL", "AUTO_LATER"]} onChange={(value) => setForm({ ...form, mode: value })} />
              <TextInput label="Max Daily Recommendations" type="number" value={form.maxDailyRecommendations} onChange={(value) => setForm({ ...form, maxDailyRecommendations: value })} />
              <TextInput label="Target ACOS Default" type="number" value={form.targetAcosDefault} onChange={(value) => setForm({ ...form, targetAcosDefault: value })} />
              <TextInput label="Min Profit Low Price" type="number" value={form.minProfitLowPrice} onChange={(value) => setForm({ ...form, minProfitLowPrice: value })} />
              <TextInput label="Min Profit Mid Price" type="number" value={form.minProfitMidPrice} onChange={(value) => setForm({ ...form, minProfitMidPrice: value })} />
              <TextInput label="Shadow Mode Days" type="number" value={form.shadowModeDays} onChange={(value) => setForm({ ...form, shadowModeDays: value })} />
              <TextArea label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
              <div className="button-row">
                <button type="submit">Save Settings</button>
                <button type="button" className="secondary" onClick={reset}>Reset</button>
              </div>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}

function hardeningSummaryOf<T extends AnyRecord>(value: unknown): T {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return recordOf(root.summary ?? data.summary ?? result.summary ?? root.health ?? root.latest ?? root.data ?? root.result ?? root) as T;
}

function qaSmokeLatestOf(value: unknown): QaSmokeLatest {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return recordOf(root.latestRun ?? data.latestRun ?? result.latestRun ?? root.latest ?? data.latest ?? result.latest ?? root) as QaSmokeLatest;
}

function hardeningResultOf(value: unknown): AnyRecord {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return recordOf(
    root.preview ??
      root.execution ??
      root.rollback ??
      root.run ??
      root.latestRun ??
      data.preview ??
      result.preview ??
      data.execution ??
      result.execution ??
      data.rollback ??
      result.rollback ??
      data.run ??
      result.run ??
      data.latestRun ??
      result.latestRun ??
      root.result ??
      root.data ??
      root
  );
}

function hardeningRowsOf<T extends AnyRecord>(value: unknown, ...sources: unknown[]): T[] {
  const root = recordOf(value);
  const data = recordOf(root.data);
  const result = recordOf(root.result);
  return firstRecordRows<T>(
    ...sources,
    root.events,
    root.latestEvents,
    root.snapshots,
    root.latestSnapshots,
    root.actions,
    root.readyActions,
    root.latestReadyActions,
    root.runs,
    root.latestRuns,
    root.checks,
    root.rows,
    root.items,
    data.events,
    data.latestEvents,
    data.snapshots,
    data.latestSnapshots,
    data.actions,
    data.readyActions,
    data.latestReadyActions,
    data.runs,
    data.latestRuns,
    data.checks,
    data.rows,
    result.events,
    result.latestEvents,
    result.snapshots,
    result.latestSnapshots,
    result.actions,
    result.readyActions,
    result.latestReadyActions,
    result.runs,
    result.latestRuns,
    result.checks,
    result.rows,
    value
  );
}

function responseWasBlocked(value: unknown): boolean {
  const root = recordOf(value);
  const result = hardeningResultOf(value);
  return root.ok === false || result.ok === false || normalizeState(result.status).includes("BLOCK");
}

function actionIdOf(row: AnyRecord): string {
  return String(row.actionId ?? row.id ?? "").trim();
}

function snapshotIdOf(row: RollbackSnapshot): string {
  return String(row.snapshotId ?? row.id ?? "").trim();
}

function SeverityBadge({ value }: { value: unknown }) {
  const label = normalizeState(value || "INFO");
  const tone = label === "INFO" ? "good" : label === "WARNING" || label === "WARN" ? "watch" : label === "ERROR" || label === "CRITICAL" ? "risk" : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

function ResultPanel({ title, result }: { title: string; result: AnyRecord | null }) {
  if (!result) return null;
  return (
    <Card title={title}>
      <div className="detail-grid">
        {Object.entries(result).slice(0, 12).map(([key, value]) => (
          <MetricRow key={key} label={labelize(key)} value={typeof value === "object" ? <JsonSnippet value={value} /> : formatObjectValue(value)} />
        ))}
      </div>
    </Card>
  );
}

function ActivityLogsPage() {
  const summary = useApi<ActivityLogSummary>(() => activityLogsApi.summary(SELLER_ID));
  const events = useApi<ApiRows<ActivityLogEvent>>(() => activityLogsApi.events(SELLER_ID, 100));
  const data = hardeningSummaryOf<ActivityLogSummary>(summary.data);
  const rows = hardeningRowsOf<ActivityLogEvent>(events.data);
  const [severity, setSeverity] = useState("All");
  const [category, setCategory] = useState("All");
  const [module, setModule] = useState("All");
  const [eventType, setEventType] = useState("All");
  const [search, setSearch] = useState("");
  const filteredRows = rows.filter((row) => {
    const haystack = [row.title, row.message, row.sku, row.asin, row.actionId].map((value) => String(value ?? "").toLowerCase()).join(" ");
    return (severity === "All" || normalizeState(row.severity) === severity) &&
      (category === "All" || String(row.eventCategory ?? "") === category) &&
      (module === "All" || String(row.sourceModule ?? "") === module) &&
      (eventType === "All" || String(row.eventType ?? "") === eventType) &&
      (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  });
  const refresh = () => {
    summary.reload();
    events.reload();
  };

  return (
    <div className="page">
      <PageHeader title="Activity Logs" subtitle="Founder-visible system timeline for approvals, engines, execution, alerts, maintenance, and QA." />
      <SafetyBanner text="Activity logs are internal only. No external action is executed." />
      <div className="stack">
        <div className="button-row"><button type="button" onClick={refresh}>Refresh</button></div>
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock text="Could not load activity log summary." /> : (
          <div className="summary-strip command-summary">
            <MetricTile label="Total Events" value={summaryNumber(data, ["totalEvents", "total"], rows.length)} />
            <MetricTile label="Info Count" value={summaryNumber(data, ["infoCount"], rows.filter((row) => normalizeState(row.severity) === "INFO").length)} />
            <MetricTile label="Warning Count" value={summaryNumber(data, ["warningCount", "warnCount"], rows.filter((row) => ["WARNING", "WARN"].includes(normalizeState(row.severity))).length)} />
            <MetricTile label="Error Count" value={summaryNumber(data, ["errorCount"], rows.filter((row) => normalizeState(row.severity) === "ERROR").length)} />
            <MetricTile label="Critical Count" value={summaryNumber(data, ["criticalCount"], rows.filter((row) => normalizeState(row.severity) === "CRITICAL").length)} />
            <MetricTile label="Today Events" value={summaryNumber(data, ["todayEvents", "eventsToday"], 0)} />
          </div>
        )}
        <Card title="Latest Events">
          <div className="form-grid filters-grid">
            <SelectField label="Severity" value={severity} options={["All", ...uniqueTextValues(rows.map((row) => normalizeState(row.severity || "INFO")))]} onChange={setSeverity} />
            <SelectField label="Event Category" value={category} options={["All", ...uniqueTextValues(rows.map((row) => row.eventCategory))]} onChange={setCategory} />
            <SelectField label="Source Module" value={module} options={["All", ...uniqueTextValues(rows.map((row) => row.sourceModule))]} onChange={setModule} />
            <SelectField label="Event Type" value={eventType} options={["All", ...uniqueTextValues(rows.map((row) => row.eventType))]} onChange={setEventType} />
            <TextInput label="Search" value={search} onChange={setSearch} />
          </div>
          {events.loading ? <LoadingBlock /> : events.error ? <ErrorBlock text="Could not load activity log events." /> : filteredRows.length === 0 ? <EmptyBlock text="No activity events match these filters." /> : (
            <div className="card-list command-card-list">
              {filteredRows.map((row, index) => (
                <article className="item-card command-item-card" key={String(row.id ?? `${row.eventType}-${index}`)}>
                  <div className="item-top">
                    <strong>{formatEmpty(row.title ?? row.eventType)}</strong>
                    <SeverityBadge value={row.severity} />
                  </div>
                  <p className="long-text">{formatEmpty(row.message)}</p>
                  <div className="detail-grid">
                    <MetricRow label="Created At" value={formatLocalDateTime(row.createdAt)} />
                    <MetricRow label="Category" value={formatEmpty(row.eventCategory)} />
                    <MetricRow label="Event Type" value={formatEmpty(row.eventType)} />
                    <MetricRow label="Actor" value={formatEmpty(row.actor)} />
                    <MetricRow label="Source Module" value={formatEmpty(row.sourceModule)} />
                    <MetricRow label="Entity Type" value={formatEmpty(row.entityType)} />
                    <MetricRow label="Entity ID" value={formatEmpty(row.entityId)} />
                    <MetricRow label="SKU" value={formatEmpty(row.sku)} />
                    <MetricRow label="ASIN" value={formatEmpty(row.asin)} />
                    <MetricRow label="Action ID" value={formatShortId(row.actionId)} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const LIVE_EXECUTE_CONFIRM_TEXT = "EXECUTE LIVE APPROVED ACTION";
const guardrailActions = [
  "LIVE_PPC_EXECUTION",
  "LIVE_LISTING_EXECUTION",
  "LIVE_ROLLBACK_EXECUTION",
  "AI_GENERATE",
  "NOTIFICATION_SEND",
  "SAFETY_SETTING_UPDATE"
];

function liveExecutionStatusOf(value: unknown): LiveExecutionStatus {
  return hardeningSummaryOf<LiveExecutionStatus>(value);
}

function liveExecutionRunsOf(value: unknown): LiveExecutionRun[] {
  return hardeningRowsOf<LiveExecutionRun>(value);
}

function launchGateSummaryOf(value: unknown): LaunchGateSummary {
  return hardeningSummaryOf<LaunchGateSummary>(value);
}

function launchGateChecksOf(value: unknown): LaunchGateCheck[] {
  const data = launchGateSummaryOf(value);
  return hardeningRowsOf<LaunchGateCheck>(value, data.checks);
}

function launchChecklistSummaryOf(value: unknown): LaunchChecklistSummary {
  return hardeningSummaryOf<LaunchChecklistSummary>(value);
}

function launchChecklistItemsOf(value: unknown): LaunchChecklistItem[] {
  const data = launchChecklistSummaryOf(value);
  return hardeningRowsOf<LaunchChecklistItem>(value, data.items, data.checklist);
}

function schedulerSummaryOf(value: unknown): SchedulerSummary {
  return hardeningSummaryOf<SchedulerSummary>(value);
}

function schedulerJobsOf(value: unknown): SchedulerJob[] {
  return hardeningRowsOf<SchedulerJob>(value);
}

function notificationSummaryOf(value: unknown): NotificationSummary {
  return hardeningSummaryOf<NotificationSummary>(value);
}

function notificationSettingsOf(value: unknown): NotificationSettings {
  return hardeningSummaryOf<NotificationSettings>(value);
}

function notificationMessagesOf(value: unknown): NotificationMessage[] {
  return hardeningRowsOf<NotificationMessage>(value);
}

function securityGuardrailSummaryOf(value: unknown): SecurityGuardrailSummary {
  return hardeningSummaryOf<SecurityGuardrailSummary>(value);
}

function securityAuditEventsOf(value: unknown): SecurityAuditEvent[] {
  return hardeningRowsOf<SecurityAuditEvent>(value);
}

function blockedOutcomeMessage(value: unknown, fallback: string): string {
  return responseWasBlocked(value) ? fallback : "Backend response received.";
}

function LiveExecutionPage() {
  const status = useApi<LiveExecutionStatus>(() => liveExecutionApi.status(SELLER_ID));
  const runs = useApi<ApiRows<LiveExecutionRun>>(() => liveExecutionApi.runs(SELLER_ID, 100));
  const data = liveExecutionStatusOf(status.data);
  const rows = liveExecutionRunsOf(runs.data);
  const [actionId, setActionId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [domainFilter, setDomainFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [actionTypeFilter, setActionTypeFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [processing, setProcessing] = useState("");
  const [result, setResult] = useState<AnyRecord | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const liveEligible = readBoolean(readFirst(data, ["liveExecutionEnabled", "settings.liveExecutionEnabled"]));
  const filteredRows = rows.filter((row) => {
    const rowStatus = String(row.liveStatus ?? row.dryRunStatus ?? "UNKNOWN");
    const haystack = `${row.sku ?? ""} ${row.asin ?? ""}`.toLowerCase();
    return (domainFilter === "All" || String(row.executionDomain ?? "UNKNOWN") === domainFilter) &&
      (statusFilter === "All" || rowStatus === statusFilter) &&
      (actionTypeFilter === "All" || String(row.actionType ?? "UNKNOWN") === actionTypeFilter) &&
      (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  });

  async function runAction(kind: "preflight" | "dry-run" | "live") {
    const id = actionId.trim();
    if (!id) {
      setError("Action ID is required.");
      setMessage("");
      return;
    }
    if (kind === "live") {
      if (confirmText.trim() !== LIVE_EXECUTE_CONFIRM_TEXT) {
        setError(`Exact confirm text required: ${LIVE_EXECUTE_CONFIRM_TEXT}`);
        setMessage("");
        return;
      }
      if (!window.confirm("This can change the Amazon account if all gates pass. Continue only for an approved controlled test.")) return;
    }
    setProcessing(kind);
    setError("");
    setMessage("");
    try {
      const response = kind === "preflight"
        ? await liveExecutionApi.preflight(id)
        : kind === "dry-run"
          ? await liveExecutionApi.dryRun(id)
          : await liveExecutionApi.executeLive(id, { sellerId: SELLER_ID, actor: "founder", confirmText: LIVE_EXECUTE_CONFIRM_TEXT });
      setResult(hardeningResultOf(response));
      setMessage(kind === "live" ? blockedOutcomeMessage(response, "Live execution blocked safely.") : "Live execution check response received.");
      status.reload();
      runs.reload();
    } catch (requestError) {
      const sanitized = sanitizeActionError(requestError);
      const safeBlock = kind === "live" && ["BLOCK", "LOCK", "DISABLED", "NOT ELIGIBLE", "GATE"].some((term) => normalizeState(sanitized).includes(term));
      if (safeBlock) {
        setMessage("Live execution blocked safely.");
        setError("");
      } else {
        setError(sanitized);
      }
    } finally {
      setProcessing("");
    }
  }

  return (
    <div className="page">
      <PageHeader title="Controlled Live Execution Center" subtitle="Run preflight, dry-run, and tightly gated live execution for approved Amazon PPC/listing actions." />
      <SafetyBanner text="Live execution is locked unless Safety Control, QA Smoke, Production Health, Rollback, Dry Run, and explicit founder confirmation all pass." />
      <div className="stack">
        {status.loading ? <LoadingBlock /> : status.error ? <ErrorBlock text="Could not load live execution status." /> : (
          <div className="summary-strip command-summary">
            <MetricTile label="Mode" value={<StatusBadge value={readFirst(data, ["mode"]) ?? "LOCKED"} />} />
            <MetricTile label="Live Execution Enabled" value={<StatusBadge value={liveEligible ? "ELIGIBLE" : "LOCKED"} />} />
            <MetricTile label="PPC Live Execution Enabled" value={<StatusBadge value={readBoolean(readFirst(data, ["ppcLiveExecutionEnabled", "ppcLiveExecution"])) ? "ELIGIBLE" : "LOCKED"} />} />
            <MetricTile label="Listing Live Execution Enabled" value={<StatusBadge value={readBoolean(readFirst(data, ["listingLiveExecutionEnabled", "listingLiveExecution"])) ? "ELIGIBLE" : "LOCKED"} />} />
            <MetricTile label="AI Calls Enabled" value={<StatusBadge value={readBoolean(readFirst(data, ["aiCallsEnabled"])) ? "ENABLED" : "DISABLED"} />} />
            <MetricTile label="Message" value={formatEmpty(readFirst(data, ["message"]) ?? "Live execution is locked.")} />
            <MetricTile label="Total Live Runs" value={summaryNumber(data, ["totalLiveRuns"], rows.length)} />
            <MetricTile label="Dry Runs" value={summaryNumber(data, ["dryRuns", "dryRunCount"], rows.filter((row) => row.dryRunStatus).length)} />
            <MetricTile label="Blocked Runs" value={summaryNumber(data, ["blockedRuns", "blockedCount"], rows.filter((row) => normalizeState(row.liveStatus).includes("BLOCK")).length)} />
            <MetricTile label="Successful Live Runs" value={summaryNumber(data, ["successfulLiveRuns", "successLiveRuns"], rows.filter((row) => normalizeState(row.liveStatus) === "SUCCESS").length)} />
            <MetricTile label="Failed Runs" value={summaryNumber(data, ["failedRuns", "failedCount"], rows.filter((row) => normalizeState(row.liveStatus) === "FAILED").length)} />
          </div>
        )}
        <Card title="Action Controls">
          <div className="form-grid">
            <TextInput label="Action ID" value={actionId} onChange={setActionId} />
            <TextInput label="Confirm Text" value={confirmText} onChange={setConfirmText} />
            <div className="button-row gateway-buttons">
              <button type="button" onClick={() => runAction("preflight")} disabled={processing !== ""}>Run Preflight</button>
              <button type="button" onClick={() => runAction("dry-run")} disabled={processing !== ""}>Run Dry-Run</button>
              <button type="button" className="danger-button live-block-button" onClick={() => runAction("live")} disabled={processing !== "" || confirmText.trim() !== LIVE_EXECUTE_CONFIRM_TEXT}>
                Execute Live Locked
              </button>
            </div>
          </div>
          <p className="section-note">Execute Live requires exact founder confirmation and remains locked unless the backend returns eligibility.</p>
          {message ? <div className="soft-state success-state compact-state">{message}</div> : null}
          {error ? <div className="soft-state error-state compact-state">{error}</div> : null}
        </Card>
        <ResultPanel title="Result" result={result} />
        <Card title="Runs">
          <div className="form-grid filters-grid">
            <SelectField label="Domain" value={domainFilter} options={["All", ...uniqueTextValues(rows.map((row) => row.executionDomain ?? "UNKNOWN"))]} onChange={setDomainFilter} />
            <SelectField label="Status" value={statusFilter} options={["All", ...uniqueTextValues(rows.map((row) => row.liveStatus ?? row.dryRunStatus ?? "UNKNOWN"))]} onChange={setStatusFilter} />
            <SelectField label="Action Type" value={actionTypeFilter} options={["All", ...uniqueTextValues(rows.map((row) => row.actionType ?? "UNKNOWN"))]} onChange={setActionTypeFilter} />
            <TextInput label="SKU/ASIN Search" value={search} onChange={setSearch} />
          </div>
          {runs.loading ? <LoadingBlock /> : runs.error ? <ErrorBlock text="Could not load live execution runs." /> : filteredRows.length === 0 ? <EmptyBlock text="No live execution runs match these filters." /> : (
            <div className="card-list command-card-list">
              {filteredRows.map((row, index) => (
                <article className="item-card command-item-card" key={String(row.id ?? `${row.actionId}-${index}`)}>
                  <div className="item-top">
                    <strong>{formatShortId(row.actionId)}</strong>
                    <StatusBadge value={row.liveStatus ?? row.dryRunStatus ?? "UNKNOWN"} />
                  </div>
                  <div className="detail-grid">
                    <MetricRow label="Created At" value={formatLocalDateTime(row.createdAt)} />
                    <MetricRow label="Execution Domain" value={formatEmpty(row.executionDomain)} />
                    <MetricRow label="Action Type" value={formatEmpty(row.actionType)} />
                    <MetricRow label="SKU" value={formatEmpty(row.sku)} />
                    <MetricRow label="ASIN" value={formatEmpty(row.asin)} />
                    <MetricRow label="Live Status" value={<StatusBadge value={row.liveStatus ?? "UNKNOWN"} />} />
                    <MetricRow label="Dry Run Status" value={<StatusBadge value={row.dryRunStatus ?? "UNKNOWN"} />} />
                    <MetricRow label="Blocked Reason" value={<span className="long-text">{formatEmpty(row.blockedReason)}</span>} />
                    <MetricRow label="Error Message" value={<span className="long-text">{formatEmpty(row.errorMessage)}</span>} />
                    <MetricRow label="Actor" value={formatEmpty(row.actor)} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function LaunchGatePage() {
  const summary = useApi<LaunchGateSummary>(() => launchGateApi.summary(SELLER_ID));
  const data = launchGateSummaryOf(summary.data);
  const checks = launchGateChecksOf(summary.data);
  const blockers = dailyList(readFirst(data, ["blockers"]));
  const warnings = dailyList(readFirst(data, ["warnings"]));
  const nextSteps = dailyList(readFirst(data, ["nextSteps"]));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");

  async function runGate() {
    setRunning(true);
    setError("");
    try {
      const response = await launchGateApi.run(SELLER_ID);
      setResult(hardeningResultOf(response));
      summary.reload();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Launch Gate" subtitle="Final gatekeeper before any limited live test." />
      <SafetyBanner text="Launch Gate does not enable live execution. It only checks eligibility." />
      <div className="stack">
        <div className="button-row"><button type="button" onClick={runGate} disabled={running}>{running ? "Running Launch Gate..." : "Run Launch Gate"}</button></div>
        {error ? <div className="soft-state error-state compact-state">{error}</div> : null}
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock text="Could not load launch gate summary." /> : (
          <>
            <div className="summary-strip command-summary">
              <MetricTile label="Overall Status" value={<StatusBadge value={readFirst(data, ["overallStatus", "status"]) ?? "UNKNOWN"} />} />
              <MetricTile label="Live Eligible" value={<StatusBadge value={readBoolean(readFirst(data, ["liveEligible"])) ? "PASS" : "LOCKED"} />} />
              <MetricTile label="PPC Live Eligible" value={<StatusBadge value={readBoolean(readFirst(data, ["ppcLiveEligible"])) ? "PASS" : "LOCKED"} />} />
              <MetricTile label="Listing Live Eligible" value={<StatusBadge value={readBoolean(readFirst(data, ["listingLiveEligible"])) ? "PASS" : "LOCKED"} />} />
              <MetricTile label="Blockers Count" value={summaryNumber(data, ["blockersCount"], blockers.length)} />
              <MetricTile label="Warnings Count" value={summaryNumber(data, ["warningsCount"], warnings.length)} />
            </div>
            <ResultPanel title="Launch Gate Result" result={result} />
            <Card title="Checks">
              {checks.length === 0 ? <EmptyBlock text="No Launch Gate checks returned yet." /> : (
                <div className="card-list command-card-list">
                  {checks.map((check, index) => (
                    <article className="item-card command-item-card" key={String(check.checkKey ?? index)}>
                      <div className="item-top">
                        <strong>{formatEmpty(check.checkName ?? check.checkKey)}</strong>
                        <StatusBadge value={check.status ?? "UNKNOWN"} />
                      </div>
                      <p className="long-text">{formatEmpty(check.message)}</p>
                      <div className="detail-grid">
                        <MetricRow label="Check Key" value={formatEmpty(check.checkKey)} />
                        <MetricRow label="Severity" value={<StatusBadge value={check.severity ?? "UNKNOWN"} />} />
                        <MetricRow label="Last Checked At" value={formatLocalDateTime(check.lastCheckedAt)} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>
            <div className="dashboard-grid today">
              <ListTextCard title="Blockers" rows={blockers} emptyText="No launch blockers returned." />
              <ListTextCard title="Warnings" rows={warnings} emptyText="No launch warnings returned." />
            </div>
            <ListTextCard title="Next Steps" rows={nextSteps} emptyText="No launch next steps returned." />
          </>
        )}
      </div>
    </div>
  );
}

function LaunchChecklistPage() {
  const summary = useApi<LaunchChecklistSummary>(() => launchChecklistApi.summary(SELLER_ID));
  const data = launchChecklistSummaryOf(summary.data);
  const items = launchChecklistItemsOf(summary.data);
  const nextSteps = dailyList(readFirst(data, ["nextSteps"]));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");

  async function runChecklist() {
    setRunning(true);
    setError("");
    try {
      const response = await launchChecklistApi.run(SELLER_ID);
      setResult(hardeningResultOf(response));
      summary.reload();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Production Launch Checklist" subtitle="Complete readiness checklist for shadow launch and limited live test." />
      <SafetyBanner text="Checklist statuses: NOT_READY, READY_FOR_SHADOW_LAUNCH, READY_FOR_LIMITED_LIVE_TEST." />
      <div className="stack">
        <div className="button-row"><button type="button" onClick={runChecklist} disabled={running}>{running ? "Running Launch Checklist..." : "Run Launch Checklist"}</button></div>
        {error ? <div className="soft-state error-state compact-state">{error}</div> : null}
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock text="Could not load launch checklist summary." /> : (
          <>
            <div className="summary-strip command-summary">
              <MetricTile label="Overall Launch Status" value={<StatusBadge value={readFirst(data, ["overallLaunchStatus", "status"]) ?? "UNKNOWN"} />} />
              <MetricTile label="Ready Items" value={summaryNumber(data, ["readyItems"], items.filter((item) => normalizeState(item.status).includes("READY")).length)} />
              <MetricTile label="Warning Items" value={summaryNumber(data, ["warningItems"], items.filter((item) => ["WARN", "WARNING"].includes(normalizeState(item.status))).length)} />
              <MetricTile label="Failed Items" value={summaryNumber(data, ["failedItems"], items.filter((item) => ["FAIL", "FAILED", "NOT_READY"].includes(normalizeState(item.status))).length)} />
              <MetricTile label="Ready For Shadow Launch" value={<StatusBadge value={readBoolean(readFirst(data, ["readyForShadowLaunch"])) ? "READY" : "NOT_READY"} />} />
              <MetricTile label="Ready For Limited Live Test" value={<StatusBadge value={readBoolean(readFirst(data, ["readyForLimitedLiveTest"])) ? "READY" : "NOT_READY"} />} />
            </div>
            <ResultPanel title="Launch Checklist Result" result={result} />
            <Card title="Checklist">
              {items.length === 0 ? <EmptyBlock text="No launch checklist items returned yet." /> : (
                <div className="card-list command-card-list">
                  {items.map((item, index) => (
                    <article className="item-card command-item-card" key={String(item.key ?? index)}>
                      <div className="item-top">
                        <strong>{formatEmpty(item.label ?? item.key)}</strong>
                        <StatusBadge value={item.status ?? "UNKNOWN"} />
                      </div>
                      <p className="long-text">{formatEmpty(item.message)}</p>
                      <div className="detail-grid">
                        <MetricRow label="Key" value={formatEmpty(item.key)} />
                        <MetricRow label="Critical" value={readBoolean(item.critical) ? "Yes" : "No"} />
                        <MetricRow label="Updated At" value={formatLocalDateTime(item.updatedAt)} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>
            <ListTextCard title="Next Steps" rows={nextSteps} emptyText="No checklist next steps returned." />
          </>
        )}
      </div>
    </div>
  );
}

function SchedulerControlPage() {
  const summary = useApi<SchedulerSummary>(() => schedulerControlApi.summary(SELLER_ID));
  const jobs = useApi<ApiRows<SchedulerJob>>(() => schedulerControlApi.jobs(SELLER_ID));
  const data = schedulerSummaryOf(summary.data);
  const rows = schedulerJobsOf(jobs.data);
  const [processing, setProcessing] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function refresh() {
    summary.reload();
    jobs.reload();
  }

  async function seedJobs() {
    setProcessing("seed");
    setMessage("");
    setError("");
    try {
      await schedulerControlApi.seedJobs(SELLER_ID);
      setMessage("Default scheduler jobs seeded.");
      refresh();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setProcessing("");
    }
  }

  async function runJob(jobKey: string) {
    setProcessing(`run:${jobKey}`);
    setMessage("");
    setError("");
    try {
      await schedulerControlApi.runJob(jobKey, SELLER_ID);
      setMessage(`Scheduler job ${formatShortId(jobKey)} run requested.`);
      refresh();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setProcessing("");
    }
  }

  async function toggleJob(row: SchedulerJob) {
    const jobKey = String(row.jobKey ?? row.id ?? "").trim();
    if (!jobKey) return;
    setProcessing(`toggle:${jobKey}`);
    setMessage("");
    setError("");
    try {
      await schedulerControlApi.updateJob(jobKey, SELLER_ID, { enabled: !readBoolean(row.enabled) });
      setMessage(`Scheduler job ${formatShortId(jobKey)} updated.`);
      refresh();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setProcessing("");
    }
  }

  return (
    <div className="page">
      <PageHeader title="Scheduler Control" subtitle="Manage safe recurring internal jobs for sync, AI-CGO, maintenance, QA, alerts, and freshness." />
      <SafetyBanner text="Scheduler jobs run internal checks/orchestrations. They do not execute live marketplace mutations." />
      <div className="stack">
        <div className="button-row">
          <button type="button" onClick={seedJobs} disabled={processing !== ""}>Seed Default Jobs</button>
          <button type="button" className="secondary" onClick={refresh}>Refresh Jobs</button>
        </div>
        {message ? <div className="soft-state success-state compact-state">{message}</div> : null}
        {error ? <div className="soft-state error-state compact-state">{error}</div> : null}
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock text="Could not load scheduler summary." /> : (
          <div className="summary-strip command-summary">
            <MetricTile label="Total Jobs" value={summaryNumber(data, ["totalJobs"], rows.length)} />
            <MetricTile label="Enabled Jobs" value={summaryNumber(data, ["enabledJobs"], rows.filter((row) => readBoolean(row.enabled)).length)} />
            <MetricTile label="Disabled Jobs" value={summaryNumber(data, ["disabledJobs"], rows.filter((row) => !readBoolean(row.enabled)).length)} />
            <MetricTile label="Last Run Status" value={<StatusBadge value={readFirst(data, ["lastRunStatus"]) ?? "UNKNOWN"} />} />
            <MetricTile label="Failed Runs" value={summaryNumber(data, ["failedRuns"], 0)} />
            <MetricTile label="Successful Runs" value={summaryNumber(data, ["successfulRuns"], 0)} />
          </div>
        )}
        <Card title="Jobs">
          {jobs.loading ? <LoadingBlock /> : jobs.error ? <ErrorBlock text="Could not load scheduler jobs." /> : rows.length === 0 ? <EmptyBlock text="No scheduler jobs returned. Seed default jobs when the backend is ready." /> : (
            <div className="card-list command-card-list">
              {rows.map((row, index) => {
                const jobKey = String(row.jobKey ?? row.id ?? "").trim();
                return (
                  <article className="item-card command-item-card" key={String(jobKey || index)}>
                    <div className="item-top">
                      <strong>{formatEmpty(row.jobName ?? row.jobKey)}</strong>
                      <StatusBadge value={readBoolean(row.enabled) ? "ENABLED" : "DISABLED"} />
                    </div>
                    <div className="detail-grid">
                      <MetricRow label="Job Key" value={formatEmpty(jobKey)} />
                      <MetricRow label="Job Type" value={formatEmpty(row.jobType)} />
                      <MetricRow label="Schedule Hint" value={formatEmpty(row.scheduleHint)} />
                      <MetricRow label="Last Run At" value={formatLocalDateTime(row.lastRunAt)} />
                      <MetricRow label="Last Run Status" value={<StatusBadge value={row.lastRunStatus ?? "UNKNOWN"} />} />
                    </div>
                    <div className="button-row compact">
                      <button type="button" onClick={() => runJob(jobKey)} disabled={!jobKey || processing !== ""}>Run Now</button>
                      <button type="button" className="secondary" onClick={() => toggleJob(row)} disabled={!jobKey || processing !== ""}>{readBoolean(row.enabled) ? "Disable" : "Enable"}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function NotificationOutboxPage() {
  const summary = useApi<NotificationSummary>(() => notificationOutboxApi.summary(SELLER_ID));
  const messages = useApi<ApiRows<NotificationMessage>>(() => notificationOutboxApi.messages(SELLER_ID, 100));
  const settings = useApi<NotificationSettings>(() => notificationOutboxApi.settings(SELLER_ID));
  const data = notificationSummaryOf(summary.data);
  const settingsData = notificationSettingsOf(settings.data);
  const rows = notificationMessagesOf(messages.data);
  const settingsMissing = !settings.loading && (settings.error || Object.keys(settingsData).length === 0);
  const [processing, setProcessing] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function refresh() {
    summary.reload();
    messages.reload();
    settings.reload();
  }

  async function initialize() {
    setProcessing("initialize");
    setMessage("");
    setError("");
    try {
      await notificationOutboxApi.initialize(SELLER_ID);
      setMessage("Notification settings initialized.");
      refresh();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setProcessing("");
    }
  }

  async function sendMessage(id: string) {
    setProcessing(`send:${id}`);
    setMessage("");
    setError("");
    try {
      const response = await notificationOutboxApi.send(id);
      setMessage(blockedOutcomeMessage(response, "Notification sending blocked safely."));
      refresh();
    } catch (requestError) {
      const sanitized = sanitizeActionError(requestError);
      const safeBlock = ["BLOCK", "DISABLED", "PROVIDER", "MISSING", "NOT CONFIGURED"].some((term) => normalizeState(sanitized).includes(term));
      if (safeBlock) {
        setMessage("Notification sending blocked safely.");
        setError("");
      } else {
        setError(sanitized);
      }
    } finally {
      setProcessing("");
    }
  }

  return (
    <div className="page">
      <PageHeader title="Notification Outbox" subtitle="Queued founder notifications. External sending is disabled unless explicitly configured." />
      <SafetyBanner text="No email, WhatsApp, or Slack is sent unless settings and provider are configured." />
      <div className="stack">
        {settingsMissing ? <div className="button-row"><button type="button" onClick={initialize} disabled={processing !== ""}>Initialize Notification Settings</button></div> : null}
        {message ? <div className="soft-state success-state compact-state">{message}</div> : null}
        {error ? <div className="soft-state error-state compact-state">{error}</div> : null}
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock text="Could not load notification summary." /> : (
          <div className="summary-strip command-summary">
            <MetricTile label="Queued" value={summaryNumber(data, ["queued", "queuedCount"], rows.filter((row) => normalizeState(row.status) === "QUEUED").length)} />
            <MetricTile label="Sent" value={summaryNumber(data, ["sent", "sentCount"], rows.filter((row) => normalizeState(row.status) === "SENT").length)} />
            <MetricTile label="Blocked" value={summaryNumber(data, ["blocked", "blockedCount"], rows.filter((row) => normalizeState(row.status).includes("BLOCK")).length)} />
            <MetricTile label="Failed" value={summaryNumber(data, ["failed", "failedCount"], rows.filter((row) => normalizeState(row.status) === "FAILED").length)} />
            <MetricTile label="External Notifications Enabled" value={<StatusBadge value={readBoolean(readFirst(settingsData, ["externalNotificationsEnabled"]) ?? readFirst(data, ["externalNotificationsEnabled"])) ? "ENABLED" : "DISABLED"} />} />
            <MetricTile label="Email Enabled" value={<StatusBadge value={readBoolean(readFirst(settingsData, ["emailEnabled"]) ?? readFirst(data, ["emailEnabled"])) ? "ENABLED" : "DISABLED"} />} />
            <MetricTile label="WhatsApp Enabled" value={<StatusBadge value={readBoolean(readFirst(settingsData, ["whatsappEnabled"]) ?? readFirst(data, ["whatsAppEnabled"])) ? "ENABLED" : "DISABLED"} />} />
            <MetricTile label="Slack Enabled" value={<StatusBadge value={readBoolean(readFirst(settingsData, ["slackEnabled"]) ?? readFirst(data, ["slackEnabled"])) ? "ENABLED" : "DISABLED"} />} />
          </div>
        )}
        <Card title="Messages">
          {messages.loading ? <LoadingBlock /> : messages.error ? <ErrorBlock text="Could not load notification messages." /> : rows.length === 0 ? <EmptyBlock text="No queued founder notifications yet." /> : (
            <div className="card-list command-card-list">
              {rows.map((row, index) => {
                const id = String(row.id ?? "").trim();
                return (
                  <article className="item-card command-item-card" key={String(id || index)}>
                    <div className="item-top">
                      <strong>{formatEmpty(row.subject ?? row.sourceModule ?? row.channel)}</strong>
                      <StatusBadge value={row.status ?? "UNKNOWN"} />
                    </div>
                    <p className="long-text">{formatEmpty(row.message)}</p>
                    <div className="detail-grid">
                      <MetricRow label="Created At" value={formatLocalDateTime(row.createdAt)} />
                      <MetricRow label="Channel" value={formatEmpty(row.channel)} />
                      <MetricRow label="Recipient" value={formatEmpty(row.recipient)} />
                      <MetricRow label="Severity" value={<SeverityBadge value={row.severity} />} />
                      <MetricRow label="Source Module" value={formatEmpty(row.sourceModule)} />
                      <MetricRow label="Send Attempts" value={formatEmpty(row.sendAttempts)} />
                      <MetricRow label="Last Error" value={<span className="long-text">{formatEmpty(row.lastError)}</span>} />
                    </div>
                    <div className="button-row compact">
                      <button type="button" onClick={() => sendMessage(id)} disabled={!id || processing !== ""}>Send/Test Block</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SecurityGuardrailsPage() {
  const summary = useApi<SecurityGuardrailSummary>(() => securityGuardrailsApi.summary(SELLER_ID));
  const audit = useApi<ApiRows<SecurityAuditEvent>>(() => securityGuardrailsApi.audit(SELLER_ID, 100));
  const data = securityGuardrailSummaryOf(summary.data);
  const rows = securityAuditEventsOf(audit.data);
  const [form, setForm] = useState({ action: "LIVE_PPC_EXECUTION", actor: "founder", confirmText: "" });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<AnyRecord | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function runCheck(event: FormEvent) {
    event.preventDefault();
    setProcessing(true);
    setMessage("");
    setError("");
    try {
      const response = await securityGuardrailsApi.check({ sellerId: SELLER_ID, ...form });
      setResult(hardeningResultOf(response));
      setMessage(responseWasBlocked(response) ? "Security guardrail blocked this action safely." : "Security guardrail check completed.");
      summary.reload();
      audit.reload();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Security Guardrails" subtitle="Audit and block dangerous actions unless founder, confirmation, and safety checks pass." />
      <SafetyBanner text="Security guardrails do not replace authentication, but they provide backend safety auditing." />
      <div className="stack">
        {summary.loading ? <LoadingBlock /> : summary.error ? <ErrorBlock text="Could not load security guardrail summary." /> : (
          <div className="summary-strip command-summary">
            <MetricTile label="Total Checks" value={summaryNumber(data, ["totalChecks"], rows.length)} />
            <MetricTile label="Allowed" value={summaryNumber(data, ["allowed", "allowedCount"], rows.filter((row) => readBoolean(row.allowed)).length)} />
            <MetricTile label="Blocked" value={summaryNumber(data, ["blocked", "blockedCount"], rows.filter((row) => !readBoolean(row.allowed)).length)} />
            <MetricTile label="Dangerous Blocks" value={summaryNumber(data, ["dangerousBlocks"], 0)} />
            <MetricTile label="Latest Blocked Action" value={formatEmpty(readFirst(data, ["latestBlockedAction"]) ?? rows.find((row) => !readBoolean(row.allowed))?.action)} />
          </div>
        )}
        <Card title="Manual Check">
          <form className="form-grid" onSubmit={runCheck}>
            <SelectField label="Action" value={form.action} options={guardrailActions} onChange={(value) => setForm({ ...form, action: value })} />
            <TextInput label="Actor" value={form.actor} onChange={(value) => setForm({ ...form, actor: value })} />
            <TextInput label="Confirm Text" value={form.confirmText} onChange={(value) => setForm({ ...form, confirmText: value })} />
            <div className="button-row"><button type="submit" disabled={processing}>Run Guardrail Check</button></div>
          </form>
          {message ? <div className="soft-state success-state compact-state">{message}</div> : null}
          {error ? <div className="soft-state error-state compact-state">{error}</div> : null}
        </Card>
        <ResultPanel title="Guardrail Result" result={result} />
        <Card title="Audit">
          {audit.loading ? <LoadingBlock /> : audit.error ? <ErrorBlock text="Could not load security audit events." /> : rows.length === 0 ? <EmptyBlock text="No security guardrail events yet." /> : (
            <div className="table-wrap command-table">
              <table>
                <thead>
                  <tr>
                    <th>Created At</th>
                    <th>Actor</th>
                    <th>Event Type</th>
                    <th>Route</th>
                    <th>Action</th>
                    <th>Allowed</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={String(row.id ?? `${row.action}-${index}`)}>
                      <td>{formatLocalDateTime(row.createdAt)}</td>
                      <td>{formatEmpty(row.actor)}</td>
                      <td>{formatEmpty(row.eventType)}</td>
                      <td className="wrap-cell">{formatEmpty(row.route)}</td>
                      <td>{formatEmpty(row.action)}</td>
                      <td><StatusBadge value={readBoolean(row.allowed) ? "ALLOWED" : "BLOCKED"} /></td>
                      <td className="wrap-cell">{formatEmpty(row.reason)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function RollbackCenterPage() {
  const summary = useApi<RollbackSummary>(() => rollbackApi.summary(SELLER_ID));
  const snapshots = useApi<ApiRows<RollbackSnapshot>>(() => rollbackApi.snapshots(SELLER_ID, 100));
  const data = hardeningSummaryOf<RollbackSummary>(summary.data);
  const rows = hardeningRowsOf<RollbackSnapshot>(snapshots.data);
  const [actionId, setActionId] = useState("");
  const [result, setResult] = useState<AnyRecord | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState("");

  const refresh = () => {
    summary.reload();
    snapshots.reload();
  };

  async function captureSnapshot() {
    const trimmed = actionId.trim();
    if (!trimmed) {
      setError("Action ID is required.");
      return;
    }
    setProcessing("capture");
    setError("");
    setMessage("");
    try {
      setResult(hardeningResultOf(await rollbackApi.capture(trimmed)));
      setMessage("Rollback snapshot captured.");
      refresh();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setProcessing("");
    }
  }

  async function runSnapshot(snapshotId: string, mode: "preview" | "execute") {
    if (!snapshotId) return;
    if (mode === "execute" && !window.confirm("Rollback execution is blocked in V1. This will only test the safety block.")) return;
    setProcessing(`${mode}:${snapshotId}`);
    setError("");
    setMessage("");
    try {
      const response = mode === "preview" ? await rollbackApi.preview(snapshotId) : await rollbackApi.execute(snapshotId);
      setResult(hardeningResultOf(response));
      setMessage(mode === "execute" && responseWasBlocked(response) ? "Safety block working. Rollback execution is disabled." : "Rollback preview response received.");
      refresh();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setProcessing("");
    }
  }

  return (
    <div className="page">
      <PageHeader title="Rollback Center" subtitle="Capture and preview rollback snapshots before any future live execution. Rollback execution is blocked in V1." />
      <SafetyBanner text="Rollback execution is blocked in V1. Preview only. No marketplace changes are made." />
      <div className="stack">
        <div className="summary-strip command-summary">
          <MetricTile label="Total Snapshots" value={summaryNumber(data, ["totalSnapshots", "total"], rows.length)} />
          <MetricTile label="Captured Snapshots" value={summaryNumber(data, ["capturedSnapshots", "capturedCount"], rows.filter((row) => normalizeState(row.snapshotStatus).includes("CAPTURE")).length)} />
          <MetricTile label="Previewed Snapshots" value={summaryNumber(data, ["previewedSnapshots", "previewedCount"], rows.filter((row) => normalizeState(row.snapshotStatus).includes("PREVIEW")).length)} />
          <MetricTile label="Executed Rollbacks" value={summaryNumber(data, ["executedRollbacks", "executedCount"], 0)} />
          <MetricTile label="Blocked Rollbacks" value={summaryNumber(data, ["blockedRollbacks", "blockedCount", "notExecutedCount"], rows.filter((row) => normalizeState(row.rollbackStatus).includes("BLOCK")).length)} />
          <MetricTile label="Latest Snapshot At" value={formatLocalDateTime(readFirst(data, ["latestSnapshotAt"]))} />
        </div>
        <Card title="Capture Snapshot">
          <div className="form-grid">
            <TextInput label="Action ID" value={actionId} onChange={setActionId} />
            <div className="button-row gateway-buttons">
              <button type="button" onClick={captureSnapshot} disabled={processing === "capture"}>Capture Snapshot</button>
              <button type="button" className="secondary" onClick={refresh}>Refresh</button>
            </div>
          </div>
          {message ? <div className="soft-state success-state compact-state">{message}</div> : null}
          {error ? <div className="soft-state error-state compact-state">{error}</div> : null}
        </Card>
        <ResultPanel title="Rollback Result" result={result} />
        <Card title="Snapshots">
          {snapshots.loading || summary.loading ? <LoadingBlock /> : snapshots.error || summary.error ? <ErrorBlock text="Could not load rollback snapshots." /> : rows.length === 0 ? (
            <div className="soft-state">
              <p>No rollback snapshots yet. Capture a snapshot by action ID before previewing a rollback plan.</p>
              <div className="button-row compact">
                <button type="button" disabled>Preview Rollback</button>
                <button type="button" className="danger-button live-block-button" disabled>Execute Rollback Block Test</button>
              </div>
              <p className="section-note">Rollback execution is blocked in V1. Disabled controls are shown here as a safety cue until a snapshot exists.</p>
            </div>
          ) : (
            <div className="card-list command-card-list">
              {rows.map((row, index) => {
                const snapshotId = snapshotIdOf(row);
                return (
                  <article className="item-card command-item-card" key={String(snapshotId || index)}>
                    <div className="item-top">
                      <strong>{formatShortId(snapshotId)}</strong>
                      <StatusBadge value={row.rollbackStatus ?? row.snapshotStatus ?? "CAPTURED"} />
                    </div>
                    <div className="detail-grid">
                      <MetricRow label="Created At" value={formatLocalDateTime(row.createdAt)} />
                      <MetricRow label="Action ID" value={formatShortId(row.actionId)} />
                      <MetricRow label="Source Module" value={formatEmpty(row.sourceModule)} />
                      <MetricRow label="Entity Type" value={formatEmpty(row.entityType)} />
                      <MetricRow label="Entity ID" value={formatEmpty(row.entityId)} />
                      <MetricRow label="SKU" value={formatEmpty(row.sku)} />
                      <MetricRow label="ASIN" value={formatEmpty(row.asin)} />
                      <MetricRow label="Snapshot Type" value={formatEmpty(row.snapshotType)} />
                      <MetricRow label="Snapshot Status" value={<StatusBadge value={row.snapshotStatus ?? "UNKNOWN"} />} />
                      <MetricRow label="Rollback Status" value={<StatusBadge value={row.rollbackStatus ?? "BLOCKED"} />} />
                      <MetricRow label="Captured By" value={formatEmpty(row.capturedBy)} />
                      <MetricRow label="Notes" value={<span className="long-text">{formatEmpty(row.notes)}</span>} />
                    </div>
                    <div className="button-row compact">
                      <button type="button" onClick={() => runSnapshot(snapshotId, "preview")} disabled={!snapshotId || processing === `preview:${snapshotId}`}>Preview Rollback</button>
                      <button type="button" className="danger-button live-block-button" onClick={() => runSnapshot(snapshotId, "execute")} disabled={!snapshotId || processing === `execute:${snapshotId}`}>Execute Rollback Block Test</button>
                    </div>
                    <p className="section-note">Rollback execution is blocked in V1. This button only tests the safety block.</p>
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ApprovalExecutionPage({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const summary = useApi<ApprovalExecutionSummary>(() => approvalExecutionApi.summary(SELLER_ID));
  const actions = useApi<ApiRows<ApprovalReadyAction>>(() => approvalExecutionApi.readyActions(SELLER_ID, 100));
  const data = hardeningSummaryOf<ApprovalExecutionSummary>(summary.data);
  const rows = hardeningRowsOf<ApprovalReadyAction>(actions.data);
  const [actionType, setActionType] = useState("All");
  const [riskLevel, setRiskLevel] = useState("All");
  const [source, setSource] = useState("All");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<AnyRecord | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState("");
  const filteredRows = rows.filter((row) => {
    const haystack = [row.sku, row.asin].map((value) => String(value ?? "").toLowerCase()).join(" ");
    return (actionType === "All" || String(row.actionType ?? "") === actionType) &&
      (riskLevel === "All" || normalizeState(row.riskLevel) === riskLevel) &&
      (source === "All" || String(row.source ?? "") === source) &&
      (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  });

  async function runAction(row: ApprovalReadyAction, mode: "preview" | "shadow" | "live") {
    const id = actionIdOf(row);
    if (!id) return;
    if (mode === "shadow" && !window.confirm("Run shadow execution? No external action will be executed.")) return;
    if (mode === "live" && !window.confirm("Live execution is blocked in V1. This only tests the block.")) return;
    setProcessing(`${mode}:${id}`);
    setError("");
    setMessage("");
    try {
      const response = mode === "preview" ? await approvalExecutionApi.preview(id) : mode === "shadow" ? await approvalExecutionApi.executeShadow(id) : await approvalExecutionApi.executeLive(id);
      setResult(hardeningResultOf(response));
      setMessage(mode === "live" && responseWasBlocked(response) ? "Safety block working. Live execution remains disabled." : "Approval execution response received.");
      summary.reload();
      actions.reload();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setProcessing("");
    }
  }

  return (
    <div className="page">
      <PageHeader title="Approval Execution Bridge" subtitle="Approved actions ready for preview or shadow execution. Live execution is blocked." />
      <SafetyBanner text="Only approved actions can be previewed or shadow-executed. Live execution is blocked." />
      <div className="stack">
        <div className="button-row">
          <button type="button" onClick={() => setActiveTab("Approval Center")}>Open Approval Center</button>
          <button type="button" className="secondary" onClick={() => { summary.reload(); actions.reload(); }}>Refresh</button>
        </div>
        <div className="summary-strip command-summary">
          <MetricTile label="Ready Actions" value={summaryNumber(data, ["readyActions", "readyActionCount", "readyCount"], rows.length)} />
          <MetricTile label="Previewed Actions" value={summaryNumber(data, ["previewedActions", "previewedCount"], 0)} />
          <MetricTile label="Shadow Executions" value={summaryNumber(data, ["shadowExecutions", "shadowExecutionCount"], 0)} />
          <MetricTile label="Live Blocked Attempts" value={summaryNumber(data, ["liveBlockedAttempts", "liveBlockedCount"], 0)} />
          <MetricTile label="Unsupported Actions" value={summaryNumber(data, ["unsupportedActions", "unsupportedCount"], 0)} />
          <MetricTile label="High Risk Ready Actions" value={summaryNumber(data, ["highRiskReadyActions", "highRiskCount", "highRiskReadyCount"], rows.filter((row) => normalizeState(row.riskLevel).includes("HIGH")).length)} />
        </div>
        {message ? <div className="soft-state success-state compact-state">{message}</div> : null}
        {error ? <div className="soft-state error-state compact-state">{error}</div> : null}
        <ResultPanel title="Execution Result" result={result} />
        <Card title="Ready Actions">
          <div className="form-grid filters-grid">
            <SelectField label="Action Type" value={actionType} options={["All", ...uniqueTextValues(rows.map((row) => row.actionType))]} onChange={setActionType} />
            <SelectField label="Risk Level" value={riskLevel} options={["All", ...uniqueTextValues(rows.map((row) => normalizeState(row.riskLevel || "UNKNOWN")))]} onChange={setRiskLevel} />
            <SelectField label="Source" value={source} options={["All", ...uniqueTextValues(rows.map((row) => row.source))]} onChange={setSource} />
            <TextInput label="SKU/ASIN Search" value={search} onChange={setSearch} />
          </div>
          {actions.loading || summary.loading ? <LoadingBlock /> : actions.error || summary.error ? <ErrorBlock text="Could not load approval execution data." /> : filteredRows.length === 0 ? <EmptyBlock text="No approved actions are ready for execution bridge review." /> : (
            <div className="card-list command-card-list">
              {filteredRows.map((row, index) => {
                const id = actionIdOf(row);
                return (
                  <article className="item-card command-item-card" key={String(id || index)}>
                    <div className="item-top">
                      <strong>{formatEmpty(row.title ?? row.actionType)}</strong>
                      <StatusBadge value={row.riskLevel ?? "UNKNOWN"} />
                    </div>
                    <p className="long-text">{formatEmpty(row.summary)}</p>
                    <div className="detail-grid">
                      <MetricRow label="Action ID" value={formatShortId(id)} />
                      <MetricRow label="Action Type" value={formatEmpty(row.actionType)} />
                      <MetricRow label="Entity Type" value={formatEmpty(row.entityType)} />
                      <MetricRow label="Entity ID" value={formatEmpty(row.entityId)} />
                      <MetricRow label="SKU" value={formatEmpty(row.sku)} />
                      <MetricRow label="ASIN" value={formatEmpty(row.asin)} />
                      <MetricRow label="Approval Status" value={<StatusBadge value={row.approvalStatus ?? "APPROVED"} />} />
                      <MetricRow label="State" value={<StatusBadge value={row.state ?? "READY"} />} />
                      <MetricRow label="Source" value={formatEmpty(row.source)} />
                      <MetricRow label="Created At" value={formatLocalDateTime(row.createdAt)} />
                    </div>
                    <div className="button-row compact">
                      <button type="button" onClick={() => runAction(row, "preview")} disabled={!id || processing === `preview:${id}`}>Preview</button>
                      <button type="button" onClick={() => runAction(row, "shadow")} disabled={!id || processing === `shadow:${id}`}>Execute Shadow</button>
                      <button type="button" className="danger-button live-block-button" onClick={() => runAction(row, "live")} disabled={!id || processing === `live:${id}`}>Try Live Block</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function MaintenancePage() {
  const summary = useApi<MaintenanceSummary>(() => maintenanceApi.summary(SELLER_ID));
  const runs = useApi<ApiRows<MaintenanceRun>>(() => maintenanceApi.runs(SELLER_ID, 50));
  const data = hardeningSummaryOf<MaintenanceSummary>(summary.data);
  const latestRun = recordOf(readFirst(data, ["latestRun"]));
  const rows = hardeningRowsOf<MaintenanceRun>(runs.data);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnyRecord | null>(null);
  const [error, setError] = useState("");

  async function runMaintenance() {
    if (!window.confirm("Run safe maintenance now? No external action will be executed.")) return;
    setRunning(true);
    setError("");
    try {
      setResult(hardeningResultOf(await maintenanceApi.run(SELLER_ID)));
      summary.reload();
      runs.reload();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Maintenance Runner" subtitle="Run safe internal housekeeping: safety setup, alert generation, data freshness, learning rebuild, and health check." />
      <SafetyBanner text="Maintenance runs internal checks only. No Amazon, Ads, listing, image, A+, social, notification, or AI action is executed." />
      <div className="stack">
        <div className="button-row"><button type="button" onClick={runMaintenance} disabled={running}>{running ? "Running maintenance..." : "Run Maintenance"}</button></div>
        {error ? <div className="soft-state error-state compact-state">{error}</div> : null}
        <div className="summary-strip command-summary">
          <MetricTile label="Latest Run Status" value={<StatusBadge value={readFirst(latestRun, ["runStatus"]) ?? readFirst(data, ["latestRunStatus", "runStatus"]) ?? "UNKNOWN"} />} />
          <MetricTile label="Runs Today" value={summaryNumber(data, ["runsToday", "todayRuns", "totalRuns"], 0)} />
          <MetricTile label="Alerts Generated" value={summaryNumber(latestRun, ["alertsGenerated"], summaryNumber(data, ["alertsGenerated"], 0))} />
          <MetricTile label="Data Sources Checked" value={summaryNumber(latestRun, ["dataSourcesChecked"], summaryNumber(data, ["dataSourcesChecked"], 0))} />
          <MetricTile label="Learning Rebuilt" value={<StatusBadge value={safeBooleanLabel(readFirst(latestRun, ["learningRebuilt"]) ?? readFirst(data, ["learningRebuilt"]), "YES", "NO")} />} />
          <MetricTile label="Health Status" value={<StatusBadge value={readFirst(latestRun, ["healthStatus"]) ?? readFirst(data, ["healthStatus"]) ?? "UNKNOWN"} />} />
        </div>
        <ResultPanel title="Maintenance Result" result={result} />
        <Card title="Runs">
          {runs.loading || summary.loading ? <LoadingBlock text={running ? "Running maintenance..." : "Loading maintenance runs..."} /> : runs.error || summary.error ? <ErrorBlock text="Could not load maintenance runs." /> : rows.length === 0 ? <EmptyBlock text="No maintenance runs yet." /> : (
            <div className="card-list command-card-list">
              {rows.map((row, index) => (
                <article className="item-card command-item-card" key={String(row.runId ?? row.id ?? index)}>
                  <div className="item-top">
                    <strong>{formatShortId(row.runId ?? row.id)}</strong>
                    <StatusBadge value={row.runStatus ?? "UNKNOWN"} />
                  </div>
                  <div className="detail-grid">
                    <MetricRow label="Started At" value={formatLocalDateTime(row.startedAt)} />
                    <MetricRow label="Finished At" value={formatLocalDateTime(row.finishedAt)} />
                    <MetricRow label="Run Type" value={formatEmpty(row.runType)} />
                    <MetricRow label="Safety Initialized" value={readBoolean(row.safetyInitialized) ? "Yes" : "No"} />
                    <MetricRow label="Alert Rules Seeded" value={readBoolean(row.alertRulesSeeded) ? "Yes" : "No"} />
                    <MetricRow label="Alerts Generated" value={formatEmpty(row.alertsGenerated)} />
                    <MetricRow label="Data Sources Checked" value={formatEmpty(row.dataSourcesChecked)} />
                    <MetricRow label="Learning Rebuilt" value={readBoolean(row.learningRebuilt) ? "Yes" : "No"} />
                    <MetricRow label="Health Status" value={<StatusBadge value={row.healthStatus ?? "UNKNOWN"} />} />
                    <MetricRow label="Warnings" value={<JsonSnippet value={row.warnings ?? []} />} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function QaSmokePage() {
  const latest = useApi<QaSmokeLatest>(() => qaSmokeApi.latest(SELLER_ID));
  const runs = useApi<ApiRows<QaSmokeRun>>(() => qaSmokeApi.runs(SELLER_ID, 20));
  const latestData = qaSmokeLatestOf(latest.data);
  const runRows = hardeningRowsOf<QaSmokeRun>(runs.data);
  const checks = hardeningRowsOf<QaSmokeCheck>(latest.data, latestData.checks);
  const blockers = dailyList(readFirst(latestData, ["blockers"]));
  const warnings = dailyList(readFirst(latestData, ["warnings"]));
  const totalChecks = summaryNumber(latestData, ["totalChecks"], checks.length);
  const failCount = summaryNumber(latestData, ["failCount"], checks.filter((row) => normalizeState(row.status) === "FAIL").length);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function runSmoke() {
    if (!window.confirm("Run QA smoke test now? This checks internal APIs only.")) return;
    setRunning(true);
    setError("");
    try {
      await qaSmokeApi.run(SELLER_ID);
      latest.reload();
      runs.reload();
    } catch (requestError) {
      setError(sanitizeActionError(requestError));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="QA Smoke Test Center" subtitle="Run backend smoke tests across all critical modules before enabling future execution." />
      <SafetyBanner text="QA Smoke only checks system readiness. It does not execute marketplace changes." />
      <div className="stack">
        <div className="button-row"><button type="button" onClick={runSmoke} disabled={running}>{running ? "Running QA smoke..." : "Run QA Smoke Test"}</button></div>
        {error ? <div className="soft-state error-state compact-state">{error}</div> : null}
        {totalChecks === 23 && failCount === 0 ? <div className="soft-state success-state compact-state">QA Smoke PASS</div> : null}
        {latest.loading ? <LoadingBlock /> : latest.error ? <ErrorBlock text="Could not load latest QA smoke result." /> : (
          <>
            <div className="summary-strip command-summary">
              <MetricTile label="Run Status" value={<StatusBadge value={readFirst(latestData, ["runStatus"]) ?? "UNKNOWN"} />} />
              <MetricTile label="Total Checks" value={totalChecks} />
              <MetricTile label="Pass Count" value={summaryNumber(latestData, ["passCount"], checks.filter((row) => normalizeState(row.status) === "PASS").length)} />
              <MetricTile label="Warn Count" value={summaryNumber(latestData, ["warnCount"], checks.filter((row) => ["WARN", "WARNING"].includes(normalizeState(row.status))).length)} />
              <MetricTile label="Fail Count" value={failCount} />
              <MetricTile label="Blockers Count" value={summaryNumber(latestData, ["blockersCount"], blockers.length)} />
              <MetricTile label="Warnings Count" value={summaryNumber(latestData, ["warningsCount"], warnings.length)} />
            </div>
            <Card title="Checks">
              {checks.length === 0 ? <EmptyBlock text="No QA smoke checks returned yet." /> : (
                <div className="card-list command-card-list">
                  {checks.map((row, index) => (
                    <article className="item-card command-item-card" key={String(row.key ?? index)}>
                      <div className="item-top">
                        <strong>{formatEmpty(row.name ?? row.key)}</strong>
                        <StatusBadge value={row.status ?? "UNKNOWN"} />
                      </div>
                      <p className="long-text">{formatEmpty(row.message)}</p>
                      <div className="detail-grid">
                        <MetricRow label="Key" value={formatEmpty(row.key)} />
                        <MetricRow label="Critical" value={readBoolean(row.critical) ? "Yes" : "No"} />
                        <MetricRow label="Duration Ms" value={formatEmpty(row.durationMs)} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>
            <div className="dashboard-grid today">
              <ListTextCard title="Blockers" rows={blockers} emptyText="No QA blockers returned." />
              <ListTextCard title="Warnings" rows={warnings} emptyText="No QA warnings returned." />
            </div>
          </>
        )}
        <Card title="Previous Runs">
          {runs.loading ? <LoadingBlock /> : runs.error ? <ErrorBlock text="Could not load previous QA smoke runs." /> : runRows.length === 0 ? <EmptyBlock text="No previous QA smoke runs yet." /> : (
            <div className="card-list command-card-list">
              {runRows.map((row, index) => (
                <article className="item-card command-item-card" key={String(row.runId ?? row.id ?? index)}>
                  <div className="item-top">
                    <strong>{formatShortId(row.runId ?? row.id)}</strong>
                    <StatusBadge value={row.runStatus ?? "UNKNOWN"} />
                  </div>
                  <div className="detail-grid">
                    <MetricRow label="Started At" value={formatLocalDateTime(row.startedAt)} />
                    <MetricRow label="Finished At" value={formatLocalDateTime(row.finishedAt)} />
                    <MetricRow label="Total Checks" value={formatEmpty(row.totalChecks)} />
                    <MetricRow label="Pass Count" value={formatEmpty(row.passCount)} />
                    <MetricRow label="Warn Count" value={formatEmpty(row.warnCount)} />
                    <MetricRow label="Fail Count" value={formatEmpty(row.failCount)} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-title">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ObjectCard({
  title,
  data,
  moneyKeys = [],
  percentKeys = []
}: {
  title: string;
  data: AnyRecord;
  moneyKeys?: string[];
  percentKeys?: string[];
}) {
  const entries = Object.entries(data);
  return (
    <Card title={title}>
      {entries.length === 0 ? <EmptyBlock /> : (
        <div className="detail-grid">
          {entries.map(([key, value]) => (
            <MetricRow
              key={key}
              label={labelize(key)}
              value={moneyKeys.includes(key) ? formatMoney(value) : percentKeys.includes(key) ? formatPercent(value) : formatObjectValue(value)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ListCard({ title, rows }: { title: string; rows: AnyRecord[] }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? <EmptyBlock /> : (
        <div className="card-list">
          {rows.slice(0, 10).map((row, index) => (
            <article className="item-card compact-card" key={String(row.id ?? row.title ?? index)}>
              {Object.entries(row).slice(0, 8).map(([key, value]) => (
                <MetricRow key={key} label={labelize(key)} value={formatObjectValue(value)} />
              ))}
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function formatObjectValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isInteger(value) ? value : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function labelize(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

export default App;

