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
- **Monte Carlo** — 400 simulated wealth paths per strategy (full Kelly vs chosen vs 2× Kelly) on
  a log scale, with median growth, max drawdown, ruin probability and Sharpe computed from the
  simulation — not hardcoded.

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
| 1 | Interactive calculator (this repo) | ✅ |
| 2 | Market data pipeline (Supabase + cron) | — |
| 3 | Multivariate portfolio F\* = Σ⁻¹(μ − r·1) UI | engine ready |
| 4 | Historical backtesting + μ-perturbation robustness | — |
| 5 | Paper-trading journal (Supabase Auth) | — |

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
