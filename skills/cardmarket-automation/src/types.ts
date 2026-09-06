/** Structured card detail (top block) – verified on
 *  /en/Magic/Products/Singles/<Set>/<Card>.
 */
export type CardInfo = {
  title: string;
  rarity: string;
  number: string;
  printedIn: string;
  reprints: string;
  availableItems: string;
  from: string;
  priceTrend: string;
  avg30d: string;
  avg7d: string;
  avg1d: string;
  image: string;
  url: string;
};

/** One seller row on a card detail page (main .article-row). */
export type SellerOffer = {
  seller: string;
  location: string;
  condition: string;
  language: string;
  price: string;
  quantity: string;
};

export type UserOffer = {
  articleId: number;
  seller: string;
  card: string;
  set: string;
  condition: string;
  language: string;
  price: string;
  quantity: number;
};

export type UserOffersOutput = {
  state: StateId;
  card: string;
  set: string;
  url: string;
  found: boolean;
  count: number;
  offers: UserOffer[];
  auth: AuthInfo;
};

export type UserOfferChanges = Record<string, string | number | boolean>;

/** One row on Selling → My Offers → Singles (`#UserOffersTable`). */
export type OwnOffer = {
  articleId: number;
  card: string;
  cardUrl: string;
  condition: string;
  language: string;
  price: string;
  quantity: number;
};

/** The visible values currently selected in the left-hand stock filter. */
export type OwnOfferFilterState = {
  cardName: string;
  expansion: string;
  rarity: string;
  condition: string;
  language: string;
  comments: string;
  minPrice: string;
  maxPrice: string;
  minQuantity: string;
  foil: string;
  signed: string;
  altered: string;
  sort: string;
};

/** A partial request to change one or more left-hand stock filters. */
export type OwnOfferFilter = Partial<{
  cardName: string;
  expansion: string;
  rarity: string;
  condition: string;
  language: string;
  comments: string;
  minPrice: number;
  maxPrice: number;
  minQuantity: number;
  foil: 'any' | 'yes' | 'no';
  signed: 'any' | 'yes' | 'no';
  altered: 'any' | 'yes' | 'no';
  sort: string;
}>;

export type UserOfferUpdateOutput = {
  state: 'detail';
  articleId: number;
  card: string;
  set: string;
  url: string;
  offer: UserOffer;
  changes: UserOfferChanges;
  verified: boolean;
  auth: AuthInfo;
};

/** Seller-filter value types (card detail page filter form). */
export type FilterCondition = 'any' | 'poor' | 'played' | 'light-played' | 'good' | 'excellent' | 'near-mint' | 'mint';
export type FilterLanguage = 'any' | 'english' | 'french' | 'german' | 'spanish' | 'italian' | 's-chinese' | 'japanese' | 'portuguese' | 'russian' | 't-chinese';
export type FilterYesNo = 'any' | 'yes' | 'no';
export type FilterSellerType = 'any' | 'private' | 'professional' | 'powerseller';
export type OfferCondition = 'mint' | 'near-mint' | 'excellent' | 'good' | 'light-played' | 'played' | 'poor';
export type OfferLanguage = Exclude<FilterLanguage, 'any'>;

/** Resolved (fully defaulted) seller filter applied before reading seller rows. */
export type ResolvedSellerFilter = {
  condition: FilterCondition;
  language: FilterLanguage;
  location: string;
  foil: FilterYesNo;
  signed: FilterYesNo;
  altered: FilterYesNo;
  sellerType: FilterSellerType;
};

/** Partial seller filter (any subset; defaults fill the rest). */
export type SellerFilter = Partial<ResolvedSellerFilter>;

/** One result tile from a card search (a.galleryBox). */
export type SearchCard = {
  name: string;
  set: string;
  image: string;
  fromPrice: string;
  url: string;
};

/** One printing / artwork from the card "Versions" page (a.card tile). */
export type Artwork = {
  card: string;
  set: string;
  version: string;
  available: string;
  fromPrice: string;
  image: string;
  url: string;
};

/** Artwork + seller quantity check (per-seller max, sellers meeting minQty). */
export type ArtworkCheck = Artwork & {
  maxSellerQuantity: number;
  sellersAtLeast: number;
  qualifies: boolean;
};

/** Output of cards.search */
export type SearchOutput = {
  query: string;
  count: number;
  cards: SearchCard[];
};

/** Output of cards.price */
export type PriceOutput = {
  found: boolean;
  card: string;
  url: string;
  filter: ResolvedSellerFilter;
  info: CardInfo;
  sellerCount: number;
  sellers: SellerOffer[];
};

/** Empty CardInfo used when cards.price finds no card. */
export function emptyCardInfo(): CardInfo {
  return {
    title: '', rarity: '', number: '', printedIn: '', reprints: '',
    availableItems: '', from: '', priceTrend: '', avg30d: '', avg7d: '',
    avg1d: '', image: '', url: '',
  };
}

/** Output of cards.artworks */
export type ArtworksOutput = {
  found: boolean;
  card: string;
  versionsUrl: string;
  total: number;
  shown: number;
  minQuantity: number;
  artworks: (Artwork | ArtworkCheck)[];
};

export type StateId = 'start' | 'results' | 'detail' | 'versions' | 'own-offers';
export type NavStatus = 'ok' | 'not_found' | 'not_available' | 'wrong_state';
export type NavOutput = { status: NavStatus; state: StateId };
export type AuthInfo = { loggedIn: boolean };
export type StartInfo = { state: 'start'; ready: boolean; auth: AuthInfo };
export type ResultsInfo = { state: 'results'; query: string; count: number; cards: SearchCard[]; auth: AuthInfo };
export type DetailInfo = { state: 'detail'; card: string; url: string; filter: ResolvedSellerFilter; info: CardInfo; sellerCount: number; sellers: SellerOffer[]; auth: AuthInfo };
export type VersionsInfo = { state: 'versions'; card: string; versionsUrl: string; total: number; shown: number; minQuantity: number; artworks: (Artwork | ArtworkCheck)[]; auth: AuthInfo };
export type OwnOffersInfo = {
  state: 'own-offers';
  url: string;
  filter: OwnOfferFilterState;
  count: number;
  offers: OwnOffer[];
  pagesVisited: number;
  complete: boolean;
  auth: AuthInfo;
};
export type InfoOutput = StartInfo | ResultsInfo | DetailInfo | VersionsInfo | OwnOffersInfo;
