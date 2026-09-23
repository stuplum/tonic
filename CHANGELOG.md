# Changelog

## Unreleased

- Adds a standalone architecture-decision language with a distributable EBNF grammar and source-located AST.
- Resolves decision drivers to tagged Gherkin, other decisions, or ordinary repository files.
- Adds `tonic review`, which records compact per-decision review receipts for use in local verification and CI.
- Makes `tonic check` reject unreviewed or stale active decisions and surface their complete live sources.
- Validates decision supersession targets, branches, and cycles while preserving superseded decisions as history.

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
