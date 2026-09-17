Feature: Compile executable requirements into implementation context
  Gherkin remains the readable source of business behaviour.
  Tonic discovers its implementation relationships from successful execution.

  Scenario: Record the requirement that exercises an implementation file
    Given an initialised project
    And executable requirement "PAY-001" exercises "src/payment.ts"
    When I run "tonic test"
    Then the command succeeds
    And compiled context for "src/payment.ts" links to requirement "PAY-001"
    And no manual requirement links are configured

  Scenario: A changed requirement invalidates its discovered implementation context
    Given an initialised project
    And executable requirement "PAY-001" exercises "src/payment.ts"
    When I run "tonic test"
    Then the command succeeds
    When requirement "PAY-001" has changed
    And I run "tonic check"
    Then the command fails
    And the command reports that "PAY-001" changed
    And the command reports "src/payment.ts" for reconsideration
