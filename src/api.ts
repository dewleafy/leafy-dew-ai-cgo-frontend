import type {
  ActivityLogEvent,
  ActivityLogSummary,
  ApprovalExecutionSummary,
  ApprovalReadyAction,
  AiCostEstimate,
  AiCostSummary,
  AiGatewayStatus,
  AiLedgerRow,
  AlertEvent,
  AlertSummary,
  ApiRows,
  DaypartingCheckResult,
  DaypartingHistoryResponse,
  DaypartingSettingsResponse,
  DaypartingStatusResponse,
  DataFreshnessSummary,
  Experiment,
  ExperimentSummary,
  LaunchChecklistSummary,
  LaunchGateSummary,
  LiveExecutionRun,
  LiveExecutionStatus,
  MaintenanceRun,
  MaintenanceSummary,
  NotificationMessage,
  NotificationSettings,
  NotificationSummary,
  ProductionHealthSummary,
  QaSmokeLatest,
  QaSmokeRun,
  RollbackSnapshot,
  RollbackSummary,
  SafetyAuditEvent,
  SafetyControlSettingsPayload,
  SafetyControlStatus,
  SchedulerJob,
  SchedulerSummary,
  SecurityAuditEvent,
  SecurityGuardrailSummary,
  SocialContentLogRow,
  CompetitorBenchmarkRun,
  ListingOptimizerAnalysis
} from "./types";

export const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "" : "https://api.leafydew.in");

type Body = Record<string, unknown> | undefined;

const AUTH_TOKEN_KEY = "leafy-dew-auth-token";
export const AUTH_REQUIRED_EVENT = "leafy-auth-required";

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    else window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Storage can be blocked (private window); the app then simply asks to sign in again.
  }
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (response.status === 401 && data && typeof data === "object" && (data as Record<string, unknown>).code === "AUTH_REQUIRED") {
    // The server wants a login (never signed in, or the token expired): show the sign-in screen.
    setAuthToken(null);
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : "Unable to load this section.";
    const error = new Error(message) as Error & { details?: unknown };
    if (data && typeof data === "object" && "details" in data) {
      error.details = (data as Record<string, unknown>).details;
    }
    throw error;
  }

  return data as T;
}

export function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

export function postJson<T>(path: string, body?: Body): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    body: JSON.stringify(body ?? {})
  });
}

export function patchJson<T>(path: string, body?: Body): Promise<T> {
  return requestJson<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body ?? {})
  });
}

export function putJson<T>(path: string, body?: Body): Promise<T> {
  return requestJson<T>(path, {
    method: "PUT",
    body: JSON.stringify(body ?? {})
  });
}

export function deleteJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, {
    method: "DELETE"
  });
}

export const safetyControlApi = {
  status: (sellerId: string) => getJson<SafetyControlStatus>(`/api/safety-control/status?sellerId=${sellerId}`),
  initialize: (sellerId: string) => postJson<SafetyControlStatus>(`/api/safety-control/initialize?sellerId=${sellerId}`, {}),
  saveSettings: (sellerId: string, body: SafetyControlSettingsPayload) =>
    patchJson<SafetyControlStatus>(`/api/safety-control/settings?sellerId=${sellerId}`, body),
  auditEvents: (sellerId: string, limit = 100) =>
    getJson<ApiRows<SafetyAuditEvent>>(`/api/safety-control/audit-events?sellerId=${sellerId}&limit=${limit}`)
};

export const alertCenterApi = {
  summary: (sellerId: string) => getJson<AlertSummary>(`/api/alert-center/summary?sellerId=${sellerId}`),
  events: (sellerId: string, limit = 100) =>
    getJson<ApiRows<AlertEvent>>(`/api/alert-center/events?sellerId=${sellerId}&limit=${limit}`),
  seedRules: (sellerId: string) => postJson(`/api/alert-center/seed-rules?sellerId=${sellerId}`, {}),
  generate: (sellerId: string) => postJson(`/api/alert-center/generate?sellerId=${sellerId}`, {}),
  acknowledge: (id: string) => postJson(`/api/alert-center/events/${encodeURIComponent(id)}/acknowledge`, {}),
  resolve: (id: string) => postJson(`/api/alert-center/events/${encodeURIComponent(id)}/resolve`, {})
};

export const experimentsApi = {
  summary: (sellerId: string) => getJson<ExperimentSummary>(`/api/experiments/summary?sellerId=${sellerId}`),
  list: (sellerId: string, limit = 100) => getJson<ApiRows<Experiment>>(`/api/experiments?sellerId=${sellerId}&limit=${limit}`),
  create: (body: Record<string, unknown>) => postJson<Experiment>("/api/experiments", body),
  createFromAction: (actionId: string) => postJson<Experiment>(`/api/experiments/from-action/${encodeURIComponent(actionId)}`, {}),
  start: (id: string) => postJson(`/api/experiments/${encodeURIComponent(id)}/start`, {}),
  recordCheckpoint: (id: string, body: Record<string, unknown>) =>
    postJson(`/api/experiments/${encodeURIComponent(id)}/record-checkpoint`, body),
  complete: (id: string, body: Record<string, unknown>) => postJson(`/api/experiments/${encodeURIComponent(id)}/complete`, body),
  cancel: (id: string) => postJson(`/api/experiments/${encodeURIComponent(id)}/cancel`, {})
};

export const dataFreshnessApi = {
  summary: (sellerId: string) => getJson<DataFreshnessSummary>(`/api/data-freshness/summary?sellerId=${sellerId}`),
  check: (sellerId: string) => postJson<DataFreshnessSummary>(`/api/data-freshness/check?sellerId=${sellerId}`, {}),
  mark: (body: Record<string, unknown>) => postJson("/api/data-freshness/mark", body)
};

export const aiGatewayApi = {
  status: (sellerId: string) => getJson<AiGatewayStatus>(`/api/ai-gateway/status?sellerId=${sellerId}`),
  costSummary: (sellerId: string) => getJson<AiCostSummary>(`/api/ai-gateway/cost-summary?sellerId=${sellerId}`),
  ledger: (sellerId: string, limit = 100) => getJson<ApiRows<AiLedgerRow>>(`/api/ai-gateway/ledger?sellerId=${sellerId}&limit=${limit}`),
  estimate: (body: Record<string, unknown>) => postJson<AiCostEstimate>("/api/ai-gateway/estimate", body),
  generate: (body: Record<string, unknown>) => postJson<unknown>("/api/ai-gateway/generate", body),
  recordBlocked: (body: Record<string, unknown>) => postJson("/api/ai-gateway/record-blocked", body)
};

export const productionHealthApi = {
  summary: (sellerId: string) => getJson<ProductionHealthSummary>(`/api/production-health/summary?sellerId=${sellerId}`)
};

export const activityLogsApi = {
  summary: (sellerId: string) => getJson<ActivityLogSummary>(`/api/activity-logs/summary?sellerId=${sellerId}`),
  events: (sellerId: string, limit = 100) =>
    getJson<ApiRows<ActivityLogEvent>>(`/api/activity-logs/events?sellerId=${sellerId}&limit=${limit}`),
  record: (body: Record<string, unknown>) => postJson<ActivityLogEvent>("/api/activity-logs/record", body)
};

export const rollbackApi = {
  summary: (sellerId: string) => getJson<RollbackSummary>(`/api/rollback/summary?sellerId=${sellerId}`),
  snapshots: (sellerId: string, limit = 100) =>
    getJson<ApiRows<RollbackSnapshot>>(`/api/rollback/snapshots?sellerId=${sellerId}&limit=${limit}`),
  action: (actionId: string, sellerId: string) =>
    getJson<unknown>(`/api/rollback/action/${encodeURIComponent(actionId)}?sellerId=${sellerId}`),
  capture: (actionId: string) => postJson<unknown>(`/api/rollback/capture/${encodeURIComponent(actionId)}`, {}),
  preview: (snapshotId: string) => postJson<unknown>(`/api/rollback/preview/${encodeURIComponent(snapshotId)}`, {}),
  execute: (snapshotId: string) => postJson<unknown>(`/api/rollback/execute/${encodeURIComponent(snapshotId)}`, {})
};

export const approvalExecutionApi = {
  readyActions: (sellerId: string, limit = 100) =>
    getJson<ApiRows<ApprovalReadyAction>>(`/api/approval-execution/ready-actions?sellerId=${sellerId}&limit=${limit}`),
  summary: (sellerId: string) => getJson<ApprovalExecutionSummary>(`/api/approval-execution/summary?sellerId=${sellerId}`),
  preview: (actionId: string) => postJson<unknown>(`/api/approval-execution/preview/${encodeURIComponent(actionId)}`, {}),
  executeShadow: (actionId: string) =>
    postJson<unknown>(`/api/approval-execution/execute-shadow/${encodeURIComponent(actionId)}`, {}),
  executeLive: (actionId: string) =>
    postJson<unknown>(`/api/approval-execution/execute-live/${encodeURIComponent(actionId)}`, {})
};

export const liveExecutionApi = {
  status: (sellerId: string) => getJson<LiveExecutionStatus>(`/api/live-execution/status?sellerId=${sellerId}`),
  runs: (sellerId: string, limit = 100) =>
    getJson<ApiRows<LiveExecutionRun>>(`/api/live-execution/runs?sellerId=${sellerId}&limit=${limit}`),
  action: (actionId: string, sellerId: string) =>
    getJson<unknown>(`/api/live-execution/action/${encodeURIComponent(actionId)}?sellerId=${sellerId}`),
  preflight: (actionId: string) => postJson<unknown>(`/api/live-execution/preflight/${encodeURIComponent(actionId)}`, {}),
  dryRun: (actionId: string) => postJson<unknown>(`/api/live-execution/dry-run/${encodeURIComponent(actionId)}`, {}),
  executeLive: (actionId: string, body: Record<string, unknown>) =>
    postJson<unknown>(`/api/live-execution/execute-live/${encodeURIComponent(actionId)}`, body)
};

export const launchGateApi = {
  summary: (sellerId: string) => getJson<LaunchGateSummary>(`/api/launch-gate/summary?sellerId=${sellerId}`),
  run: (sellerId: string) => postJson<LaunchGateSummary>(`/api/launch-gate/run?sellerId=${sellerId}`, {})
};

export const launchChecklistApi = {
  summary: (sellerId: string) => getJson<LaunchChecklistSummary>(`/api/launch-checklist/summary?sellerId=${sellerId}`),
  run: (sellerId: string) => postJson<LaunchChecklistSummary>(`/api/launch-checklist/run?sellerId=${sellerId}`, {})
};

export const schedulerControlApi = {
  summary: (sellerId: string) => getJson<SchedulerSummary>(`/api/scheduler-control/summary?sellerId=${sellerId}`),
  jobs: (sellerId: string) => getJson<ApiRows<SchedulerJob>>(`/api/scheduler-control/jobs?sellerId=${sellerId}`),
  seedJobs: (sellerId: string) => postJson<unknown>(`/api/scheduler-control/seed-jobs?sellerId=${sellerId}`, {}),
  runJob: (jobKey: string, sellerId: string) =>
    postJson<unknown>(`/api/scheduler-control/run/${encodeURIComponent(jobKey)}?sellerId=${sellerId}`, {}),
  updateJob: (jobKey: string, sellerId: string, body: Record<string, unknown>) =>
    patchJson<unknown>(`/api/scheduler-control/jobs/${encodeURIComponent(jobKey)}?sellerId=${sellerId}`, body)
};

export const notificationOutboxApi = {
  summary: (sellerId: string) => getJson<NotificationSummary>(`/api/notification-outbox/summary?sellerId=${sellerId}`),
  messages: (sellerId: string, limit = 100) =>
    getJson<ApiRows<NotificationMessage>>(`/api/notification-outbox/messages?sellerId=${sellerId}&limit=${limit}`),
  settings: (sellerId: string) => getJson<NotificationSettings>(`/api/notification-outbox/settings?sellerId=${sellerId}`),
  initialize: (sellerId: string) => postJson<NotificationSettings>(`/api/notification-outbox/initialize?sellerId=${sellerId}`, {}),
  queue: (body: Record<string, unknown>) => postJson<unknown>("/api/notification-outbox/queue", body),
  send: (id: string) => postJson<unknown>(`/api/notification-outbox/send/${encodeURIComponent(id)}`, {})
};

export const securityGuardrailsApi = {
  summary: (sellerId: string) => getJson<SecurityGuardrailSummary>(`/api/security-guardrails/summary?sellerId=${sellerId}`),
  audit: (sellerId: string, limit = 100) =>
    getJson<ApiRows<SecurityAuditEvent>>(`/api/security-guardrails/audit?sellerId=${sellerId}&limit=${limit}`),
  check: (body: Record<string, unknown>) => postJson<unknown>("/api/security-guardrails/check", body)
};

export const maintenanceApi = {
  run: (sellerId: string) => postJson<unknown>(`/api/maintenance/run?sellerId=${sellerId}`, {}),
  runs: (sellerId: string, limit = 50) => getJson<ApiRows<MaintenanceRun>>(`/api/maintenance/runs?sellerId=${sellerId}&limit=${limit}`),
  summary: (sellerId: string) => getJson<MaintenanceSummary>(`/api/maintenance/summary?sellerId=${sellerId}`)
};

export const qaSmokeApi = {
  run: (sellerId: string) => postJson<unknown>(`/api/qa-smoke/run?sellerId=${sellerId}`, {}),
  runs: (sellerId: string, limit = 20) => getJson<ApiRows<QaSmokeRun>>(`/api/qa-smoke/runs?sellerId=${sellerId}&limit=${limit}`),
  latest: (sellerId: string) => getJson<QaSmokeLatest>(`/api/qa-smoke/latest?sellerId=${sellerId}`)
};

export const socialContentLogApi = {
  list: (sellerId: string, limit = 200) =>
    getJson<ApiRows<SocialContentLogRow>>(`/api/social-content-log?sellerId=${sellerId}&limit=${limit}`),
  create: (body: Record<string, unknown>) => postJson<{ ok: boolean; row: SocialContentLogRow }>("/api/social-content-log", body),
  update: (id: string, body: Record<string, unknown>) =>
    patchJson<{ ok: boolean; row: SocialContentLogRow }>(`/api/social-content-log/${encodeURIComponent(id)}`, body),
  remove: (id: string) => deleteJson<{ ok: boolean }>(`/api/social-content-log/${encodeURIComponent(id)}`)
};

export const daypartingApi = {
  settings: (sellerId: string) => getJson<DaypartingSettingsResponse>(`/api/amazon-ads/dayparting/settings?sellerId=${sellerId}`),
  saveSettings: (sellerId: string, body: { enabled?: boolean; activeStartHour?: number; activeEndHour?: number }) =>
    putJson<DaypartingSettingsResponse>(`/api/amazon-ads/dayparting/settings?sellerId=${sellerId}`, { sellerId, ...body }),
  status: (sellerId: string) => getJson<DaypartingStatusResponse>(`/api/amazon-ads/dayparting/status?sellerId=${sellerId}`),
  history: (sellerId: string, limit = 50) =>
    getJson<DaypartingHistoryResponse>(`/api/amazon-ads/dayparting/history?sellerId=${sellerId}&limit=${limit}`),
  runNow: (sellerId: string) => postJson<DaypartingCheckResult>(`/api/amazon-ads/dayparting/run-now?sellerId=${sellerId}`, {})
};

export const competitorBenchmarkApi = {
  listRuns: (sellerId: string, limit = 20) =>
    getJson<{ ok: boolean; rows: CompetitorBenchmarkRun[] }>(`/api/competitor-benchmark/runs?sellerId=${sellerId}&limit=${limit}`),
  createRun: (sellerId: string, skus: string[]) =>
    postJson<{ ok: boolean; run: CompetitorBenchmarkRun; skippedSkus: { sku: string; reason: string }[] }>(
      `/api/competitor-benchmark/runs?sellerId=${sellerId}`,
      { skus }
    ),
  getRun: (sellerId: string, runId: string) =>
    getJson<{ ok: boolean; run: CompetitorBenchmarkRun }>(`/api/competitor-benchmark/runs/${encodeURIComponent(runId)}?sellerId=${sellerId}`),
  confirmCandidates: (
    sellerId: string,
    runId: string,
    body: { ownSku: string; confirmedAsins: string[]; removedAsins: string[]; addedAsins: string[] }
  ) =>
    postJson<{ ok: boolean; run: CompetitorBenchmarkRun }>(
      `/api/competitor-benchmark/runs/${encodeURIComponent(runId)}/candidates/confirm?sellerId=${sellerId}`,
      body
    ),
  compare: (sellerId: string, runId: string) =>
    postJson<{ ok: boolean; run: CompetitorBenchmarkRun }>(
      `/api/competitor-benchmark/runs/${encodeURIComponent(runId)}/compare?sellerId=${sellerId}`,
      {}
    ),
  requestImageMockup: (sellerId: string, runId: string, body: { ownSku: string; imageSlot: number }) =>
    postJson<{ ok: boolean; configured: boolean; message: string }>(
      `/api/competitor-benchmark/runs/${encodeURIComponent(runId)}/image-mockup?sellerId=${sellerId}`,
      body
    )
};

export type ListingOptimizerAnalyzeRequest = {
  sku: string;
  benchmarkRunId?: string | null;
  ownReviewCount?: number | null;
  ownRating?: number | null;
  ownHasVideo?: boolean | null;
  ownHasLifestyleImage?: boolean | null;
  ownImageQualityScore?: number | null;
  highVolumeKeywords?: string[];
  useAiJudging?: boolean;
};

export const listingOptimizerApi = {
  listAnalyses: (sellerId: string, sku?: string, limit = 20) =>
    getJson<{ ok: boolean; rows: ListingOptimizerAnalysis[] }>(
      `/api/listing-optimizer/analyses?sellerId=${sellerId}&limit=${limit}${sku ? `&sku=${encodeURIComponent(sku)}` : ""}`
    ),
  getAnalysis: (sellerId: string, id: string) =>
    getJson<{ ok: boolean; analysis: ListingOptimizerAnalysis }>(`/api/listing-optimizer/analyses/${encodeURIComponent(id)}?sellerId=${sellerId}`),
  analyze: (sellerId: string, body: ListingOptimizerAnalyzeRequest) =>
    postJson<{ ok: boolean; analysis: ListingOptimizerAnalysis }>(`/api/listing-optimizer/analyze?sellerId=${sellerId}`, body)
};

export type AuthStatus = { ok: true; enabled: boolean; authenticated: boolean };
export type AuthLoginResult = { ok: true; enabled: boolean; token?: string; expiresAt?: string };

export const authApi = {
  status: () => getJson<AuthStatus>("/api/auth/status"),
  login: (password: string) => postJson<AuthLoginResult>("/api/auth/login", { password })
};
