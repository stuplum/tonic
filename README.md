# Tonic

Tonic draws attention to implementation artifacts when an executable requirement changes.

The requirement remains the source of desired behaviour. Tonic records only its stable ID, source file, affected files, and last acknowledged fingerprint. It does not generate design documentation, prescribe implementation changes, or turn feature work into an ADR.

## Repository workflow

Initialise Tonic in a repository:

```sh
tonic init
```

Link an executable requirement to the files that should be reconsidered when it changes:

```sh
tonic add KIP-081 \
  --source features/KIP-081-local-verification-fixtures.feature \
  --affects apps/public/src/utils/verifier.ts \
  --affects libs/services/verifier/src/fixture-verifier.ts
```

Run the required attention check before an agent implements a feature and in CI:

```sh
tonic check
```

An unchanged repository exits successfully without output. A changed requirement exits unsuccessfully and lists the affected files to reconsider:

```text
KIP-081 changed.
Reconsider:
- apps/public/src/utils/verifier.ts
- libs/services/verifier/src/fixture-verifier.ts
```

After the current requirement and every affected file have been reconsidered, record the reviewed version:

```sh
tonic acknowledge KIP-081
```

`acknowledge` is the end of the review, not a way to silence `check` before reviewing the change.

## Repository files

- `tonic.json` is human-authored relationship metadata and belongs in version control.
- `tonic.lock` contains generated requirement fingerprints and belongs in version control.
- Existing Gherkin, implementation, tests, documentation, and ADRs remain where they already live.

## Development

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm pack --dry-run
```
