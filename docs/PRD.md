# PRD — Theorema Kelly

**Autor:** Antonio Spina · **Fecha:** Julio 2026 · **Versión:** 1.0
**Base académica:** *Maximizing Long-Term Investment Growth: A Study of the Kelly Criterion's Portfolio Applications* (Math Capstone, Nov 2025)

## 1. Visión

Theorema Kelly es una aplicación web de **soporte a la decisión de inversión** que implementa el
Criterio de Kelly en sus tres formulaciones (binaria, continua de un activo, y multivariada de
portafolio), con visualización interactiva, pipeline de datos de mercado y backtesting histórico.

**Lo que es:** un laboratorio matemático que traduce el capstone en una herramienta usable y una
pieza de portafolio técnico (data analytics + full-stack).

**Lo que NO es:** un bot de trading. El sistema nunca ejecuta órdenes ni se conecta a brokers. La
justificación está en el propio paper: los errores en la estimación de retornos medios (μ) son
~20x más influyentes que los errores en covarianza, y el full Kelly ha mostrado drawdowns
históricos de −79% (1931) y −62% (2022). La herramienta existe para *entender y calibrar*
decisiones, no para automatizarlas.

## 2. Problema y oportunidad

Los inversores individuales que conocen el Criterio de Kelly no tienen una herramienta accesible que:

1. Calcule f* correctamente en los tres regímenes (binario, continuo, multivariado).
2. Muestre visualmente el costo de sobre-apostar (la zona donde G(f) se vuelve negativa).
3. Compare Fractional Kelly (¼, ½) vs full Kelly en volatilidad, drawdown y tiempo de duplicación.
4. Contraste la asignación Kelly contra Markowitz MVO con distintos λ.
5. Haga backtesting honesto que exponga la sensibilidad a errores de estimación.

Las calculadoras existentes son formularios estáticos sin contexto de riesgo. La oportunidad es
una herramienta educativa/analítica con rigor matemático documentado.

## 3. Usuarios objetivo

- **Primario:** el propio autor (gestión personal + pieza de portafolio para aplicaciones a
  programas de MS Analytics/MSBA/MSDS y roles de data analytics).
- **Secundario:** estudiantes de finanzas cuantitativas y lectores de contenido educativo
  (potencial integración con la marca Cero Estrés).
- **Terciario:** inversores retail curiosos que quieren dimensionar posiciones con criterio en
  lugar de intuición.

## 4. Alcance por fases

### Fase 1 — MVP: Calculadora Kelly interactiva (este entregable)

Aplicación client-side sin backend. Detalle completo en la sección 5.

### Fase 2 — Pipeline de datos

- Vercel Cron (o Supabase Edge Function programada) que descarga precios diarios de una lista de
  tickers (Alpha Vantage / Polygon / Tiingo).
- Cálculo de retornos logarítmicos, μ y σ² con ventanas móviles (63, 126, 252 días).
- Persistencia en Supabase con timestamps para auditar cómo cambian las estimaciones en el tiempo.

### Fase 3 — Portafolio multivariado

- Resolución de F* = Σ⁻¹(M − R) para 5–10 activos.
- Visualización de la "condensación de portafolio" (concentración de pesos).
- Comparador Kelly vs MVO: slider de λ que muestra que Kelly ≡ MVO con λ = 1 sobre la frontera
  eficiente.

### Fase 4 — Backtesting

- Simulación histórica de full Kelly, ½ Kelly, ¼ Kelly y equal-weight.
- Métricas: CAGR, volatilidad, max drawdown, tiempo bajo el agua, Sharpe.
- Test de robustez: perturbar μ ±X% y mostrar cuánto cambia la asignación (demostración empírica
  de la sensibilidad 20:1).

### Fase 5 — Paper trading y bitácora

- Registro de decisiones simuladas con f elegido, tesis y resultado.
- Medición del edge real del usuario antes de arriesgar capital.
- Auth de Supabase para cuentas personales.

## 5. Requisitos funcionales del MVP (Fase 1)

### 5.1 Modo Binario (apuesta repetida)

- **Inputs:** bankroll inicial W₀, probabilidad de ganar p, multiplicador de pago b.
- **Outputs:** f* = (pb − q)/b, monto a apostar, tasa de crecimiento G(f) por ensayo, tiempo de
  duplicación (ln 2 / G).
- Si pb − q ≤ 0, la app declara la apuesta desfavorable y recomienda f = 0.

### 5.2 Modo Continuo (activo individual)

- **Inputs:** retorno esperado anual μ, volatilidad anual σ, tasa libre de riesgo r.
- **Outputs:** f* = (μ − r)/σ², tasa de crecimiento g(f) = r + f(μ−r) − ½f²σ².
- Advertencia explícita cuando f* > 1 (apalancamiento implícito) o f* < 0 (short implícito).

### 5.3 Curva de crecimiento G(f) — elemento firma

- Gráfico interactivo de G(f) con tres zonas: crecimiento (0 → f*), sobre-apuesta (f* → f₀ donde
  G cruza cero) y ruina (G < 0).
- Marcador de f* en el pico y marcador móvil de la fracción elegida por el usuario.

### 5.4 Slider de Fractional Kelly

- Rango 0%–200% de f*, con presets ¼, ½, 1×, 2×.
- Al mover el slider, todas las métricas y el marcador de la curva se actualizan en vivo,
  mostrando el trade-off retorno/varianza descrito en la sección 6.3 del paper.

### 5.5 Simulación Monte Carlo (modo binario)

- Simulación de ~250 ensayos comparando la fracción elegida vs full Kelly vs 2× Kelly.
- Gráfico de trayectorias de riqueza en escala logarítmica con botón de re-simulación.
- Propósito pedagógico: hacer visible que sobre-apostar destruye capital incluso con edge positivo.

### 5.6 Disclaimer permanente

- Texto visible: herramienta educativa, no constituye asesoría financiera.

## 6. Requisitos no funcionales

- **Sin ejecución de trades ni conexión a brokers en ninguna fase.**
- Precisión numérica: cálculos en doble precisión; validación de dominios (f < 1 en binario, σ > 0).
- Responsive hasta móvil; accesible con teclado.
- Tiempo de cálculo instantáneo (<16 ms por interacción) — todo client-side en Fase 1.
- Código de la librería matemática separado de la UI y cubierto por tests unitarios contra los
  ejemplos del paper (ej.: p=0.6, b=1 → f*=0.20).

## 7. Arquitectura técnica

### Repositorio (GitHub)

```
theorema-kelly/
├── apps/
│   └── web/                 # Next.js (App Router)
├── packages/
│   └── kelly-engine/        # Librería TypeScript pura: binario, continuo, multivariado
│       ├── src/binary.ts
│       ├── src/continuous.ts
│       ├── src/portfolio.ts # F* = Σ⁻¹(M − R)
│       └── tests/           # Casos del paper como fixtures
├── supabase/
│   ├── migrations/
│   └── functions/           # Edge Functions (ingesta de precios)
└── .github/workflows/       # CI: tests de kelly-engine en cada PR
```

- kelly-engine se publica como paquete independiente y citable — proyecto de portafolio por sí mismo.
- CI en GitHub Actions: lint + tests obligatorios antes de merge.

### Hosting (Vercel)

- Deploy automático del frontend desde main; previews por PR.
- API Routes para cálculos de portafolio (Fase 3) y Vercel Cron para la ingesta diaria (Fase 2,
  alternativa a Edge Functions).

### Datos (Supabase)

- Postgres + Auth (Fase 5) + Edge Functions (Fase 2).
- Esquema inicial en `supabase/migrations/0001_init.sql`.

## 8. Métricas de éxito

- **Fase 1:** calculadora desplegada en Vercel; tests de kelly-engine verdes reproduciendo los
  resultados del paper.
- **Fase 2:** ≥ 90 días consecutivos de ingesta sin fallos; estimaciones auditables por fecha.
- **Fase 3–4:** backtest que reproduzca cualitativamente los drawdowns documentados en la
  literatura y el gráfico Kelly vs MVO.
- **Global:** proyecto citable en SOPs y CV con README de calidad publicación.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Error de estimación de μ induce sobre-apuesta | Defaults en ½ Kelly; test de perturbación en Fase 4; advertencias en UI |
| Percepción de asesoría financiera | Disclaimer permanente; sin conexión a brokers; lenguaje educativo |
| Límites de API de datos gratuitas | Cache en Supabase; frecuencia diaria, no intradía |
| Scope creep antes de terminar Fase 1 | Fases cerradas; el MVP no tiene backend por diseño |
| Datos históricos con survivorship bias | Documentar la limitación; usar índices además de acciones individuales |

## 10. Roadmap tentativo

| Fase | Duración estimada | Ventana |
| --- | --- | --- |
| 1 — MVP calculadora | 1–2 semanas | Julio 2026 |
| 2 — Pipeline de datos | 2 semanas | Agosto 2026 |
| 3 — Portafolio multivariado | 2–3 semanas | Agosto–Sept 2026 |
| 4 — Backtesting | 2–3 semanas | Septiembre 2026 |
| 5 — Paper trading | 2 semanas | Octubre 2026 |

La ventana calza con la temporada de aplicaciones (septiembre–octubre): las Fases 1–3 estarían
listas para incluirse en SOPs y CV.
