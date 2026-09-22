# CLAUDE.md review

`react-app/CLAUDE.md` was cut to what the agent needs on every task. The rest moved to per-folder rules that Claude
Code loads when the agent reads a file in that folder, to hooks that hold the agent to the standards, or to the
`how-to-use/` docs that already covered it. This file is at the repository root, so it is never scaffolded; delete
it once the decisions below are settled.

## Size

| | Before (HEAD) | After |
|---|---|---|
| CLAUDE.md, rendered with Probity | 58 lines, 23,117 bytes, 3,429 words | 42 lines, 5,826 bytes, 839 words (−75%) |
| CLAUDE.md, rendered without Probity | 64 lines, 23,223 bytes, 3,420 words | 42 lines, 5,532 bytes, 791 words (−76%) |
| `.claude/rules/*.md`, loaded per folder | — | 769 to 2,791 bytes each, 13,163 in all |

`@file` imports were not used: Claude Code expands them at startup, so they save nothing.

## Where each part went

| Old CLAUDE.md | Now |
|---|---|
| Intro | CLAUDE.md intro, shorter |
| Commands table, "every root command runs generate", "before a commit" | CLAUDE.md Commands. What `add:jobs` adds is in `how-to-use/jobs/map-reduce-job.md`, Steps |
| Adding a script: the four kinds, the recipes | CLAUDE.md Layout, and the "Folder rules" bullet pointing at the worked examples |
| Adding a script: the snippet list | Dropped from CLAUDE.md. Snippets are for a person in VS Code; the table in `how-to-use/folder-structure.md` (".vscode/") lists them |
| Adding a script: ids written once, lint fails until the pieces agree | CLAUDE.md Standards: "Ids are written once", "The tooling holds the rest" |
| Where things live: `netsuite.ts`, the two halves, `user` / `userRoles` as reference, `_host/`, `netsuite/`, flat layout | CLAUDE.md Layout |
| Where things live: the wire package entries | `.claude/rules/api.md` (ESLint enforces it) |
| Where things live: `api/src/jobs/` | `.claude/rules/jobs.md`; progress and refresh in full in `map-reduce-job.md`, "Following a run" |
| Where things live: `api/src/events/` | `.claude/rules/events.md` |
| Where things live: `api/src/controllers/` | `.claude/rules/controllers.md`; the generator's rules in full in `restlet-controller.md` |
| Where things live: services | `.claude/rules/services.md` |
| Where things live: repositories, specifications, models, Suitelet client | `.claude/rules/data-access.md` |
| Where things live: `client/src/` | `.claude/rules/client.md` |
| Where things live: tests | `.claude/rules/tests.md` |
| Conventions: Naming | CLAUDE.md Standards (the per-layer tables were already in `how-to-use/naming.md`) |
| Conventions: SuiteScript constraints, Logging, layer types | `.claude/rules/api.md` (ESLint enforces the log shape and `console`) |
| Conventions: Script ids | CLAUDE.md "Ids are written once"; `_mr` in `.claude/rules/jobs.md`; the 40-character cap is left to the structure check, whose message names it |
| Conventions: Layers | CLAUDE.md Layout (the call chain), `.claude/rules/api.md` (types per layer); the imports are ESLint's |
| Conventions: Dependencies | CLAUDE.md "Packages" |
| Conventions: Outgrown rules | CLAUDE.md "The tooling holds the rest" |
| Rules (without Probity) | `.claude/hooks/guardrails.mjs` blocks the commands, generated output, secret files and tests next to source, and asks before a deploy; `.claude/hooks/checkWrittenFile.mjs` catches focused or skipped tests; the commit checks and secrets stay as CLAUDE.md lines |
| Guardrails (with Probity) | CLAUDE.md Guardrails, without the list of what Probity blocks (its block message says) |

## Decided while doing it, for you to confirm

1. **The default scaffold now has hooks.** It had none, and `scripts/e2e.mjs` asserted that; the assertion now
   checks the new wiring and runs both hooks. `guardrails.mjs` (only without Probity, via `template.json`) mirrors
   Probity's fixed rules. It reads one tool call at a time, so "tests before a commit", which needs the session's
   history, stays a CLAUDE.md line. A deploy gets `ask` (the person confirms) rather than a block.
2. **`checkWrittenFile.mjs` runs ESLint on every file the agent writes**, in both variants. It skips
   `import-x/no-unresolved` and `no-unused-vars`, which a file written one edit at a time passes through on its way
   to being right. Each write waits for one ESLint run: 1.5 to 2.4 seconds per file on the e2e scaffold.
3. **Four standards moved from prose into that hook, not ESLint**, following your split (the linter holds the
   person, hooks hold the agent): responses written field by field (no object spread in a controller),
   repositories imported as namespaces in services, no `N/*` in models or specifications, no `.only` / `.skip`.
   A person is not held to them. Any one can move to `eslint.config.mjs` if it should be.
4. **Folder rules load when the agent reads a matching file, not when it writes one.** A new file in a folder the
   agent has not read yet (the first event, since the template has none) is written without its rule unless the
   agent follows the CLAUDE.md line telling it to read the rule first.
5. **Your index has staged copies of files that no longer exist**: `.claude/hooks/folder-rules/*.md` and
   `.claude/hooks/lintEditedFile.mjs`. The rules went back to `.claude/rules/` and the lint hook became
   `checkWrittenFile.mjs`. `git add -A react-app/.claude` brings the index in line.

Also changed: `how-to-use/folder-structure.md` (".claude/" section), the `probity.config.ts` header comment, and the
CLI's `README.md` layout line for `.claude/`.
