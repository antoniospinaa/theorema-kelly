"use client";

import { useKelly } from "./KellyProvider";
import { money, plainSummary } from "@/lib/plain";
import { fmtPct } from "@/lib/format";

/** "En palabras simples": the answer an investor/bettor actually asked for. */
export default function PlainSummaryCard() {
  const { state, derived } = useKelly();
  const p = plainSummary(state, derived);
  const verb = state.mode === "bin" ? "apuesta" : "invierte";

  return (
    <div className="card">
      <div className="card-rule sage" />
      <div className="card-body plain-card" aria-live="polite">
        <span className="label" style={{ color: "var(--sage-text)" }}>
          En palabras simples
        </span>
        {p.noEdge ? (
          <p>
            Con estos números <strong>no tienes ventaja</strong>. Lo matemáticamente correcto es
            no {state.mode === "bin" ? "apostar" : "invertir en este activo"}: cualquier monto
            tiene expectativa de pérdida a largo plazo.
          </p>
        ) : (
          <>
            <p>
              Con <span className="n">{money(p.base)}</span>, {verb}{" "}
              <strong className="n" style={{ color: "var(--blue-deep)" }}>
                {money(p.invest)}
              </strong>{" "}
              ({fmtPct(derived.fChosen, 1)} de tu capital).
            </p>
            <p>
              Tras {p.horizon} típico tendrías{" "}
              <strong className={"n " + (p.typical >= p.base ? "pos" : "neg")}>
                {money(p.typical)}
              </strong>
              . En un mal escenario (1 de cada 10):{" "}
              <strong className="n neg">{money(p.bad)}</strong>. En uno bueno (1 de cada 10):{" "}
              <strong className="n pos">{money(p.good)}</strong>.
            </p>
            {p.doubling && (
              <p>
                Duplicarías tu dinero en ≈ <strong className="n">{p.doubling}</strong> — si tus
                supuestos se cumplen.
              </p>
            )}
            {p.overbetting && (
              <p className="neg">
                Estás por encima del óptimo (f &gt; f*): asumes más riesgo a cambio de{" "}
                <em>menos</em> crecimiento esperado. Baja el multiplicador.
              </p>
            )}
            <p className="hint" style={{ marginTop: 6 }}>
              {p.approximate ? "Cifras aproximadas (CLT). " : ""}Proyección basada en tus
              supuestos, no una garantía{state.mode === "cont" ? "; incluye el capital no invertido rentando a la tasa libre de riesgo" : ""}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
