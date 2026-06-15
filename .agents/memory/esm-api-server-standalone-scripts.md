---
name: Running api-server ESM code in one-off scripts
description: How to execute a function from the ESM, esbuild-bundled api-server outside the server
---

# Don't try to run api-server modules with tsx/scripts

`artifacts/api-server` is `"type": "module"` and ships as an esbuild bundle
(`build.mjs`), not via tsx. Attempts to import its modules from a one-off script
fail several ways: the `@workspace/scripts` package is CJS (drizzle-orm dual-
package + top-level-await errors), and tsx from `/tmp` can't resolve workspace
paths or `@workspace/*`.

**What works:** write the throwaway entry *inside* `artifacts/api-server/src/`
(so workspace + relative imports resolve), then bundle it the same way the server
is built and run the bundle:

```
node -e "import('esbuild').then(({build})=>build({
  entryPoints:['src/_tmp.ts'], platform:'node', bundle:true, format:'esm',
  outfile:'/tmp/x.mjs', external:['pg-native','*.node'],
  banner:{js:\"import {createRequire as cr} from 'node:module'; globalThis.require=cr(import.meta.url);\"}
}))"
node /tmp/x.mjs <args>
```

Wrap logic in an async `main()` (no top-level await), `DATABASE_URL` is already
in env, and delete the temp src file afterward.

**Why:** lets you exercise real server functions (e.g. verify `persistRoadmap`
status preservation against the live DB) without standing up the whole server or
fighting CJS/ESM resolution.
