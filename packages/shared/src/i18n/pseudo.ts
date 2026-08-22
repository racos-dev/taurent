import type { CatalogResources } from './types';

const ACCENTS: Record<string, string> = {
  A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ģ', H: 'Ħ', I: 'Ï',
  J: 'Ĵ', K: 'Ķ', L: 'Ŀ', M: 'Ḿ', N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ',
  S: 'Š', T: 'Ţ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẍ', Y: 'Ý', Z: 'Ž',
  a: 'å', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ģ', h: 'ħ', i: 'ï',
  j: 'ĵ', k: 'ķ', l: 'ŀ', m: 'ḿ', n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ',
  s: 'š', t: 'ţ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẍ', y: 'ý', z: 'ž',
};

const PROTECTED_TOKEN = /({{[^{}]+}}|<\/?[A-Za-z][^>]*>)/g;
const PROTECTED_TOKEN_EXACT = /^({{[^{}]+}}|<\/?[A-Za-z][^>]*>)$/;

function transformSegment(segment: string): string {
  const accented = [...segment].map((character) => ACCENTS[character] ?? character).join('');
  const letters = [...segment].filter((character) => /\p{L}/u.test(character)).length;
  return accented + '~'.repeat(Math.ceil(letters * 0.3));
}

/**
 * Produce visibly expanded copy for layout and missing-literal testing while
 * preserving i18next interpolation tokens and embedded markup.
 */
export function pseudoLocalizeText(value: string): string {
  const parts = value.split(PROTECTED_TOKEN);
  const transformed = parts.map((part) => (
    PROTECTED_TOKEN_EXACT.test(part) ? part : transformSegment(part)
  ));
  return `［${transformed.join('')}］`;
}

type MutableCatalog<T> = {
  -readonly [K in keyof T]: T[K] extends string ? string : MutableCatalog<T[K]>;
};

function transformCatalog<T extends object>(catalog: T): MutableCatalog<T> {
  return Object.fromEntries(Object.entries(catalog).map(([key, value]) => [
    key,
    typeof value === 'string' ? pseudoLocalizeText(value) : transformCatalog(value),
  ])) as MutableCatalog<T>;
}

/** Test/development-only pseudo resources; not a SupportedLocale. */
export function createPseudoCatalog(catalog: CatalogResources): MutableCatalog<CatalogResources> {
  return transformCatalog(catalog);
}
