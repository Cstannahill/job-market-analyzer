const TRUTHY_VALUES = new Set(["1", "true", "t", "yes", "y", "on", "enabled"]);
const FALSY_VALUES = new Set(["0", "false", "f", "no", "n", "off", "disabled"]);

function parseEnvBoolean(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (TRUTHY_VALUES.has(normalized)) return true;
  if (FALSY_VALUES.has(normalized)) return false;
  return defaultValue;
}

export const insertToggles = {
  companies: parseEnvBoolean(process.env.ENABLE_INSERT_COMPANIES, true),
  jobs: parseEnvBoolean(process.env.ENABLE_INSERT_JOBS, true),
  technologies: parseEnvBoolean(process.env.ENABLE_INSERT_TECHNOLOGIES, true),
  jobTechnologies: parseEnvBoolean(
    process.env.ENABLE_INSERT_JOB_TECHNOLOGIES,
    true
  ),
  skills: parseEnvBoolean(process.env.ENABLE_INSERT_SKILLS, true),
  industries: parseEnvBoolean(process.env.ENABLE_INSERT_INDUSTRIES, true),
} as const;

export const isAnyInsertEnabled = Object.values(insertToggles).some(Boolean);

