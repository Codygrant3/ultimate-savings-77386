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
  finePrint?: string;
  expirationLabel?: string;
  availability?: AvailabilityStatus;
  dealType?: DealType;
  freshness?: FreshnessStatus;
  discoveredOn?: string;
  preferenceSignals?: string[];
}

export interface ScoredOpportunity extends Opportunity {
  score: number;
  scoreLabel: "Excellent" | "Strong" | "Worth a look" | "Low priority";
  scoreBreakdown: ScoreFactor[];
}

export interface ScoreFactor {
  label: string;
  points: number;
  weight: number;
  detail: string;
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
