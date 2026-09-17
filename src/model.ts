export type RequirementLink = {
  affects: string[];
  source: string;
};

export type TonicConfiguration = {
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
