/**
 * Multivariate portfolio Kelly formulation (Phase 3 engine — UI pending).
 *
 *   F* = Σ⁻¹ (μ − r·1)
 *
 * where Σ is the covariance matrix of arithmetic returns, μ the vector of
 * expected returns and r the risk-free rate. Solved via Gaussian elimination
 * with partial pivoting (no matrix inversion).
 *
 * Reference: capstone §6; Thorp (2006).
 */

export interface PortfolioParams {
  /** Expected annual returns per asset (decimals). */
  mu: number[];
  /** Annual risk-free rate (decimal). */
  r: number;
  /** Covariance matrix of annual returns (n×n, symmetric positive definite). */
  cov: number[][];
}

/** Solve A·x = b via Gaussian elimination with partial pivoting. */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  if (A.length !== n || A.some((row) => row.length !== n)) {
    throw new RangeError("A must be n×n and match b's length");
  }
  // Work on copies.
  const M = A.map((row, i) => [...row, b[i] as number]);
  for (let col = 0; col < n; col++) {
    // Partial pivot.
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs((M[row] as number[])[col] as number) > Math.abs((M[pivot] as number[])[col] as number)) pivot = row;
    }
    const pivRow = M[pivot] as number[];
    if (Math.abs(pivRow[col] as number) < 1e-12) {
      throw new RangeError("Matrix is singular or ill-conditioned");
    }
    [M[col], M[pivot]] = [M[pivot] as number[], M[col] as number[]];
    const base = M[col] as number[];
    for (let row = col + 1; row < n; row++) {
      const target = M[row] as number[];
      const factor = (target[col] as number) / (base[col] as number);
      for (let k = col; k <= n; k++) {
        target[k] = (target[k] as number) - factor * (base[k] as number);
      }
    }
  }
  // Back substitution.
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    const R = M[row] as number[];
    let sum = R[n] as number;
    for (let k = row + 1; k < n; k++) sum -= (R[k] as number) * (x[k] as number);
    x[row] = sum / (R[row] as number);
  }
  return x;
}

/**
 * Optimal Kelly weight vector F* = Σ⁻¹(μ − r·1).
 * Weights may exceed 1 in aggregate (implied leverage) or be negative
 * (implied shorts); presentation-layer constraints are a Phase 3 concern.
 */
export function fStarPortfolio({ mu, r, cov }: PortfolioParams): number[] {
  if (mu.length === 0) throw new RangeError("mu must be non-empty");
  if (cov.length !== mu.length) throw new RangeError("cov must be n×n for n assets");
  const excess = mu.map((m) => m - r);
  return solveLinearSystem(cov, excess);
}
