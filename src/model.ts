export type RequirementLink = {
  affects: string[];
  source: string;
};

export type CucumberConfiguration = {
  features?: string[];
  steps?: string[];
};

export type TonicConfiguration = {
  cucumber?: CucumberConfiguration;
  requirements: Record<string, RequirementLink>;
  version: 1;
};

export type RequirementVersion = {
  fingerprint: string;
};

export type TonicLock = {
  requirements: Record<string, RequirementVersion>;
  version: 1;
};

export type ChangedRequirement = {
  affects: string[];
  id: string;
};
