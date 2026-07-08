"use client";

import { useRef } from "react";

export default function Footer() {
  const methRef = useRef<HTMLDialogElement>(null);
  const discRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <footer>
        <div className="foot-inner">
          <div style={{ maxWidth: 640 }}>
            <p>
              Descargo de responsabilidad: Theorema Kelly es una herramienta educativa de apoyo a
              la decisión. No constituye asesoría financiera ni una plataforma de corretaje. Los
              resultados de simulación son estocásticos y no predicen rendimientos reales.
            </p>
            <div className="foot-links">
              <button type="button" onClick={() => methRef.current?.showModal()}>
                Metodología
              </button>
              <button type="button" onClick={() => discRef.current?.showModal()}>
                Descargo de responsabilidad
              </button>
              <a href="https://github.com/antoniospinaa/theorema-kelly">GitHub</a>
            </div>
          </div>
          <div className="foot-right">
            <p className="strong">© 2026 Lab. Theorema</p>
            <p className="dim">web v0.4.0 · kelly-engine v0.3.0 · Basado en Kelly (1956)</p>
          </div>
        </div>
      </footer>

      <dialog ref={methRef} aria-labelledby="dlg-meth-title">
        <div className="dlg-head">
          <h3 id="dlg-meth-title">Metodología</h3>
          <button type="button" className="btn" onClick={() => methRef.current?.close()}>
            Cerrar
          </button>
        </div>
        <div className="dlg-body">
          <p>
            <strong>Apuesta binaria</strong> (Kelly, 1956). Con probabilidad de ganar p, de perder
            q = 1−p y pago b a 1:
          </p>
          <span className="formula">{"f* = (p·b − q) / b\nG(f) = p·ln(1 + f·b) + q·ln(1 − f)"}</span>
          <p>
            <strong>Activo continuo</strong> (fracción de Merton). Con retorno esperado μ,
            volatilidad σ y tasa libre de riesgo r:
          </p>
          <span className="formula">{"f* = (μ − r) / σ²\ng(f) = r + f(μ − r) − ½·f²·σ²"}</span>
          <p>
            La simulación de Monte Carlo genera 400 trayectorias independientes por estrategia y
            grafica la mediana por período. «Ruina» se define como una pérdida superior al 90 % del
            capital inicial en cualquier momento del horizonte. Los cálculos viven en el paquete
            <code> kelly-engine</code>, verificado con tests unitarios contra los ejemplos del
            paper.
          </p>
        </div>
      </dialog>

      <dialog ref={discRef} aria-labelledby="dlg-disc-title">
        <div className="dlg-head">
          <h3 id="dlg-disc-title">Descargo de responsabilidad</h3>
          <button type="button" className="btn" onClick={() => discRef.current?.close()}>
            Cerrar
          </button>
        </div>
        <div className="dlg-body">
          <p>
            Esta herramienta tiene fines exclusivamente educativos. El criterio de Kelly asume que
            las probabilidades y pagos introducidos son correctos; en mercados reales estos
            parámetros son inciertos, y sobreestimar la ventaja conduce sistemáticamente a
            sobreapostar (los errores en μ pesan ~20× más que los errores en covarianza).
          </p>
          <p>
            Nada de lo aquí mostrado constituye recomendación de inversión. El sistema no ejecuta
            órdenes ni se conecta a brokers en ninguna fase. Consulte a un asesor financiero
            certificado antes de tomar decisiones con dinero real.
          </p>
        </div>
      </dialog>
    </>
  );
}
