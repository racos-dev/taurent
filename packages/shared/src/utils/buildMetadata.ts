export interface AppBuildMetadataInput {
  version?: string;
  releaseTag?: string;
  gitSha?: string;
}

export interface AppBuildMetadata {
  version: string;
  releaseTag: string | null;
  gitSha: string | null;
  diagnostics: string[];
}

const DEV_VERSION = 'dev';

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function createAppBuildMetadata(input: AppBuildMetadataInput): AppBuildMetadata {
  const version = clean(input.version) ?? DEV_VERSION;
  const releaseTag = clean(input.releaseTag);
  const gitSha = clean(input.gitSha);
  const diagnostics = [releaseTag, gitSha].filter((value): value is string => Boolean(value));

  return {
    version,
    releaseTag,
    gitSha,
    diagnostics,
  };
}
