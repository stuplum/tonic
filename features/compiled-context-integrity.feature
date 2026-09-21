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
