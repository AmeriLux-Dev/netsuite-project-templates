# netsuite-project-templates

The project templates that [create-netsuite-project](https://github.com/AmeriLux-Dev/create-netsuite-project) renders.

```sh
npm create netsuite-project@latest MyApp
```

The CLI downloads one template folder from this repository at a pinned git ref, substitutes tokens, and writes the result. Nothing here runs on its own: the files under `react-app/` contain `{{tokens}}` and are not a valid project until rendered.

## Layout

```
react-app/            Suitelet-hosted React application: Vite client, webpack AMD API, one script per controller
scripts/e2e.mjs       renders react-app with the CLI, then installs, generates, typechecks, lints, tests and builds the result
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

The check scaffolds `DemoApp` into the OS temp directory, installs, generates, typechecks, lints, tests and builds it, adds a Restlet and a Suitelet controller, and asserts the File Cabinet output and the deploy guard. It needs Node 22 or newer and Java 17 or newer (for the SuiteCloud CLI).

## Releasing

Tag `v<x.y.z>` and push the tag. Then set `templateSource.ref` in the CLI's `package.json` to that tag and release the CLI; a CLI release always scaffolds from the ref pinned in it, so a new tag here changes nothing for users until the CLI picks it up. Tags here and CLI versions are independent; the pin is the only link between them.

The `version` in `react-app/package.json` is the starting version of every scaffolded project (it feeds the bundle URL), not the version of this template. Leave it at 0.1.0.

A template change that needs a CLI change lands in the CLI first: CI here scaffolds with the CLI's `main` branch. Set the `CREATE_NETSUITE_PROJECT_REF` repository variable to test against another branch or tag.

## Security

This repository is public. Nothing account-specific belongs here: no account ids, authentication ids, `project.json`, `.env` files, keys or certificates. CI runs gitleaks and `scripts/check-no-private-refs.mjs` on every push.

## License

[MIT](./LICENSE)
