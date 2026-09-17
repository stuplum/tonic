Feature: Reconsider artifacts affected by a changed requirement
  Executable requirements describe the behaviour the software must provide.
  Tonic draws attention to affected artifacts when one of those requirements changes.

  Scenario: Initialise an empty repository
    Given an empty project
    When I run "tonic init"
    Then the command succeeds
    And the project contains an empty Tonic configuration
    And the project contains an empty Tonic lock file

  Scenario: Link a requirement to an affected artifact
    Given an initialised project
    And requirement "PAY-001" is defined in "features/PAY-001.feature"
    And artifact "src/payment.ts" exists
    When I run "tonic add PAY-001 --source features/PAY-001.feature --affects src/payment.ts"
    Then the command succeeds
    And the configuration links requirement "PAY-001" to "src/payment.ts"
    And the current fingerprint of "PAY-001" is recorded

  Scenario: Accept an unchanged requirement
    Given requirement "PAY-001" is linked to "src/payment.ts"
    When I run "tonic check"
    Then the command succeeds
    And the command produces no output

  Scenario: Draw attention to artifacts affected by a changed requirement
    Given requirement "PAY-001" is linked to "src/payment.ts"
    And requirement "PAY-001" has changed
    When I run "tonic check"
    Then the command fails
    And the command reports that "PAY-001" changed
    And the command reports "src/payment.ts" for reconsideration

  Scenario: Acknowledge a requirement after reconsidering its affected artifacts
    Given requirement "PAY-001" is linked to "src/payment.ts"
    And requirement "PAY-001" has changed
    When I run "tonic acknowledge PAY-001"
    Then the command succeeds
    And the current fingerprint of "PAY-001" is recorded
    When I run "tonic check"
    Then the command succeeds
    And the command produces no output

  Scenario: Reject a link to an artifact that does not exist
    Given an initialised project
    And requirement "PAY-001" is defined in "features/PAY-001.feature"
    When I run "tonic add PAY-001 --source features/PAY-001.feature --affects src/missing.ts"
    Then the command fails
    And the command reports that "src/missing.ts" does not exist
