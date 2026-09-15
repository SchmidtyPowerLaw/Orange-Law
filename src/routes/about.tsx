import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { GIOVANNI_X, PAPER_URL, SITE_EMAIL, SITE_NAME } from "@/lib/site";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [{ title: `About · ${SITE_NAME}` }],
  }),
});

function AboutPage() {
  return (
    <LegalPage title="About">
      <p>
        {SITE_NAME} is an independent educational website that charts Bitcoin’s
        price on the scale-invariant power law published by Giovanni Santostasi
        and Stephen Perrenod. It is built so anyone can see the floor, fair
        value, and cycle-top bands, project a stack, and compare bitcoin with
        other assets in USD, CAD, or gold.
      </p>
      <p>
        The model is Giovanni’s. This site is not affiliated with him, with
        Santostasi’s research group, or with any exchange. Credit and the paper
        live on the main chart under “The Law”:
      </p>
      <p>
        <a href={GIOVANNI_X} target="_blank" rel="noopener noreferrer">
          Giovanni Santostasi on X
        </a>
        {" · "}
        <a href={PAPER_URL} target="_blank" rel="noopener noreferrer">
          A Mechanistic Derivation of the Bitcoin Price Power Law
        </a>
      </p>
      <p>
        Nothing here is investment, tax, or legal advice. Bitcoin is volatile.
        Quantile bands are a statistical description of history, not a promise
        of future price.
      </p>
      <p>
        Questions, corrections, or press:{" "}
        <a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
