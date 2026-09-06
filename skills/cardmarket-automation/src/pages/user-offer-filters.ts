import type { OfferCondition, OfferLanguage } from '../types.ts';

export const OFFER_CONDITION_VALUES: Record<OfferCondition, string> = {
  mint: 'MT',
  'near-mint': 'NM',
  excellent: 'EX',
  good: 'GD',
  'light-played': 'LP',
  played: 'PL',
  poor: 'PO',
};

export const OFFER_LANGUAGE_VALUES: Record<OfferLanguage, string> = {
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

export const OFFER_CONDITION_LABELS: Record<OfferCondition, string> = {
  mint: 'Mint',
  'near-mint': 'Near Mint',
  excellent: 'Excellent',
  good: 'Good',
  'light-played': 'Light Played',
  played: 'Played',
  poor: 'Poor',
};

export const OFFER_LANGUAGE_LABELS: Record<OfferLanguage, string> = {
  english: 'English',
  french: 'French',
  german: 'German',
  spanish: 'Spanish',
  italian: 'Italian',
  's-chinese': 'S-Chinese',
  japanese: 'Japanese',
  portuguese: 'Portuguese',
  russian: 'Russian',
  't-chinese': 'T-Chinese',
};

export function reverseOfferCondition(value: string): OfferCondition | null {
  const entry = Object.entries(OFFER_CONDITION_VALUES).find(([, code]) => code === value);
  return entry ? (entry[0] as OfferCondition) : null;
}

export function reverseOfferLanguage(value: string): OfferLanguage | null {
  const entry = Object.entries(OFFER_LANGUAGE_VALUES).find(([, code]) => code === value);
  return entry ? (entry[0] as OfferLanguage) : null;
}
