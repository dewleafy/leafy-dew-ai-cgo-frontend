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
  id: string;
  key?: string;
  sku?: string | null;
  asin?: string | null;
  productName?: string | null;
  subCategory?: string | null;
  sellingPrice?: number | string | null;
  costStatus?: string | null;
  missingFields?: string[] | string | null;
  profitStatus?: string | null;
  profitDataStatus?: string | null;
  targetAcos?: number | string | null;
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
