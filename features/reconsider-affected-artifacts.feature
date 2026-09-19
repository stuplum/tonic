Feature: Run executable requirements with minimal setup
  Tonic runs executable Gherkin without requiring manual relationship files.
  Configuration is optional and only changes how executable requirements are found.

  Scenario: Run executable requirements without Tonic configuration
    Given an empty project
    And a passing executable requirement in the default feature directory
    When I run "tonic test"
    Then the command succeeds
    And the executable requirement ran
    And no legacy Tonic files are created

  Scenario: Fail when an executable requirement is not satisfied
    Given an empty project
    And a failing executable requirement in the default feature directory
    When I run "tonic test"
    Then the command fails
    And the command reports that the executable requirement failed

  Scenario: Run executable requirements from configured paths
    Given an empty project
    And Tonic is configured to find features in "specifications" and steps in "specifications/support"
    And a passing executable requirement exists in the configured directories
    When I run "tonic test"
    Then the command succeeds
    And the executable requirement ran

  Scenario Outline: Reject a removed manual workflow command
    Given an empty project
    When I run "<command>"
    Then the command fails
    And the command reports only the supported commands

    Examples:
      | command                                        |
      | tonic init                                     |
      | tonic add PAY-001 --source requirement.feature |

  Scenario: Reject legacy manual relationship configuration
    Given a project with legacy manual relationship configuration
    And a passing executable requirement in the default feature directory
    When I run "tonic test"
    Then the command fails
    And the command reports invalid Tonic configuration
