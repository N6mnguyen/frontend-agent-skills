---
name: web-accessibility
description: Build and review accessible web interfaces using WCAG 2.2 AA, semantic HTML, keyboard operation, accessible forms, focus management, and assistive-technology testing. Use when creating UI, dialogs, navigation, forms, status messages, or fixing accessibility issues in React or Angular.
license: MIT
metadata:
  category: shared
  version: "1.0.0"
  frameworks: "react, angular"
  last-reviewed: "2026-11-25"
---

# Web Accessibility

## Purpose

Make core workflows perceivable, operable, understandable, and robust for keyboard and assistive-technology users. Prefer native HTML behavior; add ARIA only to supply semantics that native elements cannot express. Treat automated checks as one signal, not proof of conformance.

## When to Use

- Building or reviewing pages, forms, navigation, dialogs, menus, notifications, or dynamic loading states.
- Fixing keyboard traps, missing names, poor contrast, inaccessible errors, or screen-reader announcements.

Do not use when: the task is solely responsive layout; use the `responsive-design` skill alongside this one where both apply.

## Workflow

1. **Detect** — inspect framework versions, router, component library, existing accessibility tests, and design tokens. Follow the project's established patterns unless they prevent access.
2. **Map** — identify the user's primary task, page landmarks, interactive controls, status transitions, and keyboard path.
3. **Implement** — use semantic elements and native controls first. Add ARIA and focus behavior only for demonstrated gaps.
4. **Verify** — run existing lint/tests and axe where available; test keyboard-only flows and representative screen-reader output manually.

## Best Practices

### Semantics and names

- Use `header`, `nav`, `main`, `aside`, `footer`, headings, lists, buttons, and anchors for their intended roles. One `main` landmark per page view; provide distinct accessible names for multiple navigation landmarks.
- Use `<button>` for actions and `<a href>` for navigation. Do not use clickable `div` or `span` when a native control fits.
- Give every control a programmatic name. Prefer visible `<label>` text, then `aria-label` only when visible text is impossible; use `aria-labelledby` to reference existing text.
- Keep heading levels logical and descriptive. Do not select heading tags for visual size.
- Provide useful alternative text for informative images. Use `alt=""` for decorative images; avoid repeating nearby text.
- Use table headers (`th`, `scope`) for tabular data; do not fake tables with layout markup.

### ARIA and custom widgets

- Native HTML is the default. ARIA changes accessibility-tree semantics but does not create keyboard behavior, focus, or interaction.
- Never add a role or ARIA state that conflicts with native semantics. Keep states such as `aria-expanded`, `aria-pressed`, and `aria-selected` synchronized with the actual UI.
- For a custom widget, implement the complete expected keyboard pattern, focus behavior, state announcements, and disabled behavior; otherwise choose native controls.
- `aria-hidden="true"` must not contain focusable controls or hide content still needed by a focused user.

### Keyboard and focus

- Every action works with keyboard alone. Preserve a visible focus indicator; do not remove outlines without an equally visible replacement.
- Keep tab order aligned with reading and visual order. Avoid positive `tabindex`; use `tabindex="0"` only to make a custom, non-native widget focusable and `-1` for programmatic focus targets.
- Dialogs must have an accessible name, move focus inside on open, keep focus within while modal, close on Escape when appropriate, and return focus to the opener. Use native `<dialog>` when the project supports its behavior; validate the full interaction.
- For client-side route changes, move focus to the new page's main heading or main region when needed, update the document title, and avoid unexpectedly stealing focus during ordinary in-page updates.
- Do not move focus merely to announce routine background updates. Use a live region for status text when focus should remain where it is.

### Forms and errors

- Associate each input with a visible label. Group related controls with `fieldset` and `legend`.
- State requiredness in text and native attributes. Do not rely on color or placeholder text alone.
- Identify errors in text, associate field-specific messages using `aria-describedby`, set `aria-invalid="true"` while invalid, and explain how to fix the issue.
- On submit failure, provide an error summary, link each item to its field, and move focus to the summary only when this helps users recover.
- Preserve entered values after validation failure. Announce successful submission and relevant asynchronous errors.

### Visual and dynamic content

- Meet WCAG 2.2 AA contrast: normal text 4.5:1, large text 3:1, and meaningful non-text UI components/graphics 3:1 against adjacent colors. Do not convey meaning by color alone.
- Support zoom/reflow and text resizing without clipping, loss of functionality, or two-dimensional scrolling for ordinary content.
- Respect reduced-motion preferences; avoid flashing content and unnecessary motion. Ensure animations do not obscure focus or state.
- Loading state: expose a concise status (for example, `role="status"`), mark only the updating region busy when useful, and avoid repeatedly announcing progress noise.
- Empty state: explain that there are no results and offer a clear next action where appropriate.
- Error state: state what failed, whether data was preserved, and a recoverable next step. Do not announce the same error through multiple live regions.

### React and Angular notes

- React: use native elements in JSX; pass `htmlFor` on `<label>` and stable IDs to controls. A custom dialog still needs explicit focus handling; a render alone does not make it modal accessibly.
- Angular: use native elements in templates and associate `<label for>` with a stable input `id`. Bind state attributes from the same source of truth as the component state.
- Both: framework event handlers do not supply missing roles, names, keyboard support, focus management, or live announcements.

## Anti-patterns

- Clickable non-semantic containers with only a mouse handler — replace with a button or link.
- `aria-label` on every element or `role="button"` on a native button — unnecessary or conflicting semantics.
- Placeholder-only labels, color-only error indicators, and unlabeled icon buttons — provide visible labels or an explicit accessible name.
- Focusing a live region for every update — keep focus stable and announce status through the region.
- A modal that merely renders above the page — implement focus entry, containment, Escape behavior, and focus return.
- Treating an axe-clean scan as WCAG conformance — combine automation with keyboard and assistive-technology review.

## Implementation Examples

```tsx
// src/SearchForm.tsx (React 18/19)
import { useId, useState } from 'react';

export function SearchForm() {
  const inputId = useId();
  const errorId = useId();
  const [query, setQuery] = useState('');
  const invalid = query.trim().length === 0;

  return (
    <form onSubmit={(event) => { event.preventDefault(); }}>
      <label htmlFor={inputId}>Search articles</label>
      <input
        id={inputId}
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      />
      {invalid && <p id={errorId}>Enter a search term.</p>}
      <button type="submit">Search</button>
    </form>
  );
}
```

```ts
// src/app/search/search.component.ts (Angular 17+)
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-search',
  template: `
    <form (submit)="$event.preventDefault()">
      <label for="article-search">Search articles</label>
      <input id="article-search" name="q" [value]="query()"
        (input)="query.set($any($event.target).value)"
        [attr.aria-invalid]="query().trim() ? null : 'true'"
        [attr.aria-describedby]="query().trim() ? null : 'search-error'">
      @if (!query().trim()) {
        <p id="search-error">Enter a search term.</p>
      }
      <button type="submit">Search</button>
    </form>
  `,
})
export class SearchComponent {
  readonly query = signal('');
}
```

These examples illustrate label/error association; production validation should occur on submit and avoid showing an error before the user has had a chance to enter a value. On Angular 17/18 add `standalone: true`; from Angular 19 standalone is the default.

### Accessible status (loading / empty / error)

The live region must exist in the DOM before its text changes; inserting a region and its message at the same time is often not announced.

```tsx
// src/OrdersPanel.tsx (React 18/19)
type Props = { status: 'loading' | 'error' | 'ready'; count: number; onRetry: () => void };

export function OrdersPanel({ status, count, onRetry }: Props) {
  const message =
    status === 'loading' ? 'Loading orders…'
    : status === 'error' ? 'Orders could not be loaded.'
    : count === 0 ? 'No orders yet.'
    : `${count} orders loaded.`;

  return (
    <section aria-labelledby="orders-heading" aria-busy={status === 'loading'}>
      <h2 id="orders-heading">Orders</h2>
      {/* Always rendered; only the text changes. */}
      <p role="status">{message}</p>
      {status === 'error' && <button type="button" onClick={onRetry}>Try again</button>}
    </section>
  );
}
```

Angular: the same template pattern works; for one-off announcements without a visible region use `LiveAnnouncer` from `@angular/cdk/a11y` (`announcer.announce('Saved', 'polite')`).

### Focus on route change

```tsx
// src/RouteFocus.tsx (React Router 6.4+/7)
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';  // 'react-router-dom' on v6

export function PageHeading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const firstPath = useRef<string | null>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${children} · Acme`;
    firstPath.current ??= pathname;
    if (pathname !== firstPath.current) ref.current?.focus(); // skip initial load
  }, [pathname, children]);
  return <h1 ref={ref} tabIndex={-1}>{children}</h1>;
}
```

```ts
// src/app/route-focus.service.ts (Angular 17+)
import { DestroyRef, Injectable, Injector, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RouteFocusService {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  init(): void {
    let first = true;
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (first) { first = false; return; } // leave initial load alone
        // Wait for the new view to render; the heading needs tabindex="-1".
        afterNextRender(() => document.querySelector<HTMLElement>('main h1')?.focus(), {
          injector: this.injector,
        });
      });
  }
}
```

Call `init()` once from the root component. Set page titles with the route `title` property (or a custom `TitleStrategy`). `afterNextRender` exists from Angular 17 and is stable since 20 (developer preview before). If the app already uses a skip link or a router-level focus utility, extend that instead.

### Dialogs

- Prefer an existing accessible dialog from the project's component library (Angular CDK `Dialog`/Material `MatDialog`, Radix, React Aria, Headless UI) over a hand-rolled one.
- Native `<dialog>` opened with `showModal()` gives inert background and Escape handling; still label it (`aria-labelledby`) and restore focus to the opener on close if the browser does not.
- Angular CDK: `cdkTrapFocus` (`A11yModule`) for custom overlays that cannot use `Dialog`.

### Testing

Automated rules catch only a subset of WCAG failures (names, roles, some contrast, ARIA misuse); focus order, meaningful text, and announcement quality need humans.

```tsx
// src/OrdersPanel.test.tsx (Vitest + @testing-library/react 16)
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { expect, it, vi } from 'vitest';
import { OrdersPanel } from './OrdersPanel';

it('exposes status and a retry action on error', async () => {
  const onRetry = vi.fn();
  const { container } = render(<OrdersPanel status="error" count={0} onRetry={onRetry} />);

  expect(screen.getByRole('status')).toHaveTextContent('Orders could not be loaded.');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalledOnce();

  // jsdom has no layout: axe cannot check contrast here; do that in a real browser.
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(results.violations).toEqual([]);
});
```

`toHaveTextContent` needs `@testing-library/jest-dom` registered in the setup file. Angular: `@testing-library/angular` offers the same `screen.getByRole` queries; with `TestBed` alone, query `fixture.nativeElement` and run `axe.run` on it.

```ts
// e2e/a11y.spec.ts (@playwright/test + @axe-core/playwright)
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('orders page has no detectable WCAG A/AA violations', async ({ page }) => {
  await page.goto('/orders');
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

Manual pass for each key workflow:

1. Unplug the mouse: Tab/Shift+Tab through the page, operate every control with Enter/Space/arrows/Escape, confirm focus is always visible and logically ordered.
2. Zoom to 200% and 400% (320 CSS px width): no lost content or horizontal scrolling for text.
3. Screen reader smoke test: NVDA or JAWS with Chrome/Firefox on Windows, VoiceOver with Safari on macOS/iOS, TalkBack on Android. Check names, roles, states, headings list, landmarks, and announcements for loading/error/success.
4. Check forced-colors / high-contrast mode keeps focus rings and icons visible.

## Validation Checklist

- [ ] All tasks can be completed with keyboard only; focus is visible and never trapped unexpectedly.
- [ ] Landmarks, headings, controls, and images expose correct names and semantics.
- [ ] Dialog open/close and route changes have deliberate focus behavior.
- [ ] Forms expose labels, requiredness, invalid state, actionable errors, and success/failure status.
- [ ] Text, controls, and meaningful graphics meet contrast requirements; color is not the only cue.
- [ ] Loading, empty, and error states are understandable without relying on visual changes alone.
- [ ] Automated checks pass, then keyboard and screen-reader checks cover key workflows.

## References

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN: Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Testing Library: ByRole](https://testing-library.com/docs/queries/byrole/)
- [axe-core](https://github.com/dequelabs/axe-core)
