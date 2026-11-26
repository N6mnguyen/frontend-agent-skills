# Virtualization and Profiling

## @tanstack/react-virtual list (dynamic row heights)

```tsx
// src/components/virtual-list.tsx
import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  estimateSize?: number;
  height: number;
  label: string;
}

export function VirtualList<T>({ items, getKey, renderItem, estimateSize = 48, height, label }: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    getItemKey: (index) => getKey(items[index]!),
    overscan: 6,
  });

  return (
    <div ref={parentRef} style={{ height, overflow: 'auto' }} role="list" aria-label={label} tabIndex={0}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            role="listitem"
            aria-setsize={items.length}
            aria-posinset={row.index + 1}
            data-index={row.index}
            ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start}px)` }}
          >
            {renderItem(items[row.index]!)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Notes:
- `measureElement` + `data-index` handle variable heights; keep `estimateSize` close to the average to reduce scroll jumps.
- `getItemKey` keeps measurements tied to items when the list reorders. Option name checked against v3 memory only [VERIFY].
- Use `useWindowVirtualizer` when the page itself scrolls.
- Table-like data: virtualize rows and keep header outside the scroller; add `aria-rowcount` / `aria-rowindex` on `role="grid"`/`"table"` rows.
- antd `Table`: `virtual` + `scroll={{ x: number, y: number }}` instead of a custom virtualizer.
- `react-window` remains fine for fixed-size rows; check the installed major's API before copying older `FixedSizeList` snippets (v2 renamed components) [VERIFY].

## Profiling recipe

1. `npm run build && npm run preview` (or `next build && next start`). For named component frames in production profiles, use a profiling build (`react-dom/profiling` alias) if the project sets it up.
2. React DevTools → Profiler → settings: enable "Record why each component rendered" and "Highlight updates".
3. Record only the slow interaction. Sort the flamegraph by commit duration; open the slowest commit; check "Rendered because" for each heavy component.
4. Chrome DevTools → Performance → record the same interaction with CPU 4x throttling. Look for long tasks, layout thrash (purple Layout blocks after JS), and the React tracks (React 19.2+).
5. Write down: interaction, commit ms, long task ms, number of components rendered. Fix, rebuild, repeat.

## Programmatic measurement with <Profiler>

```tsx
// src/perf/profiled.tsx
import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from 'react';

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration) => {
  if (actualDuration > 16) {
    console.warn(`[perf] ${id} ${phase} took ${actualDuration.toFixed(1)}ms (base ${baseDuration.toFixed(1)}ms)`);
  }
};

export function Profiled({ id, children }: { id: string; children: ReactNode }) {
  return <Profiler id={id} onRender={onRender}>{children}</Profiler>;
}
```

`<Profiler>` is disabled in standard production builds; use it in dev/profiling builds or tests.

## Field metrics

```ts
// src/perf/report-web-vitals.ts
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

function send(metric: Metric) {
  navigator.sendBeacon?.('/api/vitals', JSON.stringify({ name: metric.name, value: metric.value, id: metric.id, rating: metric.rating }));
}

export function reportWebVitals() {
  onCLS(send);
  onINP(send);
  onLCP(send);
}
```

Targets (good): LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 at the 75th percentile.
