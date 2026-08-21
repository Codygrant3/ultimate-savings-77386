import { describe, expect, it } from "vitest";
import type { DiscoverySource } from "./source-parsers-types";
import { parseSourceOffers } from "./source-parsers";

const wendysSource: DiscoverySource = {
  id: "wendys-offers",
  name: "Wendy's official offers",
  url: "https://www.wendys.com/offers-coupons",
  category: "restaurants",
  priority: 10,
  keywords: ["free", "offer"]
};

const take5Source: DiscoverySource = {
  id: "take5-rayford",
  name: "Take 5 Rayford Road coupons",
  url: "https://www.take5.com/locations/oil-change/texas/spring/30083/",
  category: "auto",
  priority: 10,
  keywords: ["coupon", "oil change"]
};

const dutchBrosSource: DiscoverySource = {
  id: "dutch-bros-rewards",
  name: "Dutch Bros rewards",
  url: "https://www.dutchbros.com/dutch-101/",
  category: "coffee",
  priority: 10,
  keywords: ["free drink", "rewards"]
};

describe("merchant-specific offer parsers", () => {
  it("parses Wendy's offers and collapses semantic duplicates", () => {
    const html = `
      <main>
        <h3>Wendy's Wednesday - Free 6pc Nuggs w/ $5 Purchase</h3>
        <p>Wendy's Wednesday - Free 6pc Nuggs w/ $5 Purchase</p>
        <p>Wendy's Wednesday - Free 6pc Nuggs w/ Purchase</p>
        <p>Offer runs through 9/10/26. App account required. Terms apply.</p>
        <h3>Wendy's and Paze spend $10 at Wendy's earn $10 back</h3>
        <p>Paze® users who spend $10+ in the Wendy’s app will earn $10 back*, up to 10 times per card.</p>
        <p>Offer runs through 9/10/26. App account required. Terms apply.</p>
      </main>
    `;
    const candidates = parseSourceOffers(
      wendysSource,
      wendysSource.url,
      html
    );

    expect(candidates).toHaveLength(2);
    const nuggets = candidates.find(({ title }) => title.includes("Nuggs"));
    const paze = candidates.find(({ title }) => title.includes("Paze"));

    expect(nuggets?.merchant).toBe("Wendy's");
    expect(nuggets?.amountText).toBe("Free");
    expect(nuggets?.minimumSpend).toBe(5);
    expect(nuggets?.expirationText).toBe("9/10/26");
    expect(paze?.title).toBe(
      "Wendy's and Paze spend $10 at Wendy's earn $10 back"
    );
    expect(paze?.minimumSpend).toBe(10);
    expect(paze?.expirationText).toBe("9/10/26");
  });

  it("parses a Take 5 local coupon without treating it as verified dashboard data", () => {
    const html = `
      <section>
        <h2>Oil Change Coupons</h2>
        <div>Core, Complete or Ultimate Oil Change</div>
        <div>$15 Off</div>
        <div>Core, Complete or Ultimate Oil Change</div>
        <button>Claim Offer</button>
        <p>Coupons have no cash value.</p>
      </section>
    `;
    const candidates = parseSourceOffers(take5Source, take5Source.url, html);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].title).toContain("$15 Off Core");
    expect(candidates[0].amountText).toBe("$15 Off");
    expect(candidates[0].detail).toContain("no cash value");
  });

  it("returns no candidates for an unsupported source", () => {
    const candidates = parseSourceOffers(
      { ...wendysSource, id: "unsupported" },
      wendysSource.url,
      "<main>Free 6pc Nuggs</main>"
    );

    expect(candidates).toEqual([]);
  });

  it("parses Dutch Bros welcome and points rewards without treating them as verified deals", () => {
    const html = `
      <main>
        <section>
          <h2>FREE MEDIUM DRINK</h2>
          <p>When You Download the App and Join Dutch Rewards</p>
          <small>*Offer valid for new app users only. Free medium drink reward upon registration. 180-day expiration. Terms apply.</small>
        </section>
        <section>250 Points = Free Medium Drink</section>
      </main>
    `;
    const candidates = parseSourceOffers(dutchBrosSource, dutchBrosSource.url, html);

    expect(candidates).toHaveLength(2);
    const welcome = candidates.find(({ title }) => title.includes("download the app"));
    const points = candidates.find(({ title }) => title.includes("250 Points"));

    expect(welcome?.amountText).toBe("Free");
    expect(welcome?.expirationText).toBe("180-day expiration");
    expect(welcome?.detail).toContain("new app users only");
    expect(points?.title).toContain("250 Points = Free Medium Drink");
  });
});
