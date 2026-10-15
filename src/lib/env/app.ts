const APP_ENVS = ["development", "staging", "production"] as const;

export type AppEnv = (typeof APP_ENVS)[number];

function readName(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function readAppEnv(env: Record<string, string | undefined> = process.env): AppEnv {
  const published = readName(env.NEXT_PUBLIC_APP_ENV);
  const server = readName(env.APP_ENV);
  if (published && server && published !== server) {
    throw new Error(`APP_ENV (${server}) and NEXT_PUBLIC_APP_ENV (${published}) must match.`);
  }
  const value = published || server || "development";
  if (!APP_ENVS.includes(value as AppEnv)) {
    throw new Error(`APP_ENV must be development, staging, or production. Received "${value}".`);
  }
  return value as AppEnv;
}
