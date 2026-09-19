export type CucumberConfiguration = {
  features?: string[];
  steps?: string[];
};

export type TonicConfiguration = {
  cucumber?: CucumberConfiguration;
  version: 1;
};

export type ChangedRequirement = {
  affects: string[];
  id: string;
};
