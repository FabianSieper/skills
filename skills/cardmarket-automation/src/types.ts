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