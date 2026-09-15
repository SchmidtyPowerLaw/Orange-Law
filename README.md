# Orange Law

Bitcoin power-law tracker (USD / CAD / gold), Giovanni Santostasi model.

## Run locally

```bash
npm install
npm run dev
```

## Deploy (recommended: Vercel + Cloudflare DNS)

This app is a TanStack Start / Nitro site built for **Vercel**. Keep the domain
on Cloudflare, but host the app on Vercel:

1. Import this GitHub repo in [Vercel](https://vercel.com/new).
2. Deploy (no env vars required).
3. In Vercel → Domains, add `orangelaw.com` and `www.orangelaw.com`.
4. In Cloudflare DNS, add the records Vercel shows (usually a CNAME for `www`
   and either an A or CNAME for the apex). Proxy status can stay **DNS only**
   (grey cloud) until it works, then you can orange-cloud it.

Cloudflare Pages will fail to fetch an empty repo, and even with files it is
not the right target for this Vercel Nitro build.

Price quotes use CoinGecko. No database required for the public site.
