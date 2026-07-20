"use client";

import { useRef } from "react";
import { useKelly } from "./KellyProvider";

export default function Footer() {
  const { L } = useKelly();
  const methRef = useRef<HTMLDialogElement>(null);
  const discRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <footer>
        <div className="foot-inner">
          <div style={{ maxWidth: 640 }}>
            <p>{L.footer.disclaimer}</p>
            <div className="foot-links">
              <button type="button" onClick={() => methRef.current?.showModal()}>
                {L.footer.methodology}
              </button>
              <button type="button" onClick={() => discRef.current?.showModal()}>
                {L.footer.disclaimerLink}
              </button>
              <a href="https://github.com/antoniospinaa/theorema-kelly">GitHub</a>
            </div>
          </div>
          <div className="foot-right">
            <p className="strong">© 2026 Lab. Theorema</p>
            <p className="dim">{L.footer.based}</p>
          </div>
        </div>
      </footer>

      <dialog ref={methRef} aria-labelledby="dlg-meth-title">
        <div className="dlg-head">
          <h3 id="dlg-meth-title">{L.footer.methodology}</h3>
          <button type="button" className="btn" onClick={() => methRef.current?.close()}>
            {L.common.close}
          </button>
        </div>
        <div className="dlg-body">
          <p>
            <strong>{L.footer.methBinTitle}</strong> {L.footer.methBinBody}
          </p>
          <span className="formula">{"f* = (p·b − q) / b\nG(f) = p·ln(1 + f·b) + q·ln(1 − f)"}</span>
          <p>
            <strong>{L.footer.methContTitle}</strong> {L.footer.methContBody}
          </p>
          <span className="formula">{"f* = (μ − r) / σ²\ng(f) = r + f(μ − r) − ½·f²·σ²"}</span>
          <p>{L.footer.methMC}</p>
        </div>
      </dialog>

      <dialog ref={discRef} aria-labelledby="dlg-disc-title">
        <div className="dlg-head">
          <h3 id="dlg-disc-title">{L.footer.disclaimerLink}</h3>
          <button type="button" className="btn" onClick={() => discRef.current?.close()}>
            {L.common.close}
          </button>
        </div>
        <div className="dlg-body">
          <p>{L.footer.discP1}</p>
          <p>{L.footer.discP2}</p>
        </div>
      </dialog>
    </>
  );
}
