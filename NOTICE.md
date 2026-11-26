# Sources and Attribution

All skill text in this repository is original. No content was copied from other skill repositories. The sources below were read for format compatibility, fact-checking or ideas, and are credited here.

| Source | License | How it was used |
|---|---|---|
| [Agent Skills Specification](https://agentskills.io/specification) | — | File format, frontmatter rules, progressive-disclosure limits. Enforced by `scripts/validate-skills.mjs`. |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) (Skills CLI) | MIT | Repository layout and discovery rules (`skills/<category>/<name>/`, depth ≤ 3), install commands documented in the README. |
| [angular/skills](https://github.com/angular/skills) | No license file in this mirror at time of review (2026-11-25); its README says the content is generated from `angular/angular` (MIT) | Read only, to cross-check modern Angular API names. No text reused. |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | No license file at time of review (2026-11-25) | Not used as a content source. Listed because it is the reference example the Skills CLI documents. |
| Official framework and library documentation (react.dev, angular.dev, tanstack.com, reactrouter.com, ant.design, ng.ant.design, js.devexpress.com, mswjs.io, playwright.dev, owasp.org, w3.org/WAI, MDN) | various | Fact-checking APIs and version behaviour. Links appear in each skill's References section. |

Repositories without a license grant no reuse rights. Do not copy from them. When contributing, add a row here for any source that shaped a skill's structure or recommendations.
