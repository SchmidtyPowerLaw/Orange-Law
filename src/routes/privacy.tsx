import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { SITE_EMAIL, SITE_NAME } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [{ title: `Privacy · ${SITE_NAME}` }],
  }),
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>Last updated: 15 September 2026.</p>
      <p>
        {SITE_NAME} (“we”) operates this Bitcoin power-law chart. This policy
        explains what happens when you use the site. It is written for a
        visitor, not a lawyer, and covers Canada’s PIPEDA and typical ad-network
        review.
      </p>

      <h2>What we do not collect</h2>
      <p>
        There are no user accounts. We do not ask for your name, and we do not
        receive your buy spreadsheet on a server. Purchases you upload stay in
        this browser (local storage) on your device.
      </p>

      <h2>What stays on your device</h2>
      <p>
        Display currency, chart range, and “Your Buys” data are saved locally so
        the chart looks the same when you return. Clearing site data in the
        browser deletes them. We cannot read that storage.
      </p>
      <p>
        On a first visit we may use your IP country (Canada vs United States)
        only to pick CAD or USD as the starting unit. After you change the
        unit, that choice stays on this device.
      </p>

      <h2>Live prices</h2>
      <p>
        When the chart loads, your browser requests current Bitcoin, CAD, and
        gold prices from market APIs (including Coinbase, Kraken, and a gold
        spot feed) and FX from the Bank of Canada and a USD cross-rate feed.
        Those providers see a standard web request (IP address, time, user
        agent) under their own policies.
      </p>

      <h2>Cookies, ads, and analytics</h2>
      <p>
        The core chart does not require an advertising cookie. If we later show
        ads (for example Google AdSense or a crypto publisher network), those
        partners may set cookies or similar IDs to measure views and, where
        allowed, personalize ads. You can block third-party cookies in the
        browser. We will not sell a list of our visitors.
      </p>
      <p>
        We measure traffic with Vercel Web Analytics so we know whether the
        chart is used. It is cookieless: it records page path, referrer,
        country, browser, and device class — not your name, and not the
        contents of your stack. Vercel processes that data as our host. You
        can block it with a content blocker.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions or a request to explain this policy:{" "}
        <a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
