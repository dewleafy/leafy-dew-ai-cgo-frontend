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
  experimentName?: string;
  experimentType?: string;
  status?: string;
  priority?: string;
  hypothesis?: string | null;
  expectedResult?: string | null;
  successMetric?: string | null;
  startDate?: string | null;
  endDate?: string | null;
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
