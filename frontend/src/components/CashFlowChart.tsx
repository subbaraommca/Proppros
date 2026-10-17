import { money, monthLabel } from "../utils/format";

interface Point {
  period: string;
  income_cents: number;
  expense_cents: number;
}

/**
 * Grouped bars: income vs. expenses per month (plain SVG).
 * Series colors are the validated Strata chart pair (--pp-chart-1 / --pp-chart-2,
 * CVD-safe in both themes — see docs/DESIGN_GUIDELINES.md §2.4).
 */
export function CashFlowChart({ data }: { data: Point[] }) {
  const W = 720;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 56 };
  const max = Math.max(1, ...data.flatMap((d) => [d.income_cents, d.expense_cents]));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const base = pad.top + innerH;
  const slot = innerW / Math.max(1, data.length);
  const bar = Math.max(4, Math.min(16, slot / 3));
  const y = (v: number) => base - (v / top) * innerH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Monthly income and expenses for the last 12 months">
        {ticks.map((t) => (
          <g key={t}>
            {t > 0 && <line className="grid-line" x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} />}
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end">
              {compact(t)}
            </text>
          </g>
        ))}
        <line className="baseline" x1={pad.left} x2={W - pad.right} y1={base} y2={base} />
        {data.map((d, i) => {
          const cx = pad.left + slot * i + slot / 2;
          return (
            <g key={d.period}>
              {/* Wide invisible hit target for the native tooltip */}
              <rect x={cx - slot / 2} y={pad.top} width={slot} height={innerH} fill="transparent">
                <title>{`${monthLabel(d.period)} — income ${money(d.income_cents)}, expenses ${money(d.expense_cents)}`}</title>
              </rect>
              <path className="bar" d={barPath(cx - bar - 1, base, bar, base - y(d.income_cents))} fill="var(--pp-chart-1)" pointerEvents="none" />
              <path className="bar" d={barPath(cx + 1, base, bar, base - y(d.expense_cents))} fill="var(--pp-chart-2)" pointerEvents="none" />
              <text x={cx} y={H - 8} textAnchor="middle">
                {monthLabel(d.period)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span>
          <i style={{ background: "var(--pp-chart-1)" }} />
          Income
        </span>
        <span>
          <i style={{ background: "var(--pp-chart-2)" }} />
          Expenses
        </span>
      </div>
    </div>
  );
}

/** Bar anchored to the baseline with 4px rounded top corners only. */
function barPath(x: number, base: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  const t = base - h;
  return `M${x},${base}V${t + r}Q${x},${t} ${x + r},${t}H${x + w - r}Q${x + w},${t} ${x + w},${t + r}V${base}Z`;
}

function niceStep(max: number): number {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

function compact(cents: number): string {
  const d = cents / 100;
  if (d >= 1000) return `$${(d / 1000).toFixed(d >= 10000 ? 0 : 1)}k`;
  return `$${d.toFixed(0)}`;
}
