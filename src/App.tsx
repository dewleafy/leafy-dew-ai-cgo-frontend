import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import "./App.css";
import { deleteJson, getJson, postJson, putJson } from "./api";
import type {
  ActionLedgerRow,
  ActionLedgerSummary,
  ActivityLog,
  AnyRecord,
  ApiRows,
  CostCompletionQueueItem,
  Experiment,
  ProductEconomics,
  ProductPassport,
  Recommendation
} from "./types";

const SELLER_ID = "default";

const tabs = [
  "Today Dashboard",
  "Product Passport",
  "Product Economics",
  "PPC Recommendations",
  "Approval Center",
  "CEO Report",
  "Experiments",
  "Learning",
  "Settings",
  "Activity Logs"
] as const;

type Tab = (typeof tabs)[number];
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

function StatusBadge({ value }: { value: unknown }) {
  const label = formatEmpty(value).toUpperCase();
  const tone = ["READY", "PASS", "APPROVED", "ACTIVE", "SUCCESS", "SHADOW", "GOOD", "AVAILABLE", "LOW"].includes(label)
    ? "good"
    : ["WATCH", "NEEDS_FIX", "MONITORING", "WARNING", "NEW", "NEEDS_COST_DATA", "MISSING_COST_DATA", "PARTIAL", "INCOMPLETE", "NEEDS_INPUT", "SUBCATEGORY MISSING", "MEDIUM", "APPROVAL REQUIRED", "APPROVAL_REQUIRED"].includes(label)
      ? "watch"
      : ["RISK", "ERROR", "FAILED", "REJECTED", "POOR", "BLOCKED", "HIGH", "VERY_HIGH", "HIGH_RISK_APPROVAL", "FOUNDER_OVERRIDE_REQUIRED"].includes(label)
        ? "risk"
        : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

function LoadingBlock() {
  return <div className="soft-state">Loading...</div>;
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

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("Today Dashboard");
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          {logoFailed ? (
            <div className="logo-fallback">LD</div>
          ) : (
            <img src="/ld-logo.png" alt="Leafy Dew" onError={() => setLogoFailed(true)} />
          )}
          <div>
            <strong>Leafy Dew</strong>
            <span>Founder workspace</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Main sections">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="top-brand">
            {logoFailed ? <div className="mini-logo">LD</div> : <img src="/ld-logo.png" alt="" />}
            <h1>Leafy Dew</h1>
          </div>
          <div className="top-actions">
            <span>Seller: {SELLER_ID}</span>
            <StatusBadge value="SHADOW" />
            <span>Founder</span>
          </div>
        </header>

        {activeTab === "Today Dashboard" && <TodayDashboard setActiveTab={setActiveTab} />}
        {activeTab === "Product Passport" && <ProductPassportPage />}
        {activeTab === "Product Economics" && <CostCompletionQueuePage />}
        {activeTab === "PPC Recommendations" && <PpcRecommendationsPage setActiveTab={setActiveTab} />}
        {activeTab === "Approval Center" && <ApprovalCenterPage />}
        {activeTab === "CEO Report" && <CeoReportPage />}
        {activeTab === "Experiments" && <ExperimentsPage />}
        {activeTab === "Learning" && <LearningPage />}
        {activeTab === "Settings" && <SettingsPage />}
        {activeTab === "Activity Logs" && <ActivityLogsPage />}
      </main>
    </div>
  );
}

function TodayDashboard({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const ceo = useApi<AnyRecord>(() => getJson(`/api/ceo-report/daily?sellerId=${SELLER_ID}&days=30`));
  const amazonStatus = useApi<AnyRecord>(() => getJson(`/api/amazon-sp/status?sellerId=${SELLER_ID}`));
  const recommendations = useApi<ApiRows<Recommendation>>(() => getJson(`/api/recommendations?sellerId=${SELLER_ID}&status=NEW`));
  const reportJobs = useApi<ApiRows<AnyRecord>>(() => getJson(`/api/amazon-sp/report-jobs?sellerId=${SELLER_ID}`));

  const ceoReport = ceo.data ?? {};
  const executiveSummary = recordOf(ceo.data?.executiveSummary);
  const profitGuardrail = recordOf(ceo.data?.profitGuardrail);
  const amazonSales = recordOf(ceo.data?.amazonSalesSummary);
  const topActions = arrayOf(ceo.data?.todayTopActions).slice(0, 3);
  const pendingApprovalCount = Array.isArray(ceo.data?.pendingApprovals)
    ? arrayOf(ceo.data?.pendingApprovals).length
    : rowsOf<Recommendation>(recommendations.data).length;
  const latestReportJob = rowsOf<AnyRecord>(reportJobs.data)[0];
  const profitStatus = executiveSummary.profitStatus ?? ceoReport.profitStatus ?? profitGuardrail.profitStatus;
  const profitDataStatus = profitGuardrail.profitDataStatus;
  const profitRiskAlerts = arrayOf(ceo.data?.profitRiskAlerts);
  const warnings = arrayOf(ceo.data?.warnings);
  const profitFlexAvailable =
    profitRiskAlerts.some((alert) => String(recordOf(alert).type ?? "").toUpperCase() === "PROFIT_FLEX_REQUIRES_APPROVAL") ||
    warnings.some((warning) => String(warning.message ?? warning.title ?? warning).toLowerCase().includes("profit flex"));
  const showProfitSafetyWarning =
    profitStatus === "NEEDS_COST_DATA" || profitDataStatus === "MISSING_COST_DATA" || profitDataStatus === "PARTIAL" || !profitDataStatus;

  return (
    <div className="page">
      <div className="page-title">
        <h1>Today Dashboard</h1>
        <p>Founder-simple operating view. Shadow mode stays approval-first.</p>
      </div>
      <div className="dashboard-grid today">
        <Card title="CEO Status">
          {ceo.error ? <ErrorBlock /> : null}
          {ceo.loading ? (
            <LoadingBlock />
          ) : (
            <div className="status-card">
              <h3>{formatEmpty(ceoReport.headline ?? executiveSummary.headline)}</h3>
              <div className="badge-row">
                <StatusBadge value={ceoReport.businessStatus ?? executiveSummary.businessStatus} />
                <StatusBadge value={profitStatus} />
              </div>
              <p>{formatEmpty(ceoReport.oneLineAdvice ?? executiveSummary.oneLineAdvice)}</p>
            </div>
          )}
        </Card>

        <Card title="Amazon Sales Summary">
          {ceo.error ? <ErrorBlock /> : null}
          {ceo.loading ? (
            <LoadingBlock />
          ) : (
            <div>
              <MetricRow label="Confirmed Sales" value={formatMoney(amazonSales.confirmedSales)} />
              <MetricRow label="Confirmed Orders" value={formatEmpty(amazonSales.confirmedOrders)} />
              <MetricRow label="Confirmed Units" value={formatEmpty(amazonSales.confirmedUnits)} />
              <MetricRow label="Pending Sales" value={formatMoney(amazonSales.pendingSales)} />
              <MetricRow label="Cancelled Sales" value={formatMoney(amazonSales.cancelledSales)} />
              <MetricRow label="Raw Sales" value={formatMoney(amazonSales.rawSales)} />
              <p className="section-note">
                {formatEmpty(amazonSales.statusNote) === "???"
                  ? "Confirmed sales exclude cancelled and pending orders."
                  : formatEmpty(amazonSales.statusNote)}
              </p>
            </div>
          )}
        </Card>

        <Card title="Profit Safety">
          {ceo.error ? <ErrorBlock /> : null}
          {ceo.loading ? (
            <LoadingBlock />
          ) : showProfitSafetyWarning ? (
            <div className="warning-card">
              <StatusBadge value="NEEDS_COST_DATA" />
              <p>Product cost data is missing. Add landed cost before approving PPC scaling or growth actions.</p>
              <button type="button" onClick={() => setActiveTab("Product Economics")}>Complete Product Costs</button>
            </div>
          ) : (
            <div>
              <MetricRow label="Profit Status" value={<StatusBadge value={profitStatus} />} />
              <MetricRow label="Profit Data" value={<StatusBadge value={profitDataStatus ?? "AVAILABLE"} />} />
              <p className="section-note">Growth actions remain approval-first in shadow mode.</p>
            </div>
          )}
        </Card>

        <Card title="Sync Status">
          {amazonStatus.error ? <ErrorBlock /> : null}
          {amazonStatus.loading ? (
            <LoadingBlock />
          ) : (
            <div>
              <MetricRow label="Connected" value={<StatusBadge value={amazonStatus.data?.connected ? "CONNECTED" : "DISCONNECTED"} />} />
              <MetricRow label="Listing Count" value={formatEmpty(amazonStatus.data?.listingCount)} />
              <MetricRow label="Order Count" value={formatEmpty(amazonStatus.data?.orderCount)} />
              <MetricRow label="Last Listings Sync" value={formatEmpty(amazonStatus.data?.lastListingsSyncAt)} />
              <MetricRow label="Last Orders Sync" value={formatEmpty(amazonStatus.data?.lastOrdersSyncAt)} />
              <MetricRow label="Last Error" value={formatEmpty(amazonStatus.data?.lastError)} />
              {reportJobs.loading || reportJobs.error || !latestReportJob ? null : (
                <MetricRow label="Latest Report Job" value={<StatusBadge value={latestReportJob.status} />} />
              )}
            </div>
          )}
        </Card>

        {profitFlexAvailable ? (
          <Card title="Profit Flex Available">
            {ceo.loading ? (
              <LoadingBlock />
            ) : (
              <div className="warning-card profit-flex-card">
                <StatusBadge value="APPROVAL REQUIRED" />
                <p>Lower profit band may allow PPC, but approval is required.</p>
                <button type="button" onClick={() => setActiveTab("Product Economics")}>Review Profit Bands</button>
              </div>
            )}
          </Card>
        ) : null}

        <Card title="Today Top 3 Actions">
          {ceo.error ? <ErrorBlock /> : null}
          {ceo.loading ? (
            <LoadingBlock />
          ) : topActions.length === 0 ? (
            <EmptyBlock text="No urgent shadow-mode actions today." />
          ) : (
            <div className="action-list">
              {topActions.map((item, index) => (
                <article className="action-card" key={String(item.id ?? item.entityValue ?? index)}>
                  <div className="item-top">
                    <strong>{formatEmpty(item.recommendedAction)}</strong>
                    <StatusBadge value={item.priorityLabel} />
                  </div>
                  <MetricRow label="Entity" value={formatEmpty(item.entityValue)} />
                  <div className="badge-row">
                    <StatusBadge value={item.confidenceLabel} />
                    <StatusBadge value={item.riskLevel} />
                  </div>
                  <p>{formatEmpty(item.reason)}</p>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card title="Approval Queue">
          {recommendations.error && ceo.error ? <ErrorBlock /> : null}
          {recommendations.loading && ceo.loading ? (
            <LoadingBlock />
          ) : (
            <div>
              <MetricRow label="Pending Approvals" value={pendingApprovalCount} />
              <p className="section-note">Review before any Amazon action. Shadow mode does not execute changes.</p>
              <button type="button" onClick={() => setActiveTab("Approval Center")}>Review Pending Approvals</button>
            </div>
          )}
        </Card>
      </div>
      <div className="button-row">
        <button type="button" onClick={() => setActiveTab("CEO Report")}>View Full CEO Report</button>
        <button type="button" onClick={() => setActiveTab("Product Economics")}>Complete Product Costs</button>
      </div>
    </div>
  );
}

function ProductPassportPage() {
  const passports = useApi<ApiRows<ProductPassport>>(() => getJson(`/api/product-passports?sellerId=${SELLER_ID}`));
  const readiness = useApi<AnyRecord>(() => getJson(`/api/product-passports/readiness/summary?sellerId=${SELLER_ID}`));
  const [openForm, setOpenForm] = useState(false);
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

  async function loadReadiness(id: string) {
    setDetail({ data: null, loading: true, error: null });
    try {
      const data = await getJson<AnyRecord>(`/api/product-passports/${id}/readiness`);
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
                    <td><button type="button" onClick={() => loadReadiness(row.id)}>View Readiness</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Readiness Details">
        {detail.loading ? <LoadingBlock /> : detail.error ? <ErrorBlock /> : detail.data ? <ReadinessDetail data={detail.data} /> : <EmptyBlock text="Choose a product to view readiness." />}
      </Card>
    </div>
  );
}

function ReadinessDetail({ data }: { data: AnyRecord }) {
  const row = recordOf(data.row ?? data.readiness ?? data);
  const missing = arrayOf(row.missingFields);
  return (
    <div className="detail-grid">
      <MetricRow label="Passport score" value={formatEmpty(row.passportScore ?? row.score)} />
      <MetricRow label="Economics status" value={<StatusBadge value={row.economicsStatus} />} />
      <MetricRow label="Profit status" value={<StatusBadge value={row.profitStatus} />} />
      <MetricRow label="Ad readiness status" value={<StatusBadge value={row.adReadinessStatus ?? row.readinessStatus} />} />
      <MetricRow label="Next best action" value={formatEmpty(recordOf(row.nextBestAction).title ?? row.nextBestAction)} />
      <MetricRow label="Missing fields" value={missing.length ? missing.map(String).join(", ") : "—"} />
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

function CostCompletionQueuePage() {
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
    ["Profit Margin %", ["profitMargin", "profit_margin"], "percent"],
    ["Max Allowable Ad Spend", ["maxAllowableAdSpend", "max_allowable_ad_spend"], "money"],
    ["Target ACOS", ["targetAcos", "target_acos"], "percent"],
    ["Break-even ACOS", ["breakEvenAcos", "break_even_acos"], "percent"],
    ["Fee Rules Version", ["feeRulesVersion", "fee_rules_version"], "text"]
  ] as const;

  return (
    <div className="page">
      <PageHeader
        title="Cost Completion Queue"
        subtitle="Add only the missing business inputs. Amazon listing data and Amazon fee calculations are handled automatically."
      />

      <Card title="Products Needing Cost Completion">
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

type ApprovalFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "MONITORING" | "COMPLETED";
type LedgerAction = "approve" | "reject" | "monitor" | "complete";

const approvalFilters: ApprovalFilter[] = ["ALL", "PENDING", "APPROVED", "REJECTED", "MONITORING", "COMPLETED"];

function normalizeState(value: unknown): string {
  return String(value ?? "").toUpperCase();
}

function isMonitoringAction(row: ActionLedgerRow): boolean {
  return ["MONITOR", "MONITORING"].includes(normalizeState(row.state));
}

function isCompletedAction(row: ActionLedgerRow): boolean {
  return ["COMPLETED", "COMPLETED_MANUALLY"].includes(normalizeState(row.state));
}

function filterActionLedgerRows(rows: ActionLedgerRow[], filter: ApprovalFilter): ActionLedgerRow[] {
  if (filter === "ALL") return rows;
  if (filter === "PENDING") return rows.filter((row) => normalizeState(row.approvalStatus) === "PENDING");
  if (filter === "APPROVED") return rows.filter((row) => normalizeState(row.approvalStatus) === "APPROVED");
  if (filter === "REJECTED") return rows.filter((row) => normalizeState(row.approvalStatus) === "REJECTED");
  if (filter === "MONITORING") return rows.filter(isMonitoringAction);
  return rows.filter(isCompletedAction);
}

async function fetchActionLedgerData(): Promise<{ summary: ActionLedgerSummary; rows: ActionLedgerRow[] }> {
  const [summaryResponse, rowsResponse] = await Promise.all([
    getJson<AnyRecord>(`/api/action-ledger/summary?sellerId=${SELLER_ID}`),
    getJson<unknown>(`/api/action-ledger?sellerId=${SELLER_ID}&limit=50`)
  ]);
  const summaryRoot = recordOf(summaryResponse);
  return {
    summary: recordOf(summaryRoot.summary ?? summaryRoot) as ActionLedgerSummary,
    rows: actionLedgerRowsOf(rowsResponse)
  };
}

function ActionLedgerCard({
  row,
  processing,
  onAction,
  onCopy
}: {
  row: ActionLedgerRow;
  processing: { id: string; action: LedgerAction } | null;
  onAction: (row: ActionLedgerRow, action: LedgerAction) => void;
  onCopy: (id: string) => void;
}) {
  const approvalStatus = normalizeState(row.approvalStatus);
  const completed = isCompletedAction(row);
  const monitoring = isMonitoringAction(row);
  const buttonDisabled = Boolean(processing);
  const fields: Array<[string, ReactNode]> = [
    ["Short ID", formatShortId(row.id)],
    ["Title", formatEmpty(row.title)],
    ["Summary", formatEmpty(row.summary)],
    ["Recommended Action", formatEmpty(row.recommendedAction)],
    ["Source", formatEmpty(row.source)],
    ["Action Type", formatEmpty(row.actionType)],
    ["Entity Type", formatEmpty(row.entityType)],
    ["Entity ID", formatEmpty(row.entityId)],
    ["SKU", formatEmpty(row.sku)],
    ["ASIN", formatEmpty(row.asin)],
    ["Risk Level", <StatusBadge key="risk-level" value={row.riskLevel ?? "LOW"} />],
    ["Confidence", <StatusBadge key="confidence-label" value={row.confidenceLabel ?? "LOW"} />],
    ["Approval Tier", formatEmpty(row.approvalTier)],
    ["State", <StatusBadge key="state" value={row.state ?? "UNKNOWN"} />],
    ["Approval Status", <StatusBadge key="approval-status" value={row.approvalStatus ?? "UNKNOWN"} />],
    ["Created At", formatEmpty(row.createdAt)]
  ];

  let footer: ReactNode = null;
  if (completed) {
    footer = <p className="approval-status-note">Completed manually.</p>;
  } else if (approvalStatus === "REJECTED") {
    footer = <p className="approval-status-note">Rejected. No action executed.</p>;
  } else if (approvalStatus === "APPROVED") {
    footer = <p className="approval-status-note">Approved in shadow mode. No external action executed.</p>;
  } else if (monitoring) {
    footer = (
      <div className="button-row compact">
        <button type="button" onClick={() => onAction(row, "complete")} disabled={buttonDisabled}>
          {processing?.id === row.id && processing.action === "complete" ? "Completing..." : "Complete"}
        </button>
      </div>
    );
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
    <article className="item-card action-ledger-card">
      <div className="item-top">
        <strong>{formatEmpty(row.title)}</strong>
        <StatusBadge value={row.approvalStatus ?? row.state ?? "PENDING"} />
      </div>
      <p>{formatEmpty(row.summary)}</p>
      <div className="approval-id-row">
        <span>Action ID {formatShortId(row.id)}</span>
        <button type="button" className="secondary tiny-button" onClick={() => onCopy(row.id)} disabled={buttonDisabled}>Copy ID</button>
      </div>
      <div className="detail-grid approval-detail-grid">
        {fields.map(([label, value]) => (
          <MetricRow key={label} label={label} value={value} />
        ))}
      </div>
      {footer}
    </article>
  );
}

function ApprovalCenterPage() {
  const [activeFilter, setActiveFilter] = useState<ApprovalFilter>("ALL");
  const [processing, setProcessing] = useState<{ id: string; action: LedgerAction } | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [summaryState, setSummaryState] = useState<LoadState<ActionLedgerSummary>>(emptyState<ActionLedgerSummary>());
  const [rowsState, setRowsState] = useState<LoadState<ActionLedgerRow[]>>(emptyState<ActionLedgerRow[]>());

  async function refreshApprovalData() {
    setSummaryState((current) => ({ ...current, loading: true, error: null }));
    setRowsState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await fetchActionLedgerData();
      setSummaryState({ data: data.summary, loading: false, error: null });
      setRowsState({ data: data.rows, loading: false, error: null });
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

  const allRows = rowsState.data ?? [];
  const rows = filterActionLedgerRows(allRows, activeFilter);
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
      await refreshApprovalData();
      setMessage({ type: "success", text: `${labelize(action)} saved for action ${formatShortId(id)}.` });
    } catch (error) {
      setMessage({ type: "error", text: `Action failed: ${sanitizeActionError(error)}` });
    } finally {
      setProcessing(null);
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
          <button key={filter} type="button" className={activeFilter === filter ? "active" : ""} onClick={() => setActiveFilter(filter)} disabled={Boolean(processing)}>
            {filter}
          </button>
        ))}
      </div>
      {loading && !rowsState.data ? <LoadingBlock /> : loadError ? (
        <ErrorBlock text={`Could not load approval actions: ${loadError}`} />
      ) : allRows.length === 0 ? (
        <EmptyBlock text="No approval actions yet. AI recommendations will appear here before execution." />
      ) : rows.length === 0 ? (
        <EmptyBlock text="No actions match this filter." />
      ) : (
        <div className="card-list">
          {rows.map((row) => (
            <ActionLedgerCard
              key={row.id}
              row={row}
              processing={processing}
              onAction={act}
              onCopy={copyActionId}
            />
          ))}
        </div>
      )}
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
  const experiments = useApi<ApiRows<Experiment>>(() => getJson(`/api/experiments?sellerId=${SELLER_ID}`));
  const rows = rowsOf<Experiment>(experiments.data);
  const [form, setForm] = useState({
    experimentName: "",
    experimentType: "PPC_KEYWORD_TEST",
    campaignId: "",
    adGroupId: "",
    recommendationId: "",
    hypothesis: "",
    expectedResult: "",
    successMetric: "",
    status: "PLANNED",
    priority: "MEDIUM"
  });

  const counts = useMemo(() => ({
    total: rows.length,
    active: rows.filter((row) => row.status === "ACTIVE").length,
    planned: rows.filter((row) => row.status === "PLANNED").length,
    completed: rows.filter((row) => row.status === "COMPLETED").length
  }), [rows]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await postJson("/api/experiments", { sellerId: SELLER_ID, ...form });
    setForm({ ...form, experimentName: "", campaignId: "", adGroupId: "", recommendationId: "", hypothesis: "", expectedResult: "", successMetric: "" });
    experiments.reload();
  }

  async function action(id: string, name: "start" | "complete" | "cancel") {
    const body = name === "complete"
      ? { resultSummary: "Completed from frontend.", learningNote: "Review performance after test.", afterMetrics: {} }
      : name === "cancel"
        ? { learningNote: "Cancelled from frontend." }
        : {};
    await postJson(`/api/experiments/${id}/${name}`, body);
    experiments.reload();
  }

  return (
    <div className="page">
      <PageHeader title="Experiments" subtitle="Track approval-first tests and learn before scaling." />
      <div className="summary-strip">
        <MetricTile label="Total experiments" value={counts.total} />
        <MetricTile label="Active" value={counts.active} />
        <MetricTile label="Planned" value={counts.planned} />
        <MetricTile label="Completed" value={counts.completed} />
      </div>
      <Card title="Experiment List">
        {experiments.loading ? <LoadingBlock /> : experiments.error ? <ErrorBlock /> : rows.length === 0 ? <EmptyBlock /> : (
          <div className="card-list">
            {rows.map((row) => (
              <article className="item-card" key={row.id}>
                <div className="item-top"><strong>{formatEmpty(row.experimentName)}</strong><StatusBadge value={row.status} /></div>
                <div className="item-meta"><span>{formatEmpty(row.experimentType)}</span><span>{formatEmpty(row.priority)}</span></div>
                <p>{formatEmpty(row.hypothesis)}</p>
                <MetricRow label="Expected Result" value={formatEmpty(row.expectedResult)} />
                <MetricRow label="Success Metric" value={formatEmpty(row.successMetric)} />
                <MetricRow label="Start Date" value={formatEmpty(row.startDate)} />
                <MetricRow label="End Date" value={formatEmpty(row.endDate)} />
                <div className="button-row compact">
                  <button type="button" onClick={() => action(row.id, "start")}>Start</button>
                  <button type="button" onClick={() => action(row.id, "complete")}>Complete</button>
                  <button type="button" onClick={() => action(row.id, "cancel")}>Cancel</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
      <Card title="Create Experiment">
        <form className="form-grid" onSubmit={submit}>
          <TextInput label="Experiment Name" value={form.experimentName} onChange={(value) => setForm({ ...form, experimentName: value })} />
          <SelectField label="Experiment Type" value={form.experimentType} options={["PPC_KEYWORD_TEST", "PPC_PRODUCT_TARGET_TEST", "LISTING_CONTENT_TEST", "IMAGE_TEST", "PRICE_TEST", "BUNDLE_TEST", "BRAND_CONTENT_TEST", "OTHER"]} onChange={(value) => setForm({ ...form, experimentType: value })} />
          <TextInput label="Campaign Id" value={form.campaignId} onChange={(value) => setForm({ ...form, campaignId: value })} />
          <TextInput label="Ad Group Id" value={form.adGroupId} onChange={(value) => setForm({ ...form, adGroupId: value })} />
          <TextInput label="Recommendation Id" value={form.recommendationId} onChange={(value) => setForm({ ...form, recommendationId: value })} />
          <TextArea label="Hypothesis" value={form.hypothesis} onChange={(value) => setForm({ ...form, hypothesis: value })} />
          <TextArea label="Expected Result" value={form.expectedResult} onChange={(value) => setForm({ ...form, expectedResult: value })} />
          <TextInput label="Success Metric" value={form.successMetric} onChange={(value) => setForm({ ...form, successMetric: value })} />
          <SelectField label="Status" value={form.status} options={["PLANNED", "ACTIVE", "PAUSED", "COMPLETED", "FAILED", "CANCELLED"]} onChange={(value) => setForm({ ...form, status: value })} />
          <SelectField label="Priority" value={form.priority} options={["LOW", "MEDIUM", "HIGH"]} onChange={(value) => setForm({ ...form, priority: value })} />
          <button type="submit">Create Experiment</button>
        </form>
      </Card>
    </div>
  );
}

function LearningPage() {
  const learning = useApi<AnyRecord>(() => getJson(`/api/learning-summary?sellerId=${SELLER_ID}&days=30`));
  const data = learning.data ?? {};
  const recommendationLearning = recordOf(data.recommendationLearning);
  const experimentLearning = recordOf(data.experimentLearning);
  const outcomeLearning = recordOf(data.outcomeLearning);

  return (
    <div className="page">
      <PageHeader title="Learning" subtitle="See what the system has learned from recommendations, tests, and outcomes." />
      {learning.loading ? <LoadingBlock /> : learning.error ? <ErrorBlock /> : (
        <div className="stack">
          <ObjectCard title="Summary Counts" data={recordOf(data.summary)} />
          <ObjectCard title="Approval Pattern" data={recordOf(recommendationLearning.approvalPattern)} />
          <ListCard title="Recommendation Learning by Type" rows={arrayOf(recommendationLearning.byType)} />
          <ListCard title="Recommendation Learning by Action" rows={arrayOf(recommendationLearning.byAction)} />
          <ListCard title="Active Experiments" rows={arrayOf(experimentLearning.activeExperiments)} />
          <ListCard title="Outcomes Needing More Data" rows={arrayOf(outcomeLearning.needsMoreData)} />
          <Card title="System Insights">
            {arrayOf(data.systemInsights).length === 0 && !Array.isArray(data.systemInsights) ? <p>{formatEmpty(data.systemInsights)}</p> : (
              <ul className="clean-list">{(Array.isArray(data.systemInsights) ? data.systemInsights : []).map((item, index) => <li key={index}>{String(item)}</li>)}</ul>
            )}
          </Card>
          <ObjectCard title="Next Best Action" data={recordOf(data.nextBestAction)} />
        </div>
      )}
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

function ActivityLogsPage() {
  const logs = useApi<ApiRows<ActivityLog>>(() => getJson(`/api/activity-logs?sellerId=${SELLER_ID}`));
  const rows = rowsOf<ActivityLog>(logs.data);

  async function createTestLog() {
    await postJson("/api/activity-logs", {
      sellerId: SELLER_ID,
      eventType: "FRONTEND_TEST",
      entityType: "SYSTEM",
      entityLabel: "Frontend activity test",
      action: "CREATE_FRONTEND_TEST_LOG",
      status: "SUCCESS",
      message: "Frontend activity log test created successfully.",
      metadata: { source: "frontend" },
      userNote: "Created from frontend"
    });
    logs.reload();
  }

  async function remove(id: string) {
    await deleteJson(`/api/activity-logs/${id}`);
    logs.reload();
  }

  return (
    <div className="page">
      <PageHeader title="Activity Logs" subtitle="Audit trail for founder actions and system events." />
      <Card title="Logs" action={<button type="button" onClick={createTestLog}>Create Test Log</button>}>
        {logs.loading ? <LoadingBlock /> : logs.error ? <ErrorBlock /> : rows.length === 0 ? <EmptyBlock /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Created At</th>
                  <th>Event Type</th>
                  <th>Entity Type</th>
                  <th>Entity Label</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th>User Note</th>
                  <th>Cleanup</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatEmpty(row.createdAt)}</td>
                    <td>{formatEmpty(row.eventType)}</td>
                    <td>{formatEmpty(row.entityType)}</td>
                    <td>{formatEmpty(row.entityLabel)}</td>
                    <td>{formatEmpty(row.action)}</td>
                    <td><StatusBadge value={row.status} /></td>
                    <td>{formatEmpty(row.message)}</td>
                    <td>{formatEmpty(row.userNote)}</td>
                    <td><button type="button" className="secondary" onClick={() => remove(row.id)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
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

