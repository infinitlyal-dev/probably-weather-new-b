export const SUPPORTED_LANGS = ['en', 'af', 'zu', 'xh', 'st'];

export const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'zu', name: 'isiZulu' },
  { code: 'xh', name: 'isiXhosa' },
  { code: 'st', name: 'Sesotho' },
];

export function normalizeLanguageCode(language) {
  const primary = String(language || '').trim().toLowerCase().split('-')[0];
  return SUPPORTED_LANGS.includes(primary) ? primary : null;
}

export function resolveInitialLanguage({ stored, navigatorLanguage } = {}) {
  return normalizeLanguageCode(stored) || normalizeLanguageCode(navigatorLanguage) || 'en';
}
