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
  common: {
    add: string;
    cancel: string;
    close: string;
    save: string;
    delete: string;
    create: string;
    done: string;
    edit: string;
  };
  shopping: {
    defaultListName: string;
    defaultHouseholdName: string;
    listsButton: string;
    progressDone: string;
    costEstimate: string;
    costEstimatePartial: string;
    emptyTitle: string;
    emptyBody: string;
    checkedHeader: string;
    clearCheckedTitle: string;
    clearCheckedBody: string;
    recipeAddedTitle: string;
    recipeAddedIngredients: string;
    recipeAddedPlanned: string;
    recipeAddedSaved: string;
    addedToListBody: string;
    addItem: {
      title: string;
      namePlaceholder: string;
      quantityPlaceholder: string;
      elsewhereHint: string;
      frequentlyBought: string;
      brandAt: string;
      brandPlaceholder: string;
      categoryLabel: string;
    };
    lists: {
      title: string;
      quickCreate: string;
      namePlaceholder: string;
      newList: string;
      cantDeleteTitle: string;
      cantDeleteBody: string;
      deleteConfirmTitle: string;
      deleteConfirmBody: string;
    };
  };
}
