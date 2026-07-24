// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

  it("shows the preference-filtered value and offer count", () => {
    render(<App />);

    expect(screen.getByText("Priority mode: household-fit, high-value savings")).toBeTruthy();
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
});
