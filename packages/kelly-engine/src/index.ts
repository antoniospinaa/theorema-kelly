export {
  fStarBinary,
  isFavorable,
  growthBinary,
  wealthStepBinary,
  type BinaryParams,
} from "./binary";

export {
  fStarContinuous,
  growthContinuous,
  classifyFStar,
  wealthStepContinuous,
  type ContinuousParams,
  type ContinuousRegime,
} from "./continuous";

export {
  fStarPortfolio,
  solveLinearSystem,
  type PortfolioParams,
} from "./portfolio";

export {
  simulateBinary,
  simulateContinuous,
  medianPath,
  pathStats,
  type SimOptions,
  type Paths,
  type PathStats,
} from "./simulate";

export { doublingTime, clamp, mulberry32, gaussian, median, type Rng } from "./common";
