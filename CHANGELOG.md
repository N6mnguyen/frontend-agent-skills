# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). Individual skills also carry their own `metadata.version`.

## [Unreleased]

### Added

- Initial set of 34 skills: 11 shared, 11 React, 12 Angular.
- Skill authoring standard (`AUTHORING.md`) and template.
- Zero-dependency validator (`scripts/validate-skills.mjs`): frontmatter, naming, required sections, line limit, broken and escaping links, unclosed code fences, unreferenced `references/` files, duplicate names, `[VERIFY]` marker count.
- GitHub Actions workflow running the validator and a Skills CLI discovery check.
