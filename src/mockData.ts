import type { Product, PriceHistoryPoint, ShoppingSite } from './types';

// Helper to generate realistic price histories
const generateHistory = (originalPrice: number, currentPrice: number, days: number = 10): PriceHistoryPoint[] => {
  const history: PriceHistoryPoint[] = [];
  const now = new Date();
  
  // Set prices over the last X days, ending exactly on today with the current price
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    if (i === 0) {
      history.push({ date: dateStr, price: currentPrice });
    } else if (i === days - 1) {
      history.push({ date: dateStr, price: originalPrice });
    } else {
      // Create some fluctuation
      const progress = (days - 1 - i) / (days - 1);
      const targetPrice = originalPrice - (originalPrice - currentPrice) * progress;
      const fluctuation = (Math.random() - 0.5) * (originalPrice * 0.05); // 5% fluctuation max
      const calculatedPrice = Number((targetPrice + fluctuation).toFixed(2));
      // Clamp to ensure it doesn't drop below 40% of original price
      const price = Math.max(originalPrice * 0.4, calculatedPrice);
      history.push({ date: dateStr, price: Number(price.toFixed(2)) });
    }
  }
  
  return history;
};

export const INITIAL_SITES: ShoppingSite[] = [
  {
    id: 'site-1',
    name: 'Zalando',
    domain: 'zalando.de',
    logoColor: '#ea580c',
    isActive: true,
    addedAt: 'May 10, 2026',
    description: 'European fashion giant offering a massive catalog of clothing, sportswear, and designer sneakers.'
  },
  {
    id: 'site-2',
    name: 'BSTN',
    domain: 'bstn.com',
    logoColor: '#0284c7',
    isActive: true,
    addedAt: 'May 12, 2026',
    description: 'Premium international streetwear hub specializing in highly coveted sneaker drops and premium apparel.'
  },
  {
    id: 'site-3',
    name: 'END',
    domain: 'endclothing.com',
    logoColor: '#854d0e',
    isActive: true,
    addedAt: 'May 14, 2026',
    description: 'Luxury menswear and fashion retailer combining high-end designer pieces with contemporary street culture.'
  },
  {
    id: 'site-4',
    name: 'HHV',
    domain: 'hhv.de',
    logoColor: '#e11d48',
    isActive: true,
    addedAt: 'May 15, 2026',
    description: 'Unique boutique combining vinyl records, underground hip-hop releases, and curated classic streetwear.'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    title: 'New Balance 2002RD "Protection Pack" Neon Glow',
    url: 'https://www.bstn.com/en/p/new-balance-m2002rdb-protection-pack',
    store: 'BSTN',
    originalPrice: 190.00,
    currentPrice: 149.99,
    image: '/sneaker_jordan.png',
    category: 'Sneakers',
    trackingSince: 'May 18, 2026',
    alertPrice: 145.00,
    isTracked: true,
    history: generateHistory(190.00, 149.99, 12),
    lastChecked: '5 minutes ago'
  },
  {
    id: 'prod-2',
    title: 'MF DOOM - MM..FOOD (Deluxe 2xLP Vinyl Record)',
    url: 'https://www.hhv.de/shop/en/item/mf-doom-mm-food-deluxe-vinyl-edition',
    store: 'HHV',
    originalPrice: 42.99,
    currentPrice: 32.99,
    image: '/vinyl_record.png',
    category: 'Vinyl & Music',
    trackingSince: 'May 20, 2026',
    alertPrice: 35.00,
    isTracked: true,
    history: generateHistory(42.99, 32.99, 10),
    lastChecked: '2 minutes ago'
  },
  {
    id: 'prod-3',
    title: 'Arc\'teryx Beta LT Waterproof Jacket Blackout',
    url: 'https://www.zalando.de/arcteryx-beta-lt-hardshell-jacket-black',
    store: 'Zalando',
    originalPrice: 450.00,
    currentPrice: 389.99,
    image: '/outdoor_jacket.png',
    category: 'Clothing',
    trackingSince: 'May 14, 2026',
    alertPrice: 400.00,
    isTracked: true,
    history: generateHistory(450.00, 389.99, 15),
    lastChecked: '12 minutes ago'
  },
  {
    id: 'prod-4',
    title: 'Stone Island Compass Patch Organic Tee',
    url: 'https://www.endclothing.com/en-de/stone-island-compass-patch-tee-781524113.html',
    store: 'END',
    originalPrice: 145.00,
    currentPrice: 145.00,
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=60',
    category: 'Clothing',
    trackingSince: 'May 22, 2026',
    alertPrice: 120.00,
    isTracked: true,
    history: generateHistory(145.00, 145.00, 8),
    lastChecked: '1 hour ago'
  },
  {
    id: 'prod-5',
    title: 'Adidas Originals Samba OG White Black Gum',
    url: 'https://www.zalando.de/adidas-originals-samba-og-sneakers-white-ad115o06k-a11.html',
    store: 'Zalando',
    originalPrice: 120.00,
    currentPrice: 95.00,
    image: 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=800&auto=format&fit=crop&q=60',
    category: 'Sneakers',
    trackingSince: 'May 19, 2026',
    alertPrice: 100.00,
    isTracked: true,
    history: generateHistory(120.00, 95.00, 11),
    lastChecked: '25 minutes ago'
  },
  {
    id: 'prod-6',
    title: 'Carhartt WIP Single Knee Pant Dearborn Canvas',
    url: 'https://www.hhv.de/shop/en/item/carhartt-wip-single-knee-pant-dearborn-canvas-hamilton-brown',
    store: 'HHV',
    originalPrice: 109.99,
    currentPrice: 87.99,
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&auto=format&fit=crop&q=60',
    category: 'Clothing',
    trackingSince: 'May 21, 2026',
    alertPrice: 90.00,
    isTracked: true,
    history: generateHistory(109.99, 87.99, 9),
    lastChecked: '45 minutes ago'
  },
  {
    id: 'prod-7',
    title: 'Salomon XT-6 Gore-Tex Premium Utility',
    url: 'https://www.bstn.com/en/p/salomon-xt-6-gtx-black-ebony',
    store: 'BSTN',
    originalPrice: 200.00,
    currentPrice: 200.00,
    image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop&q=60',
    category: 'Sneakers',
    trackingSince: 'May 25, 2026',
    alertPrice: 180.00,
    isTracked: false,
    history: generateHistory(200.00, 200.00, 5),
    lastChecked: '3 hours ago'
  },
  {
    id: 'prod-8',
    title: 'Stussy Stock Logo Trucker Cap Pigment Dyed',
    url: 'https://www.endclothing.com/en-de/stussy-stock-logo-trucker-cap',
    store: 'END',
    originalPrice: 49.00,
    currentPrice: 39.00,
    image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&auto=format&fit=crop&q=60',
    category: 'Accessories',
    trackingSince: 'May 24, 2026',
    alertPrice: 40.00,
    isTracked: true,
    history: generateHistory(49.00, 39.00, 6),
    lastChecked: '30 minutes ago'
  }
];
