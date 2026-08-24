import { describe, expect, it } from "vitest";
import type { DiscoverySource } from "./source-parsers-types";
import { parseSourceOffers, rankOfferCandidates } from "./source-parsers";

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

const costaOilSource: DiscoverySource = {
  id: "costa-oil-rayford",
  name: "Costa Oil Rayford specials",
  url: "https://spring-rayford.costaoils.com/specials",
  category: "auto",
  priority: 10,
  keywords: ["oil change", "off"]
};

const rainbowCarCareSource: DiscoverySource = {
  id: "rainbow-car-care",
  name: "Rainbow Car Care rewards",
  url: "https://rainbowcarcare.com/frequent-wash-program",
  category: "auto",
  priority: 9,
  keywords: ["free", "car wash", "birthday", "reward"]
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

  it("parses Costa Oil local dollar and percentage specials with eligibility caveats", () => {
    const html = `
      <main>
        <h1>Current Oil Change Specials</h1>
        <section>
          <div>Thank you for your service!</div>
          <div>Coupon</div>
          <div>Veterans, Military, &amp; First Responders</div>
          <div>30%</div>
          <div>OFF</div>
          <div>ANY OIL CHANGE</div>
          <div>Must show proof of service or military ID.</div>
          <div>Cannot be combined with any other offers</div>
          <div>12/31/2026</div>
        </section>
        <section>
          <div>DIESEL SEPCIAL</div>
          <div>Coupon</div>
          <div>$10 OFF</div>
          <div>Any</div>
          <div>DIESEL</div>
          <div>Full Synthetic</div>
          <div>Oil Change</div>
          <div>Valid at the Rayford Rd Location:</div>
          <div>Cannot be combined with any other offers.</div>
          <div>12/31/2026</div>
        </section>
      </main>
    `;
    const candidates = parseSourceOffers(
      costaOilSource,
      costaOilSource.url,
      html
    );

    expect(candidates).toHaveLength(2);
    const percentage = candidates.find(({ title }) =>
      title.includes("30% off")
    );
    const diesel = candidates.find(({ title }) => title.includes("diesel"));

    expect(percentage?.merchant).toBe("Costa Oil Spring Rayford");
    expect(percentage?.amountText).toBe("30% off");
    expect(percentage?.expirationText).toBe("12/31/2026");
    expect(percentage?.detail).toContain("proof of service");
    expect(percentage?.detail).toContain("Cannot be combined");
    expect(diesel?.title).toBe("$10 off any diesel full synthetic oil change");
    expect(diesel?.amountText).toBe("$10 OFF");
    expect(diesel?.expirationText).toBe("12/31/2026");
    expect(diesel?.detail).toContain("Rayford Rd Location");
  });

  it("parses Rainbow Car Care birthday and loyalty rewards with local terms", () => {
    const html = `
      <main>
        <p>Every 11th Full Service Car Wash is FREE</p>
        <p>Every 11th Woodlands Special Package is FREE</p>
        <p>Every 11th Express Service or Detail is FREE *</p>
        <small>*(some restrictions apply &ndash; please call or see store for details)</small>
        <h2>FREE Full Service Car Wash on your Birthday!</h2>
        <a href="tel:+12813630021">(281) 363-0021</a>
        <address>318 Sawdust Rd, The Woodlands, TX 77380</address>
      </main>
    `;
    const candidates = parseSourceOffers(
      rainbowCarCareSource,
      rainbowCarCareSource.url,
      html
    );

    expect(candidates).toHaveLength(4);
    const birthday = candidates.find(({ title }) =>
      title.includes("birthday")
    );
    const loyalty = candidates.find(({ title }) =>
      title.includes("Woodlands Special Package")
    );

    expect(birthday?.merchant).toBe("Rainbow Car Care");
    expect(birthday?.amountText).toBe("Free");
    expect(birthday?.detail).toContain("restrictions apply");
    expect(birthday?.detail).toContain("318 Sawdust Rd");
    expect(loyalty?.title).toBe(
      "Every 11th Woodlands Special Package is free"
    );
    expect(loyalty?.amountText).toBe("Free");
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

describe("offer candidate ranking", () => {
  it("ranks stronger value, spend, timing, and source evidence first", () => {
    const ranked = rankOfferCandidates(
      [
        {
          id: "weak",
          sourceId: "low-source",
          merchant: "Test",
          title: "$1 off with $40 purchase",
          url: "https://example.com/weak",
          amountText: "$1 Off",
          minimumSpend: 40
        },
        {
          id: "strong",
          sourceId: "strong-source",
          merchant: "Test",
          title: "$15 off any service",
          url: "https://example.com/strong",
          amountText: "$15 Off",
          expirationText: "9/10/26"
        }
      ],
      { "strong-source": 10, "low-source": 5 },
      new Date("2026-08-21T12:00:00")
    );

    expect(ranked[0].id).toBe("strong");
    expect(ranked[0].candidateScore).toBeGreaterThan(ranked[1].candidateScore!);
    expect(ranked[0].candidateReasons).toContain("$15 Off value");
    expect(ranked[0].candidateReasons).toContain("Expires 9/10/26");
  });
});
