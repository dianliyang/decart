const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

// ==========================================
// SEED CONFIGURATIONS & DB LOADERS
// ==========================================
const INITIAL_SITES = [
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

let db = {
  products: [],
  sites: INITIAL_SITES,
  notifications: []
};

function resolveCategory(title, url = '') {
  const text = `${title} ${url}`.toLowerCase();
  
  if (/(?:vinyl|record|music|lp|album|singles?|ep|turntable|cassette|cd|soundtrack)/i.test(text)) {
    return 'Vinyl & Music';
  }
  
  if (/(?:hat|caps?|beanies?|scarfs?|gloves?|keychains?|backpacks?|totes?|watches?|jewelry|rings?|necklaces?|bracelets?|umbrellas?)/i.test(text)) {
    return 'Hats & Beanies';
  }
  
  if (/(?:jacket|coats?|windbreakers?|track\s*tops?|blazers?|parkas?|trench|bombers?)/i.test(text)) {
    return 'Jackets';
  }
  
  if (/(?:shirts?|t-shirts?|tees?|polos?|crews?|pullovers?)/i.test(text)) {
    return 'Shirts';
  }
  
  if (/(?:pants?|jeans|denim|trousers?|shorts?|joggers?|cargos?)/i.test(text)) {
    return 'Pants & Jeans';
  }
  
  if (/(?:socks?|bags?|accessories?|sunglasses|glasses|wallets?|belts?)/i.test(text)) {
    return 'Accessories';
  }
  
  if (/(?:vests?|hoodies?|sweatshirts?|fleece|knit|sweaters?|cardigans?|suits?|underwears?|sweats?)/i.test(text)) {
    return 'Clothing';
  }
  
  if (/(?:sneakers?|shoes?|boots?|runners?|trainers?|sandals?|slides?|clogs?|mules?|slip-on|loafers?|derby|oxfords?|sambas?|gazelles?|dunks?|jordans?)/i.test(text)) {
    return 'Sneakers';
  }
  
  return 'Sneakers';
}

// Load database from file system
function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      db = JSON.parse(raw);
      // Ensure arrays exist
      if (!db.products) db.products = [];
      if (!db.sites) db.sites = INITIAL_SITES;
      if (!db.notifications) db.notifications = [];
      
      // Auto-migrate, sanitize simulated prices, and categorize existing products
      let migratedCount = 0;
      let sanitizedCount = 0;
      let endRenamedCount = 0;
      db.products = db.products.map(p => {
        let updated = { ...p };
        
        // 1. Correct category
        const correctCategory = resolveCategory(p.title, p.url);
        if (p.category !== correctCategory) {
          updated.category = correctCategory;
          migratedCount++;
        }
        
        // 2. Sanitize simulated prices that drifted under the legacy ticker.
        // Reset currentPrice to originalPrice so that they start fresh at real retail values!
        if (p.currentPrice !== p.originalPrice) {
          updated.currentPrice = p.originalPrice;
          
          // Re-generate a clean realistic history relative to originalPrice
          const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          updated.history = [
            { date: '2d ago', price: p.originalPrice },
            { date: 'Today', price: p.originalPrice },
            { date: todayStr, price: p.originalPrice }
          ];
          
          sanitizedCount++;
        }

        // 3. Rename End/End Clothing to END
        if (p.store === 'End' || p.store === 'End Clothing' || p.store === 'end') {
          updated.store = 'END';
          endRenamedCount++;
        }
        
        return updated;
      });

      // 4. Deduplicate database products (especially Zalando items) by SKU, Title, or URL!
      function getZalandoSku(url) {
        if (!url) return null;
        try {
          const urlObj = new URL(url);
          if (!urlObj.hostname.includes('zalando')) return null;

          const itemParam = urlObj.searchParams.get('item');
          if (itemParam) {
            const decoded = decodeURIComponent(itemParam);
            const parts = decoded.split(':');
            const sku = parts[parts.length - 1];
            if (sku && sku.includes('-')) return sku.toUpperCase();
          }

          const qParam = urlObj.searchParams.get('q');
          if (qParam && qParam.includes('-')) {
            return qParam.trim().toUpperCase();
          }

          const path = urlObj.pathname;
          if (path.endsWith('.html')) {
            const cleanPath = path.substring(0, path.length - 5);
            const match = cleanPath.match(/[a-z0-9]{9}-[a-z0-9]{3}/i);
            if (match) return match[0].toUpperCase();
          }
        } catch (e) {}
        return null;
      }

      const uniqueProducts = [];
      const seenZalandoSkus = new Set();
      const seenProductKeys = new Set();
      let deduplicatedCount = 0;

      db.products.forEach(p => {
        const titleKey = p.title.toLowerCase().replace(/\s+/g, ' ').trim();
        const urlKey = p.url.toLowerCase().trim();
        
        let isDuplicate = false;
        
        if (p.store === 'Zalando') {
          const sku = getZalandoSku(p.url);
          if (sku) {
            if (seenZalandoSkus.has(sku)) {
              isDuplicate = true;
            } else {
              seenZalandoSkus.add(sku);
            }
          }
        }
        
        if (seenProductKeys.has(titleKey) || seenProductKeys.has(urlKey)) {
          isDuplicate = true;
        } else {
          seenProductKeys.add(titleKey);
          seenProductKeys.add(urlKey);
        }
        
        if (isDuplicate) {
          deduplicatedCount++;
          // Merge details if helpful
          const existing = uniqueProducts.find(x => {
            if (p.store === 'Zalando' && getZalandoSku(p.url) && getZalandoSku(x.url) === getZalandoSku(p.url)) {
              return true;
            }
            return x.title.toLowerCase().replace(/\s+/g, ' ').trim() === titleKey || x.url.toLowerCase().trim() === urlKey;
          });
          if (existing) {
            if (p.currentPrice < existing.currentPrice) {
              existing.currentPrice = p.currentPrice;
            }
            if (p.alertPrice && !existing.alertPrice) {
              existing.alertPrice = p.alertPrice;
            }
          }
        } else {
          uniqueProducts.push(p);
        }
      });

      if (deduplicatedCount > 0) {
        db.products = uniqueProducts;
      }

      if (db.sites) {
        db.sites = db.sites.map(s => {
          if (s.name === 'End Clothing' || s.name === 'End' || s.name === 'end') {
            s.name = 'END';
            s.domain = 'endclothing.com';
            endRenamedCount++;
          }
          return s;
        });
      }
      
      if (migratedCount > 0 || sanitizedCount > 0 || endRenamedCount > 0 || deduplicatedCount > 0) {
        saveDb();
        if (migratedCount > 0) console.log(`Successfully migrated/categorized ${migratedCount} existing products in database.`);
        if (sanitizedCount > 0) console.log(`Successfully sanitized and reset ${sanitizedCount} drifted product prices in database.`);
        if (endRenamedCount > 0) console.log(`Successfully migrated and renamed ${endRenamedCount} 'End' references to 'END' in database.`);
        if (deduplicatedCount > 0) console.log(`Successfully deduplicated and merged ${deduplicatedCount} duplicate products in database.`);
      }
      
      console.log('Database loaded successfully from', DB_PATH);
    } else {
      saveDb();
    }
  } catch (err) {
    console.error('Failed to load database, using memory default:', err);
  }
}

// Save database to file system
function saveDb() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write database to disk:', err);
  }
}

loadDb();

// ==========================================
// BACKGROUND SaaS PRICE DROP FLUX TICKER
// ==========================================
/*
setInterval(() => {
  let dbChanged = false;

  db.products = db.products.map(p => {
    // Only simulate price fluctuations on active trackers
    const siteObj = db.sites.find(s => s.name.toLowerCase() === p.store.toLowerCase());
    const siteIsActive = siteObj ? siteObj.isActive : true;

    if (!p.isTracked || !siteIsActive) return p;

    // 15% chance to adjust a product price every tick
    if (Math.random() > 0.15) return p;

    // Simulate realistic retail fluctuations relative to the original retail price!
    // Kept between 65% (great sale) and 105% (slight markup/normal retail) of originalPrice.
    const minPrice = Number((p.originalPrice * 0.65).toFixed(2));
    const maxPrice = Number((p.originalPrice * 1.05).toFixed(2));
    
    // 70% chance to drop price (giving user positive alert opportunities), 30% chance to increase/normalize
    const shouldDrop = Math.random() < 0.70;
    let changePercent;
    if (shouldDrop) {
      changePercent = -(Math.random() * 0.08 + 0.01); // -1% to -9% drop
    } else {
      changePercent = (Math.random() * 0.05 + 0.01); // +1% to +6% increase
    }

    let newPrice = Number((p.currentPrice * (1 + changePercent)).toFixed(2));
    
    // Clamp between realistic boundaries relative to originalPrice
    newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));
    newPrice = Math.max(10.00, newPrice); // absolute minimum €10
    
    if (newPrice === p.currentPrice) return p;

    const oldPrice = p.currentPrice;
    const history = [...p.history];
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    // Manage history coordinate nodes
    if (history.length > 0 && history[history.length - 1].date === todayStr) {
      history[history.length - 1].price = newPrice;
    } else {
      history.push({ date: todayStr, price: newPrice });
      if (history.length > 15) history.shift();
    }

    dbChanged = true;

    // Check if new price triggers user price alert
    if (p.alertPrice !== null && newPrice < p.alertPrice && oldPrice >= p.alertPrice) {
      db.notifications.unshift({
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        productId: p.id,
        productTitle: p.title,
        store: p.store,
        image: p.image,
        oldPrice: oldPrice,
        newPrice: newPrice,
        timestamp: 'Just now',
        read: false
      });
      if (db.notifications.length > 30) db.notifications.pop();
    }

    return {
      ...p,
      currentPrice: newPrice,
      history,
      lastChecked: 'Just now'
    };
  });

  if (dbChanged) {
    saveDb();
  }
}, 30000); // scans every 30 seconds
*/

// ==========================================
// REST SERVICES
// ==========================================

// Get all collected sites
app.get('/api/sites', (req, res) => {
  res.json(db.sites);
});

// Add custom site
app.post('/api/sites', (req, res) => {
  const { name, domain, logoColor, description } = req.body;
  if (!name || !domain) {
    return res.status(400).json({ error: 'Missing name or domain credentials' });
  }

  const newSite = {
    id: `custom-${Date.now()}`,
    name,
    domain,
    logoColor: logoColor || '#7c3aed',
    isActive: true,
    addedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    description: description || 'User aggregated custom shopping site.'
  };

  db.sites.push(newSite);
  saveDb();
  res.status(201).json(newSite);
});

// Delete custom site
app.delete('/api/sites/:id', (req, res) => {
  const { id } = req.params;
  db.sites = db.sites.filter(s => s.id !== id);
  saveDb();
  res.json({ success: true });
});

// Get all tracked products
app.get('/api/products', (req, res) => {
  res.json(db.products);
});

// Add product manually
app.post('/api/products', (req, res) => {
  const { title, url, store, originalPrice, currentPrice, image, category, alertPrice } = req.body;
  if (!title || !store || !originalPrice) {
    return res.status(400).json({ error: 'Missing required product attributes' });
  }

  const price = Number(originalPrice);
  const newProduct = {
    id: `prod-${Date.now()}`,
    title,
    url,
    store,
    originalPrice: price,
    currentPrice: Number(currentPrice || price),
    image: image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=60',
    category: category || resolveCategory(title, url),
    trackingSince: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    alertPrice: alertPrice ? Number(alertPrice) : null,
    isTracked: true,
    isOwned: false,
    history: [
      { date: '2d ago', price },
      { date: 'Today', price }
    ],
    lastChecked: 'Just now'
  };

  db.products.unshift(newProduct);
  saveDb();
  res.status(201).json(newProduct);
});

// Update product alerts/tracking states
app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { alertPrice, isTracked, isOwned } = req.body;
  
  let updated = null;
  db.products = db.products.map(p => {
    if (p.id === id) {
      updated = {
        ...p,
        alertPrice: alertPrice !== undefined ? (alertPrice === null ? null : Number(alertPrice)) : p.alertPrice,
        isTracked: isTracked !== undefined ? Boolean(isTracked) : p.isTracked,
        isOwned: isOwned !== undefined ? Boolean(isOwned) : (p.isOwned || false)
      };
      return updated;
    }
    return p;
  });

  if (updated) {
    saveDb();
    res.json(updated);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  db.products = db.products.filter(p => p.id !== id);
  saveDb();
  res.json({ success: true });
});

// Get all notifications
app.get('/api/notifications', (req, res) => {
  res.json(db.notifications);
});

// Mark all notifications as read / Clear All
app.post('/api/notifications/read-all', (req, res) => {
  db.notifications = [];
  saveDb();
  res.json({ success: true });
});

// Trigger a manual simulated drop on the backend directly!
app.post('/api/products/simulate-drop', (req, res) => {
  if (db.products.length === 0) {
    return res.status(400).json({ error: 'No products in catalog' });
  }
  const eligible = db.products.filter(p => p.isTracked);
  if (eligible.length === 0) {
    return res.status(400).json({ error: 'No active tracked products' });
  }
  const randIdx = Math.floor(Math.random() * eligible.length);
  const prod = eligible[randIdx];
  
  const oldPrice = prod.currentPrice;
  const dropRate = 0.05 + Math.random() * 0.15; // 5% to 20% drop
  const newPrice = Math.max(10.00, Number((prod.originalPrice * (1 - dropRate)).toFixed(2)));
  
  if (newPrice !== oldPrice) {
    db.products = db.products.map(p => {
      if (p.id === prod.id) {
        const history = [...p.history];
        const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        history.push({ date: todayStr, price: newPrice });
        if (history.length > 15) history.shift();
        
        db.notifications.unshift({
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          productId: p.id,
          productTitle: p.title,
          store: p.store,
          image: p.image,
          oldPrice: oldPrice,
          newPrice: newPrice,
          timestamp: 'Just now',
          read: false
        });
        if (db.notifications.length > 30) db.notifications.pop();

        return {
          ...p,
          currentPrice: newPrice,
          history,
          lastChecked: 'Just now'
        };
      }
      return p;
    });
    saveDb();
  }
  res.json({ success: true, product: prod.title });
});

// ==========================================
// CHROME COMPANION DIRECT POST SYNC PORTAL
// ==========================================
app.post('/api/sync', (req, res) => {
  const scrapedItems = req.body;
  if (!Array.isArray(scrapedItems) || scrapedItems.length === 0) {
    return res.status(400).json({ error: 'Sync payload must be a non-empty array of scraped items.' });
  }

  const newItems = [];
  const updatedItems = [];

  scrapedItems.forEach((item, index) => {
    const price = (item.price === null || item.price === undefined) ? null : Number(item.price);

    const category = resolveCategory(item.title, item.url);

    // Helper to get Zalando SKU (for API duplication checking)
    function getZalandoSku(url) {
      if (!url) return null;
      try {
        const urlObj = new URL(url);
        if (!urlObj.hostname.includes('zalando')) return null;

        const itemParam = urlObj.searchParams.get('item');
        if (itemParam) {
          const decoded = decodeURIComponent(itemParam);
          const parts = decoded.split(':');
          const sku = parts[parts.length - 1];
          if (sku && sku.includes('-')) return sku.toUpperCase();
        }

        const qParam = urlObj.searchParams.get('q');
        if (qParam && qParam.includes('-')) {
          return qParam.trim().toUpperCase();
        }

        const path = urlObj.pathname;
        if (path.endsWith('.html')) {
          const cleanPath = path.substring(0, path.length - 5);
          const match = cleanPath.match(/[a-z0-9]{9}-[a-z0-9]{3}/i);
          if (match) return match[0].toUpperCase();
        }
      } catch (e) {}
      return null;
    }

    const itemSku = getZalandoSku(item.url);
    const existingIndex = db.products.findIndex(p => {
      if (itemSku && p.store === 'Zalando') {
        const pSku = getZalandoSku(p.url);
        if (pSku && pSku === itemSku) return true;
      }
      return p.url.toLowerCase() === item.url.toLowerCase() || 
             p.title.toLowerCase() === item.title.toLowerCase();
    });

    const sourceUrlLower = (item.sourceUrl || '').toLowerCase();
    const isSyncFromOwnedList = sourceUrlLower.includes('/owned/') || sourceUrlLower.includes('/owned');

    if (existingIndex !== -1) {
      const existingProduct = db.products[existingIndex];
      const history = [...existingProduct.history];
      const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      // Append new price node to history if price changed
      if (price !== null && price !== existingProduct.currentPrice) {
        if (history.length > 0 && history[history.length - 1].date === todayStr) {
          history[history.length - 1].price = price;
        } else {
          history.push({ date: todayStr, price });
          if (history.length > 15) history.shift();
        }
      }

      // Construct the replaced/updated product
      const updatedProduct = {
        ...existingProduct,
        title: item.title,
        url: item.url,
        store: item.store,
        image: item.image || existingProduct.image,
        currentPrice: price,
        category,
        history,
        lastChecked: 'Just now',
        ...(isSyncFromOwnedList ? { isOwned: true, isTracked: false } : {})
      };

      // Update default alertPrice if price changed and alertPrice matches old default threshold
      if (price !== null && price !== existingProduct.currentPrice && existingProduct.originalPrice !== null) {
        const oldDefaultAlert = Number((existingProduct.originalPrice * 0.9).toFixed(2));
        if (existingProduct.alertPrice === oldDefaultAlert) {
          updatedProduct.alertPrice = Number((price * 0.9).toFixed(2));
        }
      }

      db.products[existingIndex] = updatedProduct;
      updatedItems.push(updatedProduct);
    } else {
      // Construct a new product
      const newProd = {
        id: `sync-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`,
        title: item.title,
        url: item.url,
        store: item.store,
        originalPrice: price,
        currentPrice: price,
        image: item.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=60',
        category,
        trackingSince: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        alertPrice: price !== null ? Number((price * 0.9).toFixed(2)) : null, // default alert at 10% off
        isTracked: isSyncFromOwnedList ? false : true,
        isOwned: isSyncFromOwnedList ? true : false,
        history: price !== null ? [
          { date: '2d ago', price },
          { date: 'Today', price }
        ] : [],
        lastChecked: 'Just now'
      };

      newItems.push(newProd);
      db.products.unshift(newProd);
    }
  });

  const totalSynced = newItems.length + updatedItems.length;

  if (totalSynced > 0) {
    saveDb();
    console.log(`Successfully synced ${totalSynced} items from Chrome Extension (${newItems.length} new, ${updatedItems.length} updated).`);
  }

  res.status(200).json({
    success: true,
    count: totalSynced,
    message: `Successfully aggregated ${newItems.length} new and updated ${updatedItems.length} products to tracker.`
  });
});

app.listen(PORT, () => {
  console.log(`OmniTrack SaaS Backend listening on http://localhost:${PORT}`);
});
