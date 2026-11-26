# Frontend Agent Skills

Enterprise frontend engineering skills for AI coding agents, covering **React + TypeScript** and **Angular + TypeScript**.

[![validate](https://github.com/N6mnguyen/frontend-agent-skills/actions/workflows/validate.yml/badge.svg)](https://github.com/N6mnguyen/frontend-agent-skills/actions/workflows/validate.yml)
![skills](https://img.shields.io/badge/skills-34-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![spec](https://img.shields.io/badge/Agent%20Skills-spec%20compliant-purple)

This repository contains no application code. It is a library of [Agent Skills](https://agentskills.io): Markdown playbooks that coding agents load on demand. Each skill teaches the agent how to work in a real project: read the code that is already there, find the framework and library versions, follow the project's conventions, and make the smallest production-quality change.

## Quick install

Requires Node.js 22.20+. Run from your application project:

```bash
npx github:N6mnguyen/frontend-agent-skills
```

Choose React or Angular, then choose your agent. The installer automatically includes every skill for that framework and all shared frontend skills; it does not show the 34-skill picker. For updates, run `npx skills update -y`.

**Already installed?** Update skills installed from this GitHub repo with:

```bash
npx skills update -y
```

This updates all tracked skills in the current project. To update one skill only, use `npx skills update <skill-name>`. To also get skills added to the bundle since your install, re-run `npx github:N6mnguyen/frontend-agent-skills`. Full install options, agent IDs, and shared-skill commands: [Installation](#installation).

## Contents

- [Design principles](#design-principles)
- [Skill catalog](#skill-catalog)
- [Installation](#installation)
- [Agent compatibility](#agent-compatibility)
- [Usage](#usage)
- [Updating and uninstalling](#updating-and-uninstalling)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)

## Design principles

| Principle | What the skills make the agent do |
|---|---|
| Analyse before coding | Read `package.json`, configs and neighbouring code before writing anything. Every workflow starts with a detection step. |
| Follow the existing architecture | Fit new code into the project's structure. Don't restructure files that weren't part of the task. |
| Version-aware | Find the installed versions of Angular, React, the router and UI libraries, then use only APIs those versions have. |
| Type safety first | Use `strict` TypeScript, avoid `any`, narrow `unknown`, keep DTOs and domain models separate. |
| Minimal changes | Touch only the files the task needs. Add a dependency only with a clear reason. |
| Separation of concerns | Keep UI, state, API access and business rules in separate layers. |
| Production quality | Handle loading, empty and error states. Include accessibility, security and tests in proportion to risk. |
| Explain decisions | Report important architectural choices and their trade-offs back to the user. |

Skills follow the [Agent Skills Specification](https://agentskills.io/specification). Each `SKILL.md` stays under 500 lines, and longer material lives in `references/`, which the agent loads only when needed.

## Skill catalog

<!-- catalog:start -->
### Shared

| Skill | Description |
|---|---|
| [`frontend-api-integration`](skills/shared/frontend-api-integration/SKILL.md) | Build typed, resilient REST integrations in React and Angular - DTOs vs domain models, an API client layer, auth header injection, single-flight token refresh, interceptors (fetch/axios wrapper, HttpInterceptorFn), typed AppError mapping, pagination/filter/sort params, file upload with progress and Blob download, AbortController cancellation, and retry with backoff for idempotent requests. Use when adding or changing HTTP calls, writing an API client or interceptor, handling 401s and token refresh, mapping API errors, building list endpoints with query params, uploading or downloading files, or cancelling and retrying requests. |
| [`frontend-architecture`](skills/shared/frontend-architecture/SKILL.md) | Analyze an existing React or Angular codebase's structure before changing it, then add features inside clear boundaries - feature-based vs layered folders, component boundaries, dependency direction rules, public APIs, and when domain folders pay off. Use when adding a new feature or route, moving files between folders, deciding where new code belongs, reviewing imports that cross features, planning a folder restructure, or when the user asks about project structure, module boundaries, or scalable frontend architecture. |
| [`frontend-code-quality`](skills/shared/frontend-code-quality/SKILL.md) | Write and refactor React and Angular TypeScript code that stays readable and safe to change - single-responsibility components, hooks and services, dependency inversion via props and DI, rule-of-three abstraction, naming conventions, strict typing without any, and behaviour-preserving refactors. Use when writing new frontend code, refactoring a large component or service, removing duplication, fixing any or unsafe casts, naming things, or when the user asks to clean up, simplify, or improve maintainability of frontend code. |
| [`frontend-code-review`](skills/shared/frontend-code-review/SKILL.md) | Review a React or Angular TypeScript diff as an agent, prioritizing defects in correctness, types, security, accessibility, performance, tests, and project conventions. Use when reviewing a pull request, staged diff, commit, patch, or proposed frontend change, or when asked to find bugs or provide code-review comments. |
| [`frontend-documentation`](skills/shared/frontend-documentation/SKILL.md) | Write and maintain the minimum useful documentation for frontend codebases — feature READMEs, Architecture Decision Records (ADRs), TSDoc for public APIs, Storybook stories, CHANGELOG entries, and PR descriptions that explain decisions. Use when adding a feature module, shared component library API, architectural change, breaking change, release, or when asked to document, explain, or write an ADR in React or Angular projects. |
| [`frontend-error-handling`](skills/shared/frontend-error-handling/SKILL.md) | Classify, surface, and report errors in React and Angular apps - error taxonomy (network, HTTP 4xx/5xx, validation, unexpected), React error boundaries and root error callbacks, Angular ErrorHandler and global listeners, user-facing messages vs logs, toast vs inline vs page-level display, monitoring hooks, and never swallowing errors. Use when adding error handling to a feature, setting up a global error handler or error boundary, deciding how to show an error to users, wiring Sentry or another monitoring tool, fixing silent failures or empty catch blocks, or when the user asks how errors should be handled. |
| [`frontend-security`](skills/shared/frontend-security/SKILL.md) | Prevent common browser-application vulnerabilities including XSS, CSRF, unsafe token storage, open redirects, insecure postMessage use, exposed secrets, weak client-side authorization, and vulnerable dependencies. Use when implementing authentication, user-generated content, routing, API calls, CSP, or auditing React and Angular frontend code. |
| [`frontend-testing`](skills/shared/frontend-testing/SKILL.md) | Design reliable frontend tests with a practical testing pyramid, Testing Library role-based queries, MSW API mocking, test data builders, and Playwright end-to-end coverage. Use when creating or debugging React or Angular tests, selecting test scope, mocking APIs, addressing flaky tests, or setting meaningful coverage expectations. |
| [`responsive-design`](skills/shared/responsive-design/SKILL.md) | Build layouts that work from small phones to wide desktops using CSS first - mobile-first media queries, breakpoint tokens, container queries, fluid typography with clamp(), grid and flex patterns, responsive tables, responsive images with srcset/sizes, and viewport testing - in React and Angular projects. Use when building or fixing a layout, adding breakpoints, making a component adapt to its container, handling tables or images on mobile, replacing JS window-size logic with CSS, or when the user mentions mobile, tablet, responsive, breakpoints, or layout overflow. |
| [`web-accessibility`](skills/shared/web-accessibility/SKILL.md) | Build and review accessible web interfaces using WCAG 2.2 AA, semantic HTML, keyboard operation, accessible forms, focus management, and assistive-technology testing. Use when creating UI, dialogs, navigation, forms, status messages, or fixing accessibility issues in React or Angular. |
| [`web-performance`](skills/shared/web-performance/SKILL.md) | Measure and improve frontend loading and runtime performance against Core Web Vitals (LCP, INP, CLS) using Lighthouse, the web-vitals library, DevTools Performance panel, bundle analysis, code splitting, lazy loading, image and font optimization, caching, and list virtualization. Use when a page is slow, a bundle grew, Core Web Vitals regressed, adding heavy dependencies or images, or reviewing performance in React or Angular apps. |

### React

| Skill | Description |
|---|---|
| [`ant-design-react`](skills/react/ant-design-react/SKILL.md) | Version-aware Ant Design React guidance for antd 5-6 - ConfigProvider tokens and theming, App.useApp message/modal/notification context, choosing antd Form vs React Hook Form, typed server-side Table with TanStack Query, Modal and Drawer lifecycle, Upload, remote Select, tree-shaking, CSS-in-JS SSR and locale. Use when building an antd UI, configuring its theme, migrating v5 to v6, wiring tables/forms/overlays, or setting up SSR styles. |
| [`react-architecture`](skills/react/react-architecture/SKILL.md) | Structures React applications into feature folders with explicit dependency direction, shared layers, route-based code splitting and correct server/client boundaries. Use when creating or reorganizing a React app, adding a new feature or route, deciding where a component, hook or API call belongs, setting up lazy loading with React.lazy or router lazy routes, or working in a Next.js App Router project with Server Components and 'use client'. |
| [`react-components`](skills/react/react-components/SKILL.md) | Designs reusable React components through composition, explicit prop contracts, controlled state and accessible interaction patterns, accounting for React 18 and React 19 APIs. Use when creating or refactoring a component, designing children/slot/compound APIs, deciding controlled versus uncontrolled behavior, fixing keys or prop drilling, implementing modals, drawers, forms, or loading/empty/error states, or adopting React 19 Actions and ref props. |
| [`react-forms`](skills/react/react-forms/SKILL.md) | Typed React forms with React Hook Form 7, Zod 4 and @hookform/resolvers - schema-driven validation, z.input vs z.output types, Controller for antd and other controlled inputs, field arrays, server errors via setError, reusable field components, submit and dirty state, reset with server data, accessible error messages, and React 19 form actions for simple cases. Use when building or refactoring a form, adding validation, mapping API validation errors to fields, wiring antd/MUI inputs to react-hook-form, or choosing between RHF and useActionState. |
| [`react-hooks`](skills/react/react-hooks/SKILL.md) | Applies React hook rules and designs custom hooks, effects and external-store subscriptions without stale closures or redundant state. Use when adding or reviewing a hook, useEffect, useRef, useReducer, useSyncExternalStore, useId, useTransition or useDeferredValue, diagnosing dependency or cleanup bugs, or checking React Compiler memoization behavior. |
| [`react-performance`](skills/react/react-performance/SKILL.md) | Measure-first React performance guidance - Profiler and Performance panel workflow, React Compiler 1.0 vs manual memo, React.memo/useMemo/useCallback only where measured, re-render reduction (state colocation, children as props, context splitting, store selectors), list virtualization, useTransition/useDeferredValue, route code splitting, bundle analysis and image loading. Use when a React screen is slow, typing lags, lists are large, bundles are big, Core Web Vitals regress, or someone proposes adding memoization. |
| [`react-router`](skills/react/react-router/SKILL.md) | Version-aware React Router guidance for v6, v7 and v8 in declarative, data (createBrowserRouter) and framework modes - route config, nested layouts, lazy routes, loaders/actions, middleware, auth and role guards, search params as state, error boundaries, 404 and navigation blocking. Use when adding or changing routes, protecting pages, wiring loaders or actions, syncing filters to the URL, handling route errors, or upgrading react-router-dom to react-router. |
| [`react-state-management`](skills/react/react-state-management/SKILL.md) | Classifies React state and places it in the right owner — component state, URL search params, form library, TanStack Query cache, React Context, Zustand or Redux Toolkit — with minimal global state. Use when deciding where state should live, adding a store or context, fixing prop drilling or excessive re-renders from context, syncing filters or pagination to the URL, or working in a project that uses Zustand, Redux Toolkit or RTK Query. |
| [`react-testing`](skills/react/react-testing/SKILL.md) | Behaviour-focused React testing with Vitest (or the project's Jest), React Testing Library 16, user-event, a renderWithProviders helper (fresh QueryClient, memory router), MSW 3 network mocking, renderHook, async queries, and Playwright for critical end-to-end flows. Use when writing or fixing component, hook, form, routing or data-fetching tests, setting up a test harness, mocking APIs, debugging flaky async tests, or deciding unit vs e2e coverage. |
| [`tanstack-query`](skills/react/tanstack-query/SKILL.md) | Implements server-state fetching, caching, mutations and invalidation with TanStack Query v5 for React, including query key factories, queryOptions, optimistic updates, pagination, infinite queries, prefetching and testing. Use when a React project uses @tanstack/react-query (or react-query v4), when adding data fetching, mutations, cache invalidation or loading/error handling for API data, or when replacing useEffect-based fetching. |
| [`typescript-react`](skills/react/typescript-react/SKILL.md) | Types React components, hooks, events, refs and API data under strict TypeScript without any or unsafe assertions. Use when writing or reviewing .tsx files, typing props, children, generic or polymorphic components, discriminated union props, event handlers, refs, context, reducers, API DTOs or zod schemas, or when fixing TypeScript errors in a React 18 or 19 project. |

### Angular

| Skill | Description |
|---|---|
| [`angular-architecture`](skills/angular/angular-architecture/SKILL.md) | Design Angular application structure, feature boundaries, route loading, provider scope, environment configuration, and dependency direction. Use when adding features, routes, modules, providers, or reorganizing an Angular app. |
| [`angular-http`](skills/angular/angular-http/SKILL.md) | Configure Angular HttpClient, interceptors, auth refresh, error mapping, retries, typed APIs, uploads/downloads, XSRF, route guards, and permission directives. Use when calling backend APIs, adding interceptors or auth headers, protecting routes, or handling file transfer in Angular. |
| [`angular-performance`](skills/angular/angular-performance/SKILL.md) | Measure and improve Angular runtime and load performance with OnPush, signals, zoneless change detection, @for track, @defer, lazy routes and preloading, cheap templates, NgOptimizedImage, bundle budgets and analysis, SSR with incremental hydration, and the Angular DevTools profiler. Use when an Angular app is slow, bundles are large, budgets fail, Core Web Vitals regress, or when reviewing Angular code for performance. |
| [`angular-reactive-forms`](skills/angular/angular-reactive-forms/SKILL.md) | Build strictly typed Angular reactive forms with FormGroup<T>, NonNullableFormBuilder, FormArray rows, sync/cross-field/async validators, server error mapping, config-driven forms, ControlValueAccessor components and accessible error display. Use when creating or reviewing Angular forms, validators, form arrays, custom form controls, or deciding between reactive forms and Signal Forms. |
| [`angular-services`](skills/angular/angular-services/SKILL.md) | Design Angular injectable services, DI scopes, typed configuration tokens, and signal-backed state. Use when adding shared logic, application state, configuration providers, or choosing service lifetime. |
| [`angular-signals`](skills/angular/angular-signals/SKILL.md) | Model Angular reactive state with signals, computed values, effects, resources, RxJS interop, queries, and zoneless change detection. Use when adding signal state, replacing reactive state patterns, or working with Angular resource APIs. |
| [`angular-standalone-components`](skills/angular/angular-standalone-components/SKILL.md) | Build and migrate Angular standalone components, templates, bindings, content projection, control flow, and deferred views. Use when authoring components, reviewing templates, or incrementally adopting standalone APIs. |
| [`angular-testing`](skills/angular/angular-testing/SKILL.md) | Write and fix Angular unit, component, HTTP, router and e2e tests with the project's existing runner (Vitest, Jest via jest-preset-angular, or Karma/Jasmine), TestBed with standalone components, HttpTestingController, Angular Testing Library, CDK component harnesses, zoneless-friendly async, signal inputs and Playwright. Use when adding or debugging Angular tests, choosing a runner, or testing components, services, guards, interceptors or routes. |
| [`devextreme-angular`](skills/angular/devextreme-angular/SKILL.md) | Build DevExtreme Angular screens, especially DataGrid with remote operations through CustomStore, editing, master-detail, Excel/PDF export, virtual scrolling, themes, localization and license key setup. Use when working with devextreme-angular, dx-data-grid, CustomStore, loadOptions, or DevExtreme licensing and theming. |
| [`ng-zorro`](skills/angular/ng-zorro/SKILL.md) | Build ng-zorro-antd UIs with Angular, including standalone imports, providers, Less and CSS-variable themes, server-paged nz-table, reactive nz-form, modal/drawer, remote nz-select, upload and tree-shaken icons. Use when adding or maintaining ng-zorro-antd components. |
| [`ngx-translate`](skills/angular/ngx-translate/SKILL.md) | Set up and use @ngx-translate/core for runtime i18n in Angular, covering functional providers, HTTP loader with lazy files, pipe vs instant vs stream, key naming, interpolation, fallback language, persisted language switching, missing-translation handling, SSR-safe init and testing. Use when adding translations, switching languages at runtime, upgrading ngx-translate v16/v17 to v18, or choosing between ngx-translate and @angular/localize. |
| [`rxjs-patterns`](skills/angular/rxjs-patterns/SKILL.md) | Compose Angular asynchronous workflows with RxJS operators, lifecycle-safe subscriptions, interop, and stream testing. Use when implementing search, concurrent requests, event streams, Observable state, or debugging subscriptions. |

<!-- catalog:end -->

## Installation

Installation uses the [Skills CLI](https://github.com/vercel-labs/skills) (`npx skills`), which needs **Node.js 22.20 or later**. The commands below were tested with `skills@1.9.0`.

**Project install is recommended:** run these commands from your application repository. Skills are installed into that project's agent directory, can be committed, and shared with teammates. The CLI prompts you to choose skills and agents unless you pass flags.

### Install one skill manually

For a single skill, use the Skills CLI directly. For a complete React or Angular bundle, use the framework installer above to avoid the flat picker.

```bash
npx skills add N6mnguyen/frontend-agent-skills --skill react-architecture -a claude-code -y
```

### Install all skills

```bash
# All skills to all detected agents, no prompts
npx skills add N6mnguyen/frontend-agent-skills --all

# All skills to a specific agent
npx skills add N6mnguyen/frontend-agent-skills --skill '*' -a claude-code -y
```

Skills are installed by **name**, not by folder path. The repository keeps `skills/shared/`, `skills/react/` and `skills/angular/` separate; the CLI flattens installed skills into the chosen agent directory.

### Framework bundles

Run the language-first installer from your application project. It discovers skills from category folders, installs all skills for the selected framework plus all shared skills, then lets you choose an agent. No flat picker.

```bash
npx github:N6mnguyen/frontend-agent-skills
```

### Shared skills (optional)

Shared practices được cài cùng bundle React/Angular ở trên. Lệnh dưới đây chỉ dùng khi muốn cài riêng một vài shared skills:

```bash
npx skills add N6mnguyen/frontend-agent-skills \
  --skill frontend-security --skill web-accessibility \
  -a claude-code -y
```

Add individual shared skills to either framework install when useful. Avoid `--all` unless you intentionally want both framework libraries installed. To install one skill only, pass one `--skill <name>` as in the quick start.

### Choose an agent

| Agent | Skills CLI ID |
|---|---|
| Claude Code | `claude-code` |
| Cursor | `cursor` |
| GitHub Copilot | `github-copilot` |
| OpenAI Codex | `codex` |
| Windsurf | `windsurf` |
| Gemini CLI | `gemini-cli` |
| OpenCode | `opencode` |

Example: install an Angular skill for GitHub Copilot:

```bash
npx skills add N6mnguyen/frontend-agent-skills --skill angular-signals -a github-copilot -y
```

### Global install (documented, not tested)

Add `-g` to install for your user account instead of the current project. Global install paths are documented by the CLI but were not tested for this repository:

```bash
npx skills add N6mnguyen/frontend-agent-skills --skill react-architecture -a claude-code -g
```

### Pin a release

```bash
npx skills add N6mnguyen/frontend-agent-skills@v1.0.0 --skill react-hooks
```

### Without the CLI

Copy a skill folder, for example `skills/react/tanstack-query/`, into your agent's skills directory (see the table below). Each skill folder is self-contained.

## Agent compatibility

Install paths and agent IDs come from the Skills CLI. Project installs were tested on 2026-11-25 with `skills@1.9.0` by installing one skill per agent ID into an empty project.

| Agent | `-a` ID | Project install path | Global install path (`-g`) | Tested |
|---|---|---|---|---|
| Claude Code | `claude-code` | `.claude/skills/` | `~/.claude/skills/` | Project install ✓ |
| Cursor | `cursor` | `.agents/skills/` | `~/.cursor/skills/` | Project install ✓ |
| GitHub Copilot | `github-copilot` | `.agents/skills/` | `~/.copilot/skills/` | Project install ✓ |
| OpenAI Codex | `codex` | `.agents/skills/` | `~/.agents/skills/` | Project install ✓ |
| Windsurf | `windsurf` | `.windsurf/skills/` | `~/.codeium/windsurf/skills/` | Project install ✓ |
| Gemini CLI | `gemini-cli` | `.agents/skills/` | `~/.gemini/skills/` | Project install ✓ |
| OpenCode | `opencode` | `.agents/skills/` | `~/.config/opencode/skills/` | Project install ✓ |

Global paths are taken from the [CLI's agent table](https://github.com/vercel-labs/skills/blob/main/docs/agents.md) and were not installed during testing. Several agents share `.agents/skills/`, so one copy serves all of them. "Tested" means the CLI placed the files in the right location. Whether and when an agent loads a skill depends on that agent's own skills support; see its documentation.

## Usage

After installation, skills activate automatically: the agent reads each skill's `description` and loads the full skill when a task matches. You don't need to change how you prompt.

| You ask | Skills the agent is likely to load |
|---|---|
| "Add a paginated users table with server-side sorting" | `tanstack-query`, `ant-design-react` or `ng-zorro`, `frontend-api-integration` |
| "Refresh the access token when the API returns 401" | `frontend-api-integration`, `angular-http`, `frontend-security` |
| "Convert this component to signals" | `angular-signals`, `angular-standalone-components` |
| "Why does this page re-render so often?" | `react-performance`, `react-hooks` |
| "Review my PR" | `frontend-code-review` plus the framework skills for the files touched |

To use a skill explicitly, name it in your prompt, for example: *"Use the angular-reactive-forms skill to build the address form."* In Claude Code, installed skills are also available as `/skill-name`.

To try a skill without installing it:

```bash
npx skills use N6mnguyen/frontend-agent-skills@react-hooks --agent claude-code
```

## Updating and uninstalling

```bash
npx skills list                      # installed skills and the agents that have them
npx skills check                     # look for newer versions
npx skills update -y                 # update all tracked GitHub skills in this project
npx skills update tanstack-query     # update one skill
npx skills remove tanstack-query     # remove one skill from every agent
npx skills remove N6mnguyen/frontend-agent-skills   # remove every skill from this repository
```

Add `-g` to act on global installs, and `-y` to skip prompts. `check` and `update` work only for skills installed from a Git source; a skill installed from a local path is not tracked for updates.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [authoring standard](AUTHORING.md), then start from the [skill template](templates/skill/SKILL.template.md).

```bash
npm test                  # validator self-tests
npm run validate          # validate every skill
npx skills add . --list   # confirm the Skills CLI discovers your skill
```

CI runs all three checks on every pull request. Sources and attribution are listed in [NOTICE.md](NOTICE.md).

## Roadmap

- [ ] Remove every remaining `[VERIFY]` marker by checking it against official docs
- [ ] Angular Material and CDK skill
- [ ] Next.js App Router / React Server Components skill
- [ ] Nx and monorepo boundaries skill
- [ ] Storybook and design-system documentation skill
- [ ] Micro-frontend (Module Federation / Native Federation) skill
- [ ] Evals: sample tasks per skill to measure whether agents trigger the skill and follow it

## License

[MIT](LICENSE)
