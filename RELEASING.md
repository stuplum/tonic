# Releasing

Tonic is published as the public npm package `@stuplum/tonic`. The executable
installed by the package is still named `tonic`.

## Prerequisites

- Confirm the release version and changelog entry.
- Confirm the `@stuplum` npm scope is controlled by the maintainer.
- Authenticate with npm using `npm login`.
- Ensure the default branch passes GitHub Actions.

## Publish

```sh
pnpm install --frozen-lockfile
pnpm verify
npm publish --access public
```

After npm accepts the package, create and push a matching `v0.1.0` tag and make
a GitHub release from the changelog entry. Do not create the tag before npm
publication succeeds.
