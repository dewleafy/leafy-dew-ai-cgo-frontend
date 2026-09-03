export type AnyRecord = Record<string, unknown>;

export type ApiRows<T> = {
  ok?: boolean;
  sellerId?: string;
  count?: number;
  rows?: T[];
};

export type Recommendation = {
  id: string;
  entityValue?: string | null;
  recommendationType?: string;
  recommendedAction?: string;
  priorityLabel?: string;
  confidenceLabel?: string;
  riskLevel?: string;
  reason?: string;
  status?: string;
  userNote?: string | null;
  profitEvidence?: AnyRecord;
};

export type ActionLedgerRow = {
  id: string;
  title?: string | null;
  summary?: string | null;
  recommendedAction?: string | null;
  source?: string | null;
  actionType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  sku?: string | null;
  asin?: string | null;
  riskLevel?: string | null;
  confidenceLabel?: string | null;
  approvalTier?: string | null;
  state?: string | null;
  approvalStatus?: string | null;
  createdAt?: string | null;
};

export type ActionLedgerSummary = {
  pendingCount?: number | string | null;
  approvedCount?: number | string | null;
  rejectedCount?: number | string | null;
  monitoringCount?: number | string | null;
  completedCount?: number | string | null;
  highRiskCount?: number | string | null;
  founderOverrideCount?: number | string | null;
};

export type ProductPassport = {
  id: string;
  productName?: string;
  sku?: string | null;
  asin?: string | null;
  category?: string | null;
  subCategory?: string | null;
  productType?: string | null;
  sellingPrice?: number | string | null;
  weight?: string | null;
  status?: string;
};

export type CostCompletionQueueItem = {
  id?: string;
  key?: string;
  sku?: string | null;
  asin?: string | null;
  productName?: string | null;
  product_name?: string | null;
  subcategory?: string | null;
  subCategory?: string | null;
  sub_category?: string | null;
  sellingPrice?: number | string | null;
  selling_price?: number | string | null;
  price?: number | string | null;
  productCost?: number | string | null;
  product_cost?: number | string | null;
  buyingCost?: number | string | null;
  buying_cost?: number | string | null;
  landedCost?: number | string | null;
  landed_cost?: number | string | null;
  packagingCost?: number | string | null;
  packaging_cost?: number | string | null;
  shippingCost?: number | string | null;
  shipping_cost?: number | string | null;
  otherCost?: number | string | null;
  other_cost?: number | string | null;
  otherCostPerUnit?: number | string | null;
  otherFees?: number | string | null;
  requiredProfit?: number | string | null;
  required_profit?: number | string | null;
  costStatus?: string | null;
  cost_status?: string | null;
  missingFields?: string[] | string | null;
  missing_fields?: string[] | string | null;
  currentProfitStatus?: string | null;
  current_profit_status?: string | null;
  profitStatus?: string | null;
  profitDataStatus?: string | null;
  targetAcos?: number | string | null;
  target_acos?: number | string | null;
  breakEvenAcos?: number | string | null;
  break_even_acos?: number | string | null;
  marketplaceId?: string | null;
  fulfillmentType?: string | null;
  productType?: string | null;
  weightKg?: number | string | null;
  volumeCuFt?: number | string | null;
  productGstRatePercent?: number | string | null;
  amazonFeeGstRatePercent?: number | string | null;
  economics?: ProductEconomics | null;
};

export type AmazonSpListing = CostCompletionQueueItem & {
  listingStatus?: string | null;
  fulfillmentChannel?: string | null;
  price?: number | string | null;
};

export type SchemaAttributeStatus = {
  attribute: string;
  label: string;
  status: "KNOWN" | "MISSING" | "UNTRACKED";
};

export type AplusContentStatus = "FOUND" | "NOT_FOUND" | "APPROVED" | "SUBMITTED" | "REJECTED" | "DRAFT";

export type NormalizedAplusBlock = {
  headline?: string;
  body?: string;
  image?: string;
};

export type NormalizedAplusModule = {
  type: string;
  headline?: string;
  body?: string;
  images: string[];
  items: NormalizedAplusBlock[];
  debugKeys?: string[];
};

export type AplusContentReport = {
  ok: true;
  asin: string;
  status: AplusContentStatus;
  moduleCount: number;
  modules: NormalizedAplusModule[];
  fetchedAt: string;
  source: "CACHED" | "FETCHED_LIVE";
  warning?: string;
};

export type SchemaReadinessReport = {
  ok: boolean;
  sku: string;
  productType: string | null;
  marketplaceId: string;
  schemaSource: "CACHED" | "FETCHED_LIVE" | "UNAVAILABLE";
  requiredAttributeCount: number;
  attributes: SchemaAttributeStatus[];
  missingCount: number;
  untrackedCount: number;
  readyForSubmission: boolean;
  summaryMessage: string;
  checkedAt: string;
  warning?: string;
};

export type ProductEconomics = {
  id: string;
  marketplaceId?: string | null;
  productName?: string | null;
  subCategory?: string | null;
  productType?: string | null;
  sku?: string | null;
  asin?: string | null;
  sellingPrice?: number | string | null;
  buyingCost?: number | string | null;
  landedCost?: number | string | null;
  packagingCost?: number | string | null;
  shippingCost?: number | string | null;
  shippingFeeEstimate?: number | string | null;
  referralFee?: number | string | null;
  amazonFeeEstimate?: number | string | null;
  closingFee?: number | string | null;
  shippingFee?: number | string | null;
  pickAndPackFee?: number | string | null;
  storageFee?: number | string | null;
  otherCostPerUnit?: number | string | null;
  otherFees?: number | string | null;
  referralFeePercent?: number | string | null;
  totalAmazonFees?: number | string | null;
  gstOnAmazonFees?: number | string | null;
  productGstRatePercent?: number | string | null;
  amazonFeeGstRatePercent?: number | string | null;
  netRevenueBeforeGst?: number | string | null;
  outputGstOnSale?: number | string | null;
  returnRatePercent?: number | string | null;
  returnCostProvision?: number | string | null;
  hiddenOtherFee?: number | string | null;
  grossProfit?: number | string | null;
  netProfit?: number | string | null;
  netProfitBeforeAds?: number | string | null;
  profitMargin?: number | string | null;
  profitMarginPercent?: number | string | null;
  feeRulesVersion?: string | null;
  requiredProfit?: number | string | null;
  minimumApprovedProfit?: number | string | null;
  profitFlexEnabled?: boolean | null;
  profitBands?: AnyRecord[] | null;
  recommendedProfitBand?: AnyRecord | string | null;
  recommendedProfitBandReason?: string | null;
  fulfillmentType?: string | null;
  shippingRegion?: string | null;
  categoryException?: string | boolean | null;
  weightKg?: number | string | null;
  volumeCuFt?: number | string | null;
  targetProfit?: number | string | null;
  nonAdCost?: number | string | null;
  maxAllowableAdSpend?: number | string | null;
  targetAcos?: number | string | null;
  breakEvenAcos?: number | string | null;
  profitStatus?: string | null;
  profitDataStatus?: string | null;
  reason?: string | null;
  notes?: string | null;
};

export type Experiment = {
  id: string;
  name?: string | null;
  experimentName?: string;
  experimentType?: string;
  status?: string;
  priority?: string;
  sku?: string | null;
  asin?: string | null;
  description?: string | null;
  hypothesis?: string | null;
  resultStatus?: string | null;
  resultSummary?: string | null;
  expectedResult?: string | null;
  successMetric?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type SafetyControlSettingsPayload = {
  maxDailyEngineRuns?: number;
  maxDailyExecutionAttempts?: number;
  maxDailyAiCost?: number;
  safetyNotes?: string;
  ppcLiveExecutionEnabled?: boolean;
  actor?: string;
  note?: string;
};

export type PpcExecutionApiResult = AnyRecord & {
  ok?: boolean;
  mode?: "SIMULATED" | "EXECUTED";
  message?: string;
  targetType?: string;
  targetValue?: string;
};

export type SafetyControlStatus = AnyRecord & {
  settings?: (AnyRecord & {
    globalMode?: string | null;
    mode?: string | null;
    liveExecutionEnabled?: boolean | string | number | null;
    ppcLiveExecution?: boolean | string | number | null;
    listingLiveExecution?: boolean | string | number | null;
    imageLiveExecution?: boolean | string | number | null;
    aplusLiveExecution?: boolean | string | number | null;
    socialLiveExecution?: boolean | string | number | null;
    aiCallsEnabled?: boolean | string | number | null;
    approvalRequired?: boolean | string | number | null;
    founderApprovalRequired?: boolean | string | number | null;
    maxDailyEngineRuns?: number | string | null;
    maxDailyExecutionAttempts?: number | string | null;
    maxDailyAiCost?: number | string | null;
    safetyNotes?: string | null;
  }) | null;
  initialized?: boolean | string | number | null;
  status?: string | null;
};

export type SafetyAuditEvent = AnyRecord & {
  id?: string | null;
  createdAt?: string | null;
  eventType?: string | null;
  actor?: string | null;
  note?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
};

export type AlertSummary = AnyRecord & {
  openAlerts?: number | string | null;
  openCount?: number | string | null;
  highAlerts?: number | string | null;
  criticalAlerts?: number | string | null;
  acknowledgedAlerts?: number | string | null;
  resolvedAlerts?: number | string | null;
};

export type AlertEvent = AnyRecord & {
  id: string;
  createdAt?: string | null;
  severity?: string | null;
  category?: string | null;
  title?: string | null;
  message?: string | null;
  entityType?: string | null;
  sku?: string | null;
  asin?: string | null;
  status?: string | null;
  actionId?: string | null;
};

export type ExperimentSummary = AnyRecord & {
  totalExperiments?: number | string | null;
  draftExperiments?: number | string | null;
  runningExperiments?: number | string | null;
  completedExperiments?: number | string | null;
  cancelledExperiments?: number | string | null;
  won?: number | string | null;
  lost?: number | string | null;
  inconclusive?: number | string | null;
};

export type DataFreshnessRow = AnyRecord & {
  id?: string | null;
  dataSource?: string | null;
  status?: string | null;
  lastSuccessAt?: string | null;
  lastAttemptAt?: string | null;
  freshnessMinutes?: number | string | null;
  staleAfterMinutes?: number | string | null;
  lastError?: string | null;
  updatedAt?: string | null;
};

export type DataFreshnessSummary = AnyRecord & {
  totalSources?: number | string | null;
  freshSources?: number | string | null;
  staleSources?: number | string | null;
  unknownSources?: number | string | null;
  errorSources?: number | string | null;
  rows?: DataFreshnessRow[] | null;
  warnings?: unknown[] | null;
};

export type AiGatewayStatus = AnyRecord & {
  aiCallsEnabled?: boolean | string | number | null;
  dailyBudget?: number | string | null;
  monthlyBudget?: number | string | null;
  requestsToday?: number | string | null;
  requestsThisMonth?: number | string | null;
};

export type AiCostSummary = AnyRecord & {
  dailyCost?: number | string | null;
  monthlyCost?: number | string | null;
  requestsToday?: number | string | null;
  requestsThisMonth?: number | string | null;
};

export type AiCostEstimate = AnyRecord & {
  estimatedCost?: number | string | null;
  status?: string | null;
  blockedReason?: string | null;
};

export type AiLedgerRow = AnyRecord & {
  id?: string | null;
  createdAt?: string | null;
  moduleName?: string | null;
  purpose?: string | null;
  provider?: string | null;
  modelName?: string | null;
  inputTokens?: number | string | null;
  outputTokens?: number | string | null;
  estimatedCost?: number | string | null;
  status?: string | null;
  blockedReason?: string | null;
};

export type ProductionHealthModule = AnyRecord & {
  key?: string | null;
  name?: string | null;
  status?: string | null;
  message?: string | null;
  critical?: boolean | string | number | null;
  counts?: AnyRecord | null;
  lastCheckedAt?: string | null;
};

export type ProductionHealthSummary = AnyRecord & {
  overallStatus?: string | null;
  mode?: string | null;
  shadowMode?: boolean | string | number | null;
  externalExecution?: string | boolean | number | null;
  liveExecutionEnabled?: boolean | string | number | null;
  aiCallsEnabled?: boolean | string | number | null;
  blockersCount?: number | string | null;
  warningsCount?: number | string | null;
  modulesPassing?: number | string | null;
  modulesWarning?: number | string | null;
  modulesFailing?: number | string | null;
  modules?: ProductionHealthModule[] | null;
  blockers?: unknown[] | null;
  warnings?: unknown[] | null;
  nextChecks?: unknown[] | null;
};

export type ActivityLog = {
  id: string;
  createdAt?: string;
  eventType?: string;
  entityType?: string | null;
  entityLabel?: string | null;
  action?: string;
  status?: string;
  message?: string | null;
  userNote?: string | null;
};

export type ActivityLogSummary = AnyRecord & {
  totalEvents?: number | string | null;
  infoCount?: number | string | null;
  warningCount?: number | string | null;
  errorCount?: number | string | null;
  criticalCount?: number | string | null;
  todayEvents?: number | string | null;
};

export type ActivityLogEvent = AnyRecord & {
  id?: string | null;
  createdAt?: string | null;
  severity?: string | null;
  eventCategory?: string | null;
  eventType?: string | null;
  title?: string | null;
  message?: string | null;
  actor?: string | null;
  sourceModule?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  sku?: string | null;
  asin?: string | null;
  actionId?: string | null;
};

export type RollbackSummary = AnyRecord & {
  totalSnapshots?: number | string | null;
  capturedSnapshots?: number | string | null;
  previewedSnapshots?: number | string | null;
  executedRollbacks?: number | string | null;
  blockedRollbacks?: number | string | null;
  latestSnapshotAt?: string | null;
};

export type RollbackSnapshot = AnyRecord & {
  id?: string | null;
  snapshotId?: string | null;
  createdAt?: string | null;
  actionId?: string | null;
  sourceModule?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  sku?: string | null;
  asin?: string | null;
  snapshotType?: string | null;
  snapshotStatus?: string | null;
  rollbackStatus?: string | null;
  capturedBy?: string | null;
  notes?: string | null;
};

export type ApprovalExecutionSummary = AnyRecord & {
  readyActions?: number | string | null;
  previewedActions?: number | string | null;
  shadowExecutions?: number | string | null;
  liveBlockedAttempts?: number | string | null;
  unsupportedActions?: number | string | null;
  highRiskReadyActions?: number | string | null;
};

export type ApprovalReadyAction = AnyRecord & {
  id?: string | null;
  actionId?: string | null;
  actionType?: string | null;
  title?: string | null;
  summary?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  sku?: string | null;
  asin?: string | null;
  riskLevel?: string | null;
  approvalStatus?: string | null;
  state?: string | null;
  source?: string | null;
  createdAt?: string | null;
};

export type LiveExecutionStatus = AnyRecord & {
  mode?: string | null;
  liveExecutionEnabled?: boolean | string | number | null;
  ppcLiveExecutionEnabled?: boolean | string | number | null;
  listingLiveExecutionEnabled?: boolean | string | number | null;
  aiCallsEnabled?: boolean | string | number | null;
  message?: string | null;
  totalLiveRuns?: number | string | null;
  dryRuns?: number | string | null;
  blockedRuns?: number | string | null;
  successfulLiveRuns?: number | string | null;
  failedRuns?: number | string | null;
};

export type LiveExecutionRun = AnyRecord & {
  id?: string | null;
  createdAt?: string | null;
  actionId?: string | null;
  executionDomain?: string | null;
  actionType?: string | null;
  sku?: string | null;
  asin?: string | null;
  liveStatus?: string | null;
  dryRunStatus?: string | null;
  blockedReason?: string | null;
  errorMessage?: string | null;
  actor?: string | null;
};

export type LaunchGateCheck = AnyRecord & {
  checkKey?: string | null;
  checkName?: string | null;
  status?: string | null;
  severity?: string | null;
  message?: string | null;
  lastCheckedAt?: string | null;
};

export type LaunchGateSummary = AnyRecord & {
  overallStatus?: string | null;
  liveEligible?: boolean | string | number | null;
  ppcLiveEligible?: boolean | string | number | null;
  listingLiveEligible?: boolean | string | number | null;
  blockersCount?: number | string | null;
  warningsCount?: number | string | null;
  checks?: LaunchGateCheck[] | null;
  blockers?: unknown[] | null;
  warnings?: unknown[] | null;
  nextSteps?: unknown[] | null;
};

export type LaunchChecklistItem = AnyRecord & {
  key?: string | null;
  label?: string | null;
  status?: string | null;
  message?: string | null;
  critical?: boolean | string | number | null;
  updatedAt?: string | null;
};

export type LaunchChecklistSummary = AnyRecord & {
  overallLaunchStatus?: string | null;
  readyItems?: number | string | null;
  warningItems?: number | string | null;
  failedItems?: number | string | null;
  readyForShadowLaunch?: boolean | string | number | null;
  readyForLimitedLiveTest?: boolean | string | number | null;
  items?: LaunchChecklistItem[] | null;
  checklist?: LaunchChecklistItem[] | null;
  nextSteps?: unknown[] | null;
};

export type SchedulerSummary = AnyRecord & {
  totalJobs?: number | string | null;
  enabledJobs?: number | string | null;
  disabledJobs?: number | string | null;
  lastRunStatus?: string | null;
  failedRuns?: number | string | null;
  successfulRuns?: number | string | null;
};

export type SchedulerJob = AnyRecord & {
  id?: string | null;
  jobKey?: string | null;
  jobName?: string | null;
  jobType?: string | null;
  enabled?: boolean | string | number | null;
  scheduleHint?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
};

export type NotificationSummary = AnyRecord & {
  queued?: number | string | null;
  sent?: number | string | null;
  blocked?: number | string | null;
  failed?: number | string | null;
  externalNotificationsEnabled?: boolean | string | number | null;
  emailEnabled?: boolean | string | number | null;
  whatsappEnabled?: boolean | string | number | null;
  slackEnabled?: boolean | string | number | null;
};

export type NotificationMessage = AnyRecord & {
  id?: string | null;
  createdAt?: string | null;
  channel?: string | null;
  recipient?: string | null;
  subject?: string | null;
  message?: string | null;
  severity?: string | null;
  status?: string | null;
  sourceModule?: string | null;
  sendAttempts?: number | string | null;
  lastError?: string | null;
};

export type NotificationSettings = AnyRecord & {
  externalNotificationsEnabled?: boolean | string | number | null;
  emailEnabled?: boolean | string | number | null;
  whatsappEnabled?: boolean | string | number | null;
  slackEnabled?: boolean | string | number | null;
};

export type SecurityGuardrailSummary = AnyRecord & {
  totalChecks?: number | string | null;
  allowed?: number | string | null;
  blocked?: number | string | null;
  dangerousBlocks?: number | string | null;
  latestBlockedAction?: string | null;
};

export type SecurityAuditEvent = AnyRecord & {
  id?: string | null;
  createdAt?: string | null;
  actor?: string | null;
  eventType?: string | null;
  route?: string | null;
  action?: string | null;
  allowed?: boolean | string | number | null;
  reason?: string | null;
};

export type MaintenanceSummary = AnyRecord & {
  latestRunStatus?: string | null;
  runsToday?: number | string | null;
  alertsGenerated?: number | string | null;
  dataSourcesChecked?: number | string | null;
  learningRebuilt?: boolean | string | number | null;
  healthStatus?: string | null;
};

export type MaintenanceRun = AnyRecord & {
  id?: string | null;
  runId?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  runStatus?: string | null;
  runType?: string | null;
  safetyInitialized?: boolean | string | number | null;
  alertRulesSeeded?: boolean | string | number | null;
  alertsGenerated?: number | string | null;
  dataSourcesChecked?: number | string | null;
  learningRebuilt?: boolean | string | number | null;
  healthStatus?: string | null;
  warnings?: unknown[] | string | null;
};

export type QaSmokeCheck = AnyRecord & {
  key?: string | null;
  name?: string | null;
  status?: string | null;
  critical?: boolean | string | number | null;
  message?: string | null;
  durationMs?: number | string | null;
};

export type QaSmokeLatest = AnyRecord & {
  runId?: string | null;
  runStatus?: string | null;
  totalChecks?: number | string | null;
  passCount?: number | string | null;
  warnCount?: number | string | null;
  failCount?: number | string | null;
  blockersCount?: number | string | null;
  warningsCount?: number | string | null;
  checks?: QaSmokeCheck[] | null;
  blockers?: unknown[] | null;
  warnings?: unknown[] | null;
};

export type QaSmokeRun = AnyRecord & {
  id?: string | null;
  runId?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  runStatus?: string | null;
  totalChecks?: number | string | null;
  passCount?: number | string | null;
  warnCount?: number | string | null;
  failCount?: number | string | null;
};

export type EngineRegistryItem = AnyRecord & {
  engineKey?: string | null;
  engineName?: string | null;
  category?: string | null;
  subcategory?: string | null;
  ruleTemplate?: string | null;
  outputActionType?: string | null;
  riskLevel?: string | null;
  costLevel?: string | null;
  priorityScore?: number | string | null;
  enabled?: boolean | string | number | null;
  shadowMode?: boolean | string | number | null;
  requiresApproval?: boolean | string | number | null;
  ownerModule?: string | null;
  lastRunStatus?: string | null;
  lastRunSummary?: string | null;
  lastRunAt?: string | null;
};

export type EngineRunLog = AnyRecord & {
  id?: string | null;
  engineKey?: string | null;
  runStatus?: string | null;
  runType?: string | null;
  actionsCreatedCount?: number | string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type DailyOrchestratorStatus = AnyRecord & {
  mode?: string | null;
  counts?: {
    totalEngines?: number | string | null;
    enabledEngines?: number | string | null;
    pendingApprovals?: number | string | null;
    last24hEngineRuns?: number | string | null;
    last24hActionsCreated?: number | string | null;
  } | null;
  dataReadiness?: {
    productPassportAvailable?: boolean | string | number | null;
    productEconomicsAvailable?: boolean | string | number | null;
    engineRegistryReady?: boolean | string | number | null;
    engineRouterReady?: boolean | string | number | null;
    approvalCenterReady?: boolean | string | number | null;
  } | null;
  warnings?: unknown[] | null;
};

export type DailyOrchestratorRun = AnyRecord & {
  id?: string | null;
  runId?: string | null;
  runStatus?: string | null;
  mode?: string | null;
  runType?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  enginesPlanned?: number | string | null;
  enginesRun?: number | string | null;
  actionsCreated?: number | string | null;
  skippedCount?: number | string | null;
  failedCount?: number | string | null;
  approvalPendingBefore?: number | string | null;
  approvalPendingAfter?: number | string | null;
  warnings?: unknown[] | null;
  recommendations?: unknown[] | null;
  message?: string | null;
};

export type AutomationSettings = {
  mode?: string;
  maxDailyRecommendations?: number;
  targetAcosDefault?: number;
  minProfitLowPrice?: number;
  minProfitMidPrice?: number;
  allowAutoNegative?: boolean;
  allowAutoBidChange?: boolean;
  allowAutoBudgetChange?: boolean;
  allowAutoKeywordAdd?: boolean;
  allowAutoProductTargetAdd?: boolean;
  allowAutoListingChange?: boolean;
  allowAutoPriceChange?: boolean;
  approvalRequiredForTier2?: boolean;
  approvalRequiredForTier3?: boolean;
  shadowModeDays?: number;
  notes?: string | null;
};

export type TodayCommandSummary = AnyRecord & {
  systemStatus?: AnyRecord | null;
  topRisks?: AnyRecord[] | null;
  todayPriorities?: AnyRecord[] | null;
  nextBestActions?: AnyRecord[] | string[] | null;
};

export type LearningEngineSummary = AnyRecord & {
  engineKey?: string | null;
  usefulnessScore?: number | string | null;
  confidenceScore?: number | string | null;
  approvedCount?: number | string | null;
  completedCount?: number | string | null;
  rejectedCount?: number | string | null;
  failedCount?: number | string | null;
  noActionCount?: number | string | null;
  lastEventAt?: string | null;
};

export type LearningSummary = AnyRecord & {
  totalLearningEvents?: number | string | null;
  enginesTracked?: number | string | null;
  approvedCount?: number | string | null;
  rejectedCount?: number | string | null;
  monitoringCount?: number | string | null;
  completedCount?: number | string | null;
  noActionCount?: number | string | null;
  failedCount?: number | string | null;
  topUsefulEngines?: LearningEngineSummary[] | null;
  weakestEngines?: LearningEngineSummary[] | null;
};

export type LearningEvent = AnyRecord & {
  id?: string | null;
  createdAt?: string | null;
  eventType?: string | null;
  engineKey?: string | null;
  actionType?: string | null;
  sku?: string | null;
  asin?: string | null;
  actor?: string | null;
  note?: string | null;
};

export type ExecutionGatewayStatus = AnyRecord & {
  mode?: string | null;
  liveExecutionEnabled?: boolean | string | number | null;
  message?: string | null;
  totalAttempts?: number | string | null;
  shadowCompleted?: number | string | null;
  liveBlocked?: number | string | null;
  failedAttempts?: number | string | null;
};

export type ExecutionAttempt = AnyRecord & {
  id?: string | null;
  createdAt?: string | null;
  actionId?: string | null;
  actionType?: string | null;
  executionMode?: string | null;
  executionStatus?: string | null;
  actor?: string | null;
  blockedReason?: string | null;
  resultMessage?: string | null;
  errorMessage?: string | null;
};

export type ListingDraftSummary = AnyRecord & {
  totalDrafts?: number | string | null;
  drafted?: number | string | null;
  actionCreated?: number | string | null;
  approved?: number | string | null;
  rejected?: number | string | null;
  titleDrafts?: number | string | null;
  bulletDrafts?: number | string | null;
  backendKeywordDrafts?: number | string | null;
  descriptionDrafts?: number | string | null;
};

export type ListingDraft = AnyRecord & {
  id: string;
  sku?: string | null;
  asin?: string | null;
  productName?: string | null;
  draftType?: string | null;
  currentValue?: string | null;
  proposedValue?: string | null;
  reason?: string | null;
  confidenceLabel?: string | null;
  riskLevel?: string | null;
  status?: string | null;
  actionId?: string | null;
};

export type CreativeRecommendationSummary = AnyRecord & {
  totalRecommendations?: number | string | null;
  drafted?: number | string | null;
  actionCreated?: number | string | null;
  mainImageReviews?: number | string | null;
  infographicReviews?: number | string | null;
  lifestyleReviews?: number | string | null;
  sizeChartReviews?: number | string | null;
  aplusContentReviews?: number | string | null;
  brandStoryReviews?: number | string | null;
};

export type CreativeRecommendation = AnyRecord & {
  id: string;
  sku?: string | null;
  asin?: string | null;
  productName?: string | null;
  recommendationType?: string | null;
  title?: string | null;
  summary?: string | null;
  recommendedAction?: string | null;
  confidenceLabel?: string | null;
  riskLevel?: string | null;
  status?: string | null;
  actionId?: string | null;
};

export type AmazonAdsDashboardMetricSummary = {
  impressions: number;
  clicks: number;
  cost: number;
  sales: number;
  orders: number;
  ctr: number;
  cpc: number;
  acos: number | null;
  roas: number | null;
  conversionRate: number;
};

export type AmazonAdsDashboardCampaignSummary = AmazonAdsDashboardMetricSummary & {
  campaignId: string;
  campaignName: string | null;
};

export type AmazonAdsDashboardDailyTrend = AmazonAdsDashboardMetricSummary & {
  date: string;
};

export type AmazonAdsDashboardSummary = AnyRecord & {
  ok?: boolean;
  sellerId?: string;
  days?: number;
  dateRange?: { startDate: string; endDate: string };
  totals: AmazonAdsDashboardMetricSummary;
  dailyTrend: AmazonAdsDashboardDailyTrend[];
  campaigns: AmazonAdsDashboardCampaignSummary[];
  bestCampaignByClicks: AmazonAdsDashboardCampaignSummary | null;
  highestSpendCampaign: AmazonAdsDashboardCampaignSummary | null;
  zeroSalesSpend: number;
};

export type AmazonAdsRecommendationEvidence = {
  impressions: number;
  clicks: number;
  cost: number;
  sales: number;
  orders: number;
  ctr: number;
  cpc: number;
  acos: number | null;
  roas: number;
  conversionRate: number;
};

export type AmazonAdsRecommendationItem = AnyRecord & {
  searchTerm: string;
  campaignId: string;
  campaignName: string | null;
  adGroupId: string;
  adGroupName: string | null;
  recommendationType?: string | null;
  recommendedAction?: string | null;
  priorityScore?: number | null;
  priorityLabel?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null;
  confidenceScore?: number | null;
  confidenceLabel?: "LOW" | "MEDIUM" | "HIGH" | null;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | null;
  reason?: string | null;
  evidence?: AmazonAdsRecommendationEvidence;
};

export type PpcRecommendationResponse = AnyRecord & {
  ok?: boolean;
  sellerId?: string;
  days?: number;
  targetAcos?: number;
  effectiveTargetAcos?: number;
  summary?: Record<string, number>;
  profitDataStatus?: "AVAILABLE" | "MISSING" | "MISSING_COST_DATA";
  exactMatchOpportunities: AmazonAdsRecommendationItem[];
  productTargetingOpportunities: AmazonAdsRecommendationItem[];
  watchlistWasteTerms: AmazonAdsRecommendationItem[];
  negativeKeywordCandidates: AmazonAdsRecommendationItem[];
  negativeProductTargetCandidates: AmazonAdsRecommendationItem[];
  bidDownCandidates: AmazonAdsRecommendationItem[];
  productPageCheckWarnings: AmazonAdsRecommendationItem[];
  profitRiskWarnings: AmazonAdsRecommendationItem[];
  monitorOnlyTerms: AmazonAdsRecommendationItem[];
  warnings?: string[];
};

export type AmazonSpSalesSummaryBySku = AnyRecord & {
  sku: string;
  asin: string | null;
  title: string | null;
  units: number;
  sales: number;
  orders: number;
  confirmedUnits: number;
  confirmedSales: number;
  confirmedOrders: number;
  pendingUnits: number;
  pendingSales: number;
  pendingOrders: number;
  cancelledUnits: number;
  cancelledSales: number;
  cancelledOrders: number;
};

export type AmazonSpSalesSummary = AnyRecord & {
  days: number;
  rawSales: number;
  rawOrders: number;
  rawUnits: number;
  confirmedSales: number;
  confirmedOrders: number;
  confirmedUnits: number;
  pendingSales: number;
  pendingOrders: number;
  pendingUnits: number;
  cancelledSales: number;
  cancelledOrders: number;
  cancelledUnits: number;
  unknownSales: number;
  unknownOrders: number;
  unknownUnits: number;
  totalSales: number;
  totalOrders: number;
  totalUnits: number;
  averageConfirmedOrderValue: number | null;
  averageOrderValue: number | null;
  bySku: AmazonSpSalesSummaryBySku[];
};
