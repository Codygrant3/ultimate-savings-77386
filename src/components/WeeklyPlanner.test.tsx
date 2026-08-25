// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScoredOpportunity } from "../types";
import { DEFAULT_WEEKLY_PLAN_SETTINGS } from "../lib/plan";
import { WeeklyPlanner } from "./WeeklyPlanner";

function offer(overrides: Partial<ScoredOpportunity>): ScoredOpportunity {
  return {
    id: "offer",
    merchant: "Market",
    title: "Test offer",
    summary: "Official test offer",
    category: "grocery",
    estimatedSavings: 10,
    minimumSpend: 10,
    isFree: false,
    expiresOn: "2026-09-30",
    locationNote: "77386 area",
    verification: "verified",
    friction: "low",
    tags: [],
    stackNote: "Compatible",
    source: {
      label: "Official source",
      url: "https://example.com/offer",
      checkedOn: "2026-08-24"
    },
    actionLabel: "Review",
    distanceMiles: 2,
    score: 80,
    scoreLabel: "Strong",
    scoreBreakdown: [],
    ...overrides
  };
}

const opportunities = [
  offer({ id: "kept", merchant: "Kept Market", title: "Kept offer" }),
  offer({ id: "used", merchant: "Used Market", title: "Used offer" })
];

function renderPlanner(redeemedIds: string[] = []) {
  return render(
    <WeeklyPlanner
      opportunities={opportunities}
      settings={DEFAULT_WEEKLY_PLAN_SETTINGS}
      onSettingsChange={vi.fn()}
      savedIds={[]}
      redeemedIds={redeemedIds}
      receipts={[]}
      onSave={vi.fn()}
      onRedeem={vi.fn()}
    />
  );
}

describe("WeeklyPlanner execution controls", () => {
  afterEach(cleanup);

  it("saves a selected plan deal without removing it from the plan", () => {
    renderPlanner();
    const onSave = vi.fn();
    cleanup();

    render(
      <WeeklyPlanner
        opportunities={opportunities}
        settings={DEFAULT_WEEKLY_PLAN_SETTINGS}
        onSettingsChange={vi.fn()}
        savedIds={[]}
        redeemedIds={[]}
        receipts={[]}
        onSave={onSave}
        onRedeem={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Kept offer" }));
    expect(onSave).toHaveBeenCalledWith("kept");
    expect(screen.getByText("Kept offer")).toBeTruthy();
  });

  it("removes a deal marked used from the next optimized plan", () => {
    const onRedeem = vi.fn();
    const { rerender } = render(
      <WeeklyPlanner
        opportunities={opportunities}
        settings={{ ...DEFAULT_WEEKLY_PLAN_SETTINGS, maxTrips: 5 }}
        onSettingsChange={vi.fn()}
        savedIds={[]}
        redeemedIds={[]}
        receipts={[]}
        onSave={vi.fn()}
        onRedeem={onRedeem}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark Used offer as used" }));
    expect(onRedeem).toHaveBeenCalledWith("used");

    rerender(
      <WeeklyPlanner
        opportunities={opportunities}
        settings={{ ...DEFAULT_WEEKLY_PLAN_SETTINGS, maxTrips: 5 }}
        onSettingsChange={vi.fn()}
        savedIds={[]}
        redeemedIds={["used"]}
        receipts={[]}
        onSave={vi.fn()}
        onRedeem={onRedeem}
      />
    );

    expect(screen.queryByText("Used offer")).toBeNull();
    expect(screen.getByText("Kept offer")).toBeTruthy();
  });

  it("shows planning context and emits validity, effort, and stacking changes", () => {
    const onSettingsChange = vi.fn();
    render(
      <WeeklyPlanner
        opportunities={[offer({ id: "kept", title: "Kept offer" })]}
        settings={DEFAULT_WEEKLY_PLAN_SETTINGS}
        onSettingsChange={onSettingsChange}
        savedIds={[]}
        redeemedIds={[]}
        receipts={[]}
        onSave={vi.fn()}
        onRedeem={vi.fn()}
      />
    );

    expect(screen.getByText(/ends Sep 30 · 37 days left/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Minimum days valid"), {
      target: { value: "7" }
    });
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...DEFAULT_WEEKLY_PLAN_SETTINGS,
      minimumDaysRemaining: 7
    });

    fireEvent.change(screen.getByLabelText("Maximum effort"), {
      target: { value: "any" }
    });
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...DEFAULT_WEEKLY_PLAN_SETTINGS,
      maximumFriction: "any"
    });

    expect(screen.getByLabelText("Allow conditional stacks")).toHaveProperty(
      "checked",
      false
    );
    fireEvent.click(screen.getByLabelText("Allow conditional stacks"));
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WEEKLY_PLAN_SETTINGS,
      allowConditionalStacking: true
    });

    fireEvent.change(screen.getByLabelText("Estimated cost per mile"), {
      target: { value: "0.70" }
    });
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WEEKLY_PLAN_SETTINGS,
      travelCostPerMile: 0.7
    });

    expect(screen.getByLabelText("High-priority only")).toHaveProperty(
      "checked",
      false
    );
    fireEvent.click(screen.getByLabelText("High-priority only"));
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WEEKLY_PLAN_SETTINGS,
      requireHighPriorityFit: true
    });

    fireEvent.click(screen.getByLabelText("Measured cash value only"));
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WEEKLY_PLAN_SETTINGS,
      requireMeasuredDollarValue: true
    });

    fireEvent.change(screen.getByLabelText("Planning objective"), {
      target: { value: "efficiency" }
    });
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WEEKLY_PLAN_SETTINGS,
      planObjective: "efficiency"
    });

    fireEvent.change(screen.getByLabelText("Minimum value per $1"), {
      target: { value: "0.50" }
    });
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULT_WEEKLY_PLAN_SETTINGS,
      minimumValuePerDollar: 0.5
    });
  });
});
