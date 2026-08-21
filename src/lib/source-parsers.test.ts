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

describe("merchant-specific offer parsers", () => {
  it("parses and deduplicates Wendy's offers with amount and spend terms", () => {
    const html = `
      <main>
        <h3>Wendy's Wednesday - Free 6pc Nuggs w/ $5 Purchase</h3>
        <p>Wendy's Wednesday - Free 6pc Nuggs w/ $5 Purchase</p>
        <p>Offer runs through 9/10/26. App account required. Terms apply.</p>
      </main>
    `;
    const candidates = parseSourceOffers(
      wendysSource,
      wendysSource.url,
      html
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].merchant).toBe("Wendy's");
    expect(candidates[0].amountText).toBe("Free");
    expect(candidates[0].minimumSpend).toBe(5);
    expect(candidates[0].expirationText).toBe("9/10/26");
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
});
