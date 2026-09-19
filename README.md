# Tonic

Tonic connects executable Gherkin to the implementation it actually exercises.
The Gherkin remains the readable source of business behaviour for product,
engineering, and agents. Tonic generates only hidden relationship metadata; it
does not generate another description of the requirement.

## Repository workflow

Write an executable requirement with a stable requirement tag:

```gherkin
@PAY-001
Feature: Take a payment
  Scenario: Accept a valid payment
    When the customer submits a valid payment
    Then the payment is accepted
```

Run the executable requirements:

```sh
tonic test
```

For every successful tagged feature, Tonic compares dry-run and real execution
coverage. It records the implementation functions exercised by the scenarios in
`.tonic/compiled/`, mirroring the implementation paths. Step definitions,
dependencies, generated metadata, and code loaded but not exercised are excluded.

Retrieve the current Gherkin relevant to an implementation file:

```sh
tonic context src/payment.ts
```

This reads the live `.feature` file rather than a generated summary. Agents can
therefore request focused business context without loading all repository
documentation.

Add this small rule to the repository's agent instructions so context retrieval
is part of normal implementation work:

```markdown
- Run `tonic check` before implementing a feature or changing architecture.
- Before editing an implementation file, run `tonic context <path>` and treat
  any returned Gherkin as its current business and acceptance contract.
- `No compiled context` means no related executable requirement is known.
- Acknowledge a changed requirement only after reconsidering every reported
  implementation file.
```

The CLI provides the portable mechanism; the repository instruction is the
agent integration. It works inside or outside Nx, but still depends on the agent
following repository instructions.

Run the attention check before changing implementation and in CI:

```sh
tonic check
```

An unchanged repository exits successfully without output. If linked Gherkin has
changed since it was last acknowledged, Tonic exits unsuccessfully and lists the
implementation it previously exercised:

```text
PAY-001 changed.
Reconsider:
- src/payment.ts
```

A successful `tonic test` refreshes the discovered relationships but deliberately
does not clear changed-requirement attention. After reconsidering every reported
implementation file, explicitly record the reviewed requirement version:

```sh
tonic acknowledge PAY-001
```

This acknowledgement does not require or create manual file mappings.

By default, Tonic discovers `features/**/*.feature` and
`features/step_definitions/**/*.ts`. Step definitions import Cucumber from the
package supplied by Tonic:

```ts
import { Given, Then, When } from "tonic/cucumber";
```

No Tonic configuration file is required. Repositories can override discovery
paths with an optional `tonic.json`:

```json
{
  "version": 1,
  "cucumber": {
    "features": ["specifications/**/*.feature"],
    "steps": ["specifications/support/**/*.ts"]
  }
}
```

The automatic discovery candidate covers JavaScript and TypeScript executed in
the bundled Node.js runner. Tonic reports dynamic imports because their module
identity can make coverage relationships unreliable. Other runtimes will
require coverage adapters; they do not require Nx.

## Repository files

- `tonic.json` optionally overrides executable Gherkin discovery paths.
- `.tonic/compiled/` contains generated implementation relationships and belongs in version control.
- Existing Gherkin, implementation, tests, documentation, and ADRs remain where they already live.

Tonic's command surface is deliberately narrow: `test`, `context`, `check`, and
`acknowledge`. Implementation relationships are discovered from successful
execution; they cannot be maintained manually.

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
