# Changelog

## Unreleased

- Adds a standalone architecture-decision language with a distributable EBNF grammar and source-located AST.
- Discovers `.decision` files and resolves their `Driven by requirement` relationships to tagged Gherkin.
- Makes `tonic check` surface the complete live requirement and decision sources when a tracked Gherkin file differs from `HEAD`, without decision fingerprints or generated decision state.

## 0.1.1 - 2026-09-22

- Supports Node.js 20, 22, and 24 when loading TypeScript acceptance steps and resolving TSX coverage sources.
- Enforces one requirement ID per feature and parses IDs from Gherkin tags rather than comments or scenario data.
- Warns when executable features have no requirement ID.
- Supports absolute artifact paths and treats missing compiled context as a successful empty query.
- Avoids attributing imported-but-unexecuted modules to a requirement.
- Reports missing requirement source files clearly.
- Forces single-worker Cucumber execution so baseline and requirement coverage remain comparable.

## 0.1.0 - 2026-09-19

Initial experimental release.

- Runs executable Gherkin through the bundled Cucumber runner.
- Discovers implementation relationships from successful scenario execution.
- Retrieves live Gherkin context for an implementation file.
- Reports changed requirements and the implementation that must be reconsidered.
- Records explicit acknowledgement after that reconsideration.
- Supports default discovery and optional path overrides without depending on Nx.
