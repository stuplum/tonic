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
tonic add PAY-001 \
  --source features/PAY-001-take-payment.feature \
  --affects src/payment.ts \
  --affects src/payment-gateway.ts
```

Run the required attention check before an agent implements a feature and in CI:

```sh
tonic check
```

An unchanged repository exits successfully without output. A changed requirement exits unsuccessfully and lists the affected files to reconsider:

```text
PAY-001 changed.
Reconsider:
- src/payment.ts
- src/payment-gateway.ts
```

After the current requirement and every affected file have been reconsidered, record the reviewed version:

```sh
tonic acknowledge PAY-001
```

`acknowledge` is the end of the review, not a way to silence `check` before reviewing the change.

Run the repository's executable requirements with the Cucumber runtime bundled by Tonic:

```sh
tonic test
```

By default, Tonic loads `features/**/*.feature` and
`features/step_definitions/**/*.ts`. Step definitions import Cucumber from the
package supplied by Tonic:

```ts
import { Given, Then, When } from "tonic/cucumber";
```

Repositories can override the paths in `tonic.json`:

```json
{
  "version": 1,
  "requirements": {},
  "cucumber": {
    "features": ["specifications/**/*.feature"],
    "steps": ["specifications/support/**/*.ts"]
  }
}
```

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

Link a development checkout into a consumer without changing the consumer's
package manifest:

```sh
cd /path/to/tonic
npm link

cd /path/to/consumer
npm link --no-save --package-lock=false tonic
```

`npm link` runs Tonic's `prepare` script, so `dist` is rebuilt before the link
is used. The consumer can then invoke `tonic` from its existing package or Nx
scripts.
