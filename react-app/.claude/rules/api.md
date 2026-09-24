---
paths:
  - "api/src/**"
---

# api/src

- Server handlers are synchronous. TypeScript emits ES2019 and downlevels newer syntax such as `?.` and `??`.
- A file becomes a deployed script only when its leading JSDoc carries `@NScriptType`; everything else is bundled into the scripts that import it.
- `N/*` imports are rewritten to the telemetry wrapper at build time. Do not add an externals function to `api/webpack.config.js`.
- Logging: the title is the same short phrase every time (`endpoint completed`) and the controller, method and record ids go in the details object; never glue ids into a title or a details string, never `console.log`. With telemetry on, the wrapper adds the run id, the function, its arguments and the call chain to every line; put `@ptrk-ignore-arguments` above a function whose arguments must not be captured.
- Each layer uses the types of the layer directly below it or types it declares itself: a repository uses {{#if netsuiteRepository}}entity types or {{/if}}its own, a service what repositories return or its own, a controller what services return or its own.{{#if netsuiteRepository}} The generated entity types in `types/models.gen.ts` are shared vocabulary above the repository.{{/if}} `lib/` is outside the layers: any of them may call its functions and use its types.
{{#if netsuiteApi}}
- `api/` imports `@amerilux/netsuite-api/server`; the `/client` entry is for `client/`, `/testing` for the vitest configs.
{{/if}}
- Every folder, one section each: `how-to-use/folder-structure.md`.
