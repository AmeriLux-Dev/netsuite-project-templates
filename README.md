# netsuite-project-templates

The project templates that [create-netsuite-project](https://github.com/AmeriLux-Dev/create-netsuite-project) renders.

```sh
npm create netsuite-project@latest MyApp
```

The CLI downloads one template folder from this repository at a git ref (`main` by default), substitutes tokens, and writes the result. Nothing here runs on its own: the files under `react-app/` contain `{{tokens}}` and are not a valid project until rendered.

## Layout

```
react-app/            Suitelet-hosted React application: Vite client, webpack AMD API, one script per controller, job or event
scripts/e2e.mjs       renders react-app with the CLI, then installs, generates, typechecks, lints, tests and builds the result
scripts/checkSnippets.mjs   expands every VS Code snippet of react-app into the e2e scaffold and typechecks the result (run by e2e.mjs)
scripts/check-no-private-refs.mjs   fails when anything account-specific leaks in
.github/workflows/    CI: the end-to-end check on Linux and Windows against the CLI's main branch, plus a secret scan
```

Each template is one folder at the repository root, and the CLI's `--project-type` picks the folder. The CLI README describes what `react-app` produces.

## Template language

The CLI's `src/template/render.ts` is the source of truth; in short:

- `{{token}}` is substituted in text files (`.ts`, `.tsx`, `.js`, `.cjs`, `.mjs`, `.json`, `.html`, `.xml`, `.md`, `.css`, `.yml`, `.yaml`, `.txt`, `.example`) and in file names. Tokens: `appName`, `appNameKebab`, `appTitle`, `prefix`, `author`, `description`, `cliVersion`, `year`, `templateRef`, `projectType`, `performanceTrackerJson`, `probityJson`.
- `{{#if flag}}…{{/if}}` and `{{#unless flag}}…{{/unless}}` keep or drop a block; blocks nest. Flags: `performanceTracker`, `probity`.
- `template.json` → `conditionalPaths` maps a file to the flag that must be on for it to be written. The manifest itself is never copied.
- `_gitignore` and `_npmrc` are written as `.gitignore` and `.npmrc`, so the template survives npm's stripping of those names should it ever ship inside a package.

## Testing a change

```sh
node scripts/e2e.mjs --cli ../create-netsuite-project   # a CLI checkout; run npm run build there first
node scripts/e2e.mjs                                     # the published CLI, through npx create-netsuite-project@latest
node scripts/e2e.mjs --keep                              # leave the scratch project in the OS temp dir for inspection
```

The check scaffolds `DemoApp` into the OS temp directory, installs, generates, typechecks, lints, tests and builds it, adds a Restlet and a Suitelet controller, sets up jobs with `npm run add:jobs` and builds the job it writes, and asserts the File Cabinet output and the deploy guard. It needs Node 22 or newer and Java 17 or newer (for the SuiteCloud CLI).

## Releasing

There is no release step. The CLI scaffolds from `main` by default, so a merge here reaches the next scaffold immediately. Keep `main` green: the scaffold check below is the gate, and branch protection should require it. Tags are optional bookmarks that users can freeze to with `--ref <tag>`.

The `version` in `react-app/package.json` is the starting version of every scaffolded project (it feeds the bundle URL), not the version of this template. Leave it at 0.1.0.

A template change that needs a CLI change lands in the CLI first: CI here scaffolds with the CLI's `main` branch. Set the `CREATE_NETSUITE_PROJECT_REF` repository variable to test against another branch or tag.

## Security

This repository is public. Nothing account-specific belongs here: no account ids, authentication ids, `project.json`, `.env` files, keys or certificates. CI runs gitleaks and `scripts/check-no-private-refs.mjs` on every push.

## License

[MIT](./LICENSE)
