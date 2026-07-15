// lib/currency.ts — household-wide currency (not every country uses EUR, unlike the app's
// original German-only assumption). Formatting is done manually (symbol + decimal separator)
// rather than via Intl.NumberFormat's currency style, since Hermes's bundled ICU data can't be
// relied on to have full CLDR currency formatting for every locale/currency combination.
export interface CurrencyOption { code: string; symbol: string }

export const CURRENCIES: CurrencyOption[] = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CNY', symbol: '¥' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'SEK', symbol: 'kr' },
  { code: 'NOK', symbol: 'kr' },
  { code: 'DKK', symbol: 'kr' },
  { code: 'PLN', symbol: 'zł' },
  { code: 'CZK', symbol: 'Kč' },
  { code: 'HUF', symbol: 'Ft' },
  { code: 'RON', symbol: 'lei' },
  { code: 'BGN', symbol: 'лв' },
  { code: 'TRY', symbol: '₺' },
  { code: 'RUB', symbol: '₽' },
  { code: 'INR', symbol: '₹' },
  { code: 'BRL', symbol: 'R$' },
  { code: 'MXN', symbol: 'MX$' },
  { code: 'ZAR', symbol: 'R' },
  { code: 'AED', symbol: 'د.إ' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'NZD', symbol: 'NZ$' },
  { code: 'KRW', symbol: '₩' },
  { code: 'THB', symbol: '฿' },
  { code: 'ILS', symbol: '₪' },
];

const DEFAULT_CURRENCY = 'EUR';

export function currencySymbol(code: string | undefined | null): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? (code || DEFAULT_CURRENCY);
}

// Mirrors the app's existing "€ 12,34" style: symbol, space, amount with a
// language-appropriate decimal separator (de: comma, en: dot).
export function formatCurrency(amount: number, currencyCode: string | undefined | null, language: 'de' | 'en', decimals = 2): string {
  const symbol = currencySymbol(currencyCode);
  const fixed = amount.toFixed(decimals);
  const formatted = language === 'de' ? fixed.replace('.', ',') : fixed;
  return `${symbol} ${formatted}`;
}
