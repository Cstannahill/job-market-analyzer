import { describe, it, expect } from 'vitest';
import { normalizeLookup } from '@/lib/utils/techBadgeHelpers';

describe('normalizeLookup', () => {
  it('maps explicit special cases', () => {
    expect(normalizeLookup('Ruby on Rails')).toBe('rails');
    expect(normalizeLookup('AWS Lambda')).toBe('lambda');
  });

  it('handles variant spellings for C++ family', () => {
    expect(normalizeLookup('C++')).toBe('cpp');
    expect(normalizeLookup('c plus plus')).toBe('cpp');
  });

  it('normalizes pattern-based technologies', () => {
    expect(normalizeLookup('REST API')).toBe('rest');
    expect(normalizeLookup('Continuous Integration workflows')).toBe('ci-cd');
    expect(normalizeLookup('Next.js app')).toBe('next');
  });

  it('falls back to slugified lowercase values', () => {
    expect(normalizeLookup('Observability Suite')).toBe('observability-suite');
    expect(normalizeLookup('C#')).toBe('csharp');
  });
});
