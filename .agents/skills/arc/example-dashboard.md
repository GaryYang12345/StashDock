# Example: analytics overview

Request: "An overview page for our signups: a few KPIs, a chart for the selected range, and the top sources."

## Plan

```
Job: see how signups are trending and where they come from
Primary action: Export (one primary button)
Regions: header (h1, range, export), KPI row (metric-card x4), trend (line-chart), sources (sortable-data-table)
States: loading (skeleton per region), empty (empty-state), error (alert with retry)
```

Choices: `segmented-control` for the range because it changes the view of the same data (not `tabs`, which swap panels); `metric-card` for the KPIs; the table scrolls inside its card on phones. Pro alternative for the whole page: `metrics-dashboard`.

```bash
npx shadcn@latest add @uiarc/button @uiarc/segmented-control @uiarc/metric-card @uiarc/line-chart @uiarc/sortable-data-table @uiarc/skeleton @uiarc/empty-state @uiarc/alert
```

## overview.tsx

```tsx
"use client";

import { Download } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { LineChart, type LineChartDatum } from "@/components/arc/line-chart/line-chart";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { SortableDataTable } from "@/components/arc/sortable-data-table/sortable-data-table";
import styles from "./overview.module.css";

type Kpi = { label: string; value: number; suffix?: string; change: string }; // change carries its sign: "+12%"
type Source = { id: string; source: string; signups: number; conversion: string };
type Data = { kpis: Kpi[]; trend: LineChartDatum[]; sources: Source[] };
type Props = {
  range: string;
  onRangeChange: (range: string) => void;
  state: { status: "loading" } | { status: "error"; retry: () => void } | { status: "ready"; data: Data };
  onExport: () => void;
};

const ranges = [{ value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "90d", label: "90 days" }];

export function Overview({ range, onRangeChange, state, onExport }: Props) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Signups</h1>
        <div className={styles.tools}>
          <SegmentedControl label="Range" options={ranges} value={range} onValueChange={onRangeChange} />
          <Button onClick={onExport}><Download size={16} strokeWidth={1.75} aria-hidden="true" />Export</Button>
        </div>
      </header>

      {state.status === "error" && (
        <Alert tone="danger" title="Signups could not load">
          <Button variant="secondary" size="sm" onClick={state.retry}>Try again</Button>
        </Alert>
      )}

      <section className={styles.kpis} aria-label="Key numbers" aria-busy={state.status === "loading"}>
        {state.status === "ready"
          ? state.data.kpis.map(kpi => <MetricCard key={kpi.label} label={kpi.label} value={kpi.value} suffix={kpi.suffix} change={kpi.change} context="vs previous period" />)
          : [0, 1, 2, 3].map(i => <Skeleton key={i} lines={2} className={styles.kpiSkeleton} />)}
      </section>

      <section className={styles.card} aria-label="Signups over time">
        {state.status === "ready"
          ? <LineChart label="Signups" data={state.data.trend} series={[{ key: "signups", label: "Signups" }]} height={280} />
          : <Skeleton lines={6} />}
      </section>

      <section className={styles.card} aria-label="Top sources">
        {state.status !== "ready" ? <Skeleton lines={5} /> : state.data.sources.length === 0
          ? <EmptyState title="No sources yet" description="Sources appear after your first tracked signup." />
          : <div className={styles.tableScroll}>
              <SortableDataTable rows={state.data.sources} rowKey="id" caption="Top sources"
                columns={[
                  { key: "source", label: "Source" },
                  { key: "signups", label: "Signups", numeric: true, sortable: true },
                  { key: "conversion", label: "Conversion", numeric: true },
                ]}
                defaultSort={{ key: "signups", direction: "desc" }} />
            </div>}
      </section>
    </main>
  );
}
```

## overview.module.css

```css
.page { width: 100%; max-width: 1200px; margin-inline: auto; padding: 32px clamp(16px, 4vw, 32px); display: grid; gap: 24px; }
.page > * { min-width: 0; }
.header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
.title { margin: 0; font-family: var(--font-display); font-size: var(--text-3xl); font-weight: 500; letter-spacing: var(--tracking-display); line-height: var(--leading-display); color: var(--foreground); }
.tools { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; align-items: stretch; }
.kpiSkeleton { min-height: 112px; }
.card { border: 1px solid var(--border); border-radius: var(--radius-surface); background: var(--surface); padding: 24px; overflow: hidden; }
.tableScroll { overflow-x: auto; overscroll-behavior-x: contain; margin: -24px; padding: 8px; }
```

## Why it passes the checklist

- One container; header, KPI row, chart, and table share the same left edge; gaps 24px between regions and 16px between cards.
- `segmented-control` for a view of the same data, one primary button (Export uses the default variant; Try again is `secondary`), the export icon is plain and `aria-hidden`.
- Every region has loading, error, and empty states in its final layout; `aria-busy` while loading.
- The table scrolls inside its card; values are right-aligned numeric columns with tabular numerals from the component.
- Data arrives as props, so the first render is the same on server and client.
