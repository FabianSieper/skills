import { AutomationError } from '../runtime/errors.ts';
import type {
  FilterCondition,
  FilterLanguage,
  FilterSellerType,
  FilterYesNo,
  ResolvedSellerFilter,
  SellerFilter,
} from '../types.ts';

export const SELLER_FILTER_DEFAULTS = {
  condition: 'excellent',
  language: 'english',
  location: 'germany',
  sellerType: 'any',
  foil: 'any',
  signed: 'any',
  altered: 'any',
} as const;

export const CONDITION_VALUES: Record<FilterCondition, string> = {
  any: '7',
  poor: '7',
  played: '6',
  'light-played': '5',
  good: '4',
  excellent: '3',
  'near-mint': '2',
  mint: '1',
};

export const LANGUAGE_VALUES: Record<FilterLanguage, string> = {
  any: '',
  english: '1',
  french: '2',
  german: '3',
  spanish: '4',
  italian: '5',
  's-chinese': '6',
  japanese: '7',
  portuguese: '8',
  russian: '9',
  't-chinese': '11',
};

export const YES_NO_VALUES: Record<FilterYesNo, string> = {
  any: '0',
  yes: 'Y',
  no: 'N',
};

export const SELLER_TYPE_VALUES: Record<FilterSellerType, string> = {
  any: '',
  private: '0',
  professional: '1',
  powerseller: '2',
};

const COUNTRY_VALUES: Record<string, string> = {
  any: '',
  austria: '1',
  belgium: '2',
  switzerland: '4',
  cyprus: '5',
  'czech-republic': '6',
  germany: '7',
  denmark: '8',
  estonia: '9',
  spain: '10',
  finland: '11',
  france: '12',
  'united-kingdom': '13',
  greece: '14',
  hungary: '15',
  ireland: '16',
  italy: '17',
  liechtenstein: '18',
  lithuania: '19',
  luxembourg: '20',
  latvia: '21',
  malta: '22',
  netherlands: '23',
  norway: '24',
  poland: '25',
  portugal: '26',
  romania: '27',
  sweden: '28',
  singapore: '29',
  slovenia: '30',
  slovakia: '31',
  croatia: '35',
  canada: '33',
  japan: '36',
  iceland: '37',
};

export const COUNTRY_KEYS = Object.keys(COUNTRY_VALUES);

const COUNTRY_ALIASES: Record<string, string> = {
  all: 'any',
  alle: 'any',
  de: 'germany',
  deutschland: 'germany',
  at: 'austria',
  osterreich: 'austria',
  be: 'belgium',
  belgien: 'belgium',
  ch: 'switzerland',
  schweiz: 'switzerland',
  cy: 'cyprus',
  czech: 'czech-republic',
  czechia: 'czech-republic',
  tschechien: 'czech-republic',
  dk: 'denmark',
  daenemark: 'denmark',
  ee: 'estonia',
  estland: 'estonia',
  es: 'spain',
  spanien: 'spain',
  fi: 'finland',
  fr: 'france',
  frankreich: 'france',
  gr: 'greece',
  griechenland: 'greece',
  hu: 'hungary',
  ungar: 'hungary',
  ie: 'ireland',
  irland: 'ireland',
  it: 'italy',
  italien: 'italy',
  li: 'liechtenstein',
  lt: 'lithuania',
  litauen: 'lithuania',
  lu: 'luxembourg',
  lv: 'latvia',
  lettland: 'latvia',
  mt: 'malta',
  nl: 'netherlands',
  holland: 'netherlands',
  no: 'norway',
  norwegen: 'norway',
  pl: 'poland',
  polen: 'poland',
  pt: 'portugal',
  ro: 'romania',
  rumaenien: 'romania',
  rumaenia: 'romania',
  sg: 'singapore',
  si: 'slovenia',
  slowenien: 'slovenia',
  sk: 'slovakia',
  slowakei: 'slovakia',
  hr: 'croatia',
  hrvatska: 'croatia',
  kroatien: 'croatia',
  ca: 'canada',
  jp: 'japan',
  is: 'iceland',
  island: 'iceland',
  uk: 'united-kingdom',
  britain: 'united-kingdom',
  england: 'united-kingdom',
  gbr: 'united-kingdom',
  se: 'sweden',
  schweden: 'sweden',
};

export const COUNTRY_INPUT_KEYS = Array.from(
  new Set([...COUNTRY_KEYS, ...Object.keys(COUNTRY_ALIASES)]),
).sort();

export function normalizeCountryKey(raw: string): string | null {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!key) return null;
  const alias = COUNTRY_ALIASES[key] ?? key;
  return Object.hasOwn(COUNTRY_VALUES, alias) ? alias : null;
}

export function resolveCountry(raw: string): string {
  const key = normalizeCountryKey(raw);
  if (!key) throw new AutomationError('INVALID_INPUT', `location:${raw}`);
  return key;
}

export type FilterTargets = {
  minCondition: string;
  language: string;
  sellerCountry: string;
  sellerType: string;
  isFoil: string;
  isSigned: string;
  isAltered: string;
};

export function buildFilterTargets(filter: ResolvedSellerFilter): FilterTargets {
  return {
    minCondition: CONDITION_VALUES[filter.condition],
    language: LANGUAGE_VALUES[filter.language],
    sellerCountry: COUNTRY_VALUES[filter.location] ?? '',
    sellerType: SELLER_TYPE_VALUES[filter.sellerType],
    isFoil: YES_NO_VALUES[filter.foil],
    isSigned: YES_NO_VALUES[filter.signed],
    isAltered: YES_NO_VALUES[filter.altered],
  };
}

export function resolveSellerFilter(partial: SellerFilter = {}): ResolvedSellerFilter {
  const condition = (partial.condition ?? SELLER_FILTER_DEFAULTS.condition) as FilterCondition;
  const language = (partial.language ?? SELLER_FILTER_DEFAULTS.language) as FilterLanguage;
  const location = resolveCountry(partial.location ?? SELLER_FILTER_DEFAULTS.location);
  const sellerType = (partial.sellerType ?? SELLER_FILTER_DEFAULTS.sellerType) as FilterSellerType;
  const foil = (partial.foil ?? SELLER_FILTER_DEFAULTS.foil) as FilterYesNo;
  const signed = (partial.signed ?? SELLER_FILTER_DEFAULTS.signed) as FilterYesNo;
  const altered = (partial.altered ?? SELLER_FILTER_DEFAULTS.altered) as FilterYesNo;
  if (!Object.hasOwn(CONDITION_VALUES, condition))
    throw new AutomationError('INVALID_INPUT', `condition:${String(condition)}`);
  if (!Object.hasOwn(LANGUAGE_VALUES, language))
    throw new AutomationError('INVALID_INPUT', `language:${String(language)}`);
  if (!Object.hasOwn(COUNTRY_VALUES, location))
    throw new AutomationError('INVALID_INPUT', `location:${location}`);
  if (!Object.hasOwn(SELLER_TYPE_VALUES, sellerType))
    throw new AutomationError('INVALID_INPUT', `sellerType:${String(sellerType)}`);
  if (!Object.hasOwn(YES_NO_VALUES, foil)) throw new AutomationError('INVALID_INPUT', `foil:${String(foil)}`);
  if (!Object.hasOwn(YES_NO_VALUES, signed)) throw new AutomationError('INVALID_INPUT', `signed:${String(signed)}`);
  if (!Object.hasOwn(YES_NO_VALUES, altered)) throw new AutomationError('INVALID_INPUT', `altered:${String(altered)}`);
  return { condition, language, location, sellerType, foil, signed, altered };
}

export function isResolvedSellerFilter(value: unknown): value is ResolvedSellerFilter {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  const keys = ['altered', 'condition', 'foil', 'language', 'location', 'sellerType', 'signed'];
  if (Object.keys(o).length !== keys.length || keys.some((k) => !Object.hasOwn(o, k))) return false;
  return (
    typeof o.condition === 'string' &&
    Object.hasOwn(CONDITION_VALUES, o.condition) &&
    typeof o.language === 'string' &&
    Object.hasOwn(LANGUAGE_VALUES, o.language) &&
    typeof o.location === 'string' &&
    normalizeCountryKey(o.location) !== null &&
    typeof o.sellerType === 'string' &&
    Object.hasOwn(SELLER_TYPE_VALUES, o.sellerType) &&
    typeof o.foil === 'string' &&
    Object.hasOwn(YES_NO_VALUES, o.foil) &&
    typeof o.signed === 'string' &&
    Object.hasOwn(YES_NO_VALUES, o.signed) &&
    typeof o.altered === 'string' &&
    Object.hasOwn(YES_NO_VALUES, o.altered)
  );
}
