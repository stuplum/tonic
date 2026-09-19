# Changelog

## 0.1.0 - 2026-09-19

Initial experimental release.

- Runs executable Gherkin through the bundled Cucumber runner.
- Discovers implementation relationships from successful scenario execution.
- Retrieves live Gherkin context for an implementation file.
- Reports changed requirements and the implementation that must be reconsidered.
- Records explicit acknowledgement after that reconsideration.
- Supports default discovery and optional path overrides without depending on Nx.
