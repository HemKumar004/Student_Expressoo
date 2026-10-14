import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, TriangleAlert, CircleAlert, ChartColumn, Table2 } from "lucide-react";
import { cx } from "../utils/format.js";
import { Card } from "../components/Display.jsx";
import { SegmentedControl } from "../components/Navigation.jsx";
import { DataTable } from "../components/DataTable.jsx";

/* Chart rules (shared with the design system): single series in --chart-series-1,
   bars ≤ 24px with a 4px rounded data-end anchored to the baseline, 2px lines with a
   10% wash, hairline solid grid, hover + keyboard tooltip, and a table twin. */

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function niceMax(value) {
  if (!value || value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

const roundedTopRect = (x, y, w, h, r = 4) => {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
};

function Tooltip({ x, y, value, label }) {
  return (
    <div className="chart-tooltip" style={{ left: x, top: y }} role="presentation">
      <div className="chart-tooltip-value">{value}</div>
      <div className="chart-tooltip-label">
        <span className="chart-tooltip-key" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}

/**
 * Column chart for one series. data: [{ key, label, value, detail? }]
 */
export function BarChart({ data, height = 220, format = (v) => String(v), max, threshold, ariaLabel, refreshing, emptyText = "No data for this period" }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const margin = { top: 22, right: 8, bottom: 28, left: 44 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;
  const values = data.map((d) => d.value ?? 0);
  const domainMax = max ?? niceMax(Math.max(...values, threshold?.value ?? 0));
  const y = (v) => margin.top + innerH - (Math.max(0, v) / domainMax) * innerH;
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.max(4, Math.min(24, band * 0.56));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * domainMax);
  const labelEvery = band < 34 ? Math.ceil(34 / Math.max(band, 1)) : 1;
  const maxIdx = values.indexOf(Math.max(...values));
  const lastIdx = data.length - 1;

  if (!data.length) return <div className="chart-empty" style={{ height }}>{emptyText}</div>;

  return (
    <div ref={ref} className={cx("chart", refreshing && "is-refreshing")} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <g className="chart-grid">
            {ticks.map((t) => (
              <line key={t} x1={margin.left} x2={width - margin.right} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
            ))}
          </g>
          {ticks.map((t) => (
            <text key={`t${t}`} className="chart-tick" x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {format(t, true)}
            </text>
          ))}
          <line className="chart-baseline" x1={margin.left} x2={width - margin.right} y1={y(0) + 0.5} y2={y(0) + 0.5} />
          <g className="chart-bars" onMouseLeave={() => setActive(null)}>
            {data.map((d, i) => {
              const cx_ = margin.left + band * i + band / 2;
              const x = cx_ - barW / 2;
              const top = y(d.value ?? 0);
              const h = y(0) - top;
              return (
                <g key={d.key ?? d.label}>
                  <rect
                    className="chart-hit"
                    x={margin.left + band * i}
                    y={margin.top}
                    width={band}
                    height={innerH}
                    tabIndex={0}
                    aria-label={`${d.label}: ${format(d.value ?? 0)}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                  />
                  <path className={cx("chart-bar", active === i && "is-active")} d={roundedTopRect(x, top, barW, Math.max(h, d.value ? 1 : 0))} pointerEvents="none" />
                  {(i === maxIdx || i === lastIdx) && d.value > 0 && active === null && (
                    <text className="chart-value" x={cx_} y={top - 6} textAnchor="middle">
                      {format(d.value)}
                    </text>
                  )}
                  {i % labelEvery === 0 && (
                    <text className="chart-xlabel" x={cx_} y={height - 8} textAnchor="middle">
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          {threshold && (
            <g pointerEvents="none">
              <line className="chart-threshold" x1={margin.left} x2={width - margin.right} y1={Math.round(y(threshold.value)) + 0.5} y2={Math.round(y(threshold.value)) + 0.5} />
              <text className="chart-threshold-label" x={width - margin.right} y={y(threshold.value) - 5} textAnchor="end">
                {threshold.label}
              </text>
            </g>
          )}
        </svg>
      )}
      {active !== null && data[active] && (
        <Tooltip
          x={margin.left + band * active + band / 2}
          y={y(data[active].value ?? 0)}
          value={format(data[active].value ?? 0)}
          label={data[active].detail || data[active].label}
        />
      )}
    </div>
  );
}

/**
 * Line chart for one series over ordered x positions. data: [{ key, label, value|null, detail? }]
 */
export function LineChart({ data, height = 220, format = (v) => String(v), domain, threshold, ariaLabel, refreshing, emptyText = "No data for this period" }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const margin = { top: 22, right: 16, bottom: 28, left: 44 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;
  const valid = data.filter((d) => d.value !== null && d.value !== undefined);
  const [dMin, dMax] = domain || [0, niceMax(Math.max(...valid.map((d) => d.value), threshold?.value ?? 0))];
  const x = (i) => margin.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => margin.top + innerH - ((v - dMin) / (dMax - dMin || 1)) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => dMin + t * (dMax - dMin));

  const { line, area } = useMemo(() => {
    if (!width) return { line: "", area: "" };
    let l = "";
    let a = "";
    let segStart = null;
    let prev = null;
    data.forEach((d, i) => {
      if (d.value === null || d.value === undefined) {
        if (segStart !== null && prev !== null) a += `L${x(prev)},${y(dMin)}L${x(segStart)},${y(dMin)}Z`;
        segStart = null;
        prev = null;
        return;
      }
      const px = x(i);
      const py = y(d.value);
      if (segStart === null) {
        l += `M${px},${py}`;
        a += `M${px},${py}`;
        segStart = i;
      } else {
        l += `L${px},${py}`;
        a += `L${px},${py}`;
      }
      prev = i;
    });
    if (segStart !== null && prev !== null) a += `L${x(prev)},${y(dMin)}L${x(segStart)},${y(dMin)}Z`;
    return { line: l, area: a };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, width, height, dMin, dMax]);

  if (!valid.length) return <div className="chart-empty" style={{ height }}>{emptyText}</div>;

  const lastIdx = data.map((d) => d.value !== null && d.value !== undefined).lastIndexOf(true);
  const labelStep = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 70))));
  // Evenly spaced x labels; always label the last point, and skip one that would crowd it.
  const labelIdx = new Set();
  for (let i = 0; i < data.length; i += labelStep) labelIdx.add(i);
  for (const i of Array.from(labelIdx)) if (i !== data.length - 1 && data.length - 1 - i < labelStep * 0.6) labelIdx.delete(i);
  labelIdx.add(data.length - 1);

  const nearest = (clientX) => {
    const rect = ref.current.getBoundingClientRect();
    const px = clientX - rect.left - margin.left;
    const i = data.length <= 1 ? 0 : Math.round((px / innerW) * (data.length - 1));
    return Math.max(0, Math.min(data.length - 1, i));
  };

  const onKey = (e) => {
    if (e.key === "ArrowRight") setActive((a) => Math.min(data.length - 1, (a ?? -1) + 1));
    if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? data.length) - 1));
  };

  const activePoint = active !== null ? data[active] : null;

  return (
    <div ref={ref} className={cx("chart", refreshing && "is-refreshing")} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <g className="chart-grid">
            {ticks.map((t) => (
              <line key={t} x1={margin.left} x2={width - margin.right} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} />
            ))}
          </g>
          {ticks.map((t) => (
            <text key={`t${t}`} className="chart-tick" x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {format(t, true)}
            </text>
          ))}
          {threshold && (
            <g>
              <line className="chart-threshold" x1={margin.left} x2={width - margin.right} y1={Math.round(y(threshold.value)) + 0.5} y2={Math.round(y(threshold.value)) + 0.5} />
              <text className="chart-threshold-label" x={margin.left + 4} y={y(threshold.value) - 5}>
                {threshold.label}
              </text>
            </g>
          )}
          <path className="chart-area" d={area} />
          <path className="chart-line" d={line} />
          {data.map((d, i) =>
            labelIdx.has(i) ? (
              <text key={d.key ?? i} className="chart-xlabel" x={x(i)} y={height - 8} textAnchor={i === 0 && data.length > 1 ? "start" : i === data.length - 1 && data.length > 1 ? "end" : "middle"}>
                {d.label}
              </text>
            ) : null
          )}
          {lastIdx >= 0 && active === null && (
            <g>
              <circle className="chart-dot" cx={x(lastIdx)} cy={y(data[lastIdx].value)} r={4} />
              <text className="chart-value" x={x(lastIdx)} y={y(data[lastIdx].value) - 10} textAnchor="end">
                {format(data[lastIdx].value)}
              </text>
            </g>
          )}
          {activePoint && (
            <g pointerEvents="none">
              <line className="chart-crosshair" x1={x(active) + 0.5} x2={x(active) + 0.5} y1={margin.top} y2={margin.top + innerH} />
              {activePoint.value !== null && activePoint.value !== undefined && <circle className="chart-dot" cx={x(active)} cy={y(activePoint.value)} r={4} />}
            </g>
          )}
          <rect
            className="chart-overlay"
            x={margin.left}
            y={margin.top}
            width={innerW}
            height={innerH}
            tabIndex={0}
            aria-label={`${ariaLabel}. Use left and right arrow keys to read values.`}
            onMouseMove={(e) => setActive(nearest(e.clientX))}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive((a) => a ?? lastIdx)}
            onBlur={() => setActive(null)}
            onKeyDown={onKey}
          />
        </svg>
      )}
      {activePoint && (
        <Tooltip
          x={Math.min(Math.max(x(active), 70), width - 70)}
          y={activePoint.value !== null && activePoint.value !== undefined ? y(activePoint.value) : margin.top + innerH / 2}
          value={activePoint.value !== null && activePoint.value !== undefined ? format(activePoint.value) : "No classes"}
          label={activePoint.detail || activePoint.label}
        />
      )}
    </div>
  );
}

const TONE_ICONS = { good: CircleCheck, warning: TriangleAlert, critical: CircleAlert };

/** Progress toward 100% with a threshold tick; colour carries severity, always with icon + text. */
export function Meter({ label, value, threshold, tone = "good", valueLabel, foot, size }) {
  const v = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value));
  const FootIcon = TONE_ICONS[tone];
  return (
    <div className={cx("meter", `tone-${tone}`, size === "lg" && "meter-lg")}>
      {(label || valueLabel) && (
        <div className="meter-head">
          <span className="meter-label truncate">{label}</span>
          <span className="meter-value">{valueLabel ?? (value === null || value === undefined ? "—" : `${value}%`)}</span>
        </div>
      )}
      <div className="meter-track" role="meter" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={typeof label === "string" ? label : undefined}>
        <div className="meter-fill" style={{ width: `${v}%` }} />
        {threshold !== undefined && <span className="meter-threshold" style={{ left: `calc(${threshold}% - 1px)` }} title={`Required: ${threshold}%`} />}
      </div>
      {foot && (
        <div className={cx("meter-foot", `tone-${tone}`)}>
          {FootIcon && <FootIcon aria-hidden="true" />}
          <span>{foot}</span>
        </div>
      )}
    </div>
  );
}

/** Attendance-specific meter: maps standing to tone and explains what to do next. */
export function AttendanceMeter({ label, stats, threshold, size }) {
  if (!stats || stats.total === 0) {
    return <Meter label={label} value={null} threshold={threshold} tone="good" valueLabel="—" foot="No classes recorded yet" size={size} />;
  }
  const tone = stats.standing === "none" ? "good" : stats.standing;
  const foot =
    stats.standing === "good"
      ? `${stats.attended}/${stats.total} classes · can miss ${stats.canMiss} and stay above ${threshold}%`
      : `${stats.attended}/${stats.total} classes · attend the next ${stats.needed} to reach ${threshold}%`;
  return <Meter label={label} value={stats.percentage} threshold={threshold} tone={tone} foot={foot} size={size} />;
}

/** Two or more parts of one whole with a 2px surface gap; legend always shown. */
export function SplitMeter({ segments, format = (v) => String(v), ariaLabel }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  return (
    <div className="stack-sm">
      <div className="split-meter" role="img" aria-label={ariaLabel}>
        {segments.map((s) =>
          s.value > 0 ? <span key={s.label} style={{ flexGrow: total ? s.value / total : 0, flexBasis: 0, background: s.color }} title={`${s.label}: ${format(s.value)}`} /> : null
        )}
        {total === 0 && <span style={{ flexGrow: 1, background: "var(--gray-150)" }} />}
      </div>
      <div className="chart-legend">
        {segments.map((s) => (
          <span key={s.label} className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: s.color }} aria-hidden="true" />
            <span>
              {s.label} <strong className="num" style={{ color: "var(--text-primary)" }}>{format(s.value)}</strong>
              {total > 0 && <span className="muted"> · {Math.round((s.value / total) * 100)}%</span>}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Card that hosts a chart with a Chart / Table toggle (the table is the accessible twin). */
export function ChartCard({ title, subtitle, children, tableColumns, tableRows, extraActions, className }) {
  const [view, setView] = useState("chart");
  return (
    <Card
      title={title}
      subtitle={subtitle}
      className={className}
      actions={
        <>
          {extraActions}
          {tableColumns && (
            <SegmentedControl
              size="sm"
              label={`${title} view`}
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "Chart", icon: ChartColumn },
                { value: "table", label: "Table", icon: Table2 },
              ]}
            />
          )}
        </>
      }
      flush={view === "table"}
    >
      {view === "chart" ? (
        children
      ) : (
        <div className="chart-table" style={{ maxHeight: 320, overflowY: "auto" }}>
          <DataTable columns={tableColumns} rows={tableRows} rowKey={(r) => r.key ?? r.label} compact empty={{ title: "No data" }} />
        </div>
      )}
    </Card>
  );
}
