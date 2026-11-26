# Contributing

Thanks for helping improve these skills. Quality beats quantity: one accurate, specific skill is worth more than five generic ones.

## Ground rules

- Write original text. Do not paste from other skill repositories, blog posts or docs. Paraphrase, verify, credit ideas in [NOTICE.md](NOTICE.md).
- Repositories without a license grant no reuse rights. Do not copy from them at all.
- No secrets, internal URLs, company names or customer data in examples.
- Every factual claim about an API or version must be checked against official docs. If you could not check it, mark it `[VERIFY]` inline.

## Adding or changing a skill

1. Read [AUTHORING.md](AUTHORING.md).
2. Copy [templates/skill/SKILL.template.md](templates/skill/SKILL.template.md) to `skills/<category>/<skill-name>/SKILL.md`.
3. Fill every required section. Keep `SKILL.md` under 500 lines; move long examples to `references/`.
4. Bump `metadata.version` (semver) and set `metadata.last-reviewed` when you change an existing skill.
5. Run the checks:

   ```bash
   npm test            # validator self-tests
   npm run validate    # all skills
   npx skills add . --list   # confirms the Skills CLI discovers your skill
   ```

6. Add a line to [CHANGELOG.md](CHANGELOG.md) under `Unreleased`.
7. Open a PR. Describe what changed, which docs you verified against, and any `[VERIFY]` markers left.

## Review criteria

Reviewers check each skill for:

| Area | Question |
|---|---|
| Technical correctness | Do the examples compile under `strict`? Are the APIs real and current? |
| Version compatibility | Does it detect the project version and branch where APIs differ? No deprecated APIs recommended? |
| Clarity | Could an agent act on every rule without guessing? |
| Practical usefulness | Does it cover the decisions real projects face, not textbook basics? |
| Security | No unsafe patterns (raw HTML, tokens in `localStorage` without discussion, secrets in bundles). |
| Maintainability | Is it short enough to keep current? Are volatile details isolated in `references/`? |
| Triggering | Does the `description` name the libraries, tasks and phrasings that should activate it? |

## Reporting problems

Open an issue with the skill name, what the agent did wrong, and the project versions involved. Outdated APIs are bugs.
