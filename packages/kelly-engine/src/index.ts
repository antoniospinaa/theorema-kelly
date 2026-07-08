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
  quantilePath,
  pathStats,
  type SimOptions,
  type Paths,
  type PathStats,
} from "./simulate";

export {
  logReturns,
  estimateMuSigma,
  covMatrix,
  expectedMaxLosingStreak,
  TRADING_DAYS_PER_YEAR,
  type MuSigmaEstimate,
} from "./estimate";

export { doublingTime, clamp, mulberry32, gaussian, median, type Rng } from "./common";
