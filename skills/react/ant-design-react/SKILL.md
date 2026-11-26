---
name: ant-design-react
description: Version-aware Ant Design React guidance for antd 5-6 - ConfigProvider tokens and theming, App.useApp message/modal/notification context, choosing antd Form vs React Hook Form, typed server-side Table with TanStack Query, Modal and Drawer lifecycle, Upload, remote Select, tree-shaking, CSS-in-JS SSR and locale. Use when building an antd UI, configuring its theme, migrating v5 to v6, wiring tables/forms/overlays, or setting up SSR styles.
license: MIT
metadata:
  category: react
  version: "1.0.0"
  frameworks: "antd 5-6"
  last-reviewed: "2026-11-25"
---

# Ant Design React

## Purpose

Use the installed antd version and the project's form/data conventions. Deliver UI that inherits theme and locale, handles remote data explicitly, and avoids deprecated props and CSS selectors coupled to antd internals.

## When to Use

- Creating or migrating antd components, forms, tables, modals, drawers, uploads, or remote selects.
- Setting design tokens, locale, CSS-in-JS SSR, or v5-to-v6 migration.
- Deciding between antd `Form` and React Hook Form.

Do not use when: the project uses a different component library. Follow its conventions instead.

## Workflow

1. **Detect.** Read `package.json` / lockfile for `antd`, `@ant-design/icons`, React, Next/Vite versions. Inspect `ConfigProvider`, app root, current form library, API client/query hooks, locale, and SSR setup.
2. **Choose.** Follow the project: existing antd `Form` → keep antd `Form`; existing RHF → keep RHF and bridge controlled antd controls with `Controller` (see `react-forms`). New simple CRUD form → prefer antd `Form` for native binding/validation. Avoid mixed state ownership.
3. **Version branch.** v5 uses tokens/CSS-in-JS; v6 defaults CSS variables on, requires React 18+, supports modern browsers only, and removes React 17 patch package. Upgrade `@ant-design/icons` to v6 with antd v6. Use v6 APIs below; marked deprecations remain only for migration, not new code.
4. **Implement** using semantic slots, token APIs, and existing data fetching. Do not use Less variable overrides in v5+ for new theme work.
5. **Verify.** Run typecheck/lint/tests. Check keyboard/focus behavior, narrow viewport, theme, locale, loading/empty/error states, SSR hydration warnings, and browser console deprecations.

### v5 → v6 migration facts

- React 18 minimum; IE and older browsers dropped; CSS variables enabled by default. Remove `@ant-design/v5-patch-for-react-19`; upgrade `@ant-design/icons` to 6+.
- Deprecated props still work but are scheduled for removal in v7. Replace `destroyOnClose` → `destroyOnHidden`; `bordered` → `variant`; `dropdownRender` → `popupRender`; Modal/Drawer `bodyStyle`/`maskStyle` → `styles.body`/`styles.mask`; Select dropdown props → `showSearch` object or `popupRender` as relevant.
- Antd v6.3+ uses `mask.closable` instead of `maskClosable`; `Modal` / `Drawer` mask may accept `{ enabled, blur, closable }`.
- Many component DOM structures changed. Avoid selectors reaching into undocumented internals.
- Overlay mask blur was on by default in 6.0-6.2 and is off by default from 6.3; opt in via `ConfigProvider` `modal.mask.blur` / `drawer.mask.blur`.
- 6.3 unified size enums to `'large' | 'medium' | 'small'` (`middle`/`default` → `medium` on Table, Divider, Switch, Card and others).
- Run the official antd migration CLI scan for deprecated APIs before a bulk change, then confirm CSS variables / CSS-in-JS SSR still work.

## Best Practices

- **Theme with `ConfigProvider` tokens.** `theme: { token, algorithm, components }`; algorithms are `theme.defaultAlgorithm`, `darkAlgorithm`, `compactAlgorithm`. Nested providers inherit unspecified tokens. Use `theme.useToken()` for custom components. Never globally patch `.ant-*` CSS internals.
- **App context.** Wrap app in `<App>` under `ConfigProvider`, then call `const { message, modal, notification } = App.useApp()`. Static `message.*` / `Modal.*` methods cannot consume React context/theme; use `App.useApp()` or `Modal.useModal()` + render its `contextHolder`.
- **Form decision.** Use antd `Form` when project convention is antd and fields are conventional; use RHF+Zod when schema inference, non-antd controlled widgets, complex field arrays, or existing RHF conventions make it the better fit. No half-and-half form state.
- **Server-side Table.** Set `pagination`, `sorter: true`, and `filters` for server-owned behavior. Convert `onChange(pagination, filters, sorter, extra)` into a TanStack Query key; reset page on filter/sort; never locally sort only the current page. Type columns `TableColumnsType<Row>`.
- **Modal/Drawer.** Control visibility with `open` and state. Use `destroyOnHidden` when hidden children should reset. Modal Form preserves values by default; set `<Form preserve={false}>` when each open should start blank. Mount a fresh record via keyed child or `form.resetFields()` on open; do not let async stale data overwrite edits.
- **Upload.** Validate size/type/content server-side too. For local validation, `beforeUpload` returns `Upload.LIST_IGNORE` to omit rejected files; `false` stops network upload but retains list item. Use `customRequest` only when project transport needs it; keep `fileList` controlled only when you need custom lifecycle.
- **Remote Select.** In v6 put `onSearch`, `filterOption`, `searchValue`, and `optionFilterProp` inside `showSearch={{ ... }}`. For server results set `filterOption: false`, debounce queries, cancel/ignore stale responses, show `loading` and `notFoundContent`.
- **Tree shaking.** Import named components from `antd` and icons from `@ant-design/icons`; ESM tree-shakes unused exports. Do not add `babel-plugin-import` without a project-specific need.
- **SSR.** Next App Router: wrap root in `AntdRegistry` from `@ant-design/nextjs-registry`. Pages Router: collect styles with `@ant-design/cssinjs` cache in `_document`. Match `@ant-design/cssinjs` to the version nested under antd; duplicate versions break context/hydration.
- **Locale.** Set `ConfigProvider locale={...}` using the locale object from `antd/locale/<code>` and set the date library locale separately (antd uses Day.js by default). [VERIFY] Locale import path for installed bundler/major and locale-specific Day.js setup.

## Anti-patterns

- `message.success()` static inside themed app — loses context/config; use `App.useApp()`.
- `ConfigProvider` Less variable hacks in v5/v6 — unsupported theme path; use tokens.
- Client-side sorting/filtering of a server-paginated `Table` — only the current page is processed; send sort/filter state to server/query.
- `Modal.destroyOnClose` on new code — deprecated; use `destroyOnHidden`.
- `Select onSearch` top-level on v6 — deprecated; use `showSearch={{ onSearch }}`.
- `Upload beforeUpload={() => false}` as validation rejection — file stays listed; use `Upload.LIST_IGNORE` when it must disappear.
- Using undocumented `.ant-select-*` DOM descendants for styling — DOM can change between minor versions; use `classNames`/`styles` semantic slots or wrap the component.
- Global `ConfigProvider` theme object recreated on every render — keep it module-scoped or memoized to avoid needless reconfiguration.

## Implementation Examples

### Theme + context APIs

```tsx
// src/app/providers.tsx
import type { PropsWithChildren } from 'react';
import { App as AntdApp, ConfigProvider, theme, type ThemeConfig } from 'antd';
import enUS from 'antd/locale/en_US';

const config: ThemeConfig = {
  token: { colorPrimary: '#1457d9', borderRadius: 6 },
  algorithm: theme.defaultAlgorithm,
  components: { Button: { controlHeight: 40 } },
};

export function Providers({ children }: PropsWithChildren) {
  return <ConfigProvider theme={config} locale={enUS}><AntdApp>{children}</AntdApp></ConfigProvider>;
}
```

```tsx
// src/features/orders/export-button.tsx
import { App, Button } from 'antd';
import { exportOrders } from './orders-api';

export function ExportButton() {
  const { message, modal } = App.useApp();
  return <Button onClick={() => modal.confirm({ title: 'Export orders?', onOk: async () => { await exportOrders(); message.success('Export complete'); } })}>Export</Button>;
}
```

### Server-side Table + TanStack Query

```tsx
// src/features/users/users-table.tsx
import { Table } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchUsers } from './users-api';

interface User { id: string; name: string; email: string; status: 'active' | 'disabled' }
export interface PageState { page: number; pageSize: number; sort?: string; direction?: 'asc' | 'desc'; status?: string }

const columns: TableColumnsType<User> = [
  { title: 'Name', dataIndex: 'name', sorter: true },
  { title: 'Email', dataIndex: 'email', sorter: true },
  { title: 'Status', dataIndex: 'status', filters: [{ text: 'Active', value: 'active' }, { text: 'Disabled', value: 'disabled' }] },
];

export function UsersTable() {
  const [state, setState] = useState<PageState>({ page: 1, pageSize: 20 });
  const query = useQuery({ queryKey: ['users', state], queryFn: () => fetchUsers(state), placeholderData: (previous) => previous });

  const onChange: TableProps<User>['onChange'] = (pagination, filters, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    setState({
      page: pagination.current ?? 1,
      pageSize: pagination.pageSize ?? 20,
      sort: typeof s?.field === 'string' ? s.field : undefined,
      direction: s?.order === 'ascend' ? 'asc' : s?.order === 'descend' ? 'desc' : undefined,
      status: typeof filters.status?.[0] === 'string' ? filters.status[0] : undefined,
    });
  };

  return <Table<User>
    rowKey="id"
    columns={columns}
    dataSource={query.data?.items ?? []}
    loading={query.isFetching}
    onChange={onChange}
    pagination={{ current: state.page, pageSize: state.pageSize, total: query.data?.total ?? 0, showSizeChanger: true }}
  />;
}
```

`fetchUsers` must send `state` to the API and return `{ items: User[]; total: number }`. For multi-sort, serialize all sorter entries. Keep a visible error/retry state when `query.isError`; do not present an empty table as a successful response.

### Remote Select, Upload, lifecycle, SSR

See [references/components.md](references/components.md) for remote Select with stale-request protection, antd Upload validation/custom request, Modal/Drawer reset lifecycle, and Next SSR integration.

## Validation Checklist

- [ ] `antd`, React and icon versions checked; v6 is React 18+ and icons 6+.
- [ ] Theme uses `ConfigProvider` tokens; no Less variable override.
- [ ] Context-bound notifications use `App.useApp` or `Modal.useModal`.
- [ ] Form follows one project convention: antd Form or RHF, not both.
- [ ] Table server pagination/sort/filter drives query key and API parameters.
- [ ] Modal/Drawer uses `open`, `destroyOnHidden` as needed; edit values reset intentionally.
- [ ] Upload checks file type/size client-side and revalidates server-side.
- [ ] Remote Select disables local filtering and suppresses stale responses.
- [ ] SSR integration is correct for Next router and uses matching cssinjs version.
- [ ] Locale and Day.js locale both set; narrow viewport and keyboard tested.
- [ ] No deprecated API warnings in console after migration.

## References

- [references/components.md](references/components.md) — Select, Upload, Modal/Drawer, SSR snippets.
- https://ant.design/docs/react/customize-theme
- https://ant.design/components/app
- https://ant.design/components/table
- https://ant.design/docs/react/migration-v6
- https://ant.design/docs/react/use-with-next
