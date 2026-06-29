import { describe, expect, it } from 'vitest';

import { createAppBuildMetadata } from '../buildMetadata';

describe('createAppBuildMetadata', () => {
  it('uses clean SemVer as the user-facing version', () => {
    expect(createAppBuildMetadata({ version: '1.2.3' })).toEqual({
      version: '1.2.3',
      releaseTag: null,
      gitSha: null,
      diagnostics: [],
    });
  });

  it('includes tag and sha diagnostics when available', () => {
    expect(createAppBuildMetadata({
      version: '1.2.3',
      releaseTag: 'v1.2.3',
      gitSha: 'abc1234',
    })).toEqual({
      version: '1.2.3',
      releaseTag: 'v1.2.3',
      gitSha: 'abc1234',
      diagnostics: ['v1.2.3', 'abc1234'],
    });
  });

  it('falls back to dev for local builds without version metadata', () => {
    expect(createAppBuildMetadata({ version: '', releaseTag: '', gitSha: '' })).toEqual({
      version: 'dev',
      releaseTag: null,
      gitSha: null,
      diagnostics: [],
    });
  });
});
