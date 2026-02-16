const { describe, it, expect } = require('bun:test');

/**
 * Tests the localizes field priority logic used in pageLifecycle.ts (Strapi → MDX export).
 * Lives in sync-mdx because it validates the shared localizes contract that sync-mdx writes.
 *
 * The logic should be:
 *   localizesValue = (isLocalized && englishSlug ? englishSlug : undefined) || localizes
 *
 * This means:
 * - For localized files with englishSlug provided: use englishSlug (current English slug)
 * - For localized files without englishSlug: use preserved localizes
 * - For English files: no localizes field
 */

describe('localizes field priority', () => {
  // Simulate the logic from pageLifecycle.ts generateMDX function
  function computeLocalizesValue(locale, englishSlug, preservedLocalizes) {
    const isLocalized = locale !== 'en';
    return (isLocalized && englishSlug ? englishSlug : undefined) || preservedLocalizes;
  }

  it('uses englishSlug for localized files when provided', () => {
    // Spanish file with new englishSlug and old preserved localizes
    const result = computeLocalizesValue('es', 'new-english-slug', 'old-english-slug');
    expect(result).toBe('new-english-slug');
  });

  it('falls back to preserved localizes when englishSlug is not provided', () => {
    // Spanish file without englishSlug but with preserved localizes
    const result = computeLocalizesValue('es', undefined, 'preserved-slug');
    expect(result).toBe('preserved-slug');
  });

  it('preserves existing localizes for English files when present (defensive fallback)', () => {
    // Defensive behavior: if an English file still has preserved localizes, keep it.
    const result = computeLocalizesValue('en', 'some-slug', 'preserved-slug');
    // For English, isLocalized is false, so logic falls back to preserved value.
    expect(result).toBe('preserved-slug');
  });

  it('returns undefined for English files without preserved localizes', () => {
    const result = computeLocalizesValue('en', 'some-slug', undefined);
    expect(result).toBeUndefined();
  });

  it('updates localizes when English slug changes', () => {
    // Scenario: English slug changed from "about" to "about-us"
    // Spanish file has preserved localizes: "about"
    // englishSlug parameter is "about-us" (current English slug)
    const result = computeLocalizesValue('es', 'about-us', 'about');
    expect(result).toBe('about-us'); // Should use new English slug
  });

  it('handles empty englishSlug for localized files', () => {
    const result = computeLocalizesValue('es', '', 'preserved');
    expect(result).toBe('preserved'); // Empty string is falsy, falls back
  });

  it('handles null englishSlug for localized files', () => {
    const result = computeLocalizesValue('es', null, 'preserved');
    expect(result).toBe('preserved');
  });
});
