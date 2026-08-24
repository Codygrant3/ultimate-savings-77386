export type Category =
  | "restaurants"
  | "grocery"
  | "fuel"
  | "coffee"
  | "convenience"
  | "local"
  | "auto"
  | "movies"
  | "sports"
  | "tax-free"
  | "shopping"
  | "financial"
  | "entertainment"
  | "home";

export type VerificationStatus = "verified" | "program" | "needs-check";
export type Friction = "low" | "medium" | "high";
export type OpportunityTier = "A" | "B" | "C";
export type AvailabilityStatus = "available" | "waitlist" | "program";
export type DealType =
  | "digital-coupon"
  | "loyalty-reward"
  | "free-food"
  | "fuel-reward"
  | "convenience-reward"
  | "stacking-strategy"
  | "grand-opening"
  | "promotion-event"
  | "vehicle-maintenance"
  | "movie-discount"
  | "sports-ticket"
  | "tax-holiday";
export type FreshnessStatus = "new" | "improved" | "current" | "monitoring";
export type StackCompatibility = "compatible" | "conditional" | "exclusive";

export interface SourceEvidence {
  label: string;
  url: string;
  checkedOn: string;
}

export interface Opportunity {
  id: string;
  merchant: string;
  title: string;
  summary: string;
  category: Category;
  estimatedSavings: number;
  minimumSpend: number;
  savingsRate?: number;
  isFree: boolean;
  expiresOn?: string;
  locationNote: string;
  verification: VerificationStatus;
  friction: Friction;
  tags: string[];
  source: SourceEvidence;
  actionLabel: string;
  tier?: OpportunityTier;
  distanceMiles?: number;
  stackNote?: string;
  stackGroup?: string;
  stackStatus?: StackCompatibility;
  finePrint?: string;
  expirationLabel?: string;
  availability?: AvailabilityStatus;
  dealType?: DealType;
  freshness?: FreshnessStatus;
  discoveredOn?: string;
  preferenceSignals?: string[];
  localRecord?: boolean;
}

export interface LocalMerchantLocation {
  id: string;
  merchantAliases: string[];
  locationName: string;
  address: string;
  distanceMiles: number;
  sourceLabel: string;
  sourceUrl: string;
  checkedOn: string;
}

export interface LocalMerchantInventory {
  zipCode: string;
  origin: {
    label: string;
    latitude: number;
    longitude: number;
  };
  checkedOn: string;
  merchants: LocalMerchantLocation[];
}

export interface ResolvedDistance {
  distanceMiles: number;
  basis: "offer" | "merchant-location";
  sourceLabel: string;
  sourceUrl: string;
  checkedOn: string;
  locationName: string;
}

export interface ScoredOpportunity extends Opportunity {
  score: number;
  scoreLabel: "Excellent" | "Strong" | "Worth a look" | "Low priority";
  scoreBreakdown: ScoreFactor[];
  distanceBasis?: "offer" | "merchant-location" | "unknown";
  distanceCheckedOn?: string;
  distanceSourceLabel?: string;
  distanceSourceUrl?: string;
}

export interface ScoreFactor {
  label: string;
  points: number;
  weight: number;
  detail: string;
}

export interface ReceiptEntry {
  id: string;
  opportunityId?: string;
  merchant: string;
  category: Category;
  occurredOn: string;
  amountSpent: number;
  actualSavings: number;
  listedValue?: number;
}

export interface PreferenceEvidence {
  count: number;
  confirmedSavings: number;
}

export interface LearnedPreferences {
  categoryAffinity: Record<Category, number>;
  merchantAffinity: Record<string, number>;
  categoryEvidence: Record<Category, PreferenceEvidence>;
  merchantEvidence: Record<string, PreferenceEvidence>;
}

export interface ValueAlertSettings {
  minimumValue: number;
  includeFreeRewards: boolean;
  maximumFriction: "low" | "medium" | "any";
}

export interface ScoringWeights {
  evidence: number;
  dollarValue: number;
  savingsRate: number;
  householdFit: number;
  localRelevance: number;
  timing: number;
  effort: number;
  requiredSpend: number;
  stackability: number;
}

export interface HouseholdProfile {
  excludedKeywords: string[];
  highPriorityKeywords: string[];
  preferredKeywords: string[];
}

export interface ValueAlert {
  id: string;
  merchant: string;
  title: string;
  reason: string;
  estimatedSavings: number;
  expiresOn?: string;
  sourceUrl: string;
}

export interface OfferCandidate {
  id: string;
  sourceId: string;
  merchant: string;
  title: string;
  detail?: string;
  url: string;
  amountText?: string;
  minimumSpend?: number;
  expirationText?: string;
  candidateScore?: number;
  candidateReasons?: string[];
}

export type CandidateReviewStatus = "keep" | "dismissed";

export type CandidateReviews = Record<string, CandidateReviewStatus>;

export interface WeeklyPlanSettings {
  weeklyBudget: number;
  maxTrips: number;
  maxDistanceMiles: number;
  maximumSourceAgeDays: number;
  minimumDaysRemaining: number;
  maximumFriction: "low" | "medium" | "any";
  includeUnconfirmedLocations: boolean;
  requireLocalParticipation: boolean;
  allowConditionalStacking: boolean;
  maxDealsPerTrip: number;
  tripOrder: TripOrder;
}

export type TripOrder = "utility" | "distance";

export interface PlannedDeal {
  opportunity: ScoredOpportunity;
  warnings: string[];
}

export interface PlannedTrip {
  id: string;
  merchant: string;
  distanceMiles?: number;
  distanceConfirmed: boolean;
  hasUnconfirmedLocationDeal: boolean;
  hasUnconfirmedParticipationDeal: boolean;
  requiredSpend: number;
  estimatedSavings: number;
  averageScore: number;
  utility: number;
  deals: PlannedDeal[];
  warnings: string[];
}

export type EvidenceAgeFilter = "all" | "7" | "14";

export interface ExcludedOpportunity {
  opportunity: ScoredOpportunity;
  reason: string;
}

export interface WeeklyPlan {
  trips: PlannedTrip[];
  selectedDeals: PlannedDeal[];
  excluded: ExcludedOpportunity[];
  requiredSpend: number;
  estimatedSavings: number;
  savingsRate: number;
  assumptions: string[];
}

export interface WeeklyReport {
  generatedAt: string;
  weekOf: string;
  zipCode: string;
  totalPotentialSavings: number;
  verifiedCount: number;
  expiringCount: number;
  opportunities: ScoredOpportunity[];
  watchlist: ScoredOpportunity[];
}

export interface PriceAlert {
  id: string;
  item: string;
  category: string;
  targetPrice: number;
  latestPrice: number | null;
  unit: string;
  sourceLabel: string;
  sourceUrl?: string;
  checkedOn?: string;
}

export type LocalPriceStatus =
  "verified-local" | "official-needs-local-check" | "unavailable";

export interface GroceryWatchItem {
  id: string;
  item: string;
  comparisonId?: string;
  targetPrice: number;
  latestPrice: number | null;
  unit: string;
  retailer?: string;
  sourceLabel: string;
  sourceUrl?: string;
  checkedOn?: string;
  locationStatus: LocalPriceStatus | "manual";
  custom?: boolean;
}

export interface GroceryWatchlistSnapshot {
  generatedAt: string;
  checkedOn: string;
  items: GroceryWatchItem[];
}

export interface LocalGroceryPrice {
  retailer: "Kroger" | "Walmart" | "H-E-B" | "Aldi";
  product: string;
  packageSize: string;
  price: number | null;
  unitPrice: number | null;
  unit: string;
  status: LocalPriceStatus;
  locationNote: string;
  checkedOn?: string;
  dateLabel: string;
  sourceUrl: string;
}

export interface LocalGroceryComparison {
  id: string;
  item: string;
  category: "staple" | "produce" | "meat";
  comparisonNote: string;
  winner: string | null;
  prices: LocalGroceryPrice[];
}

export type SettlementProofRequirement =
  | "none-stated"
  | "notice-or-records"
  | "purchase-or-subscription-records"
  | "expense-documentation"
  | "vehicle-records";

export type SettlementVerification =
  "official-administrator" | "court-authorized-notice";

export interface ClassActionSettlement {
  id: string;
  caseName: string;
  shortTitle: string;
  summary: string;
  claimDeadline: string;
  eligibilitySummary: string;
  proofRequirement: SettlementProofRequirement;
  proofSummary: string;
  estimatedBenefit: string;
  geography: string;
  sourceUrl: string;
  claimFormUrl: string;
  administrator: string;
  court: string;
  verification: SettlementVerification;
  checkedOn: string;
  freshness: "current" | "review-due";
  relevanceScore: number;
  relevanceReason: string;
  feeRequired: false;
  eligibilityStatus: "user-confirmation-required";
}

export interface SettlementSnapshot {
  generatedAt: string;
  checkedOn: string;
  openCount: number;
  settlements: ClassActionSettlement[];
  excludedRules: string[];
  limitations: string[];
}
