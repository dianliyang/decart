# OmniTrack // Premium Price Tracker & Aggregator

OmniTrack is a state-of-the-art e-commerce aggregator, price-tracking pipeline, and wardrobe cataloging application. Specially designed for sneakerheads, audiophiles, and fashion enthusiasts, it automatically aggregates products from leading platforms (like Zalando, End, BSTN, HHV, and Asphaltgold) using a Manifest V3 Chrome Companion extension, analyzes pricing patterns, and dynamically categorizes items using advanced heuristics.

---

## 🚀 Key Architectural Features

### 1. Dual Collection Tracking System
OmniTrack facilitates two primary tracking domains, beautifully segregated in the premium UI:
- **Active Products Tracker**: 
  - Tracks wishlist items, alerts users on price changes, and visualizes price-drop metrics.
  - Implements sparkline charting on product cards for quick historical checks.
  - Computes exact lifetime savings, total active deals, and highlights active discounts.
- **My Owned Collection**:
  - Catalogues items that have already been purchased.
  - Marked with a custom absolute-positioned purple **Owned** badge on product cards.
  - Pauses unnecessary price history checks and active notification rules for items already in your possession.
  - Features quick-access toggles within the slide-out product details drawer.

### 2. Intelligent Chrome Companion Auto-Sync
The custom **Manifest V3 Chrome Companion** operates silently in the background or manual scan modes to scrape active collections:
- **Owned Wardrobe List Syncing**: 
  - Automatically detects if the tab URL corresponds to an owned wardrobe path (such as `/owned/` or `/owned` pathways on Zalando: `https://en.zalando.de/wardrobe/lists/owned/`).
  - Synced products from owned paths initialize with `isOwned: true` and `isTracked: false` automatically.
- **Recommendation & Carousel Filter**:
  - E-commerce portals often bloat synchronization payloads with cross-promotions ("Customers also bought", "Similar products", "You might also like").
  - The scraper traverses the parent DOM node tree, cross-referencing against **24 common recommendation, upsell, and slider attributes** (e.g. `upsell`, `cross-sell`, `complete-the-look`, `style-it-with`, `reco`, `similar`, `trending`, `carousel`, `slider`, `sponsored`).
  - Successfully excludes promotional clutter, keeping wishlists pristine.

### 3. Advanced Heuristics Classification Engine
Products scraped across multiple platforms occasionally suffer from ambiguous category tags or retailer misclassification. OmniTrack runs a comprehensive **Keyword Density Scoring & Brand-Scrubbing pipeline** to sort products:
- **Brand Normalization**: Sanitizes colliding brand strings (e.g. `Polo Ralph Lauren`, `Nudie Jeans`, `Levi's`) prior to category calculations. This ensures that a "Polo Ralph Lauren Hat" or "Nudie Jeans Jacket" doesn't falsely categorize as a "Shirt" or "Pants & Jeans".
- **Shoe Sizing Pattern Matching**: Detects typical shoe size structures (e.g. `42 |`, `42 2/3 |`, or European/UK shoe size formats) to deterministically catalog items under **Sneakers**.
- **Contamination Adjustments**: Deducts/zeroes category scores when conflict words (like `socks`, `bag`, `cap` in sneaker titles) are present to guarantee clean division between Sneakers, Hats & Beanies, Shirts, Pants, and Accessories.

### 4. Robust Null-Safe Pricing Support
Retail items (especially limited-edition streetwear or vintage vinyl) frequently sell out or lack explicit price listings. 
- Type interfaces and SQL/JSON engines are updated to allow `currentPrice` and `originalPrice` to be `number | null`.
- Avoids runtime errors (such as `Cannot read properties of null (reading 'toFixed')`) by rendering fallback labels `"No Price Listed"`.
- Seamlessly bypasses history-saving routines, alerts, and graphs where pricing data is absent.

---

## 🛠️ Technology Stack
- **Frontend**: React 19, Vite, TypeScript, Lucide Icons, Custom Premium HSL CSS (no generic templates).
- **Backend**: Node.js, Express, Lowdb JSON storage (active db state is git-ignored via `backend/db.json` and isolated locally).
- **Companion**: Manifest V3 Chrome Extension.
- **Deployment**: Multi-stage lightweight Docker containers (Frontend uses an optimized Nginx build; Backend runs Node 20-alpine).

---

## 🐳 Docker Deployment (Recommended)

Run the entire suite synchronously in isolated containers. Simply run:

```bash
docker-compose up --build -d
```

### Port Mappings
- **Frontend App**: `http://localhost:5174` (served via production-grade Nginx redirect rules)
- **Backend API**: `http://localhost:5001` (express app with hot-reloading volume mounts)

To stop services:
```bash
docker-compose down
```

---

## 💻 Local Development Setup

If you prefer to run services bare-metal:

### 1. Prerequisite
Ensure you have `Node.js v20+` and `npm` installed.

### 2. Backend Setup
```bash
cd backend
npm install
node server.js
```
The REST API server will launch on `http://localhost:5001`.

### 3. Frontend Setup
From the repository root:
```bash
npm install
npm run dev
```
The Vite development server will spin up on `http://localhost:5173` or `http://localhost:5174` as configured.

### 4. Chrome Extension Companion
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** (top-right corner).
3. Click **Load unpacked** (top-left corner).
4. Select the `extension` subdirectory within this project.
5. Trigger scans from any e-commerce page!

---

## 📁 Repository Structure
```text
├── backend/
│   ├── Dockerfile         # Dockerized backend build
│   ├── package.json       # Express service dependencies
│   ├── server.js          # REST API server (classification, sync controller)
│   └── db.json            # Local JSON database (git-ignored)
├── extension/
│   ├── manifest.json      # Extension V3 definitions
│   ├── content.js         # Content crawler (strips carousels, maps tab URL)
│   ├── popup.html         # Scraper HUD view
│   └── popup.js           # Scraping sync executor
├── src/
│   ├── components/        # React components (Dashboard, ProductCard, Drawer)
│   ├── types.ts           # Shared TypeScript definitions
│   ├── App.css / index.css# Custom sleek typography & HSL variables
│   └── main.tsx           # Entrypoint
├── Dockerfile             # Multi-stage production Nginx frontend Dockerfile
├── docker-compose.yml     # Multi-container conductor
└── README.md              # Documentation
```
