import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import "./App.css";
import { deleteJson, getJson, postJson, putJson } from "./api";
import type {
  ActivityLog,
  AnyRecord,
  ApiRows,
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
  const tone = ["READY", "PASS", "APPROVED", "ACTIVE", "SUCCESS", "SHADOW", "GOOD", "AVAILABLE"].includes(label)
    ? "good"
    : ["WATCH", "NEEDS_FIX", "MONITORING", "WARNING", "NEW", "NEEDS_COST_DATA", "MISSING_COST_DATA", "PARTIAL"].includes(label)
      ? "watch"
      : ["RISK", "ERROR", "FAILED", "REJECTED", "POOR", "BLOCKED"].includes(label)
        ? "risk"
        : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

function LoadingBlock() {
  return <div className="soft-state">Loading...</div>;
}

function ErrorBlock() {
  return <div className="soft-state error-state">Could not load this section. Backend may still be deploying.</div>;
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
        {activeTab === "Product Economics" && <ProductEconomicsPage />}
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
  const showProfitSafetyWarning =
    profitStatus === "NEEDS_COST_DATA" || profitDataStatus === "MISSING_COST_DATA" || profitDataStatus === "PARTIAL";

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
              <button type="button" onClick={() => setActiveTab("Product Economics")}>Add Product Costs</button>
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
        <button type="button" onClick={() => setActiveTab("Product Economics")}>Add Product Costs</button>
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

function ProductEconomicsPage() {
  const economics = useApi<ApiRows<ProductEconomics>>(() => getJson(`/api/product-economics?sellerId=${SELLER_ID}`));

  const rows = rowsOf<ProductEconomics>(economics.data);

  const [form, setForm] = useState({
    sellerId: SELLER_ID,
    sku: "",
    asin: "",
    sellingPrice: "",
    buyingCost: "",
    packagingCost: "",
    shippingCost: "",
    referralFee: "",
    closingFee: "",
    requiredProfit: "",
    notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    setSaveError("");

    try {
      await postJson("/api/product-economics", {
        sellerId: form.sellerId.trim() || SELLER_ID,
        sku: form.sku.trim(),
        asin: form.asin.trim() || null,
        sellingPrice: asInputNumber(form.sellingPrice),
        buyingCost: asInputNumber(form.buyingCost),
        packagingCost: asInputNumber(form.packagingCost) ?? 0,
        shippingCost: asInputNumber(form.shippingCost) ?? 0,
        referralFee: asInputNumber(form.referralFee) ?? 0,
        closingFee: asInputNumber(form.closingFee) ?? 0,
        requiredProfit: asInputNumber(form.requiredProfit) ?? 0,
        notes: form.notes.trim() || null
      });

      setForm({
        sellerId: form.sellerId || SELLER_ID,
        sku: "",
        asin: "",
        sellingPrice: "",
        buyingCost: "",
        packagingCost: "",
        shippingCost: "",
        referralFee: "",
        closingFee: "",
        requiredProfit: "",
        notes: ""
      });
      setSaveMessage("Cost data saved. Profit guardrails will use this SKU data.");
      economics.reload();
    } catch {
      setSaveError("Could not save cost data. Backend may still be deploying.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Product Economics" subtitle="Add landed cost to unlock profit-safe PPC decisions." />

      <div className="advice-box">Add landed cost to unlock profit-safe PPC decisions.</div>

      <Card title="Cost Table">
        {economics.loading ? <LoadingBlock /> : economics.error ? <ErrorBlock /> : rows.length === 0 ? <EmptyBlock /> : (
          <div className="table-wrap cost-table">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>ASIN</th>
                  <th>Product Name</th>
                  <th>Selling Price</th>
                  <th>Buying Cost</th>
                  <th>Packaging Cost</th>
                  <th>Shipping Cost</th>
                  <th>Referral Fee</th>
                  <th>Closing Fee</th>
                  <th>Required Profit</th>
                  <th>Non-Ad Cost</th>
                  <th>Max Allowable Ad Spend</th>
                  <th>Target ACOS</th>
                  <th>Break-even ACOS</th>
                  <th>Profit Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatEmpty(row.sku)}</td>
                    <td>{formatEmpty(row.asin)}</td>
                    <td>{formatEmpty(row.productName)}</td>
                    <td>{formatMoney(row.sellingPrice)}</td>
                    <td>{formatMoney(row.buyingCost ?? row.landedCost)}</td>
                    <td>{formatMoney(row.packagingCost)}</td>
                    <td>{formatMoney(row.shippingCost ?? row.shippingFeeEstimate)}</td>
                    <td>{formatMoney(row.referralFee ?? row.amazonFeeEstimate)}</td>
                    <td>{formatMoney(row.closingFee ?? row.otherCostPerUnit)}</td>
                    <td>{formatMoney(row.requiredProfit ?? row.targetProfit)}</td>
                    <td>{formatMoney(row.nonAdCost)}</td>
                    <td>{formatMoney(row.maxAllowableAdSpend)}</td>
                    <td>{formatPercent(row.targetAcos)}</td>
                    <td>{formatPercent(row.breakEvenAcos)}</td>
                    <td>
                      <div className="badge-row">
                        <StatusBadge value={row.profitStatus ?? row.profitDataStatus ?? "NEEDS_COST_DATA"} />
                        {row.profitDataStatus ? <StatusBadge value={row.profitDataStatus} /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Add or Update Cost Data">
        <form className="form-grid" onSubmit={submit}>
          <TextInput label="Seller Id" value={form.sellerId} onChange={(next) => setForm({ ...form, sellerId: next })} />
          <TextInput label="SKU" value={form.sku} onChange={(next) => setForm({ ...form, sku: next })} />
          <TextInput label="ASIN" value={form.asin} onChange={(next) => setForm({ ...form, asin: next })} />
          <TextInput label="Selling Price" type="number" value={form.sellingPrice} onChange={(next) => setForm({ ...form, sellingPrice: next })} />
          <TextInput label="Buying Cost" type="number" value={form.buyingCost} onChange={(next) => setForm({ ...form, buyingCost: next })} />
          <TextInput label="Packaging Cost" type="number" value={form.packagingCost} onChange={(next) => setForm({ ...form, packagingCost: next })} />
          <TextInput label="Shipping Cost" type="number" value={form.shippingCost} onChange={(next) => setForm({ ...form, shippingCost: next })} />
          <TextInput label="Referral Fee" type="number" value={form.referralFee} onChange={(next) => setForm({ ...form, referralFee: next })} />
          <TextInput label="Closing Fee" type="number" value={form.closingFee} onChange={(next) => setForm({ ...form, closingFee: next })} />
          <TextInput label="Required Profit" type="number" value={form.requiredProfit} onChange={(next) => setForm({ ...form, requiredProfit: next })} />
          <TextArea label="Notes" value={form.notes} onChange={(next) => setForm({ ...form, notes: next })} />
          <div className="field-wide cost-form-actions">
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Cost Data"}</button>
            {saveMessage ? <span className="save-message">{saveMessage}</span> : null}
            {saveError ? <span className="save-error">{saveError}</span> : null}
          </div>
        </form>
      </Card>

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

function ApprovalCenterPage() {
  const statuses = ["NEW", "APPROVED", "MONITORING", "REJECTED", "COMPLETED_MANUALLY"];
  const [activeStatus, setActiveStatus] = useState("NEW");
  const lists = useApi<Record<string, Recommendation[]>>(
    async () => {
      const entries = await Promise.all(
        statuses.map(async (status) => {
          const response = await getJson<ApiRows<Recommendation>>(`/api/recommendations?sellerId=${SELLER_ID}&status=${status}`);
          return [status, rowsOf<Recommendation>(response)] as const;
        })
      );
      return Object.fromEntries(entries);
    },
    []
  );

  const rows = lists.data?.[activeStatus] ?? [];

  async function act(id: string, action: "approve" | "reject" | "monitor" | "complete") {
    const notes = {
      approve: "Approved from frontend. No Amazon action executed.",
      reject: "Rejected from frontend.",
      monitor: "Moved to monitoring from frontend.",
      complete: "Marked completed manually from frontend."
    };
    await postJson(`/api/recommendations/${id}/${action}`, { userNote: notes[action] });
    lists.reload();
  }

  return (
    <div className="page">
      <PageHeader title="Approval Center" subtitle="Shadow mode active. No Amazon action is executed." />
      <div className="segmented">
        {statuses.map((status) => (
          <button key={status} type="button" className={activeStatus === status ? "active" : ""} onClick={() => setActiveStatus(status)}>
            {status}
          </button>
        ))}
      </div>
      {lists.loading ? <LoadingBlock /> : lists.error ? <ErrorBlock /> : rows.length === 0 ? <EmptyBlock /> : (
        <div className="card-list">
          {rows.map((row) => (
            <RecommendationCard
              key={row.id}
              item={row as unknown as AnyRecord}
              footer={
                <div className="button-row compact">
                  <button type="button" onClick={() => act(row.id, "approve")}>Approve</button>
                  <button type="button" onClick={() => act(row.id, "reject")}>Reject</button>
                  <button type="button" onClick={() => act(row.id, "monitor")}>Monitor</button>
                  <button type="button" onClick={() => act(row.id, "complete")}>Complete</button>
                </div>
              }
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
