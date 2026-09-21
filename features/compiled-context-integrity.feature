Feature: Refuse or expose unreliable compiled context
  Generated context must be trustworthy enough to guide implementation work.

  Scenario: Warn when execution uses a cache-busted module identity
    Given an empty project
    And an executable requirement dynamically imports "src/payment.ts" with a query
    When I run "tonic test"
    Then the command succeeds
    And the command warns that dynamic module coverage may be unreliable

  Scenario: Reject duplicate requirement IDs across feature files
    Given an empty project
    And requirement ID "PAY-001" appears in two executable feature files
    When I run "tonic test"
    Then the command fails
    And the command reports duplicate requirement ID "PAY-001"

  Scenario: Reject multiple requirement IDs in one feature file
    Given an empty project
    And one executable feature contains requirement IDs "PAY-001" and "PAY-002"
    When I run "tonic test"
    Then the command fails
    And the command reports that "features/payments.feature" must contain one requirement ID

  Scenario: Reject malformed generated context
    Given an empty project
    And malformed compiled context exists for "src/payment.ts"
    When I run "tonic context src/payment.ts"
    Then the command fails
    And the command reports invalid compiled context

  Scenario: Explain when a compiled requirement source no longer exists
    Given an empty project
    And executable requirement "PAY-001" exercises "src/payment.ts"
    When I run "tonic test"
    Then the command succeeds
    Given the source for requirement "PAY-001" has been deleted
    When I run "tonic check"
    Then the command fails
    And the command reports that requirement source "features/PAY-001.feature" no longer exists

  Scenario: Ignore an application module that is imported but not exercised
    Given an empty project
    And an executable requirement imports "src/payment.ts" without exercising it
    When I run "tonic test"
    Then the command succeeds
    When I run "tonic context src/payment.ts"
    Then the command fails
    And the command reports no compiled context for "src/payment.ts"
