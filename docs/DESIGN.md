---
name: Theorema Kelly
version: 1.1.0
colors:
  # Papel (superficies)
  paper: '#FDFCFB'
  paper-low: '#F6F3EE'
  paper-mid: '#EFECE6'
  paper-high: '#E8E4DC'
  # Tinta (texto y estructura)
  ink: '#1A1A1B'
  ink-70: '#4A4A4C'        # texto secundario (contraste ≥ 7:1 sobre papel)
  ink-55: '#62625F'        # texto terciario (contraste ≥ 5:1 sobre papel)
  hairline: 'rgba(26,26,27,0.15)'
  frame: 'rgba(26,26,27,0.38)'   # borde carboncillo de tarjetas
  # Codificación matemática funcional
  technical-blue: '#2B5B84'      # acciones primarias e interacción
  technical-blue-deep: '#1E4162' # hover / texto de marca
  growth-sage: '#4B7F52'         # crecimiento positivo / zona óptima
  growth-sage-text: '#3E6B45'    # variante para texto pequeño (contraste)
  risk-ochre: '#B8860B'          # sobreapuesta / advertencia (solo rellenos)
  risk-ochre-text: '#7A5A08'     # variante para texto (contraste ≥ 4.5:1)
  ruin-red: '#8B0000'            # resultados catastróficos
typography:
  headline-lg: { fontFamily: IBM Plex Serif, fontSize: 32px, fontWeight: '600', lineHeight: 40px, letterSpacing: -0.02em }
  headline-md: { fontFamily: IBM Plex Serif, fontSize: 24px, fontWeight: '600', lineHeight: 32px }
  headline-sm: { fontFamily: IBM Plex Serif, fontSize: 18px, fontWeight: '600', lineHeight: 24px }
  body-lg:     { fontFamily: IBM Plex Sans,  fontSize: 16px, fontWeight: '400', lineHeight: 24px }
  body-md:     { fontFamily: IBM Plex Sans,  fontSize: 14px, fontWeight: '400', lineHeight: 20px }
  mono-data:   { fontFamily: JetBrains Mono, fontSize: 14px, fontWeight: '500', lineHeight: 20px, letterSpacing: -0.01em }
  label-xs:    { fontFamily: JetBrains Mono, fontSize: 11px, fontWeight: '700', lineHeight: 16px }
spacing:
  unit: 4px
  gutter: 16px
  margin-edge: 24px
  hairline: 1px
---

## Marca y estilo

El sistema se construye sobre la tesis de un «paper técnico que aprendió a moverse». Evoca el rigor
de las revistas de laboratorio del siglo XX apoyado en el cálculo en tiempo real de las herramientas
financieras modernas. Audiencia: analistas cuantitativos, gestores de riesgo e inversores
matemáticos que valoran la precisión por encima de la decoración.

Estilo visual: **Minimalismo Académico**. Sin gradientes, desenfoques ni sombras; la jerarquía es
estructural. La interfaz es un documento vivo: un esquema de alta densidad donde cada línea y cada
carácter cumplen una función.

## Colores — fuente única de verdad

La tabla del frontmatter es la **única** paleta permitida. Regla de reconciliación (v1.1): se
eliminó la paleta Material Design 3 que convivía con esta en el código; los tokens `primary`,
`secondary`, `error`, `surface-*`, etc. quedan **prohibidos**.

- **Papel (`#FDFCFB`)** para todos los fondos primarios.
- **Tinta (`#1A1A1B`)** para texto y líneas estructurales.
- **Semántica funcional**: Azul Técnico (acciones), Salvia (crecimiento / zona óptima de Kelly),
  Ocre (sobreapuesta), Rojo Ruina (resultados catastróficos).
- **Contraste**: todo texto debe cumplir WCAG AA (≥ 4.5:1). Ocre y Salvia tienen variantes `-text`
  oscurecidas para texto pequeño; los tonos base se reservan para rellenos y trazos de gráficas.

## Tipografía

Jerarquía tripartita: IBM Plex Serif (titulares), IBM Plex Sans (cuerpo), JetBrains Mono
(datos, variables y metadatos). **Todos los numerales financieros usan cifras tabulares**
(`font-variant-numeric: tabular-nums`) para alineación vertical instantánea.

Regla de unidades (v1.1): las probabilidades se expresan **siempre en porcentaje** en la interfaz
(55 = 55 %) y se convierten a decimal solo en el motor de cálculo. Nunca mezclar `0.55` con «%».

## Retícula y espaciado

- Ritmo base de 4 px; gutter 16 px; margen de borde 24 px.
- Separación por reglas «hairline» (1 px, tinta al 15 %) además del espacio en blanco.
- Densidad alta permitida, organizada por alineación horizontal estricta.
- **Un solo código responsivo** (v1.1): móvil < 600 px (una columna), tablet 600–1024 px,
  escritorio > 1024 px con ancho máximo de 1280 px centrado. Queda prohibido mantener una
  página móvil separada.

## Elevación y profundidad

Sin sombras en el eje Z. Profundidad mediante entintado y marcos: bordes de 1 px, regla de cabecera
de 2 px («Header Rule») en tarjetas prioritarias, y variaciones tonales del papel para contenedores
anidados. El foco se indica con un trazo de 2 px en Azul Técnico.

## Formas

- Radio de 0 px en todos los elementos primarios. Excepción: 2 px solo en elementos diminutos
  (checkboxes, etiquetas).
- Prohibidos: píldoras, botones circulares y curvas orgánicas. (v1.1: se eliminó el avatar
  circular que violaba esta regla.)

## Componentes

- **Botones**: rectangulares, borde 1 px. Primario: relleno Azul Técnico con texto blanco.
  Hover: inversión de color o trama diagonal.
- **Deslizadores esquemáticos**: pista de 1 px con mango cuadrado; etiquetas monoespaciadas de
  valor, mínimo y máximo.
- **Campos de entrada**: etiqueta `label-xs` encima, unidades al final en tinta atenuada, asociación
  `label[for]` obligatoria.
- **Tablas de datos**: sin cebra; reglas horizontales de 1 px. Celdas óptimas con fondo Salvia claro.
- **Tarjetas**: borde carboncillo 1 px + Header Rule de 2 px. Sin sombras.
- **Colofón**: `label-xs` para descargos y versionado, al estilo de la nota final de un paper.
- **Cursor de precisión**: crosshair en gráficas de datos.

## Accesibilidad (v1.1, normativo)

- Contraste AA mínimo en todo texto, incluido el de 11 px.
- Objetivos táctiles ≥ 44 px en navegación y controles.
- Botones de icono con `aria-label`; gráficas `<canvas>` con `role="img"` y descripción dinámica.
- Resultados de cálculo dentro de regiones `aria-live="polite"`.
