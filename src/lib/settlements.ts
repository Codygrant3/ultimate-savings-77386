import type { ClassActionSettlement } from "../types";

export function isOpenSettlement(
  settlement: ClassActionSettlement,
  now = new Date()
): boolean {
  const deadline = new Date(`${settlement.claimDeadline}T23:59:59`);
  return (
    settlement.feeRequired === false &&
    settlement.eligibilityStatus === "user-confirmation-required" &&
    ["official-administrator", "court-authorized-notice"].includes(
      settlement.verification
    ) &&
    deadline.getTime() >= now.getTime()
  );
}

export function rankSettlements(
  settlements: ClassActionSettlement[],
  now = new Date()
): ClassActionSettlement[] {
  return settlements
    .filter((settlement) => isOpenSettlement(settlement, now))
    .sort((first, second) => {
      if (second.relevanceScore !== first.relevanceScore) {
        return second.relevanceScore - first.relevanceScore;
      }
      return first.claimDeadline.localeCompare(second.claimDeadline);
    });
}

export function daysUntilDeadline(
  deadline: string,
  now = new Date()
): number {
  const end = new Date(`${deadline}T23:59:59`);
  return Math.max(
    0,
    Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  );
}
