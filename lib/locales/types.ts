// lib/locales/types.ts — shared shape for every locale file, so TypeScript catches a
// missing/extra key in one language as soon as it's added to the other.
export interface AppTranslations {
  tabs: {
    home: string;
    shopping: string;
    scan: string;
    recipes: string;
    tasks: string;
    budget: string;
    household: string;
  };
  settings: {
    language: string;
    languageGerman: string;
    languageEnglish: string;
  };
}
