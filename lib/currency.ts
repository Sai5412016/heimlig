// lib/currency.ts — household-wide currency (not every country uses EUR, unlike the app's
// original German-only assumption). Formatting is done manually (symbol + decimal separator)
// rather than via Intl.NumberFormat's currency style, since Hermes's bundled ICU data can't be
// relied on to have full CLDR currency formatting for every locale/currency combination.
export interface CurrencyOption {
  code: string;
  symbol: string;
  decimals?: number; // default 2 — set for currencies with no minor unit in everyday use (JPY, KRW, HUF)
  placement?: 'prefix' | 'suffix'; // default 'prefix' — several currencies are conventionally written amount-first
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'JPY', symbol: '¥', decimals: 0 },
  { code: 'CNY', symbol: '¥' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'SEK', symbol: 'kr', placement: 'suffix' },
  { code: 'NOK', symbol: 'kr', placement: 'suffix' },
  { code: 'DKK', symbol: 'kr', placement: 'suffix' },
  { code: 'PLN', symbol: 'zł', placement: 'suffix' },
  { code: 'CZK', symbol: 'Kč', placement: 'suffix' },
  { code: 'HUF', symbol: 'Ft', decimals: 0, placement: 'suffix' },
  { code: 'RON', symbol: 'lei', placement: 'suffix' },
  { code: 'BGN', symbol: 'лв', placement: 'suffix' },
  { code: 'TRY', symbol: '₺' },
  { code: 'RUB', symbol: '₽' },
  { code: 'INR', symbol: '₹' },
  { code: 'BRL', symbol: 'R$' },
  { code: 'MXN', symbol: 'MX$' },
  { code: 'ZAR', symbol: 'R' },
  { code: 'AED', symbol: 'د.إ' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'NZD', symbol: 'NZ$' },
  { code: 'KRW', symbol: '₩', decimals: 0 },
  { code: 'THB', symbol: '฿' },
  { code: 'ILS', symbol: '₪' },
];

const DEFAULT_CURRENCY = 'EUR';

function currencyOption(code: string | undefined | null): CurrencyOption {
  return CURRENCIES.find(c => c.code === code) ?? CURRENCIES.find(c => c.code === DEFAULT_CURRENCY)!;
}

export function currencySymbol(code: string | undefined | null): string {
  return currencyOption(code).symbol;
}

// Mirrors the app's existing "€ 12,34" style: symbol and amount with a language-appropriate
// decimal separator (de: comma, en: dot). Placement (prefix/suffix) and decimal count come from
// the currency itself, except EUR-in-German which conventionally suffixes ("12,34 €") even
// though EUR is a prefix currency everywhere else — that's a language quirk, not a currency one.
export function formatCurrency(amount: number, currencyCode: string | undefined | null, language: 'de' | 'en', decimals?: number): string {
  const option = currencyOption(currencyCode);
  const dec = decimals ?? option.decimals ?? 2;
  const fixed = amount.toFixed(dec);
  const formatted = language === 'de' ? fixed.replace('.', ',') : fixed;

  const suffix = option.code === 'EUR' ? language === 'de' : option.placement === 'suffix';
  return suffix ? `${formatted} ${option.symbol}` : `${option.symbol} ${formatted}`;
}
