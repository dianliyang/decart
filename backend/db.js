const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = path.join(__dirname, 'omnitrack.db');
const db = new Database(DB_FILE);

// Set performance and integrity pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    logoColor TEXT NOT NULL,
    isActive INTEGER NOT NULL DEFAULT 1,
    addedAt TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    store TEXT NOT NULL,
    originalPrice REAL,
    currentPrice REAL,
    image TEXT NOT NULL,
    category TEXT NOT NULL,
    trackingSince TEXT NOT NULL,
    alertPrice REAL,
    isTracked INTEGER NOT NULL DEFAULT 1,
    isOwned INTEGER NOT NULL DEFAULT 0,
    lastChecked TEXT NOT NULL,
    FOREIGN KEY(store) REFERENCES sites(name) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId TEXT NOT NULL,
    date TEXT NOT NULL,
    price REAL,
    FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(productId, date) ON CONFLICT REPLACE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    productTitle TEXT NOT NULL,
    store TEXT NOT NULL,
    image TEXT NOT NULL,
    oldPrice REAL,
    newPrice REAL,
    timestamp TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
  );
`);

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
  },
  {
    id: 'site-5',
    name: 'Asphaltgold',
    domain: 'asphaltgold.com',
    logoColor: '#8b5cf6',
    isActive: true,
    addedAt: 'May 31, 2026',
    description: 'Premier German sneaker and streetwear destination offering highly curated footwear releases and apparel collections.'
  }
];

// Seed sites if database is completely empty
const stmtCountSites = db.prepare('SELECT COUNT(*) AS count FROM sites');
const { count } = stmtCountSites.get();
if (count === 0) {
  const insertSite = db.prepare(`
    INSERT INTO sites (id, name, domain, logoColor, isActive, addedAt, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((sitesList) => {
    for (const site of sitesList) {
      insertSite.run(
        site.id,
        site.name,
        site.domain,
        site.logoColor,
        site.isActive ? 1 : 0,
        site.addedAt,
        site.description
      );
    }
  });
  transaction(INITIAL_SITES);
  console.log('Seeded initial shopping sites into SQLite database.');
}

// Check for legacy db.json and migrate
const legacyDbPath = path.join(__dirname, 'db.json');
if (fs.existsSync(legacyDbPath)) {
  console.log('Discovered legacy db.json file. Migrating to SQLite...');
  try {
    const raw = fs.readFileSync(legacyDbPath, 'utf8');
    const legacy = JSON.parse(raw);
    
    // Temporarily disable foreign keys during migration to handle historical orphans
    db.pragma('foreign_keys = OFF');
    
    db.transaction(() => {
      // 1. Migrate sites
      if (Array.isArray(legacy.sites)) {
        const upsertSite = db.prepare(`
          INSERT INTO sites (id, name, domain, logoColor, isActive, addedAt, description)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            domain=excluded.domain,
            logoColor=excluded.logoColor,
            isActive=excluded.isActive,
            addedAt=excluded.addedAt,
            description=excluded.description
        `);
        for (const s of legacy.sites) {
          upsertSite.run(s.id, s.name, s.domain, s.logoColor, s.isActive ? 1 : 0, s.addedAt, s.description);
        }
      }
      
      // 2. Migrate products
      if (Array.isArray(legacy.products)) {
        const insertProduct = db.prepare(`
          INSERT OR IGNORE INTO products (
            id, title, url, store, originalPrice, currentPrice, image, category,
            trackingSince, alertPrice, isTracked, isOwned, lastChecked
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const insertHistory = db.prepare(`
          INSERT OR IGNORE INTO price_history (productId, date, price)
          VALUES (?, ?, ?)
        `);

        for (const p of legacy.products) {
          insertProduct.run(
            p.id,
            p.title,
            p.url,
            p.store,
            p.originalPrice,
            p.currentPrice,
            p.image,
            p.category,
            p.trackingSince,
            p.alertPrice,
            p.isTracked ? 1 : 0,
            p.isOwned ? 1 : 0,
            p.lastChecked || 'Just now'
          );
          
          if (Array.isArray(p.history)) {
            for (const h of p.history) {
              insertHistory.run(p.id, h.date, h.price);
            }
          }
        }
      }

      // 3. Migrate notifications
      if (Array.isArray(legacy.notifications)) {
        const insertNotif = db.prepare(`
          INSERT OR IGNORE INTO notifications (
            id, productId, productTitle, store, image, oldPrice, newPrice, timestamp, read
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const n of legacy.notifications) {
          insertNotif.run(
            n.id,
            n.productId,
            n.productTitle,
            n.store,
            n.image,
            n.oldPrice,
            n.newPrice,
            n.timestamp,
            n.read ? 1 : 0
          );
        }
      }
    })();
    
    // Purge orphaned notifications/histories to secure database consistency
    const deletedHist = db.prepare('DELETE FROM price_history WHERE productId NOT IN (SELECT id FROM products)').run();
    const deletedNotif = db.prepare('DELETE FROM notifications WHERE productId NOT IN (SELECT id FROM products)').run();
    if (deletedHist.changes > 0) console.log(`Cleaned up ${deletedHist.changes} orphaned price history records.`);
    if (deletedNotif.changes > 0) console.log(`Cleaned up ${deletedNotif.changes} orphaned notification logs.`);
    
    // Re-enable foreign key constraints
    db.pragma('foreign_keys = ON');
    
    console.log('Successfully migrated legacy db.json data to SQLite!');
    
    // Backup legacy file to prevent re-migration
    fs.renameSync(legacyDbPath, legacyDbPath + '.bak');
    console.log(`Backup created: db.json renamed to db.json.bak`);
  } catch (err) {
    // Make sure we re-enable foreign keys if transaction failed
    db.pragma('foreign_keys = ON');
    console.error('Failed to migrate legacy db.json database:', err);
  }
}

// Data operation controllers
module.exports = {
  conn: db,

  // --- SITES ---
  getAllSites() {
    const stmt = db.prepare('SELECT * FROM sites');
    return stmt.all().map(s => ({
      ...s,
      isActive: Boolean(s.isActive)
    }));
  },

  addSite(site) {
    const stmt = db.prepare(`
      INSERT INTO sites (id, name, domain, logoColor, isActive, addedAt, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(site.id, site.name, site.domain, site.logoColor, site.isActive ? 1 : 0, site.addedAt, site.description);
    return site;
  },

  deleteSite(id) {
    const stmt = db.prepare('DELETE FROM sites WHERE id = ?');
    stmt.run(id);
  },

  // --- PRODUCTS ---
  getAllProducts() {
    const stmtProds = db.prepare('SELECT * FROM products');
    const products = stmtProds.all();

    const stmtHist = db.prepare('SELECT date, price FROM price_history WHERE productId = ? ORDER BY id ASC');

    return products.map(p => {
      const history = stmtHist.all(p.id);
      return {
        ...p,
        isTracked: Boolean(p.isTracked),
        isOwned: Boolean(p.isOwned),
        history
      };
    });
  },

  addProduct(product) {
    const stmtProd = db.prepare(`
      INSERT INTO products (
        id, title, url, store, originalPrice, currentPrice, image, category,
        trackingSince, alertPrice, isTracked, isOwned, lastChecked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmtProd.run(
      product.id,
      product.title,
      product.url,
      product.store,
      product.originalPrice,
      product.currentPrice,
      product.image,
      product.category,
      product.trackingSince,
      product.alertPrice,
      product.isTracked ? 1 : 0,
      product.isOwned ? 1 : 0,
      product.lastChecked
    );

    if (Array.isArray(product.history)) {
      const stmtHist = db.prepare(`
        INSERT INTO price_history (productId, date, price)
        VALUES (?, ?, ?)
      `);
      for (const h of product.history) {
        stmtHist.run(product.id, h.date, h.price);
      }
    }

    return product;
  },

  updateProduct(id, updates) {
    const keys = Object.keys(updates);
    if (keys.length === 0) return this.getProductById(id);

    const setClauses = [];
    const values = [];

    for (const key of keys) {
      if (['alertPrice', 'isTracked', 'isOwned', 'currentPrice', 'lastChecked', 'title', 'url', 'store', 'image', 'category'].includes(key)) {
        setClauses.push(`${key} = ?`);
        let val = updates[key];
        if (key === 'isTracked' || key === 'isOwned') {
          val = val ? 1 : 0;
        }
        values.push(val);
      }
    }

    if (setClauses.length > 0) {
      values.push(id);
      const query = `UPDATE products SET ${setClauses.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(query);
      stmt.run(...values);
    }

    return this.getProductById(id);
  },

  getProductById(id) {
    const stmtProd = db.prepare('SELECT * FROM products WHERE id = ?');
    const p = stmtProd.get(id);
    if (!p) return null;

    const stmtHist = db.prepare('SELECT date, price FROM price_history WHERE productId = ? ORDER BY id ASC');
    const history = stmtHist.all(id);

    return {
      ...p,
      isTracked: Boolean(p.isTracked),
      isOwned: Boolean(p.isOwned),
      history
    };
  },

  deleteProduct(id) {
    const stmt = db.prepare('DELETE FROM products WHERE id = ?');
    stmt.run(id);
  },

  addPriceHistoryPoint(productId, date, price) {
    const stmt = db.prepare(`
      INSERT INTO price_history (productId, date, price)
      VALUES (?, ?, ?)
      ON CONFLICT(productId, date) DO UPDATE SET price = excluded.price
    `);
    stmt.run(productId, date, price);
  },

  trimPriceHistory(productId, maxLength = 15) {
    const stmtCount = db.prepare('SELECT COUNT(*) AS count FROM price_history WHERE productId = ?');
    const { count } = stmtCount.get(productId);
    
    if (count > maxLength) {
      const stmtIds = db.prepare('SELECT id FROM price_history WHERE productId = ? ORDER BY id ASC LIMIT ?');
      const idsToDelete = stmtIds.all(productId, count - maxLength).map(x => x.id);
      
      const stmtDelete = db.prepare(`DELETE FROM price_history WHERE id IN (${idsToDelete.map(() => '?').join(',')})`);
      stmtDelete.run(...idsToDelete);
    }
  },

  // --- NOTIFICATIONS ---
  getAllNotifications() {
    const stmt = db.prepare('SELECT * FROM notifications ORDER BY timestamp DESC, id DESC');
    return stmt.all().map(n => ({
      ...n,
      read: Boolean(n.read)
    }));
  },

  addNotification(n) {
    const stmt = db.prepare(`
      INSERT INTO notifications (
        id, productId, productTitle, store, image, oldPrice, newPrice, timestamp, read
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      n.id,
      n.productId,
      n.productTitle,
      n.store,
      n.image,
      n.oldPrice,
      n.newPrice,
      n.timestamp,
      n.read ? 1 : 0
    );

    const stmtCount = db.prepare('SELECT COUNT(*) AS count FROM notifications');
    const { count } = stmtCount.get();
    if (count > 30) {
      const stmtOldest = db.prepare('SELECT id FROM notifications ORDER BY timestamp ASC, id ASC LIMIT ?');
      const idsToDelete = stmtOldest.all(count - 30).map(x => x.id);
      const stmtDelete = db.prepare(`DELETE FROM notifications WHERE id IN (${idsToDelete.map(() => '?').join(',')})`);
      stmtDelete.run(...idsToDelete);
    }

    return n;
  },

  clearAllNotifications() {
    const stmt = db.prepare('DELETE FROM notifications');
    stmt.run();
  }
};
