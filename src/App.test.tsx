// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("Savings Desk interactions", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the complete opportunity view from the overview", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Browse this week" }));

    expect(screen.getByRole("heading", { name: "All opportunities" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Search merchant or offer")).toBeTruthy();
  });

  it("explains why each opportunity earned its score", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Browse this week" }));
    fireEvent.click(screen.getAllByText("Score factors")[0]);

    expect(screen.getAllByText("Evidence").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Local relevance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stackability").length).toBeGreaterThan(0);
  });

  it("persists a saved opportunity locally", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Browse this week" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Save Free medium drink for eligible new app users"
      })
    );

    expect(window.localStorage.getItem("savings-desk:saved")).toContain(
      "dutch-bros-free-medium-app-2026"
    );
  });

  it("persists local ranking priorities and applies them to scoring", () => {
    render(<App />);

    expect(screen.getByLabelText("Evidence priority")).toHaveProperty(
      "value",
      "18"
    );

    fireEvent.change(screen.getByLabelText("Dollar value priority"), {
      target: { value: "40" }
    });

    expect(
      window.localStorage.getItem("savings-desk:scoring-weights")
    ).toContain('"dollarValue":40');

    cleanup();
    render(<App />);
    expect(screen.getByLabelText("Dollar value priority")).toHaveProperty(
      "value",
      "40"
    );
  });

  it("shows the preference-filtered value and offer count", () => {
    render(<App />);

    expect(screen.getByText("Priority mode: household-fit, high-value savings")).toBeTruthy();
    expect(screen.getByText(/Built for an adult-and-teen household/)).toBeTruthy();
    expect(screen.queryByText(/\$10 off baby essentials/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Browse this week" }));
    expect(screen.getByText("Free Whataburger for new app members")).toBeTruthy();
    expect(screen.queryByText(/Best household fit: teen clothing/)).toBeNull();
  });

  it("removes unwanted local activity offers", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Browse this week" }));

    expect(screen.queryByText("Free curbside address paint kit")).toBeNull();
    expect(screen.queryByText("Free outdoor fitness classes")).toBeNull();
    expect(screen.queryByText("Free events and summer reading")).toBeNull();
    expect(screen.queryByRole("button", { name: "Local" })).toBeNull();
  });

  it("calculates a transparent deal stack", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Savings tools" }));

    expect(screen.getByRole("heading", { name: "Deal-stacking calculator" })).toBeTruthy();
    expect(screen.getByText("$30.40")).toBeTruthy();
    expect(screen.getByText("$19.60")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Digital coupon"), {
      target: { value: "10" }
    });
    expect(screen.getByText("$25.65")).toBeTruthy();
  });

  it("stores price alerts and expiration reminders only in local browser storage", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Savings tools" }));
    fireEvent.change(screen.getByPlaceholderText("Coffee beans, movie ticket…"), {
      target: { value: "Movie popcorn" }
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add alert" }));

    expect(window.localStorage.getItem("savings-desk:price-alerts")).toContain(
      "Movie popcorn"
    );

    const reminder = screen.getAllByRole("button", {
      name: /^Enable reminder/
    })[0];
    fireEvent.click(reminder);
    expect(window.localStorage.getItem("savings-desk:reminders")).not.toBe("[]");
  });

  it("logs confirmed savings locally and feeds preference learning", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Savings tools" }));
    fireEvent.change(screen.getByLabelText("Merchant"), {
      target: { value: "H-E-B" }
    });
    fireEvent.change(screen.getByLabelText("Actual savings"), {
      target: { value: "8.5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Log savings" }));

    expect(screen.getAllByText("$8.50").length).toBeGreaterThan(0);
    expect(
      window.localStorage.getItem("savings-desk:receipts")
    ).toContain("H-E-B");

    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByText("Confirmed savings")).toBeTruthy();
    expect(screen.getAllByText("$8.50").length).toBeGreaterThan(0);
    expect(
      window.localStorage.getItem("savings-desk:receipts")
    ).toContain('"merchant":"H-E-B"');
  });

  it("delivers threshold alerts locally and persists dismissal", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Savings tools" }));
    expect(screen.getByRole("heading", { name: "High-value alerts" })).toBeTruthy();
    expect(screen.getByText(/\$20 clears the \$10 threshold/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Minimum dollar savings"), {
      target: { value: "100" }
    });
    fireEvent.click(screen.getByLabelText("Include free rewards"));
    expect(
      screen.getByText("No opportunities clear this threshold.")
    ).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Include free rewards"));
    fireEvent.change(screen.getByLabelText("Minimum dollar savings"), {
      target: { value: "10" }
    });
    fireEvent.click(screen.getAllByRole("button", { name: /^Dismiss / })[0]);

    expect(
      window.localStorage.getItem("savings-desk:value-alert-settings")
    ).toContain("10");
    expect(
      window.localStorage.getItem("savings-desk:value-alerts-acknowledged")
    ).not.toBe("[]");
  });

  it("surfaces ranked discovery candidates and stores local review decisions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = input.toString();
        if (url.includes("/reports/discovery.json")) {
          return {
            ok: true,
            json: async () => ({
              generatedAt: "2026-08-21T13:00:00.000Z",
              parsedOfferCandidates: [
                {
                  id: "test-candidate",
                  sourceId: "take5-rayford",
                  merchant: "Take 5 Oil Change",
                  title: "$15 off any oil change",
                  url: "https://example.com/coupon",
                  amountText: "$15 Off",
                  candidateScore: 82,
                  candidateReasons: ["$15 Off value"]
                }
              ]
            })
          };
        }
        return {
          ok: true,
          json: async () => ({ generatedAt: "", checkedOn: "", items: [] })
        };
      })
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Savings tools" }));

    expect(await screen.findByRole("heading", { name: "Discovery review queue" })).toBeTruthy();
    expect(screen.getByText("$15 off any oil change")).toBeTruthy();
    expect(screen.getByText("82/100")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Capture terms for $15 off any oil change" }));
    fireEvent.change(screen.getByLabelText("Dollar estimate"), {
      target: { value: "15" }
    });
    fireEvent.change(screen.getByLabelText("Minimum spend"), {
      target: { value: "25" }
    });
    fireEvent.change(screen.getByLabelText("Expires on"), {
      target: { value: "2026-09-30" }
    });
    fireEvent.click(screen.getByLabelText("I confirmed the linked official terms"));
    fireEvent.click(screen.getByRole("button", { name: "Add locally recorded deal" }));

    expect(
      window.localStorage.getItem("savings-desk:local-offers")
    ).toContain('"id":"local-test-candidate"');

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove locally recorded deal $15 off any oil change"
      })
    );
    expect(window.localStorage.getItem("savings-desk:local-offers")).toBe("[]");

    fireEvent.click(screen.getByRole("button", { name: "Keep $15 off any oil change" }));
    expect(window.localStorage.getItem("savings-desk:candidate-reviews")).toContain(
      "keep"
    );

    vi.unstubAllGlobals();
  });

  it("shows grocery comparisons under the dedicated Grocery tab", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Grocery" }));

    expect(screen.getByRole("heading", { name: "Local grocery comparisons" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "77386 local grocery check" })).toBeTruthy();
    expect(screen.getByText("No verified local winner")).toBeTruthy();
    expect(screen.getAllByText("Not locally confirmed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("80% Lean Ground Beef")).toHaveLength(2);

    fireEvent.click(screen.getByRole("tab", { name: "Roma tomatoes" }));
    expect(screen.getByText("Walmart #3585 at $0.97/lb (only locally verified price)")).toBeTruthy();
  });

  it("renders the action plan and persists its local planning limits", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Action plan" }));

    expect(screen.getByRole("heading", { name: "Weekly action plan" })).toBeTruthy();
    expect(screen.getByLabelText("Weekly spend budget")).toHaveProperty("value", "100");

    expect(screen.getByLabelText("Minimum days valid")).toHaveProperty(
      "value",
      "0"
    );

    fireEvent.change(screen.getByLabelText("Weekly spend budget"), {
      target: { value: "20" }
    });

    expect(
      window.localStorage.getItem("savings-desk:weekly-plan-settings")
    ).toContain('"weeklyBudget":20');

    fireEvent.change(screen.getByLabelText("Minimum days valid"), {
      target: { value: "7" }
    });
    expect(
      window.localStorage.getItem("savings-desk:weekly-plan-settings")
    ).toContain('"minimumDaysRemaining":7');

    fireEvent.click(screen.getByRole("button", { name: "Overview" }));
    fireEvent.click(screen.getByRole("button", { name: "Action plan" }));
    expect(screen.getByLabelText("Weekly spend budget")).toHaveProperty("value", "20");
  });

  it("keeps a customizable local staples watchlist with target alerts", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Grocery" }));

    expect(screen.getByRole("heading", { name: "Staples watchlist" })).toBeTruthy();
    const watchlistStatus = within(screen.getByLabelText("Watchlist status"));
    expect(watchlistStatus.getAllByText("12")).toHaveLength(2);
    expect(screen.getAllByText("Target met")).toHaveLength(10);
    expect(screen.getAllByText("Meets target; confirm locally")).toHaveLength(2);
    expect(screen.getAllByText("Latest unit price")).toHaveLength(12);

    fireEvent.change(screen.getByPlaceholderText("Rice, chicken breast, cereal…"), {
      target: { value: "Brown rice" }
    });
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "1.25" }
    });
    fireEvent.change(screen.getByLabelText("Compare as"), {
      target: { value: "per lb" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add staple" }));

    expect(screen.getByText("Brown rice")).toBeTruthy();
    expect(window.localStorage.getItem("savings-desk:grocery-watchlist")).toContain(
      "Brown rice"
    );
  });

  it("keeps class action review manual and saves only non-sensitive preferences", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Settlements" }));

    expect(
      screen.getByRole("heading", { name: "Class action settlements" })
    ).toBeTruthy();
    expect(screen.getByText("Informational only — not legal advice")).toBeTruthy();
    expect(screen.getAllByText("Eligibility not confirmed")).toHaveLength(4);
    expect(
      screen.getAllByRole("link", { name: "Open official claim form" })
    ).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /submit claim/i })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Save YouTube TV / DirecTV Stream settlement"
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Enable reminder for YouTube TV / DirecTV Stream settlement"
      })
    );

    expect(
      window.localStorage.getItem("savings-desk:settlement-saved")
    ).toContain("biddle-disney-online-tv-2026");
    expect(
      window.localStorage.getItem("savings-desk:settlement-reminders")
    ).toContain("biddle-disney-online-tv-2026");
  });
});
