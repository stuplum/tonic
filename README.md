# Tonic

Tonic connects executable Gherkin to the implementation it actually exercises.
The Gherkin remains the readable source of business behaviour for product,
engineering, and agents. Tonic generates only hidden relationship metadata; it
does not generate another description of the requirement.

> **Status:** experimental 0.1 software. The current evidence shows that Tonic
> can provide focused requirement-to-code navigation, but has not yet shown
> enough benefit over ordinary Gherkin, Cucumber, and repository rules to be
> considered established infrastructure.

This repository is currently unlicensed. Its source is public for evaluation,
but no permission to copy, modify, or redistribute it is granted.

## Installation

```sh
pnpm add --save-dev @stuplum/tonic
```

## Repository workflow

### Requirement boundary

Tonic currently treats one `.feature` file as one requirement boundary. A
feature may have one stable requirement ID; multiple requirement IDs in the
same file are rejected because coverage and fingerprints are collected at file
level. This is a deliberate current design decision, not an incidental parser
limitation.

True per-tag attribution would require separate scenario selection, coverage,
and fingerprinting for every requirement ID. That option remains on the
backlog in [issue #1](https://github.com/stuplum/tonic/issues/1) and can be
reconsidered if real repositories need multiple requirements in one feature.

See [ADR 001](docs/decisions/001-feature-file-requirement-boundary.md) for the
decision and trade-offs.

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

Repositories may add a small rule to their agent instructions for on-demand
implementation context:

```markdown
- Before editing an implementation file, run `tonic context <path>` and treat
  any returned Gherkin as its current business and acceptance contract.
- `No compiled context` means no related executable requirement is known.
- Acknowledge a changed requirement only after reconsidering every reported
  implementation file.
```

The CLI provides the portable mechanism and works inside or outside Nx.

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

### Enforceable architecture decisions

Architecture decisions can be written as `.decision` source files:

```text
Decision PAY-003 "Reliable confirmation delivery"
Driven by requirement ORDER-006
Choose durable storage of pending confirmations
Because accepted orders must survive delivery outages
Accept possible duplicate delivery
```

Decisions can be driven by tagged Gherkin, another decision, or any ordinary
repository file:

```text
Driven by requirement ORDER-006
Driven by decision OPS-002
Driven by source requirements/order-confirmation.md
```

Review an active decision once its sources and choice agree:

```sh
tonic review PAY-003
```

This writes a small, generated `.tonic/reviews/PAY-003.json` receipt containing
only content fingerprints and source identities. Commit the receipt. Subsequent
`tonic check` calls fail if the decision or any declared driver changes, and
print the complete live sources that must be reconsidered. The receipt can then
be refreshed if the decision remains valid, or a new `.decision` can supersede
the historical decision.

Supersession is validated as a single, acyclic history. Only active decisions
require current review receipts. This works in a clean CI checkout and does not
depend on Git working-tree state.

Add `tonic check` to the repository's normal verification command so agents and
CI cannot silently bypass decision review. No agent-specific ADR instruction is
required.

A decision is authoritative context, not a mechanically evaluated premise.
Tonic does not report that the decision itself has passed or failed.

By default, Tonic discovers `features/**/*.feature` and
`features/step_definitions/**/*.ts`. Step definitions import Cucumber from the
package supplied by Tonic:

```ts
import { Given, Then, When } from "@stuplum/tonic/cucumber";
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
- `**/*.decision` contains architecture decisions and remains human-authored source.
- `.tonic/compiled/` contains generated implementation relationships and belongs in version control.
- `.tonic/reviews/` contains generated decision-review receipts and belongs in version control.
- Existing Gherkin, implementation, tests, documentation, and ADRs remain where they already live.

Tonic's command surface is deliberately narrow: `test`, `context`, `check`,
`acknowledge`, and `review`. Implementation relationships are discovered from
successful execution; they cannot be maintained manually.

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
npm link --no-save --package-lock=false @stuplum/tonic
```

`npm link` runs Tonic's `prepare` script, so `dist` is rebuilt before the link
is used. The consumer can then invoke `tonic` from its existing package or Nx
scripts.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow and
[RELEASING.md](RELEASING.md) for the maintainer release checklist.
