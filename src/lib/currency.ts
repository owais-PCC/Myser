export interface CurrencyConfig {
  code: string;
  symbol: string;
  locale: string;
  label: string;
  flag: string;
}

export const CURRENCIES: CurrencyConfig[] = [
  { code: 'PKR', symbol: '₨', locale: 'en-PK', label: 'Pakistani Rupee', flag: '🇵🇰' },
  { code: 'USD', symbol: '$',  locale: 'en-US', label: 'US Dollar',        flag: '🇺🇸' },
  { code: 'EUR', symbol: '€',  locale: 'de-DE', label: 'Euro',             flag: '🇪🇺' },
  { code: 'GBP', symbol: '£',  locale: 'en-GB', label: 'British Pound',    flag: '🇬🇧' },
  { code: 'AED', symbol: 'د.إ', locale: 'ar-AE', label: 'UAE Dirham',      flag: '🇦🇪' },
  { code: 'SAR', symbol: '﷼',  locale: 'ar-SA', label: 'Saudi Riyal',      flag: '🇸🇦' },
  { code: 'INR', symbol: '₹',  locale: 'en-IN', label: 'Indian Rupee',     flag: '🇮🇳' },
  { code: 'CAD', symbol: 'C$', locale: 'en-CA', label: 'Canadian Dollar',  flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$', locale: 'en-AU', label: 'Australian Dollar',flag: '🇦🇺' },
  { code: 'JPY', symbol: '¥',  locale: 'ja-JP', label: 'Japanese Yen',     flag: '🇯🇵' },
];

export const DEFAULT_CURRENCY = CURRENCIES[0]; // PKR

export const CURRENCY_KEY = 'financeapp_currency';

export function getCurrencyConfig(code: string): CurrencyConfig {
  return CURRENCIES.find((c) => c.code === code) ?? DEFAULT_CURRENCY;
}

export function formatCurrency(amount: number, currency: CurrencyConfig): string {
  // Use Intl if possible, fallback to symbol prefix
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.code === 'JPY' ? 0 : 0,
      maximumFractionDigits: currency.code === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency.symbol}${amount.toLocaleString()}`;
  }
}
