const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// ==========================================
// HEURISTICS CATEGORY ENGINE
// ==========================================
function resolveCategory(title, url = '') {
  let t = `${title} ${url}`.toLowerCase();
  
  // Clean brand names to prevent false positive keyword matches
  t = t.replace("polo ralph lauren", "");
  t = t.replace("nudie jeans", "");
  t = t.replace("calvin klein jeans", "");
  t = t.replace("levi's", "");
  t = t.replace("levis", "");

  const scores = {
    "Sneakers": 0,
    "Vinyl & Music": 0,
    "Hats & Beanies": 0,
    "Jackets": 0,
    "Pants & Jeans": 0,
    "Shirts": 0,
    "Accessories": 0,
    "Clothing": 1 // Base fallback score
  };

  // --- 1. SNEAKERS SCORE ---
  if (/\b\d{2}(?:\s+\d\/\d)?\s*\|\s*/.test(t)) {
    scores["Sneakers"] += 15; // Extremely strong signal (size tag in title)
  }
  const sneakerKeywords = ["sneaker", "shoe", "boot", "slide", "sandal", "clog", "footwear", "trainer", "samba", "2002r", "xt-6", "x-alp", "verto alpine", "birkenstock", "keen", "crocs", "slip-on", "pegasus", "agravic", "cell geo", "salomon", "vomero", "wallabee", "lace-ups", "lace-up", "runner", "running", "gazelle", "dunk", "jordan", "yeezy", "clarks", "timberland", "dr. martens", "dr martens", "1461", "mayfare", "sala", "xt-quest", "adios", "adizero", "sylan", "xt-4", "1300", "chuck 70", "u992gy"];
  for (const kw of sneakerKeywords) {
    if (t.includes(kw)) scores["Sneakers"] += 5;
  }

  // --- 2. VINYL & MUSIC SCORE ---
  if (t.includes("vinyl") || t.includes("record") || t.includes(" lp") || t.endsWith(" lp") || t.includes("2xlp") || t.includes("album") || t.includes("ep") || t.includes("cassette") || t.includes(" cd")) {
    scores["Vinyl & Music"] += 10;
  }
  if (t.includes("mf doom") || t.includes("mm..food")) {
    scores["Vinyl & Music"] += 12;
  }

  // --- 3. HATS & BEANIES SCORE ---
  const hatKeywords = ["cap", "hat", "beanie", "bandana", "balaclava", "foulard", "bucket hat", "bonnet", "clean up", "tieband", "headband", "headscarf", "visor", "snapback"];
  for (const kw of hatKeywords) {
    if (t.includes(kw)) scores["Hats & Beanies"] += 8;
  }

  // --- 4. JACKETS SCORE ---
  const jacketKeywords = ["jacket", "track top", "anthem jacket", "windbreaker", "anorak", "parka", "coat", "vest", "helium down", "hood jacket", "mountain light", "hardshell", "alpha jacket", "freelight polartec", "alpha™ hood", "blazer", "bomber", "raincoat", "cardigan", "windcheater", "overcoat"];
  for (const kw of jacketKeywords) {
    if (t.includes(kw)) scores["Jackets"] += 8;
  }

  // --- 5. PANTS & JEANS SCORE ---
  const pantsKeywords = ["pants", "jorts", "shorts", "short", "sweatshort", "trousers", "bottoms", "baggies", "cargo", "chino", "jogger", "sweatpants", "single knee", "double knee", "pant", "trouser", "trousers", "leggings", "tights", "jeans"];
  for (const kw of pantsKeywords) {
    if (t.includes(kw)) scores["Pants & Jeans"] += 8;
  }

  // --- 6. SHIRTS SCORE ---
  const shirtKeywords = ["shirt", "tee", "t-shirt", "polo", "sweatshirt", "hoodie", "knit", "jersey", "top", "pullover", "crewneck", "long sleeve", "longsleeve", "tank", "tshirt", "t-shirt", "sweat", "fleece", "hood"];
  for (const kw of shirtKeywords) {
    if (t.includes(kw)) scores["Shirts"] += 7;
  }

  // --- 7. ACCESSORIES SCORE ---
  const accessoryKeywords = ["bag", "backpack", "socks", "sock", "belt", "wallet", "keychain", "sunglasses", "scarf", "gloves", "umbrella", "watch", "bottle", "accessories", "daypack", "rucksack", "neckwarmer", "snood", "sweatband", "totebag", "tote bag"];
  for (const kw of accessoryKeywords) {
    if (t.includes(kw)) scores["Accessories"] += 8;
  }

  // Deduct/Clean cross-contamination
  const hasShirtKeyword = t.includes("shirt") || t.includes("tee") || t.includes("t-shirt") || t.includes("polo") || t.includes("sweatshirt") || t.includes("hoodie") || t.includes("pullover") || t.includes("crewneck");
  if (hasShirtKeyword) {
    scores["Pants & Jeans"] = 0;
    scores["Sneakers"] = 0;
    scores["Vinyl & Music"] = 0;
  }
  if (t.includes("socks") || t.includes("sock") || t.includes("bag") || t.includes("backpack") || t.includes("cap") || t.includes("hat")) {
    scores["Sneakers"] = 0;
  }

  // Find category with highest score
  let maxScore = -1;
  let bestCategory = "Clothing";
  for (const cat in scores) {
    if (scores[cat] > maxScore) {
      maxScore = scores[cat];
      bestCategory = cat;
    }
  }

  return bestCategory;
}

// ==========================================
// REST SERVICES
// ==========================================

// Get all collected sites
app.get('/api/sites', (req, res) => {
  try {
    res.json(db.getAllSites());
  } catch (err) {
    console.error('Error fetching sites:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Add custom site
app.post('/api/sites', (req, res) => {
  try {
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

    db.addSite(newSite);
    res.status(201).json(newSite);
  } catch (err) {
    console.error('Error adding site:', err);
    res.status(500).json({ error: 'Database insertion failed' });
  }
});

// Delete custom site
app.delete('/api/sites/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.deleteSite(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting site:', err);
    res.status(500).json({ error: 'Database deletion failed' });
  }
});

// Get all tracked products
app.get('/api/products', (req, res) => {
  try {
    res.json(db.getAllProducts());
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Add product manually
app.post('/api/products', (req, res) => {
  try {
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

    db.addProduct(newProduct);
    res.status(201).json(newProduct);
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).json({ error: 'Database insertion failed' });
  }
});

// Update product alerts/tracking states
app.put('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { alertPrice, isTracked, isOwned } = req.body;
    
    const existing = db.getProductById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updates = {};
    if (alertPrice !== undefined) updates.alertPrice = alertPrice === null ? null : Number(alertPrice);
    if (isTracked !== undefined) updates.isTracked = Boolean(isTracked);
    if (isOwned !== undefined) updates.isOwned = Boolean(isOwned);

    const updated = db.updateProduct(id, updates);
    res.json(updated);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.deleteProduct(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Database deletion failed' });
  }
});

// Get all notifications
app.get('/api/notifications', (req, res) => {
  try {
    res.json(db.getAllNotifications());
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// Mark all notifications as read / Clear All
app.post('/api/notifications/read-all', (req, res) => {
  try {
    db.clearAllNotifications();
    res.json({ success: true });
  } catch (err) {
    console.error('Error clearing notifications:', err);
    res.status(500).json({ error: 'Database deletion failed' });
  }
});

// Trigger a manual simulated drop on the backend directly!
app.post('/api/products/simulate-drop', (req, res) => {
  try {
    const allProducts = db.getAllProducts();
    if (allProducts.length === 0) {
      return res.status(400).json({ error: 'No products in catalog' });
    }
    const eligible = allProducts.filter(p => p.isTracked);
    if (eligible.length === 0) {
      return res.status(400).json({ error: 'No active tracked products' });
    }
    const randIdx = Math.floor(Math.random() * eligible.length);
    const prod = eligible[randIdx];
    
    const oldPrice = prod.currentPrice;
    const dropRate = 0.05 + Math.random() * 0.15; // 5% to 20% drop
    const newPrice = Math.max(10.00, Number((prod.originalPrice * (1 - dropRate)).toFixed(2)));
    
    if (newPrice !== oldPrice) {
      const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      db.updateProduct(prod.id, {
        currentPrice: newPrice,
        lastChecked: 'Just now'
      });
      
      db.addPriceHistoryPoint(prod.id, todayStr, newPrice);
      db.trimPriceHistory(prod.id, 15);
      
      db.addNotification({
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        productId: prod.id,
        productTitle: prod.title,
        store: prod.store,
        image: prod.image,
        oldPrice: oldPrice,
        newPrice: newPrice,
        timestamp: 'Just now',
        read: false
      });
    }
    
    res.json({ success: true, product: prod.title });
  } catch (err) {
    console.error('Error simulating price drop:', err);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

// ==========================================
// CHROME COMPANION DIRECT POST SYNC PORTAL
// ==========================================
app.post('/api/sync', (req, res) => {
  try {
    const scrapedItems = req.body;
    if (!Array.isArray(scrapedItems) || scrapedItems.length === 0) {
      return res.status(400).json({ error: 'Sync payload must be a non-empty array of scraped items.' });
    }

    const allProducts = db.getAllProducts();
    const newItems = [];
    const updatedItems = [];

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

    // Execute synchronizations inside an atomic database transaction
    db.conn.transaction(() => {
      scrapedItems.forEach((item, index) => {
        const price = (item.price === null || item.price === undefined) ? null : Number(item.price);
        const category = resolveCategory(item.title, item.url);

        const itemSku = getZalandoSku(item.url);
        const existing = allProducts.find(p => {
          if (itemSku && p.store === 'Zalando') {
            const pSku = getZalandoSku(p.url);
            if (pSku && pSku === itemSku) return true;
          }
          return p.url.toLowerCase() === item.url.toLowerCase() || 
                 p.title.toLowerCase() === item.title.toLowerCase();
        });

        const sourceUrlLower = (item.sourceUrl || '').toLowerCase();
        const isSyncFromOwnedList = sourceUrlLower.includes('/owned/') || sourceUrlLower.includes('/owned');

        if (existing) {
          const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          const updates = {
            title: item.title,
            url: item.url,
            store: item.store,
            image: item.image || existing.image,
            currentPrice: price,
            category,
            lastChecked: 'Just now'
          };

          if (isSyncFromOwnedList) {
            updates.isOwned = true;
            updates.isTracked = false;
          }

          // Append new price node to history if price changed
          if (price !== null && price !== existing.currentPrice) {
            db.addPriceHistoryPoint(existing.id, todayStr, price);
            db.trimPriceHistory(existing.id, 15);
          }

          // Update default alertPrice if price changed and alertPrice matches old default threshold
          if (price !== null && price !== existing.currentPrice && existing.originalPrice !== null) {
            const oldDefaultAlert = Number((existing.originalPrice * 0.9).toFixed(2));
            if (existing.alertPrice === oldDefaultAlert) {
              updates.alertPrice = Number((price * 0.9).toFixed(2));
            }
          }

          const updated = db.updateProduct(existing.id, updates);
          updatedItems.push(updated);
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
            isTracked: !isSyncFromOwnedList,
            isOwned: isSyncFromOwnedList,
            history: price !== null ? [
              { date: '2d ago', price },
              { date: 'Today', price }
            ] : [],
            lastChecked: 'Just now'
          };

          db.addProduct(newProd);
          newItems.push(newProd);
        }
      });
    })();

    const totalSynced = newItems.length + updatedItems.length;

    if (totalSynced > 0) {
      console.log(`Successfully synced ${totalSynced} items from Chrome Extension (${newItems.length} new, ${updatedItems.length} updated).`);
    }

    res.status(200).json({
      success: true,
      count: totalSynced,
      message: `Successfully aggregated ${newItems.length} new and updated ${updatedItems.length} products to tracker.`
    });
  } catch (err) {
    console.error('Error syncing products:', err);
    res.status(500).json({ error: 'Sync aggregation failed' });
  }
});

app.listen(PORT, () => {
  console.log(`OmniTrack SaaS Backend listening on http://localhost:${PORT}`);
});
