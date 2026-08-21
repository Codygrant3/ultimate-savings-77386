import type {
  LocalMerchantInventory,
  LocalMerchantLocation,
  Opportunity,
  ResolvedDistance
} from "../types";

const EARTH_RADIUS_MILES = 3958.7613;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineMiles(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number }
): number {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(first.latitude)) *
      Math.cos(toRadians(second.latitude)) *
      Math.sin(longitudeDelta / 2) **
        2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

function normalized(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesMerchant(
  opportunity: Opportunity,
  location: LocalMerchantLocation
): boolean {
  const merchant = normalized(opportunity.merchant);
  return location.merchantAliases.some(
    (alias) => merchant === normalized(alias)
  );
}

function addressMatches(
  opportunity: Opportunity,
  location: LocalMerchantLocation
): boolean {
  const searchable = `${opportunity.locationNote} ${opportunity.summary}`
    .toLowerCase()
    .replace(/-/g, " ");
  const streetNumber = location.address.split(" ")[0]?.toLowerCase();
  const street = normalized(location.address)
    .split(" ")
    .slice(1, 4)
    .join(" ");
  return Boolean(streetNumber && street && searchable.includes(streetNumber) && searchable.includes(street));
}

export function resolveOpportunityDistance(
  opportunity: Opportunity,
  inventory?: LocalMerchantInventory
): ResolvedDistance | null {
  if (opportunity.distanceMiles !== undefined) return null;
  if (!inventory || inventory.zipCode !== "77386") return null;

  const candidates = inventory.merchants.filter(
    (location) =>
      matchesMerchant(opportunity, location) ||
      addressMatches(opportunity, location)
  );
  if (candidates.length === 0) return null;

  const selected = candidates.reduce((nearest, candidate) =>
    candidate.distanceMiles < nearest.distanceMiles ? candidate : nearest
  );

  return {
    distanceMiles: selected.distanceMiles,
    basis: "merchant-location",
    sourceLabel: selected.sourceLabel,
    sourceUrl: selected.sourceUrl,
    checkedOn: selected.checkedOn,
    locationName: selected.locationName
  };
}
