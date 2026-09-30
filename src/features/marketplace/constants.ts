import type { BusinessType, BusinessVerificationStatus, PackagingType, ProductStatus } from "@/lib/db/types";

/** Liberia's 15 counties — mirrors the public.lr_county domain. */
export const COUNTIES = [
  "Bomi", "Bong", "Gbarpolu", "Grand Bassa", "Grand Cape Mount", "Grand Gedeh", "Grand Kru",
  "Lofa", "Margibi", "Maryland", "Montserrado", "Nimba", "River Cess", "River Gee", "Sinoe",
] as const;
export type County = (typeof COUNTIES)[number];

export const BUSINESS_TYPES: Record<BusinessType, string> = {
  importer: "Importer",
  wholesaler: "Wholesaler",
  distributor: "Distributor",
  manufacturer: "Manufacturer / producer",
  retailer: "Retailer",
  transport: "Transport / logistics",
};

export const SELLER_BUSINESS_TYPES: BusinessType[] = ["importer", "wholesaler", "distributor", "manufacturer"];

export const PACKAGING: Record<PackagingType, string> = {
  bag: "Bag",
  sack: "Sack",
  carton: "Carton",
  box: "Box",
  crate: "Crate",
  drum: "Drum",
  jerrycan: "Jerrycan",
  bottle: "Bottle",
  tin: "Tin",
  bale: "Bale",
  bundle: "Bundle",
  roll: "Roll",
  pallet: "Pallet",
  piece: "Piece",
  other: "Other",
};

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; tone: "neutral" | "escrow" | "signal" | "danger" }> = {
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Live", tone: "escrow" },
  paused: { label: "Paused", tone: "signal" },
  archived: { label: "Archived", tone: "danger" },
};

export const VERIFICATION: Record<BusinessVerificationStatus, { label: string; tone: "neutral" | "escrow" | "signal" | "danger" }> = {
  unverified: { label: "Not verified", tone: "neutral" },
  pending: { label: "Verification pending", tone: "signal" },
  verified: { label: "Verified business", tone: "escrow" },
  rejected: { label: "Verification rejected", tone: "danger" },
};

/** Common origins for goods sold in Liberia; ISO 3166-1 alpha-2. */
export const ORIGIN_COUNTRIES: Record<string, string> = {
  LR: "Liberia", CN: "China", IN: "India", TH: "Thailand", VN: "Vietnam", PK: "Pakistan",
  TR: "Türkiye", AE: "United Arab Emirates", US: "United States", BR: "Brazil", NL: "Netherlands",
  GB: "United Kingdom", FR: "France", BE: "Belgium", DE: "Germany", ES: "Spain", IT: "Italy",
  MY: "Malaysia", ID: "Indonesia", GH: "Ghana", NG: "Nigeria", CI: "Côte d'Ivoire", GN: "Guinea",
  SL: "Sierra Leone", SN: "Senegal", MA: "Morocco", EG: "Egypt", ZA: "South Africa",
};

export const LISTING_SORTS = {
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  moq_asc: "Lowest minimum order",
} as const;
export type ListingSort = keyof typeof LISTING_SORTS;

export const PAGE_SIZE = 24;
