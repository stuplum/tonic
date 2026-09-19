Feature: Fail clearly when executable requirement discovery is unreliable
  Tonic must either compile trustworthy context or explain why it cannot.

  Scenario: Use the repository's base TypeScript configuration
    Given an empty project
    And an executable requirement uses aliases from "tsconfig.base.json"
    When I run "tonic test"
    Then the command succeeds
    When I run "tonic context src/payment.ts"
    Then the command succeeds
    And the command returns the current Gherkin for requirement "PAY-001"

  Scenario: Reject a test run when no executable requirements match
    Given an empty project
    When I run "tonic test"
    Then the command fails
    And the command reports that no executable requirements matched

  Scenario: Reject a test run when no step definitions match
    Given an empty project
    And an executable requirement exists without step definitions
    When I run "tonic test"
    Then the command fails
    And the command reports that no step definitions matched
