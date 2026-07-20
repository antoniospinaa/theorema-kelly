"use client";

import { useKelly } from "./KellyProvider";
import { money, plainSummary } from "@/lib/plain";
import { fmtPct } from "@/lib/format";

/** Percentage change vs the starting capital, e.g. "+5.2 %". */
const pct = (x: number, base: number): string => {
  const v = (x / base - 1) * 100;
  return (v >= 0 ? "+" : "") + v.toFixed(1) + " %";
};

/** "En palabras simples" / "In plain words": the answer the user actually asked for. */
export default function PlainSummaryCard() {
  const { state, derived, L } = useKelly();
  const p = plainSummary(state, derived);
  const verb = state.mode === "bin" ? L.plain.bet : L.plain.invest;
  const horizon = state.mode === "bin" ? L.plain.horizonBets : L.plain.horizonYear;

  return (
    <div className="card">
      <div className="card-rule sage" />
      <div className="card-body plain-card" aria-live="polite">
        <span className="label" style={{ color: "var(--sage-text)" }}>
          {L.common.plainLabel}
        </span>
        {p.noEdge ? (
          <p>{L.plain.noEdge(state.mode === "bin")}</p>
        ) : (
          <>
            <p>
              {L.plain.withCapital} <span className="n">{money(p.base)}</span>, {verb}{" "}
              <strong className="n" style={{ color: "var(--blue-deep)" }}>
                {money(p.invest)}
              </strong>{" "}
              ({fmtPct(derived.fChosen, 1)} {L.plain.ofYourCapital}).
            </p>
            <p>
              {L.plain.afterTypical(horizon)}{" "}
              <strong className={"n " + (p.typical >= p.base ? "pos" : "neg")}>
                {money(p.typical)} ({pct(p.typical, p.base)})
              </strong>
              . {L.plain.badCase}{" "}
              <strong className="n neg">
                {money(p.bad)} ({pct(p.bad, p.base)})
              </strong>
              . {L.plain.goodCase}{" "}
              <strong className="n pos">
                {money(p.good)} ({pct(p.good, p.base)})
              </strong>
              .
            </p>
            {p.doubling && (
              <p>
                {L.plain.doubling} <strong className="n">{p.doubling}</strong>{" "}
                {L.plain.ifAssumptions}
              </p>
            )}
            {p.overbetting && <p className="neg">{L.plain.overbet}</p>}
            <p className="hint" style={{ marginTop: 6 }}>
              {p.approximate ? L.plain.approx : ""}
              {L.plain.footnote}
              {state.mode === "cont" ? L.plain.footnoteCont : ""}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
