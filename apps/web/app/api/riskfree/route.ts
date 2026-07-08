import { NextResponse } from "next/server";

/**
 * GET /api/riskfree
 *
 * Latest average interest rate on U.S. Treasury Bills from the Treasury's
 * public FiscalData API (no key). Falls back to a documented default when
 * the source is unavailable.
 */

export interface RiskFreeResponse {
  ratePct: number;
  asOf: string;
  source: "treasury" | "default";
}

const FALLBACK: RiskFreeResponse = { ratePct: 4.0, asOf: "estático", source: "default" };

export async function GET(): Promise<NextResponse> {
  const url =
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates" +
    "?fields=record_date,security_desc,avg_interest_rate_amt" +
    "&filter=security_desc:eq:Treasury%20Bills" +
    "&sort=-record_date&page[size]=1";
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json(FALLBACK);
    const json = (await res.json()) as {
      data?: Array<{ record_date?: string; avg_interest_rate_amt?: string }>;
    };
    const row = json.data?.[0];
    const rate = parseFloat(row?.avg_interest_rate_amt ?? "");
    if (!row?.record_date || !Number.isFinite(rate) || rate <= 0 || rate > 25) {
      return NextResponse.json(FALLBACK);
    }
    return NextResponse.json(
      { ratePct: rate, asOf: row.record_date, source: "treasury" } satisfies RiskFreeResponse,
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
