export interface PriceHistoryPoint {
  date: string;
  price: number;
}

export type CategoryName = 'Sneakers' | 'Clothing' | 'Jackets' | 'Shirts' | 'Pants & Jeans' | 'Hats & Beanies' | 'Vinyl & Music' | 'Accessories';

export interface ShoppingSite {
  id: string;
  name: string;
  domain: string;
  logoColor: string; // Brand color in hex or HSL
  isActive: boolean;
  addedAt: string;
  description?: string;
}

export interface Product {
  id: string;
  title: string;
  url: string;
  store: string; // Dynamic store reference matching ShoppingSite domain/name
  currentPrice: number | null;
  originalPrice: number | null;
  image: string;
  category: CategoryName;
  trackingSince: string;
  alertPrice: number | null;
  isTracked: boolean;
  isOwned?: boolean;
  history: PriceHistoryPoint[];
  lastChecked: string;
}

export interface Notification {
  id: string;
  productId: string;
  productTitle: string;
  store: string;
  oldPrice: number;
  newPrice: number;
  timestamp: string;
  read: boolean;
  image: string;
}
