Feature: Reconsider decisions driven by changed requirements
  Tonic uses live repository changes and explicit knowledge relationships rather
  than fingerprints to bring architectural decisions back into context.

  Scenario: Surface the raw requirement and decision when a driver changes
    Given an empty project
    And requirement "ORDER-006" exists
    And decision "PAY-003" is driven by requirement "ORDER-006"
    And the project knowledge is committed
    When requirement "ORDER-006" has changed
    And I run "tonic check"
    Then the command fails
    And the command reports decision "PAY-003" for reconsideration
    And the command returns the current Gherkin for requirement "ORDER-006"
    And the command returns the current source for decision "PAY-003"
    And no generated decision state is created

  Scenario: Do not surface a decision when an unrelated requirement changes
    Given an empty project
    And requirement "ORDER-006" exists
    And requirement "ORDER-007" exists
    And decision "PAY-003" is driven by requirement "ORDER-006"
    And the project knowledge is committed
    When requirement "ORDER-007" has changed
    And I run "tonic check"
    Then the command succeeds
    And the command produces no output

  Scenario: Reject a decision whose requirement cannot be resolved
    Given an empty project
    And decision "PAY-003" is driven by requirement "ORDER-006"
    And the project knowledge is committed
    When I run "tonic check"
    Then the command fails
    And the command reports that decision "PAY-003" references unknown requirement "ORDER-006"
