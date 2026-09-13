export type CenterStatus = 'ACTIVE' | 'CLOSED' | 'TEMPORARILY_CLOSED' | 'UNKNOWN';
export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'PENDING';
export type VoteType = 'UP' | 'DOWN';

export type RecyclableCategory =
  | 'Paper'
  | 'Plastic'
  | 'Glass'
  | 'Metal'
  | 'Aluminium'
  | 'E-Waste'
  | 'Used Clothes'
  | 'Cooking Oil'
  | 'Batteries'
  | 'Light Bulbs'
  | 'Printer Cartridges'
  | 'Cardboard'
  | 'Furniture'
  | 'General Recycling';

export const RECYCLABLE_CATEGORIES: RecyclableCategory[] = [
  'Paper',
  'Plastic',
  'Glass',
  'Metal',
  'Aluminium',
  'E-Waste',
  'Used Clothes',
  'Cooking Oil',
  'Batteries',
  'Light Bulbs',
  'Printer Cartridges',
  'Cardboard',
  'Furniture',
  'General Recycling',
];

export const MALAYSIA_STATES = [
  'Kuala Lumpur',
  'Selangor',
  'Penang',
  'Johor',
  'Perak',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Kedah',
  'Kelantan',
  'Terengganu',
  'Perlis',
  'Sabah',
  'Sarawak',
  'Putrajaya',
  'Labuan',
] as const;

export type MalaysiaState = (typeof MALAYSIA_STATES)[number];

export interface OpeningHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

export interface RecyclingCenter {
  id: string;
  slug: string;
  name: string;
  address: string;
  state: string;
  area: string;
  latitude: number;
  longitude: number;
  phone?: string;
  website_url?: string;
  google_maps_url?: string;
  accepted_items: RecyclableCategory[];
  tags: string[];
  opening_hours: OpeningHours;
  status: CenterStatus;
  verification_status: VerificationStatus;
  upvote_count: number;
  downvote_count: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  last_verified_at?: string;
  // computed
  distance_km?: number;
  thumbnail_url?: string;
}

export const MAX_PHOTOS_PER_CENTER = 3;

export interface CenterPhoto {
  id: string;
  center_slug: string;
  url: string;
  content_type: string;
  size: number;
  slot: number;
  created_at: string;
}

export interface SearchParams {
  q?: string;
  state?: string;
  items?: string[];
  open_now?: boolean;
  verified_only?: boolean;
  sort?: 'nearest' | 'most_upvoted' | 'recently_updated';
  lat?: number;
  lng?: number;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  centers: RecyclingCenter[];
  total: number;
  page: number;
  limit: number;
}
