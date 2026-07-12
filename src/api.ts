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
  SecurityGuardrailSummary
} from "./types";

export const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "" : "https://api.leafydew.in");

type Body = Record<string, unknown> | undefined;

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : "Unable to load this section.";
    throw new Error(message);
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
