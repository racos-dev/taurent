/**
 * mapRustCapabilities.test.ts
 *
 * Unit tests for mapRustCapabilitiesToFlags covering all tri-state conversions
 * for supportsSearch, supportsRss, and supportsPauseResume.
 */
import { describe, expect, it } from 'vitest';
import { mapRustCapabilitiesToFlags } from './mapRustCapabilities';
import type { RustResolvedCapabilities } from '@taurent/bridge';

type CapabilityState = 'confirmed' | 'unsupported' | 'unknown';

function makeRustCapabilities(
  search: CapabilityState,
  rss: CapabilityState,
  pauseResume: CapabilityState
): RustResolvedCapabilities {
  return {
    supports_search: search,
    supports_rss: rss,
    supports_pause_resume: pauseResume,
  };
}

describe('mapRustCapabilitiesToFlags', () => {
  // 3 states × 3 flags = 9 combinations
  describe('supportsSearch', () => {
    it('maps confirmed → true', () => {
      const rust = makeRustCapabilities('confirmed', 'unknown', 'unknown');
      expect(mapRustCapabilitiesToFlags(rust).supportsSearch).toBe(true);
    });

    it('maps unsupported → false', () => {
      const rust = makeRustCapabilities('unsupported', 'unknown', 'unknown');
      expect(mapRustCapabilitiesToFlags(rust).supportsSearch).toBe(false);
    });

    it('maps unknown → null', () => {
      const rust = makeRustCapabilities('unknown', 'unknown', 'unknown');
      expect(mapRustCapabilitiesToFlags(rust).supportsSearch).toBe(null);
    });
  });

  describe('supportsRss', () => {
    it('maps confirmed → true', () => {
      const rust = makeRustCapabilities('unknown', 'confirmed', 'unknown');
      expect(mapRustCapabilitiesToFlags(rust).supportsRss).toBe(true);
    });

    it('maps unsupported → false', () => {
      const rust = makeRustCapabilities('unknown', 'unsupported', 'unknown');
      expect(mapRustCapabilitiesToFlags(rust).supportsRss).toBe(false);
    });

    it('maps unknown → null', () => {
      const rust = makeRustCapabilities('unknown', 'unknown', 'unknown');
      expect(mapRustCapabilitiesToFlags(rust).supportsRss).toBe(null);
    });
  });

  describe('supportsPauseResume', () => {
    it('maps confirmed → true', () => {
      const rust = makeRustCapabilities('unknown', 'unknown', 'confirmed');
      expect(mapRustCapabilitiesToFlags(rust).supportsPauseResume).toBe(true);
    });

    it('maps unsupported → false', () => {
      const rust = makeRustCapabilities('unknown', 'unknown', 'unsupported');
      expect(mapRustCapabilitiesToFlags(rust).supportsPauseResume).toBe(false);
    });

    it('maps unknown → null', () => {
      const rust = makeRustCapabilities('unknown', 'unknown', 'unknown');
      expect(mapRustCapabilitiesToFlags(rust).supportsPauseResume).toBe(null);
    });
  });

  // hasUnknownCapabilities flag - true iff any capability is 'unknown'
  describe('hasUnknownCapabilities', () => {
    it('is false when all confirmed', () => {
      const rust = makeRustCapabilities('confirmed', 'confirmed', 'confirmed');
      expect(mapRustCapabilitiesToFlags(rust).hasUnknownCapabilities).toBe(false);
    });

    it('is false when all unsupported', () => {
      const rust = makeRustCapabilities('unsupported', 'unsupported', 'unsupported');
      expect(mapRustCapabilitiesToFlags(rust).hasUnknownCapabilities).toBe(false);
    });

    it('is true when any state is unknown', () => {
      const rust = makeRustCapabilities('confirmed', 'unsupported', 'unknown');
      expect(mapRustCapabilitiesToFlags(rust).hasUnknownCapabilities).toBe(true);
    });

    it('is true when all states are unknown', () => {
      const rust = makeRustCapabilities('unknown', 'unknown', 'unknown');
      expect(mapRustCapabilitiesToFlags(rust).hasUnknownCapabilities).toBe(true);
    });
  });

  // Edge cases
  describe('all states combined', () => {
    it('handles all confirmed', () => {
      const rust = makeRustCapabilities('confirmed', 'confirmed', 'confirmed');
      const result = mapRustCapabilitiesToFlags(rust);
      expect(result.supportsSearch).toBe(true);
      expect(result.supportsRss).toBe(true);
      expect(result.supportsPauseResume).toBe(true);
      expect(result.hasUnknownCapabilities).toBe(false);
    });

    it('handles all unsupported', () => {
      const rust = makeRustCapabilities('unsupported', 'unsupported', 'unsupported');
      const result = mapRustCapabilitiesToFlags(rust);
      expect(result.supportsSearch).toBe(false);
      expect(result.supportsRss).toBe(false);
      expect(result.supportsPauseResume).toBe(false);
      expect(result.hasUnknownCapabilities).toBe(false);
    });

    it('handles all unknown', () => {
      const rust = makeRustCapabilities('unknown', 'unknown', 'unknown');
      const result = mapRustCapabilitiesToFlags(rust);
      expect(result.supportsSearch).toBe(null);
      expect(result.supportsRss).toBe(null);
      expect(result.supportsPauseResume).toBe(null);
      expect(result.hasUnknownCapabilities).toBe(true);
    });

    it('handles mixed states', () => {
      const rust = makeRustCapabilities('confirmed', 'unsupported', 'unknown');
      const result = mapRustCapabilitiesToFlags(rust);
      expect(result.supportsSearch).toBe(true);
      expect(result.supportsRss).toBe(false);
      expect(result.supportsPauseResume).toBe(null);
      expect(result.hasUnknownCapabilities).toBe(true);
    });
  });
});
