/**
 * Finora's interface text. Components call `t("English text")`; the English
 * text is the key, so untranslated strings still read correctly. Catalogues
 * for other languages live in `i18n/<language>/*.json` and load on demand.
 * `pnpm i18n:check` lists strings missing from a catalogue.
 */

export type Language = "en" | "bn";

export const LANGUAGES: { value: Language; label: string; locale: string }[] = [
  { value: "en", label: "English", locale: "en" },
  { value: "bn", label: "বাংলা (খসড়া)", locale: "bn-BD" },
];

type Catalogue = Record<string, string>;

const loaders: Record<Exclude<Language, "en">, () => Promise<Catalogue>> = {
  bn: async () => {
    const modules = import.meta.glob<{ default: Catalogue }>("./bn/*.json");
    const parts = await Promise.all(Object.values(modules).map((load) => load()));
    return Object.assign({}, ...parts.map((part) => part.default)) as Catalogue;
  },
};

const STORAGE_KEY = "finora.language";
let current: Language = "en";
let catalogue: Catalogue = {};
const listeners = new Set<() => void>();

/** Numbers in placeholders use the language's digits (০১২… in Bengali). */
function fill(text: string, values?: Record<string, string | number>): string {
  if (!values) return text;
  const numbers =
    current === "en" ? null : new Intl.NumberFormat(languageLocale(), { useGrouping: false });
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in values)) return match;
    const value = values[name]!;
    return typeof value === "number" && numbers ? numbers.format(value) : String(value);
  });
}

/**
 * Marks English text that is translated later, at render time, with `t()`
 * (module-level constants such as option lists). Returns it unchanged.
 */
export function msg(text: string): string {
  return text;
}

/** Translates English interface text; `{name}` placeholders are filled from `values`. */
export function t(text: string, values?: Record<string, string | number>): string {
  return fill(catalogue[text] ?? text, values);
}

/** Like `t`, choosing the English singular or plural form by `count` (also available as `{count}`). */
export function tn(
  count: number,
  one: string,
  many: string,
  values?: Record<string, string | number>,
): string {
  return t(count === 1 ? one : many, { count, ...values });
}

export function currentLanguage(): Language {
  return current;
}

export function languageLocale(language: Language = current): string {
  return LANGUAGES.find((entry) => entry.value === language)?.locale ?? "en";
}

/** Loads a language's catalogue and re-renders subscribers. */
export async function setLanguage(language: Language): Promise<void> {
  if (language === current && (language === "en" || Object.keys(catalogue).length)) return;
  catalogue = language === "en" ? {} : await loaders[language]();
  current = language;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Private mode: the server-synced preference still applies after sign-in.
  }
  document.documentElement.lang = languageLocale(language);
  for (const listener of listeners) listener();
}

/** The language last used on this device, so the sign-in page matches it. */
export function storedLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((entry) => entry.value === saved) ? (saved as Language) : "en";
  } catch {
    return "en";
  }
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
