import { createAppBuildMetadata } from '@taurent/shared';

export const appBuildMetadata = createAppBuildMetadata({
  version: import.meta.env.VITE_APP_VERSION,
  releaseTag: import.meta.env.VITE_RELEASE_TAG,
  gitSha: import.meta.env.VITE_GIT_SHA,
});
