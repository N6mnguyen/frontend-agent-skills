# Skill Authoring Standard

Every skill in this repository follows the [Agent Skills Specification](https://agentskills.io/specification) plus the rules below. `npm run validate` enforces the mechanical ones.

## Layout

```
skills/<category>/<skill-name>/
├── SKILL.md              # required, < 500 lines
└── references/*.md       # optional deep dives, linked from SKILL.md, one level deep
```

- `<category>` is `shared`, `react` or `angular`.
- `<skill-name>` is globally unique across categories. The Skills CLI installs by name, so `performance` in two folders would collide. Prefix with the framework (`react-performance`, `angular-performance`).
- A skill never links outside its own folder. Users install skills one at a time; a link to `../other-skill/` breaks after install. Refer to other skills by name in prose ("see the `frontend-security` skill").

## Frontmatter

```yaml
---
name: tanstack-query                # = directory name, kebab-case, <= 64 chars
description: <what it does>. Use when <triggers>.   # <= 1024 chars, must contain "Use when"
license: MIT
metadata:
  category: react                   # = parent folder
  version: "1.0.0"                  # semver, quoted
  frameworks: "@tanstack/react-query 5"
  last-reviewed: "2026-11-25"
---
```

Values stay on one line. No block scalars (`>` / `|`).

## Body

Required `##` sections, in order: Purpose, When to Use, Workflow, Best Practices, Anti-patterns, Implementation Examples, Validation Checklist. Optional: References.

Writing rules:

1. **Detect first.** The Workflow starts by reading the project (package.json versions, config, existing folders) and branches on what it finds. Never assume a greenfield project.
2. **Follow the project.** Existing conventions beat this skill's preferences. Say so explicitly where it matters.
3. **Version-aware.** When an API differs across supported versions, say which version introduced it and what to use on older ones. No deprecated APIs in recommended code.
4. **Specific over generic.** Every rule should be something an agent can act on or check. Cut sentences that would fit in any skill.
5. **Correct examples.** Code compiles under `strict: true`. Include imports. Mark the file path in a comment.
6. **Unverified claims get `[VERIFY]`.** If a version number, API name or behaviour was not checked against official docs, mark it inline with `[VERIFY]`. The validator counts these; releases aim for zero.
7. **Original wording.** Read community skills for ideas, never paste them. If a structure or idea comes from a specific source, credit it in `NOTICE.md`.
