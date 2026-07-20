# Theorema Kelly

**An interactive Kelly Criterion laboratory** — position sizing, geometric growth visualization,
and Monte Carlo simulation, built on a pure, unit-tested TypeScript math engine.

Based on the capstone paper *Maximizing Long-Term Investment Growth: A Study of the Kelly
Criterion's Portfolio Applications* (Nov 2025). This is a decision-support and educational tool:
it never executes trades and never connects to brokers, by design.

## What it does (Phase 1 MVP)

- **Binary mode** — repeated favorable bets: computes f\* = (pb − q)/b, the suggested bet in
  dollars, the log growth rate G(f) and the doubling time. Declares unfavorable bets (f\* ≤ 0)
  and recommends betting nothing.
- **Continuous mode** — single asset (Merton fraction): f\* = (μ − r)/σ², with explicit warnings
  for implied leverage (f\* > 1) and implied short (f\* < 0).
- **G(f) curve** — the signature chart: growth / overbetting / ruin zones, with the optimum and
  the user's chosen fraction marked.
- **Fractional Kelly slider** — 0–200% of f\* with ¼, ½, 1×, 2× presets; every metric updates live.
- **Monte Carlo** — simulated wealth paths per strategy (full Kelly vs chosen vs 2× Kelly, plus
  Buy & Hold benchmark in continuous mode) on a log scale, with a P10–P90 percentile band and a
  side-by-side comparison table of median growth, max drawdown, ruin probability and Sharpe —
  all computed from the simulation, with user-selectable horizon and path count.

## Phase 2 — live market data (v0.2.0)

- **Market estimator**: type a ticker (AAPL, MSFT, SPY…) and the app fetches daily prices
  server-side (Stooq with Yahoo Finance fallback — no API keys), computes annualized μ̂ and σ̂
  from log returns over a selectable window (63/126/252/504 days), and fills the calculator.
- **Risk-free rate**: one click pulls the latest average T-Bill rate from the U.S. Treasury
  FiscalData API (falls back to a documented default).
- **Multi-asset portfolio (`/cartera`)**: 2–6 tickers → aligned return series → covariance
  matrix → F\* = Σ⁻¹(μ − r·1) weights, with leverage/short warnings and CSV export.
- **Bet-type presets** (binary): biased coin, card counting, European roulette, sports odds —
  each with an honest note about where the edge (if any) comes from.
- **Guardrails**: plausibility warnings for unrealistic parameters (e.g. σ < 5% annual),
  leverage/margin-call context when f\* > 1, losing-streak estimate and ±5pp win-rate
  sensitivity table for binary betting.
- **Export**: G(f) curve, Monte Carlo medians/percentiles and portfolio weights as CSV/JSON.

## Architecture

```
theorema-kelly/
├── apps/
│   └── web/                 # Next.js (App Router) — UI only, no math
├── packages/
│   └── kelly-engine/        # Pure TypeScript math engine, zero dependencies
│       ├── src/binary.ts        f* = (pb − q)/b · G(f)
│       ├── src/continuous.ts    f* = (μ − r)/σ² · g(f)  (Merton)
│       ├── src/portfolio.ts     F* = Σ⁻¹(μ − r·1)  (Gaussian elimination)
│       ├── src/simulate.ts      Monte Carlo paths + stats (injectable RNG)
│       └── tests/               34 unit tests, incl. fixtures from the paper
├── supabase/
│   └── migrations/          # Phase 2+ schema (prices, estimates, snapshots, paper trades)
├── docs/                    # PRD + design system spec
└── .github/workflows/       # CI: tests + typecheck + production build
```

The separation is strict: `apps/web` contains no financial math, and `kelly-engine` contains no
DOM. The engine's RNG is injectable, so simulations are reproducible in tests.

## Quickstart

```bash
npm install
npm test          # kelly-engine unit tests (34 tests)
npm run dev       # Next.js dev server → http://localhost:3000
npm run build     # production build
```

## Verification

`kelly-engine` is tested against the paper's worked examples, e.g.:

| Case | Expected | Test |
| --- | --- | --- |
| p=0.60, b=1 | f\* = 0.20 | `binary.test.ts` |
| p=0.55, b=1 | f\* = 0.10, doubling ≈ 138 trials | `binary.test.ts` |
| μ=12%, r=3%, σ=25% | f\* = 1.44 (leverage warning) | `continuous.test.ts` |
| G(2f\*) | ≈ 0 (overbetting boundary) | `binary.test.ts` |
| Monte Carlo empirical G | matches theory within 15% | `simulate.test.ts` |
| Diagonal Σ portfolio | decouples into Merton fractions | `portfolio.test.ts` |

## Deployment

**Vercel** — import the GitHub repo, set *Root Directory* to `apps/web` (keep "Include files
outside root directory" enabled). No environment variables are required for Phase 1.

**Supabase** — not used in Phase 1 (client-side by design). From Phase 2, apply
`supabase/migrations/0001_init.sql` and schedule the price-ingestion function.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Interactive calculator | ✅ |
| 2 | Live market data (prices, μ̂/σ̂, risk-free) | ✅ on-demand; Supabase audit trail pending |
| 3 | Multivariate portfolio, Kelly≡MVO equivalence, condensation | ✅ `/cartera` (v0.3.0) |
| 4 | Historical backtesting, μ-perturbation, fat tails, drawdown paths | ✅ (v0.4.0) |
| 5 | Supabase Auth (Google) + positions schema | ✅ auth live (v0.7.0); positions dashboard next |

### Phase 5 — accounts (v0.7.0)

Google sign-in via Supabase Auth (`@supabase/supabase-js`, PKCE). The auth button lives in the
header and hides gracefully when no backend is configured. Database schema (with RLS) is
applied to the live project, including the `positions` table that will back the upcoming
"My positions" dashboard.

**Setup** (one-time):

1. **Env vars** — copy `apps/web/.env.example` to `.env.local` and set the same two vars in
   Vercel (Project → Settings → Environment Variables):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. **Google OAuth** — in [Google Cloud Console](https://console.cloud.google.com): create a
   project → OAuth consent screen (External) → Credentials → *Create OAuth client ID* (Web
   application) → add authorized redirect URI
   `https://<PROJECT-REF>.supabase.co/auth/v1/callback` → copy Client ID + Secret.
3. **Supabase** — Dashboard → Authentication → Providers → Google → paste Client ID/Secret and
   enable. Then Authentication → URL Configuration → set *Site URL* to the production domain
   and add `http://localhost:3000` to *Redirect URLs*.

### Internationalization (v0.6.0)

Full Spanish/English UI. The language is auto-detected from the browser (`Accept-Language`),
switchable from the header (ES | EN) and persisted. All ~250 strings live in a single typed
dictionary (`apps/web/lib/i18n.ts`) where the English table is type-checked against the Spanish
one — a missing translation is a compile error. Unknown browser languages fall back to English.

### Plain-language layer (v0.5.0)

A **Simple / Laboratorio** toggle in the header. Simple mode (the default) answers the question
investors and bettors actually ask — *"I have $X: how much do I put in, what would I end up
with, and how bad can it get?"* — with an "En palabras simples" card that translates every
result into dollars over a relatable horizon (analytic lognormal quantiles, updated on every
keystroke), plus a plain-Spanish narrative of the Monte Carlo (median outcome, typical
trough, ruin frequency out of 10,000 scenarios). Laboratorio mode keeps the full technical
layer: G(f) curve, percentile bands, drawdown paths, backtest, sensitivity tables, glossary.

### Phase 4 — backtesting & stress (v0.4.0)

- **Historical backtest** (Análisis, continuous mode): constant-fraction strategies (full/½/¼
  Kelly and Buy & Hold) on real price series with daily rebalancing — CAGR, volatility, max
  drawdown, time underwater and Sharpe per strategy, plus a leveraged-wipeout guard. Explicit
  in-sample caveat.
- **μ-perturbation test**: f\* recomputed at μ̂ ± 2pp, demonstrating the capstone's ~20:1
  sensitivity finding empirically.
- **Fat tails**: optional Student-t(4) shocks in the Monte Carlo (continuous mode) to stress
  Kelly sizing against crash-prone return distributions.
- **Drawdown over time**: median and P90 drawdown paths for the chosen strategy — the lived
  experience, not just the worst point.
- **Cartera → Análisis bridge**: the full-Kelly portfolio becomes a synthetic asset (μ_p, σ_p)
  whose Merton fraction is exactly 1, so the multiplier scales the whole portfolio through the
  full Monte Carlo/drawdown/fat-tails pipeline. Cartera now auto-computes a default universe on
  load.

### Phase 3 / UX hardening (v0.3.0)

- Crypto ticker aliases (`BTC` → `BTC-USD`) so bare symbols resolve to the actual asset, plus a
  hardened Stooq→Yahoo fallback with explicit error surfacing.
- Three sizing results side by side: theoretical Kelly (f\*), applied (multiplier), and
  **no-leverage (f ≤ 1)** — when f\* > 1, investing 100% of capital is the constrained optimum,
  shown with its expected growth.
- Safer defaults and copy: ½ Kelly default multiplier, 2× marked experimental, "Tamaño de
  posición estimado" instead of bet-centric wording in investment mode, guided 1-2-3 flow
  (asset → assumptions → sizing), inline help under every field.
- Plausibility card upgraded with a one-click "usar rango conservador" fix; assumption profiles
  (conservador / base / agresivo).
- `/cartera`: Kelly ≡ Markowitz note (multiplier m ↔ risk aversion λ = 1/m) and a portfolio
  condensation readout.

## Disclaimer

Educational tool only. Nothing here is investment advice. Kelly allocations are extremely
sensitive to estimation error in μ (~20× more than covariance error); full Kelly has produced
historical drawdowns of −79% (1931) and −62% (2022). Defaults and warnings in the UI steer
toward fractional Kelly for a reason.

## References

- Kelly, J. L. (1956). *A New Interpretation of Information Rate*. Bell System Technical Journal.
- Thorp, E. O. (2006). *The Kelly Criterion in Blackjack, Sports Betting, and the Stock Market*.
- Spina, A. (2025). *Maximizing Long-Term Investment Growth: A Study of the Kelly Criterion's
  Portfolio Applications* (Math Capstone).

MIT © 2026 Antonio Spina
