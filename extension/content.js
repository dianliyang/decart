// OmniTrack Universal Multi-Item Scraper Script with Auto-Pagination Engine
(async () => {
  // Helper to parse price string into clean float, handling potential sale price combines
  function cleanPrice(priceText) {
    if (!priceText) return null;

    // 1. Separate numbers by keeping spaces initially
    let clean = priceText.replace(/[€$£]|EUR|GBP|USD/gi, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();

    // 2. Convert commas to decimal points or strip thousands separator intelligently
    if (clean.includes(',') && clean.includes('.')) {
      const commaIdx = clean.indexOf(',');
      const dotIdx = clean.indexOf('.');
      if (commaIdx < dotIdx) {
        // e.g. 1,250.50 -> comma is thousands, dot is decimal
        clean = clean.replace(/,/g, '');
      } else {
        // e.g. 1.250,50 -> dot is thousands, comma is decimal
        clean = clean.replace(/\./g, '').replace(',', '.');
      }
    } else if (clean.includes(',')) {
      // Only has a comma. Check if followed by exactly 3 digits (e.g. "2,125") -> thousands separator
      if (/,\d{3}(?!\d)/.test(clean)) {
        clean = clean.replace(/,/g, '');
      } else {
        // Decimal separator (e.g. "75,00")
        clean = clean.replace(',', '.');
      }
    }

    // 3. Find all number blocks
    const numbers = clean.match(/\d+(?:\.\d+)?/g);
    if (!numbers || numbers.length === 0) return null;

    // If there is only one number, return it!
    if (numbers.length === 1) {
      return parseFloat(numbers[0]);
    }

    // If there are multiple numbers (e.g., "95 57"), the last one is the active sale price!
    return parseFloat(numbers[numbers.length - 1]);
  }

  // Helper to parse price from element while stripping original retail struck-through elements
  function getCleanPriceFromElement(priceEl) {
    if (!priceEl) return null;

    const clone = priceEl.cloneNode(true);
    
    // Remove any struck-through elements (original price) from the clone
    const struckElements = clone.querySelectorAll(
      '.line-through, [class*="line-through"], strike, del, ' +
      '[class*="original"], [class*="old"], [class*="retail"], [class*="lineThrough"], ' +
      '[class*="was"], [class*="Was"], [class*="strike"], [class*="Strike"], ' +
      '[data-testid*="was"], [data-testid*="Was"], [data-test-id*="was"], [data-test-id*="Was"], ' +
      '[data-testid*="original"], [data-testid*="old"], [data-test-id*="original"], [data-test-id*="old"], ' +
      '[class*="regular"], .regular, [class*="discount"], .discount'
    );
    struckElements.forEach(el => el.remove());

    const priceText = clone.textContent.trim();
    if (!priceText) {
      return cleanPrice(priceEl.textContent);
    }
    
    return cleanPrice(priceText);
  }

  // Helper to resolve absolute URLs
  function resolveUrl(url) {
    if (!url) return window.location.href;
    try {
      return new URL(url, window.location.href).href;
    } catch (e) {
      return url;
    }
  }

  // Helper to search Next.js and other JSON state scripts for a direct product URL key
  function findProductInScripts(sku) {
    if (!sku) return null;
    const lowerSku = sku.toLowerCase();
    const scripts = Array.from(document.querySelectorAll('script[type="application/json"], script[id*="state"], script[id*="data"]'));
    for (const script of scripts) {
      try {
        const text = script.textContent;
        if (!text.toLowerCase().includes(lowerSku)) continue;
        
        const data = JSON.parse(text);
        let foundUrl = null;
        
        function searchObj(obj) {
          if (foundUrl) return;
          if (!obj || typeof obj !== 'object') return;
          
          if (Array.isArray(obj)) {
            for (const item of obj) {
              searchObj(item);
            }
            return;
          }
          
          // Check if this object represents the product and has the SKU (case-insensitive)
          const isSkuMatch = (obj.sku && String(obj.sku).toLowerCase() === lowerSku) || 
                             (obj.id && String(obj.id).toLowerCase() === lowerSku) || 
                             (obj.productSku && String(obj.productSku).toLowerCase() === lowerSku) ||
                             (obj.id && String(obj.id).toLowerCase().includes(lowerSku)) ||
                             (obj.sku && String(obj.sku).toLowerCase().includes(lowerSku));
          
          if (isSkuMatch) {
            const possibleKeys = ['uri', 'url', 'urlKey', 'path', 'href', 'navigationUrl'];
            for (const key of possibleKeys) {
              if (obj[key] && typeof obj[key] === 'string' && obj[key].includes('.html') && !obj[key].includes('your-boards')) {
                foundUrl = obj[key];
                return;
              }
            }
          }
          
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              searchObj(obj[key]);
            }
          }
        }
        
        searchObj(data);
        if (foundUrl) return foundUrl;
      } catch (e) {
        // Ignore JSON parse errors for non-matching scripts
      }
    }
    return null;
  }

  // Helper to extract Zalando SKU from URL
  function getZalandoSku(url) {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      if (!urlObj.hostname.includes('zalando')) return null;

      // 1. Check search parameter 'item' (e.g. ern:content::basic-product:KLH42E006-Q11)
      const itemParam = urlObj.searchParams.get('item');
      if (itemParam) {
        const decoded = decodeURIComponent(itemParam);
        const parts = decoded.split(':');
        const sku = parts[parts.length - 1];
        if (sku && sku.includes('-')) return sku.toUpperCase();
      }

      // 2. Check search query (e.g. /search?q=KLH42E006-Q11)
      const qParam = urlObj.searchParams.get('q');
      if (qParam && qParam.includes('-')) {
        return qParam.trim().toUpperCase();
      }

      // 3. Check URL path (e.g. /adidas-originals-stan-smith-ad121a123-a11.html)
      const path = urlObj.pathname;
      if (path.endsWith('.html')) {
        const cleanPath = path.substring(0, path.length - 5);
        const match = cleanPath.match(/[a-z0-9]{9}-[a-z0-9]{3}/i);
        if (match) return match[0].toUpperCase();
      }
    } catch (e) {}
    return null;
  }

  // Helper to clean and resolve product details URLs
  function cleanProductUrl(rawUrl, store) {
    if (!rawUrl) return window.location.href;
    let resolved = resolveUrl(rawUrl);

    // If it's Zalando and contains your-boards, wishlist, wardrobe, or lists, try to extract SKU and build a direct product page
    if (store === 'Zalando' && (resolved.includes('your-boards') || resolved.includes('wishlist') || resolved.includes('wardrobe') || resolved.includes('lists'))) {
      try {
        const urlObj = new URL(resolved);
        const itemParam = urlObj.searchParams.get('item');
        if (itemParam) {
          // e.g. "ern:content::basic-product:KLH42E006-Q11"
          const decoded = decodeURIComponent(itemParam);
          const parts = decoded.split(':');
          const sku = parts[parts.length - 1];
          if (sku && sku.length > 3) {
            const hostname = urlObj.hostname || 'www.zalando.de';
            
            // 1. Try to find the actual direct URL from the page's Next.js / preloaded state scripts
            const stateUrl = findProductInScripts(sku);
            if (stateUrl) {
              return resolveUrl(stateUrl);
            }
            
            // 2. Fall back to search query redirect URL which is 100% reliable and redirects to the direct product page
            return `https://${hostname}/search?q=${encodeURIComponent(sku)}`;
          }
        }
      } catch (e) {
        console.warn('Failed to parse Zalando board URL parameters:', e);
      }
    }

    return resolved;
  }

  // Helper to extract the best product link from an element
  function getProductLink(el) {
    if (!el) return window.location.href;
    
    // If el itself is an anchor link, return its href directly!
    if (el.tagName && el.tagName.toLowerCase() === 'a') {
      return el.getAttribute('href') || window.location.href;
    }
    
    const links = Array.from(el.querySelectorAll('a'));
    if (links.length === 0) return window.location.href;

    // 1. First priority: a link containing '.html' or '/p/' or '/product/' or '/item/' (standard detail pages)
    const detailLink = links.find(a => {
      const href = a.getAttribute('href') || '';
      return (href.includes('.html') || href.includes('/p/') || href.includes('/product/') || href.includes('/item/')) && 
             !href.includes('your-boards') && !href.includes('wishlist') && !href.includes('cart') && !href.includes('wardrobe') && !href.includes('lists');
    });
    if (detailLink) return detailLink.getAttribute('href');

    // 2. Second priority: any link that does NOT contain 'your-boards', 'wishlist', 'cart', 'bag', 'checkout', 'wardrobe', 'lists'
    const cleanLink = links.find(a => {
      const href = a.getAttribute('href') || '';
      return href && !href.includes('your-boards') && !href.includes('wishlist') && !href.includes('cart') && !href.includes('bag') && !href.includes('checkout') && !href.includes('wardrobe') && !href.includes('lists');
    });
    if (cleanLink) return cleanLink.getAttribute('href');

    // 3. Fallback to the very first link found
    return links[0].getAttribute('href') || window.location.href;
  }

  // Helper to extract the best raw image source from an image tag (handling lazy-loading and srcset parsing)
  function getRawImgSrc(img) {
    if (!img) return '';
    const candidates = [
      img.getAttribute('src'),
      img.getAttribute('data-src'),
      img.getAttribute('srcset'),
      img.getAttribute('data-srcset'),
      img.getAttribute('data-original'),
      img.getAttribute('data-lazy'),
      img.getAttribute('data-lazy-src')
    ];
    
    for (const raw of candidates) {
      if (raw && raw.trim()) {
        const val = raw.trim();
        // If it's a srcset, split by comma and take the first URL
        if (val.includes(' ') && val.includes(',')) {
          const parts = val.split(',');
          const firstPart = parts[0].trim().split(/\s+/)[0];
          if (firstPart) return firstPart;
        }
        // If it's a simple srcset with only one item but has size description (e.g. "https://url 300w")
        if (val.includes(' ') && (val.includes('w') || val.includes('x'))) {
          const firstPart = val.trim().split(/\s+/)[0];
          if (firstPart) return firstPart;
        }
        return val;
      }
    }
    return '';
  }

  // Helper to get high-resolution product images
  function getHighResImage(src, targetStore) {
    if (!src) return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=60';
    let resolved = resolveUrl(src);

    if (targetStore === 'HHV') {
      // Replace low-res generated dimensions (e.g. 140x140, 235x235) with high-res 475x475
      resolved = resolved.replace(/\/generated\/\d+x\d+\//i, '/generated/475x475/');
    }

    return resolved;
  }

  const hostname = window.location.hostname.toLowerCase();
  let store = 'Zalando';
  if (hostname.includes('bstn')) store = 'BSTN';
  else if (hostname.includes('hhv')) store = 'HHV';
  else if (hostname.includes('endclothing')) store = 'END';
  else if (hostname.includes('asphaltgold')) store = 'Asphaltgold';

  // Helper to extract items from a given HTML Document
  function extractFromDocument(doc, targetStore) {
    const list = [];
    const seenTitles = new Set();
    const seenUrls = new Set();
    const seenZalandoSkus = new Set();

    // Check if we should perform a single-product page extraction.
    const isSingleProductPage = (() => {
      try {
        const urlObj = new URL(window.location.href);
        if (urlObj.searchParams.get('omnitrack_sync') === 'true') {
          return true;
        }

        // 1. Precise DOM indicators for e-commerce detail pages
        if (
          doc.querySelector('meta[property="og:type"][content*="product"]') ||
          doc.querySelector('[data-testid="productTitle"]') ||
          doc.querySelector('[data-testid="pdp-promo-banner"]') ||
          doc.querySelector('[data-testid="size-region-select"]') ||
          doc.querySelector('.pdp-details, [class*="ProductDetail"], [class*="product-detail"]')
        ) {
          return true;
        }

        // 2. Standard single product detail page url patterns
        const path = window.location.pathname.toLowerCase();
        return (path.includes('.html') || path.includes('/p/') || path.includes('/product/') || path.includes('/item/')) && 
               !path.includes('wishlist') && !path.includes('cart') && !path.includes('bag') && !path.includes('your-boards') && !path.includes('wardrobe') && !path.includes('lists');
      } catch (e) {
        return false;
      }
    })();

    if (isSingleProductPage) {
      // Prioritize extracting the single main product of the page!
      let title = '';
      let price = null;
      let image = '';
      let url = window.location.href;

      const ogTitle = doc.querySelector('meta[property="og:title"]');
      const ogImage = doc.querySelector('meta[property="og:image"]');
      const ogUrl = doc.querySelector('meta[property="og:url"]');
      
      if (ogTitle) title = ogTitle.getAttribute('content');
      if (ogImage) image = ogImage.getAttribute('content');
      if (ogUrl) url = ogUrl.getAttribute('content');

      console.log("[OmniTrack] Single product page identified.", {
        url,
        ogTitle: title,
        ogImage: image
      });

      // 1. Try highly specific product details page (PDP) price selectors first to avoid matching header cart elements
      let priceVal = null;
      let pdpPriceEl = doc.querySelector('[data-testid="product-price"], [data-testid*="product-price"], [data-test-id="product-price"], [data-testid*="pdp-price"], [data-highlight-name*="Price"], [class*="items--detail--price"], .items--detail--price--base-component');
      
      // 2. Try to find price element near the product title/main pdp container
      if (!pdpPriceEl) {
        const pdpTitle = doc.querySelector('[data-testid="productTitle"], h1[class*="title"], h1[class*="Title"], .product-title, .pdp-title');
        if (pdpTitle && pdpTitle.parentElement) {
          pdpPriceEl = pdpTitle.parentElement.querySelector('[data-testid*="price"], [class*="price"], [class*="Price"]');
        }
      }
      
      // 3. Fall back to standard price selectors
      if (!pdpPriceEl) {
        pdpPriceEl = doc.querySelector(
          '.price, [class*="price-container"], [class*="PriceContainer"], [class*="Price__price"], [class*="price__price"], [class*="ProductPrice"], [data-testid*="price"], [data-test-id*="price"], [data-testid*="Price"]'
        );
      }

      if (pdpPriceEl) {
        priceVal = getCleanPriceFromElement(pdpPriceEl);
        console.log("[OmniTrack] Selected DOM price element:", {
          outerHTML: pdpPriceEl.outerHTML.substring(0, 200),
          textContent: pdpPriceEl.textContent.trim(),
          parsedVal: priceVal
        });
      }
      
      // 4. If not found, try targeted price elements
      if (priceVal === null) {
        const targetedPrice = doc.querySelector(
          '[class*="sale-price"], [class*="SalePrice"], [class*="special-price"], [class*="SpecialPrice"], [class*="current-price"], [class*="CurrentPrice"], [class*="activePrice"], [class*="active-price"]'
        );
        if (targetedPrice) {
          priceVal = getCleanPriceFromElement(targetedPrice);
          console.log("[OmniTrack] Selected targeted DOM price element:", {
            outerHTML: targetedPrice.outerHTML.substring(0, 200),
            parsedVal: priceVal
          });
        }
      }
      
      // 5. Fall back to meta tags
      if (priceVal === null) {
        const priceMeta = doc.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"], [itemprop="price"]');
        if (priceMeta) {
          priceVal = cleanPrice(priceMeta.getAttribute('content') || priceMeta.textContent);
          console.log("[OmniTrack] Selected price from meta tag:", {
            outerHTML: priceMeta.outerHTML.substring(0, 200),
            parsedVal: priceVal
          });
        }
      }
      
      price = priceVal;

      if (!title) {
        // Try custom DOM scraper for HHV details page headline (contains brand inside class upper, and name inside class lower)
        const hhvHeadline = doc.querySelector('[data-highlight-name="Items::Detail::Headline"] h1');
        if (hhvHeadline) {
          const brand = hhvHeadline.querySelector('.upper')?.textContent.trim() || '';
          const name = hhvHeadline.querySelector('.lower')?.textContent.trim() || '';
          if (brand && name) {
            title = `${brand} - ${name}`;
          } else {
            title = hhvHeadline.textContent.trim();
          }
        }
      }

      if (!title) {
        title = doc.title.split('|')[0].split('-')[0].trim();
      }

      title = title.replace(/\s+/g, ' ').trim();

      if (title && title.length > 3 && !/shopping cart|your bag/i.test(title)) {
        if (image && !image.includes('unsplash.com')) {
          const productPayload = {
            title,
            price,
            url: cleanProductUrl(url, targetStore),
            image: resolveUrl(image),
            store: targetStore
          };
          console.log("[OmniTrack] Successfully extracted product details:", productPayload);
          list.push(productPayload);
          return list; // Exits early! Returns ONLY this single main product!
        } else {
          console.warn("[OmniTrack] Product skipped because of missing or generic Unsplash image:", { title, image });
        }
      } else {
        console.warn("[OmniTrack] Product skipped because of invalid title structure:", { title });
      }
    }

    // 1. Core Retailer Selectors
    let itemSelectors = [];
    if (targetStore === 'Zalando') {
      itemSelectors = [
        // Wishlist / your-boards page selectors
        '[data-testid="wishlist-item"]',
        '[data-testid="product-card"]',
        '[class*="WishlistItem"]',
        '[class*="wishlist-item"]',
        '[class*="WishlistCard"]',
        '[class*="catalog-article"]',
        '[class*="ArticleTeaser"]',
        '[class*="productCard"]',
        '[class*="ProductCard"]',
        '[class*="Wardrobe"]',
        '[class*="wardrobe"]',
        '[class*="Liked"]',
        '[class*="liked"]',
        // Cart / bag selectors
        '[data-testid="bag-item"]',
        '.z-coast-bag-item-inner',
        '.z-nav-bag-item-inner',
        // Generic fallback
        'article'
      ];
    } else if (targetStore === 'BSTN') {
      itemSelectors = [
        '[data-testid="wishlist-item"]',
        '[data-testid="product-item"]',
        '[data-testid*="product-card"]',
        '[data-testid*="product-tile"]',
        '[class*="WishlistItem"]',
        '[class*="wishlist-item"]',
        '[class*="WishlistCard"]',
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        '[class*="ProductTile"]',
        '[class*="product-tile"]',
        '[class*="ProductItem"]',
        '[class*="product-item"]',
        '.wishlist-item',
        '.product-item',
        '.product-card',
        '.cart-item',
        '.mini-cart-item',
        '.cart-item-row',
        'article'
      ];
    } else if (targetStore === 'HHV') {
      itemSelectors = [
        '[data-highlight-name*="Artikel"]',
        '[data-controller*="items--shared"]',
        '.items--shared--meta-entry--base-component',
        '.items--shared--card--base-component',
        '[class*="items--shared--meta-entry"]',
        '[class*="items--shared--card"]',
        '[data-meta-item-cart-item-id]',
        '[class*="WishlistItem"]',
        '[class*="wishlist-item"]',
        '[class*="WishlistCard"]',
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        '[class*="ProductTile"]',
        '[class*="product-tile"]',
        '[class*="ProductItem"]',
        '[class*="product-item"]',
        '[class*="profile-wishlist"]',
        '.wishlist-item',
        '.product-item',
        '.product-card',
        '.cart-item-row',
        '.cart-table-row',
        '.item-row',
        'article'
      ];
    } else if (targetStore === 'END') {
      itemSelectors = [
        '[class*="ItemCardContent"]',
        '.cart-item-container',
        '.cart-item',
        '[data-testid="wishlist-item"]',
        '[data-testid="product-item"]',
        '[data-testid*="product"]',
        '[class*="WishlistItem"]',
        '[class*="wishlist-item"]',
        '[class*="WishlistCard"]',
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        '[class*="ProductTile"]',
        '[class*="product-tile"]',
        '[class*="ProductItem"]',
        '[class*="product-item"]',
        '.wishlist-item',
        '.product-item',
        '.product-card',
        '.cart-item-row',
        '.cart-table-row',
        '.item-row',
        'article'
      ];
    } else if (targetStore === 'Asphaltgold') {
      itemSelectors = [
        '[class*="product-card"]',
        '[class*="ProductCard"]',
        '[class*="product-grid-item"]',
        '[class*="ProductGridItem"]',
        '[class*="product-item"]',
        '[class*="ProductItem"]',
        '.product-card',
        '.product-grid-item',
        '.product-item',
        '.cart-item',
        '.cart-item-row',
        'article'
      ];
    }

    // Add generic fallback structural selectors
    itemSelectors.push('article', 'tr.cart-item', 'li.cart-item', '[class*="cart-item"]', '[class*="wl-item"]', '[class*="wishlist-item"]');

    // Filter out container/list classes from matching as individual items
    const isContainer = (el) => {
      const className = el.className ? String(el.className).toLowerCase() : '';
      const id = el.id ? String(el.id).toLowerCase() : '';
      const dataTestId = el.getAttribute('data-testid') ? String(el.getAttribute('data-testid')).toLowerCase() : '';
      
      // Real product card classes on HHV/BSTN should NEVER be classified as containers
      if (
        className.includes('items--shared') || 
        className.includes('meta-entry') || 
        className.includes('shared--card') ||
        className.includes('product-card') ||
        className.includes('wishlist-item') ||
        className.includes('product-item') ||
        dataTestId.includes('wishlist-item') ||
        dataTestId.includes('product-item')
      ) {
        return false;
      }

      return (
        className.includes('list') || className.includes('container') || className.includes('wrapper') ||
        className.includes('summary') || className.includes('header') || className.includes('footer') ||
        className.includes('sidebar') || className.includes('group') || 
        (className.includes('items') && !className.includes('items--shared')) ||
        (className.includes('component') && !className.includes('items--shared')) ||
        className.includes('page') || className.includes('table') ||
        className.includes('section') || className.includes('body') || className.includes('perspective') ||
        className.includes('filter') ||
        id.includes('list') || id.includes('container') || id.includes('wrapper') || id.includes('page') ||
        dataTestId.includes('list') || dataTestId.includes('container') || dataTestId.includes('wrapper')
      );
    };

    // Filter out items in suggestions/recommendations carousels
    const isSuggestionItem = (el) => {
      if (!el || !el.closest) return false;
      
      // If the item resides inside a primary user collection or wishlist container, bypass suggestion rejection
      if (
        el.closest('[class*="wishlist"], [id*="wishlist"], [data-testid*="wishlist"], [class*="wardrobe"], [class*="liked"], [class*="owned"], [class*="bag"], [class*="cart"], [class*="CoastBag"]')
      ) {
        return false;
      }
      
      const suggestKeywords = [
        'reco', 'recommend', 'similar', 'carousel', 'bought', 'viewed', 
        'sponsored', 'related', 'upsell', 'cross-sell', 'crosssell', 
        'suggestion', 'promo', 'advertising', 'teaser-list', 'slider', 
        'trending', 'popular', 'recommendations', 'suggestions', 'alike',
        'frequently-bought', 'customers-also', 'you-may-also', 'you-might-also',
        'complete-the-look', 'completethelook', 'match-with', 'matches-with',
        'style-it-with', 'styleitwith', 'often-bought', 'oftenbought'
      ];
      
      for (const kw of suggestKeywords) {
        try {
          if (
            el.closest(`[class*="${kw}"]`) ||
            el.closest(`[id*="${kw}"]`) ||
            el.closest(`[data-testid*="${kw}"]`) ||
            el.closest(`[data-analytics*="${kw}"]`)
          ) {
            return true;
          }
        } catch (e) {}
      }
      
      return false;
    };

    // Try targeted scraping first
    for (const selector of itemSelectors) {
      try {
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => {
          if (isContainer(el)) return; // Skip high-level lists/containers
          if (isSuggestionItem(el)) return; // Skip suggestions carousel items

          // Build title
          let titleText = '';
          
          if (targetStore === 'HHV') {
            const artistEl = el.querySelector('.artist');
            const titleEl = el.querySelector('.title, [class*="title"]');
            if (artistEl && titleEl) {
              const tText = titleEl.textContent.trim();
              if (!/your cart|my wishlist|wishlist|shopping cart/i.test(tText)) {
                titleText = `${artistEl.textContent.trim()} - ${tText}`;
              }
            }
          }
          
          if (!titleText) {
            const headings = el.querySelectorAll('h2, h3, h4, [class*="brand"], [class*="name"]');
            if (headings.length >= 2) {
              const parts = [];
              headings.forEach(h => {
                const text = h.textContent.trim();
                const isSize = /^(?:one size|[xsml]|[234]?xl)$/i.test(text) || /size:/i.test(text);
                if (text && !parts.includes(text) && !isSize && !/originally:|regular price:/i.test(text)) {
                  parts.push(text);
                }
              });
              titleText = parts.join(' - ');
            }
          }

          if (!titleText) {
            const titleEl = el.querySelector(
              '[data-testid*="title"], [data-testid*="name"], [data-test-id*="title"], [data-test-id*="name"], [data-test-id*="ItemName"], .product-title, .title, [class*="title"], [class*="name"], h3, h4, a[href*="/p/"], a[href*="/product/"], a[href*="/item/"]'
            );
            if (titleEl) titleText = titleEl.textContent.trim();
          }

          titleText = titleText.replace(/\s+/g, ' ').trim();
          
          // Get the price node
          let priceEl = null;
          
          // 1. Try to find the parent price container first (crucial for stripping line-through original prices)
          priceEl = el.querySelector('.price, .current-price, .item-price, [class*="price-container"], [class*="PriceContainer"], [data-testid*="price-container"]');
          
          // 2. Fallback to specific class names or spans containing "price"
          if (!priceEl) {
            priceEl = el.querySelector(
              '[data-testid*="price"], [data-test-id*="price"], [data-test-id*="ItemPrice"], [class*="price"], span[class*="Price"], .price .special, .price .regular, .price span'
            );
          }
          
          // 3. Leaf node regex scan fallback
          if (!priceEl) {
            const allSpans = el.querySelectorAll('span, p, div, b, strong');
            for (const s of allSpans) {
              if (s.children.length === 0 && /(?:[€$£]|EUR|GBP|USD)\s*\d+(?:[\.,]\d{2})?|\b\d+(?:[\.,]\d{2})?\s*(?:[€$£]|EUR|GBP|USD)\b/i.test(s.textContent)) {
                priceEl = s;
                break;
              }
            }
          }

          const imgEl = el.querySelector('img');
          const bestRawUrl = getProductLink(el);

          if (titleText) {
            // Exclude page summary titles
            if (titleText.length > 3 && !/shopping cart|your bag|cart summary|order summary|total/i.test(titleText) && !seenTitles.has(titleText)) {
              
              const rawImgSrc = getRawImgSrc(imgEl);
              if (!rawImgSrc) {
                // If not got picture, do not sync
                return;
              }

              let resolvedImage = getHighResImage(rawImgSrc, targetStore);
              if (!resolvedImage || resolvedImage.includes('unsplash.com')) {
                // If only fallback placeholder picture, do not sync
                return;
              }

              const cleanUrl = cleanProductUrl(bestRawUrl, targetStore);
              const lowerUrl = cleanUrl.toLowerCase().trim();
              
              let isDuplicate = false;
              if (targetStore === 'Zalando') {
                const sku = getZalandoSku(cleanUrl);
                if (sku) {
                  if (seenZalandoSkus.has(sku)) {
                    isDuplicate = true;
                  } else {
                    seenZalandoSkus.add(sku);
                  }
                }
              }
              
              if (seenUrls.has(lowerUrl)) {
                isDuplicate = true;
              } else {
                seenUrls.add(lowerUrl);
              }
              
              if (!isDuplicate) {
                seenTitles.add(titleText);
                list.push({
                  title: titleText,
                  price: getCleanPriceFromElement(priceEl),
                  url: cleanUrl,
                  image: resolvedImage,
                  store: targetStore
                });
              }
            }
          }
        });
      } catch (e) {
        console.warn('Selector error:', selector, e);
      }
    }

    // 2. Dynamic DOM Heuristic Fallback (Runs if selector method found nothing)
    if (list.length === 0) {
      // Find all leaf text nodes that look like a price
      const allElements = Array.from(doc.querySelectorAll('span, div, p, td, a, b, strong'));
      const priceCandidates = allElements.filter(el => {
        if (el.children.length > 0) return false; // leaf nodes only
        const text = el.textContent.trim();
        return /(?:[€$£]|EUR|GBP|USD)\s*\d+[\.,]\d{2}|\b\d+[\.,]\d{2}\s*(?:[€$£]|EUR|GBP|USD)\b/i.test(text);
      });

      priceCandidates.forEach(priceEl => {
        // Trace up the DOM tree to isolate the wrapping container for this cart product
        let parent = priceEl.parentElement;
        let depth = 0;
        let foundItemContainer = null;

        while (parent && depth < 6) {
          const tagName = parent.tagName.toLowerCase();
          const className = parent.className ? String(parent.className).toLowerCase() : '';
          const dataTestId = parent.getAttribute('data-testid') ? String(parent.getAttribute('data-testid')).toLowerCase() : '';

          // Stop at common structural boundaries that define individual items
          if (
            tagName === 'article' || tagName === 'li' || tagName === 'tr' ||
            className.includes('item') || className.includes('row') || className.includes('product') || className.includes('card') ||
            dataTestId.includes('item') || dataTestId.includes('product')
          ) {
            if (!isContainer(parent)) {
              foundItemContainer = parent;
              break;
            }
          }

          parent = parent.parentElement;
          depth++;
        }

        const container = foundItemContainer || priceEl.parentElement;
        if (container) {
          if (isSuggestionItem(container)) return; // Skip suggestions carousel items
          // Build title Text from headings inside the container
          let titleText = '';
          const headings = container.querySelectorAll('h3, h4, h5, [class*="brand"], [class*="title"], [class*="name"]');
          if (headings.length >= 2) {
            const parts = [];
            headings.forEach(h => {
              const text = h.textContent.trim();
              if (text && !parts.includes(text) && !/size:|originally:|regular price:/i.test(text)) {
                parts.push(text);
              }
            });
            titleText = parts.join(' - ');
          }

          if (!titleText) {
            const link = container.querySelector('a[href*="/p/"], a[href*="/product/"], a[href*="/item/"], a[class*="title"], a[class*="name"]');
            if (link) {
              titleText = link.textContent.trim();
            } else {
              const heading = container.querySelector('h3, h4, h5, [class*="title"], [class*="name"]');
              if (heading) titleText = heading.textContent.trim();
            }
          }

          // Format title text nicely
          titleText = titleText.replace(/\s+/g, ' ').trim();

          // Exclude page titles or summaries
          if (titleText && titleText.length > 3 && !/shopping cart|your bag|cart summary|order summary|total/i.test(titleText) && !seenTitles.has(titleText)) {

            const img = container.querySelector('img');
            const bestRawUrl = getProductLink(container);

            const rawImgSrc = getRawImgSrc(img);
            if (!rawImgSrc) {
              // If not got picture, do not sync
              return;
            }

            let resolvedImage = getHighResImage(rawImgSrc, targetStore);
            if (!resolvedImage || resolvedImage.includes('unsplash.com')) {
              // If only fallback placeholder picture, do not sync
              return;
            }

            const cleanUrl = cleanProductUrl(bestRawUrl, targetStore);
            const lowerUrl = cleanUrl.toLowerCase().trim();
            
            let isDuplicate = false;
            if (targetStore === 'Zalando') {
              const sku = getZalandoSku(cleanUrl);
              if (sku) {
                if (seenZalandoSkus.has(sku)) {
                  isDuplicate = true;
                } else {
                  seenZalandoSkus.add(sku);
                }
              }
            }
            
            if (seenUrls.has(lowerUrl)) {
              isDuplicate = true;
            } else {
              seenUrls.add(lowerUrl);
            }
            
            if (!isDuplicate) {
              seenTitles.add(titleText);
              list.push({
                title: titleText,
                price: getCleanPriceFromElement(priceEl),
                url: cleanUrl,
                image: resolvedImage,
                store: targetStore
              });
            }
          }
        }
      });
    }

    // 3. Fallback: If it's a single product detail view page rather than a cart grid
    if (list.length === 0) {
      let title = '';
      let price = null;
      let image = '';
      let url = window.location.href;

      const ogTitle = doc.querySelector('meta[property="og:title"]');
      const ogImage = doc.querySelector('meta[property="og:image"]');
      const ogUrl = doc.querySelector('meta[property="og:url"]');
      
      if (ogTitle) title = ogTitle.getAttribute('content');
      if (ogImage) image = ogImage.getAttribute('content');
      if (ogUrl) url = ogUrl.getAttribute('content');

      const priceMeta = doc.querySelector('meta[property="product:price:amount"], meta[property="og:price:amount"], [itemprop="price"]');
      if (priceMeta) {
        price = cleanPrice(priceMeta.getAttribute('content') || priceMeta.textContent);
      } else {
        // 1. Try highly specific PDP price selectors first
        let pdpPriceEl = doc.querySelector('[data-testid="product-price"], [data-testid*="product-price"], [data-test-id="product-price"], [data-testid*="pdp-price"], [data-highlight-name*="Price"], [class*="items--detail--price"], .items--detail--price--base-component');
        
        // 2. Try to find price element near the product title
        if (!pdpPriceEl) {
          const pdpTitle = doc.querySelector('[data-testid="productTitle"], h1[class*="title"], h1[class*="Title"], .product-title, .pdp-title');
          if (pdpTitle && pdpTitle.parentElement) {
            pdpPriceEl = pdpTitle.parentElement.querySelector('[data-testid*="price"], [class*="price"], [class*="Price"]');
          }
        }
        
        // 3. Fall back to standard price selectors
        if (!pdpPriceEl) {
          pdpPriceEl = doc.querySelector('.price, [class*="price-amount"], [class*="current-price"], [data-testid*="price"], [data-test-id*="price"], [data-testid*="Price"]');
        }

        if (pdpPriceEl) {
          price = cleanPrice(pdpPriceEl.textContent);
        }
      }

      if (!title) {
        // Try custom DOM scraper for HHV details page headline (contains brand inside class upper, and name inside class lower)
        const hhvHeadline = doc.querySelector('[data-highlight-name="Items::Detail::Headline"] h1');
        if (hhvHeadline) {
          const brand = hhvHeadline.querySelector('.upper')?.textContent.trim() || '';
          const name = hhvHeadline.querySelector('.lower')?.textContent.trim() || '';
          if (brand && name) {
            title = `${brand} - ${name}`;
          } else {
            title = hhvHeadline.textContent.trim();
          }
        }
      }

      if (!title) {
        title = doc.title.split('|')[0].split('-')[0].trim();
      }

      title = title.replace(/\s+/g, ' ').trim();

      if (title && title.length > 3 && !/shopping cart|your bag/i.test(title)) {
        if (image && !image.includes('unsplash.com')) {
          list.push({
            title,
            price,
            url: cleanProductUrl(url, targetStore),
            image: resolveUrl(image),
            store: targetStore
          });
        }
      }
    }

    return list;
  }

  // Master Extraction Orchestrator with Pagination Crawler
  async function getMultiItemsWithPagination() {
    // 1. Scrape the current visible tab first
    const currentItems = extractFromDocument(document, store);
    
    // Auto-pagination only makes sense for wishlist and catalog pages, not cart checkout pages
    const isCheckoutOrCartPage = 
      window.location.pathname.includes('checkout') || 
      window.location.pathname.includes('cart') || 
      window.location.pathname.includes('bag') || 
      window.location.pathname.includes('warenkorb');

    if (isCheckoutOrCartPage || currentItems.length === 0) {
      return currentItems;
    }

    // 2. Discover all pagination page links on the page
    const allPageUrls = new Set();
    
    // Attribute selectors for pagination URL tokens
    const attributeSelectors = [
      'a[href*="page="]', 'a[href*="?page="]', 'a[href*="&page="]',
      'a[href*="?p="]', 'a[href*="&p="]', 'a[href*="pager="]', 'a[href*="page-"]'
    ];
    
    // Standard pagination container element links
    const containerSelectors = [
      '.pagination a', '.pager a', '.page-nav a', '.nav-pages a',
      '[class*="pagination"] a', '[class*="pager"] a', '[class*="page-nav"] a',
      '[class*="paging"] a', '[id*="pagination"] a', '[id*="pager"] a'
    ];
    
    const combinedSelector = [...attributeSelectors, ...containerSelectors].join(', ');
    const pageLinks = Array.from(document.querySelectorAll(combinedSelector));
    
    // Numerical page heuristic fallback
    Array.from(document.querySelectorAll('a[href]')).forEach(a => {
      const text = a.textContent.trim();
      const href = a.getAttribute('href') || '';
      if (/^\d+$/.test(text)) {
        const hasQuery = href.includes('?') || href.includes('&') || href.includes('page') || href.includes('p=');
        if (hasQuery) {
          pageLinks.push(a);
        }
      }
    });
    
    pageLinks.forEach(a => {
      const href = a.getAttribute('href');
      if (href) {
        allPageUrls.add(resolveUrl(href));
      }
    });

    const normalizePath = (p) => p.replace(/\/+$/, '').toLowerCase();
    const currentPathNormalized = normalizePath(window.location.pathname);
    const currentHost = window.location.hostname.toLowerCase();

    const validPageUrls = Array.from(allPageUrls).filter(url => {
      try {
        const u = new URL(url);
        const hostMatches = u.hostname.toLowerCase() === currentHost;
        const pathMatches = normalizePath(u.pathname) === currentPathNormalized;
        return hostMatches && pathMatches;
      } catch (e) {
        return false;
      }
    });

    if (validPageUrls.length === 0) {
      return currentItems;
    }

    console.log(`[OmniTrack Crawler] Discovered ${validPageUrls.length} other pagination pages. Initiating background crawl...`);
    
    const itemsList = [...currentItems];
    const parser = new DOMParser();

    // 3. Fetch and scrape each discovered page asynchronously
    for (const pageUrl of validPageUrls) {
      try {
        const currentUrlObj = new URL(window.location.href);
        const pageUrlObj = new URL(pageUrl);
        // Skip re-fetching the current page number
        const curPage = currentUrlObj.searchParams.get('page') || '1';
        const targetPage = pageUrlObj.searchParams.get('page') || '1';
        if (curPage === targetPage) {
          continue;
        }

        console.log(`[OmniTrack Crawler] Scraping page ${targetPage} asynchronously: ${pageUrl}`);
        const response = await fetch(pageUrl);
        if (response.ok) {
          const html = await response.text();
          const doc = parser.parseFromString(html, 'text/html');
          const pageItems = extractFromDocument(doc, store);
          
          console.log(`[OmniTrack Crawler] Discovered ${pageItems.length} items on page ${targetPage}.`);
          
          // Merge unique items by title and link
          pageItems.forEach(item => {
            const alreadyExists = itemsList.some(existing => 
              existing.title.toLowerCase() === item.title.toLowerCase() || 
              existing.url.toLowerCase() === item.url.toLowerCase()
            );
            if (!alreadyExists) {
              itemsList.push(item);
            }
          });
        }
      } catch (err) {
        console.error(`[OmniTrack Crawler] Failed to crawl pagination page: ${pageUrl}`, err);
      }
    }

    console.log(`[OmniTrack Crawler] Auto-pagination complete. Aggregated ${itemsList.length} items total.`);
    return itemsList;
  }

  let lastSyncedPayloadString = '';

  function checkIsTargetSyncPage() {
    const path = window.location.pathname.toLowerCase();
    
    // Allow explicit re-sync instruction when visiting store from OmniTrack
    try {
      const urlObj = new URL(window.location.href);
      if (urlObj.searchParams.get('omnitrack_sync') === 'true') {
        return true;
      }
    } catch (e) {}

    return (
      path.includes('wishlist') ||
      path.includes('cart') ||
      path.includes('bag') ||
      path.includes('warenkorb') ||
      path.includes('checkout') ||
      path.includes('your-boards') ||
      path.includes('wardrobe') ||
      path.includes('lists') ||
      path.includes('my-account') ||
      path.includes('profile')
    );
  }

  async function performAutoSync(forceItems) {
    try {
      // Dynamic Path Guard: Skip if client-side navigation routed away from target wishlist/cart pages
      if (!checkIsTargetSyncPage()) {
        return;
      }

      const itemsList = forceItems || await getMultiItemsWithPagination();
      if (itemsList && itemsList.length > 0) {
        const enrichedItems = itemsList.map(item => ({
          ...item,
          sourceUrl: window.location.href
        }));
        const payloadString = JSON.stringify(enrichedItems);
        if (payloadString !== lastSyncedPayloadString) {
          lastSyncedPayloadString = payloadString;
          console.log(`[OmniTrack Auto-Sync] Syncing ${enrichedItems.length} items to backend...`);
          
          if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
            chrome.runtime.sendMessage({
              action: 'OMNITRACK_SYNC_TO_BACKEND',
              payload: enrichedItems
            }, (response) => {
              if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
                console.debug('[OmniTrack Auto-Sync] Background sync message failed (likely context invalidated):', chrome.runtime.lastError.message);
              } else {
                console.log('[OmniTrack Auto-Sync] Background auto-sync complete!', response);
              }
            });
          } else {
            console.log('[OmniTrack Auto-Sync] Extension context not available or has been invalidated.');
          }
        }
      }
    } catch (err) {
      if (err.message && (err.message.includes('context invalidated') || err.message.includes('sendMessage') || err.message.includes('undefined'))) {
        console.log('[OmniTrack Auto-Sync] Extension context invalidated. Please reload the webpage to reconnect the sync companion.');
      } else {
        console.error('[OmniTrack Auto-Sync] Error during auto-sync:', err);
      }
    }
  }

  const resultItems = await getMultiItemsWithPagination();

  // Automatic Zero-Click Background Sync — always listening for SPA dynamic navigations and DOM updates
  if (!window.__omnitrackLoaded) {
    window.__omnitrackLoaded = true;

    // Sync immediately if we already have items and are on a target page
    if (checkIsTargetSyncPage() && resultItems.length > 0) {
      lastSyncedPayloadString = JSON.stringify(resultItems);
      setTimeout(() => performAutoSync(resultItems), 300);
    }

    // Polling retry for SPA / Next.js pages that hydrate content after document_end.
    // Polls every 1.5s up to 12 attempts (18s total) until items appear, then stops.
    let pollAttempts = 0;
    const MAX_POLL = 12;
    const pollInterval = setInterval(async () => {
      pollAttempts++;
      // Stop polling early if client navigates away from targeted routes
      if (!checkIsTargetSyncPage()) {
        clearInterval(pollInterval);
        return;
      }

      const items = await getMultiItemsWithPagination();
      if (items.length > 0) {
        clearInterval(pollInterval); // Found items — stop polling
        performAutoSync(items);
      } else if (pollAttempts >= MAX_POLL) {
        clearInterval(pollInterval); // Give up after 18s
      }
    }, 1500);

    // Watch for dynamic DOM shifts (React/Next.js SPA navigation, cart updates, infinite scroll)
    let mutationTimeout = null;
    const observer = new MutationObserver(() => {
      clearTimeout(mutationTimeout);
      mutationTimeout = setTimeout(() => performAutoSync(), 1200);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Capture explicit client-side Router popstate pushes
    window.addEventListener('popstate', () => {
      setTimeout(() => performAutoSync(), 600);
    });
  }

  return {
    store,
    items: resultItems
  };
})();

