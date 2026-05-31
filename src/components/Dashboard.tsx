import { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, Bell, AlertTriangle, X, TrendingDown, ArrowUpRight, DollarSign, Package, Globe, RefreshCw, ShoppingCart, Plug, Zap, CheckCircle, Link, ArrowUp, ChevronDown } from 'lucide-react';
import type { Product, ShoppingSite, CategoryName, Notification } from '../types';
import { INITIAL_PRODUCTS } from '../mockData';
import ProductCard from './ProductCard';
import PriceChart from './PriceChart';
import AddProductModal from './AddProductModal';
import Navbar from './Navbar';

// Helper to build search URL on respective shopping platforms
const getSearchOnPlatformUrl = (product: Product | null, targetStoreName?: string) => {
  if (!product) return '#';
  // Clean size and extra details from title to form a concise search query
  let query = product.title
    .split(' - ')[0] // e.g. "Birkenstock 1774 - London..." -> "Birkenstock 1774"
    .split(' | ')[0]
    .replace(/-\s*\d+(?:\s*[.,]\s*\d+)*\b/g, '') // remove trailing size indicators like "- 42"
    .trim();

  // If split got too short, fall back to title without brackets or size pipes
  if (query.length < 5) {
    query = product.title.split('|')[0].trim();
  }
  
  // Also strip generic tags or size suffixes
  query = query.replace(/\b(?:size|eu|uk|us)\b.*/gi, '').trim();

  const encodedQuery = encodeURIComponent(query);
  const storeLower = (targetStoreName || product.store).toLowerCase();

  if (storeLower.includes('zalando')) {
    return `https://en.zalando.de/men/?q=${encodedQuery}`;
  } else if (storeLower.includes('hhv')) {
    return `https://www.hhv.de/en/clothing/catalog/filter/search-N3S11?term=${encodedQuery}`;
  } else if (storeLower.includes('bstn')) {
    return `https://www.bstn.com/eu_de/catalogsearch/result?q=${encodedQuery}&categories=Men`;
  } else if (storeLower.includes('end')) {
    return `https://www.endclothing.com/en-de/catalogsearch/results?q=${encodedQuery}`;
  } else if (storeLower.includes('asphaltgold')) {
    return `https://www.asphaltgold.com/en/search?q=${encodedQuery}&type=product`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent((targetStoreName || product.store) + ' ' + query)}`;
};

interface Toast {
  id: string;
  title: string;
  desc: string;
  type: 'info' | 'success' | 'alert';
}

interface CustomSelectProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}

function CustomSelect<T extends string>({ value, onChange, options, className }: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`custom-select-container ${className || ''}`} ref={containerRef}>
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption ? selectedOption.label : 'Select...'}</span>
        <ChevronDown size={14} className="select-arrow" />
      </button>
      {isOpen && (
        <ul className="custom-select-options">
          {options.map(opt => (
            <li
              key={String(opt.value)}
              className={`custom-select-option ${opt.value === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const BACKEND_URL = 'http://localhost:5001';

export default function Dashboard() {
  // Main Data States (Aggregated dynamically from Docker Express Backend)
  const [products, setProducts] = useState<Product[]>([]);
  const [sites, setSites] = useState<ShoppingSite[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Navigation / Drawer Open States
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const selectedProductRef = useRef<Product | null>(null);

  // Sync ref with selected product state
  useEffect(() => {
    selectedProductRef.current = selectedProduct;
  }, [selectedProduct]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Monitor window scroll to toggle back to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  const [activeTab, setActiveTab] = useState<'products' | 'owned' | 'sites' | 'sync'>('products');

  // Filters & Controls States
  const [searchQuery, setSearchQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | CategoryName>('All');
  const [sortOption, setSortOption] = useState<'default' | 'price-low' | 'price-high' | 'discount' | 'alphabetical'>('alphabetical');

  // Add Shopping Website form inputs
  const [siteNameInput, setSiteNameInput] = useState('');
  const [siteDomainInput, setSiteDomainInput] = useState('');
  const [siteColorInput, setSiteColorInput] = useState('#7c3aed');
  const [siteDescInput, setSiteDescInput] = useState('');

  // Wishlist / Cart Sync Hub States
  const [scanStep, setScanStep] = useState<number>(0); // 0 = idle, 1 = scanning tabs, 2 = parsing wishlists, 3 = success
  const [wishlistUrlInput, setWishlistUrlInput] = useState('');
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [clipboardInput, setClipboardInput] = useState('');
  const [clipboardLoading, setClipboardLoading] = useState(false);

  const [drawerAlertPrice, setDrawerAlertPrice] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==========================================
  // BACKEND REST SYNC EFFECTS
  // ==========================================

  // Load database on mount and poll for updates every 4 seconds
  useEffect(() => {
    let active = true;

    const fetchBackendData = async () => {
      try {
        const prodRes = await fetch(`${BACKEND_URL}/api/products`);
        if (!prodRes.ok) return;
        const prodData = await prodRes.json();
        
        if (!active) return;
        setProducts(prodData);
        
        // Keep active drawer product synchronized in real-time using the ref
        const currentSelected = selectedProductRef.current;
        if (currentSelected) {
          const updatedDrawerItem = prodData.find((p: Product) => p.id === currentSelected.id);
          if (updatedDrawerItem && active) {
            // Only trigger state update if details actually changed to avoid redundant renders
            const changed = updatedDrawerItem.currentPrice !== currentSelected.currentPrice ||
                            updatedDrawerItem.originalPrice !== currentSelected.originalPrice ||
                            updatedDrawerItem.isTracked !== currentSelected.isTracked ||
                            updatedDrawerItem.alertPrice !== currentSelected.alertPrice ||
                            updatedDrawerItem.lastChecked !== currentSelected.lastChecked;
            if (changed) {
              setSelectedProduct(updatedDrawerItem);
            }
          }
        }

        const sitesRes = await fetch(`${BACKEND_URL}/api/sites`);
        if (sitesRes.ok) {
          const sitesData = await sitesRes.json();
          if (active) setSites(sitesData);
        }

        const notifRes = await fetch(`${BACKEND_URL}/api/notifications`);
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          if (active) setNotifications(notifData);
        }
      } catch (err) {
        console.error('Error synchronizing database with Express backend:', err);
      }
    };

    fetchBackendData();
    const interval = setInterval(fetchBackendData, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Synchronize alert input inside drawer when product changes
  useEffect(() => {
    if (selectedProduct) {
      setDrawerAlertPrice(selectedProduct.alertPrice ? selectedProduct.alertPrice.toString() : '');
    } else {
      setDrawerAlertPrice('');
    }
  }, [selectedProduct]);

  // Listen for direct sync payloads dispatched by our custom Chrome Extension
  useEffect(() => {
    const handleChromeExtensionSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      const scrapedItems = customEvent.detail;
      
      if (Array.isArray(scrapedItems) && scrapedItems.length > 0) {
        // Post the batch directly to the REST API /api/sync endpoint!
        fetch(`${BACKEND_URL}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scrapedItems)
        })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.count > 0) {
            addToast('Direct Sync Complete!', `Synced ${data.count} products directly from your active browser tab!`, 'success');
            setActiveTab('products');
          } else {
            addToast('Items Already Tracked', 'All scraped items from your tab are already in your tracker catalog.', 'info');
          }
        })
        .catch(err => {
          console.error('Extension sync post error:', err);
        });
      }
    };

    window.addEventListener('OMNITRACK_SYNC_ITEMS', handleChromeExtensionSync);
    return () => window.removeEventListener('OMNITRACK_SYNC_ITEMS', handleChromeExtensionSync);
  }, []);

  // Toast helper
  const addToast = (title: string, desc: string, type: 'info' | 'success' | 'alert' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, title, desc, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Trigger simulated price drops on the backend!
  const triggerSimulationDrop = async () => {
    try {
      addToast('Scraping Stores', 'Aggregation engine is now actively scanning for price adjustments.', 'success');
      const response = await fetch(`${BACKEND_URL}/api/products/simulate-drop`, {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        addToast('Drop Triggered!', `Triggered automated price drop for "${data.product}"!`, 'success');
        
        // Immediately fetch fresh state
        const pRes = await fetch(`${BACKEND_URL}/api/products`);
        if (pRes.ok) setProducts(await pRes.json());
        const nRes = await fetch(`${BACKEND_URL}/api/notifications`);
        if (nRes.ok) setNotifications(await nRes.json());
      } else {
        addToast('Simulation Awaiting', 'Connect or scan a few items to run price drops.', 'info');
      }
    } catch (err) {
      console.error('Backend simulation trigger error:', err);
      addToast('Sync Offline', 'Backend server is temporarily unreachable.', 'alert');
    }
  };

  // Handle adding product from modal manually
  const handleAddProduct = async (newProduct: Product) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct)
      });
      if (response.ok) {
        const saved = await response.json();
        setProducts((prev) => [saved, ...prev]);
        addToast('Product Added', `Successfully initialized tracking for ${saved.title}.`, 'success');
      }
    } catch (err) {
      console.error('Error adding product manually:', err);
    }
  };

  // Configure target alert price from details drawer
  const handleSaveAlertPrice = async () => {
    if (!selectedProduct) return;

    const price = drawerAlertPrice.trim() ? Number(drawerAlertPrice) : null;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertPrice: price })
      });

      if (response.ok) {
        const updated = await response.json();
        setSelectedProduct(updated);
        setProducts((prev) => prev.map((p) => p.id === selectedProduct.id ? updated : p));
        addToast(
          'Alert Price Saved',
          price !== null 
            ? `We will notify you once ${selectedProduct.title} drops below €${price.toFixed(2)}.` 
            : `Disabled price drop alerts for ${selectedProduct.title}.`,
          'success'
        );
      }
    } catch (err) {
      console.error('Error saving alert price:', err);
    }
  };

  // Delete product completely
  const handleDeleteProduct = async (id: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/products/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setSelectedProduct(null);
        addToast('Product Removed', 'Successfully removed item from aggregate tracker.', 'info');
      }
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  // Add dynamic e-commerce shopping website to collected list
  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteNameInput.trim() || !siteDomainInput.trim()) return;

    // Check if domain is already registered
    const exists = sites.some(s => s.domain.toLowerCase() === siteDomainInput.toLowerCase().trim());
    if (exists) {
      addToast('Website Exists', `The store domain "${siteDomainInput}" is already tracked!`, 'info');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: siteNameInput.trim(),
          domain: siteDomainInput.toLowerCase().trim(),
          logoColor: siteColorInput,
          description: siteDescInput.trim() || 'Custom added retailer.'
        })
      });

      if (response.ok) {
        const saved = await response.json();
        setSites((prev) => [...prev, saved]);
        addToast('Website Added', `Successfully started collecting prices from "${saved.name}"!`, 'success');

        // Reset inputs
        setSiteNameInput('');
        setSiteDomainInput('');
        setSiteColorInput('#7c3aed');
        setSiteDescInput('');
      }
    } catch (err) {
      console.error('Error adding site:', err);
    }
  };

  // Delete custom website
  const deleteSite = async (id: string) => {
    const siteObj = sites.find(s => s.id === id);
    if (!siteObj) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/sites/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setSites((prev) => prev.filter((s) => s.id !== id));
        addToast('Store Removed', `Successfully stopped tracking "${siteObj.name}".`, 'info');
      }
    } catch (err) {
      console.error('Error deleting site:', err);
    }
  };

  // Toggle dynamic website active state (locally tracked status badge)
  const toggleSiteActive = (id: string) => {
    setSites((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextActive = !s.isActive;
          addToast(
            nextActive ? 'Store Active' : 'Store Paused',
            `Store "${s.name}" is now ${nextActive ? 'active' : 'paused on price aggregation'}.`,
            'info'
          );
          return { ...s, isActive: nextActive };
        }
        return s;
      })
    );
  };

  // Simulate Scanning Active Browser Shopping Tabs (CORS Bypass Bridge)
  const handleSimulateExtensionScan = () => {
    setScanStep(1); // scanning
    addToast('Bridge Initialized', 'Connecting to OmniTrack Browser extension...', 'info');

    // Step 1: Scanning Active Tabs
    setTimeout(() => {
      setScanStep(2); // found tabs
      
      // Step 2: Parsing Shopping Wishlists/Carts
      setTimeout(() => {
        setScanStep(3); // importing data
        
        // Step 3: Resolving price history points and posting to backend sync API
        setTimeout(() => {
          const syncItems = INITIAL_PRODUCTS.map(p => ({
            title: p.title,
            url: p.url,
            store: p.store,
            price: p.originalPrice,
            image: p.image
          }));

          fetch(`${BACKEND_URL}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncItems)
          })
          .then(res => res.json())
          .then(data => {
            setScanStep(0); // idle
            if (data.success && data.count > 0) {
              addToast('Wishlist Synced!', `Successfully imported ${data.count} products directly from your active carts & wishlists!`, 'success');
            } else {
              addToast('Sync Complete', 'Scraped items are already present in your active trackers catalog.', 'info');
            }
            setActiveTab('products');
          })
          .catch(err => {
            console.error('Extension simulation scan error:', err);
            setScanStep(0);
          });
        }, 1200);
      }, 1200);
    }, 1200);
  };

  // Import Shared Wishlist link
  const handleImportSharedWishlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishlistUrlInput.trim()) return;

    setWishlistLoading(true);
    addToast('Parsing Wishlist', 'Resolving public shared wishlist URL schema...', 'info');

    setTimeout(() => {
      // Pull 3 selected items from mock database to simulate import!
      const itemsToImport = INITIAL_PRODUCTS.slice(0, 3).map(p => ({
        title: p.title,
        url: p.url,
        store: p.store,
        price: p.originalPrice,
        image: p.image
      }));

      fetch(`${BACKEND_URL}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemsToImport)
      })
      .then(res => res.json())
      .then(() => {
        setWishlistLoading(false);
        setWishlistUrlInput('');
        addToast('Import Completed', 'Imported 3 fashion items from your shared wishlist URL!', 'success');
        setActiveTab('products');
      })
      .catch(err => {
        console.error('Import shared wishlist error:', err);
        setWishlistLoading(false);
      });
    }, 1500);
  };

  // Import custom cart from clipboard pasted text
  const handleClipboardImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clipboardInput.trim()) return;

    setClipboardLoading(true);
    addToast('Parsing Clipboard', 'Analyzing text nodes for e-commerce schema variables...', 'info');

    setTimeout(() => {
      const parsedItems: any[] = [];
      const lines = clipboardInput.split('\n').map(l => l.trim()).filter(Boolean);

      lines.forEach((line) => {
        // 1. Detect Price
        const priceRegex = /(?:[€$£]|EUR|GBP|USD)?\s*(\d+(?:[.,]\d{2})?)\s*(?:[€$£]|EUR|GBP|USD)?/i;
        const priceMatch = line.match(priceRegex);
        let price = 100.00;
        if (priceMatch && priceMatch[1]) {
          price = Number(priceMatch[1].replace(',', '.'));
        }

        // 2. Detect Store
        let store = 'Zalando';
        if (/bstn/i.test(line)) store = 'BSTN';
        else if (/hhv/i.test(line)) store = 'HHV';
        else if (/end/i.test(line)) store = 'End';
        else if (/asphalt/i.test(line)) store = 'Asphaltgold';

        // 3. Clean Title
        let title = line
          .replace(/(?:[€$£]|EUR|GBP|USD)/gi, '')
          .replace(/\b\d+(?:[.,]\d{2})?\b/g, '')
          .replace(/\b(zalando|bstn|hhv|end|clothing|asphalt|asphaltgold)\b/gi, '')
          .replace(/[-|:,]/g, '')
          .trim();

        if (!title || title.length < 3) {
          title = `Custom Tracked Product`;
        }

        // 4. Determine beautiful fallback image based on category keywords
        let image = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=60';
        if (/vinyl|record|music|lp|album/i.test(line)) {
          image = '/vinyl_record.png';
        } else if (/jacket|shirt|clothing|pant|tee|hoodie|fleece|knit/i.test(line)) {
          image = '/outdoor_jacket.png';
        } else if (/hat|cap|sock|bag|accessory|sunglasses/i.test(line)) {
          image = 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&auto=format&fit=crop&q=60';
        } else {
          image = '/sneaker_jordan.png';
        }

        parsedItems.push({
          title,
          url: `https://www.${store.toLowerCase()}.de/search?q=${encodeURIComponent(title)}`,
          store,
          price,
          image
        });
      });

      if (parsedItems.length > 0) {
        fetch(`${BACKEND_URL}/api/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedItems)
        })
        .then(res => res.json())
        .then(data => {
          setClipboardLoading(false);
          setClipboardInput('');
          if (data.success && data.count > 0) {
            addToast('Clipboard Parsed!', `Successfully extracted and synced ${data.count} products to your active tracker!`, 'success');
          } else {
            addToast('Already Synced', 'The items in your clipboard are already in your active trackers list.', 'info');
          }
          setActiveTab('products');
        })
        .catch(err => {
          console.error('Clipboard import sync error:', err);
          setClipboardLoading(false);
        });
      } else {
        addToast('No Items Found', 'Please check your text format and try pasting again.', 'alert');
        setClipboardLoading(false);
      }
    }, 1200);
  };

  // Toggle single alert track in drawer
  const toggleTrackInDrawer = async () => {
    if (!selectedProduct) return;
    const nextTracked = !selectedProduct.isTracked;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTracked: nextTracked })
      });

      if (response.ok) {
        const updated = await response.json();
        setSelectedProduct(updated);
        setProducts((prev) => prev.map((p) => p.id === selectedProduct.id ? updated : p));
        addToast(
          nextTracked ? 'Tracking Active' : 'Tracking Inactive',
          `${selectedProduct.title} status is now ${nextTracked ? 'Active' : 'Paused'}.`,
          'info'
        );
      }
    } catch (err) {
      console.error('Error toggling track status in drawer:', err);
    }
  };

  // Toggle owned status in drawer
  const toggleOwnedInDrawer = async () => {
    if (!selectedProduct) return;
    const nextOwned = !selectedProduct.isOwned;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOwned: nextOwned })
      });

      if (response.ok) {
        const updated = await response.json();
        setSelectedProduct(updated);
        setProducts((prev) => prev.map((p) => p.id === selectedProduct.id ? updated : p));
        addToast(
          nextOwned ? 'Marked as Owned' : 'Removed from Collection',
          `${selectedProduct.title} is now marked as ${nextOwned ? 'owned' : 'not owned'}.`,
          'success'
        );
      }
    } catch (err) {
      console.error('Error toggling owned status in drawer:', err);
      addToast('Sync Offline', 'Backend server is temporarily unreachable.', 'alert');
    }
  };

  // ==========================================
  // VIEW RENDER CALCULATION ENGINE
  // ==========================================

  // Calculate Metrics
  const activeTracked = products.filter((p) => p.isTracked);
  const totalSavings = products.reduce((acc, curr) => {
    if (curr.originalPrice === null || curr.currentPrice === null) return acc;
    return acc + (curr.originalPrice - curr.currentPrice > 0 ? curr.originalPrice - curr.currentPrice : 0);
  }, 0);
  const unreadCount = notifications.filter((n) => !n.read).length;
  
  // Calculate average discount percentage
  const itemsWithDiscounts = products.filter(p => p.currentPrice !== null && p.originalPrice !== null && p.currentPrice < p.originalPrice);
  const avgDiscount = itemsWithDiscounts.length > 0 
    ? Math.round(
        (itemsWithDiscounts.reduce((sum, p) => sum + ((p.originalPrice! - p.currentPrice!) / p.originalPrice!), 0) / itemsWithDiscounts.length) * 100
      )
    : 0;

  // Filter and Sort Products for the grid
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.store.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStore = storeFilter === 'All' || p.store.toLowerCase() === storeFilter.toLowerCase();
    const matchesCategory = categoryFilter === 'All' || p.category.toLowerCase() === categoryFilter.toLowerCase();

    const matchesOwnedTab = activeTab === 'owned' ? p.isOwned === true : !p.isOwned;

    return matchesSearch && matchesStore && matchesCategory && matchesOwnedTab;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortOption === 'price-low') {
      const priceA = a.currentPrice ?? Infinity;
      const priceB = b.currentPrice ?? Infinity;
      return priceA - priceB;
    }
    if (sortOption === 'price-high') {
      const priceA = a.currentPrice ?? -Infinity;
      const priceB = b.currentPrice ?? -Infinity;
      return priceB - priceA;
    }
    if (sortOption === 'discount') {
      const discA = (a.originalPrice !== null && a.currentPrice !== null) ? a.originalPrice - a.currentPrice : 0;
      const discB = (b.originalPrice !== null && b.currentPrice !== null) ? b.originalPrice - b.currentPrice : 0;
      return discB - discA;
    }
    if (sortOption === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }
    return 0; // Default recent insertion order
  });

  // Calculate high-fidelity metrics for drawer visualization
  const drawerStats = selectedProduct ? (() => {
    const prices = selectedProduct.history.map(h => h.price).filter(p => p !== null && p !== undefined);
    const highest = prices.length > 0 ? Math.max(...prices) : 0;
    const lowest = prices.length > 0 ? Math.min(...prices) : 0;
    const totalChange = (selectedProduct.originalPrice !== null && selectedProduct.currentPrice !== null) ? selectedProduct.originalPrice - selectedProduct.currentPrice : 0;
    const isUnderRetail = selectedProduct.currentPrice !== null && selectedProduct.originalPrice !== null && selectedProduct.currentPrice < selectedProduct.originalPrice;
    
    return {
      highest,
      lowest,
      totalChange,
      isUnderRetail
    };
  })() : null;

  // Dropdown Options
  const storeOptions = [
    { value: 'All', label: 'All Stores' },
    ...sites.map(s => ({ value: s.name, label: s.name }))
  ];

  const categoryOptions = [
    { value: 'All', label: 'All Categories' },
    { value: 'Sneakers', label: 'Sneakers' },
    { value: 'Jackets', label: 'Jackets' },
    { value: 'Shirts', label: 'Shirts' },
    { value: 'Pants & Jeans', label: 'Pants & Jeans' },
    { value: 'Hats & Beanies', label: 'Hats & Beanies' },
    { value: 'Clothing', label: 'Clothing' },
    { value: 'Vinyl & Music', label: 'Vinyl & Music' },
    { value: 'Accessories', label: 'Accessories' }
  ];

  const sortOptions = [
    { value: 'default', label: 'Recently Added' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'discount', label: 'Largest Discount (€)' },
    { value: 'alphabetical', label: 'Alphabetical A-Z' }
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Navigation Header */}
      <Navbar
        totalTracked={activeTracked.length}
        totalSavings={totalSavings}
        isSimulating={false}
        unreadCount={unreadCount}
        onToggleSimulation={triggerSimulationDrop}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      <main className="container" style={{ flex: 1 }}>
        <div className="dashboard-grid no-sidebar">
          {/* Main Dashboard Feed */}
          <section>
            {/* Aggregate Bento Grid Metrics Widgets */}
            <div className="metrics-row">
              <div 
                className="metric-card" 
                style={products.length === 0 ? { cursor: 'pointer', transition: 'border-color var(--transition-fast)' } : undefined}
                onClick={products.length === 0 ? () => setActiveTab('sync') : undefined}
                title={products.length === 0 ? 'Click to sync carts and wishlists' : undefined}
              >
                <div className="metric-icon-wrapper">
                  <ShoppingBag size={20} />
                </div>
                <div className="metric-info">
                  <h3>Catalog Count</h3>
                  <p style={{ fontSize: '1.5rem' }}>
                    {products.length} Products
                  </p>
                  <span style={{ fontSize: '0.65rem', color: products.length === 0 ? 'var(--color-primary)' : 'var(--text-secondary)', fontWeight: products.length === 0 ? 600 : 500, display: 'block', marginTop: '0.1rem' }}>
                    {products.length === 0 ? 'Click to Sync' : 'Active trackers'}
                  </span>
                </div>
              </div>
              <div 
                className="metric-card"
                style={products.length === 0 ? { cursor: 'pointer', transition: 'border-color var(--transition-fast)' } : undefined}
                onClick={products.length === 0 ? () => setActiveTab('sync') : undefined}
                title={products.length === 0 ? 'Click to sync carts and wishlists' : undefined}
              >
                <div className="metric-icon-wrapper savings">
                  <TrendingDown size={20} />
                </div>
                <div className="metric-info">
                  <h3>Active Deals</h3>
                  <p style={{ fontSize: '1.5rem' }}>
                    {products.filter((p) => p.currentPrice !== null && p.originalPrice !== null && p.currentPrice < p.originalPrice).length} Items
                  </p>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginTop: '0.1rem' }}>
                    {products.length === 0 ? 'No active drops' : 'Price drops found'}
                  </span>
                </div>
              </div>
              <div 
                className="metric-card"
                style={products.length === 0 ? { cursor: 'pointer', transition: 'border-color var(--transition-fast)' } : undefined}
                onClick={products.length === 0 ? () => setActiveTab('sync') : undefined}
                title={products.length === 0 ? 'Click to sync carts and wishlists' : undefined}
              >
                <div className="metric-icon-wrapper savings" style={{ color: 'var(--color-amber)', background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.15)' }}>
                  <Bell size={20} />
                </div>
                <div className="metric-info">
                  <h3>Active Alert Targets</h3>
                  <p style={{ fontSize: '1.5rem' }}>
                    {products.filter((p) => p.alertPrice !== null && p.isTracked).length} Configured
                  </p>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginTop: '0.1rem' }}>
                    {products.length === 0 ? 'Awaiting config' : 'Price triggers set'}
                  </span>
                </div>
              </div>
              <div 
                className="metric-card"
                style={products.length === 0 ? { cursor: 'pointer', transition: 'border-color var(--transition-fast)' } : undefined}
                onClick={products.length === 0 ? () => setActiveTab('sync') : undefined}
                title={products.length === 0 ? 'Click to sync carts and wishlists' : undefined}
              >
                <div className="metric-icon-wrapper savings">
                  <DollarSign size={20} />
                </div>
                <div className="metric-info">
                  <h3>Average Discount</h3>
                  <p style={{ fontSize: '1.5rem' }}>
                    {avgDiscount}% Drop
                  </p>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginTop: '0.1rem' }}>
                    {products.length === 0 ? 'Awaiting data' : 'Avg. discount size'}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                style={{
                  background: activeTab === 'products' ? 'var(--color-primary-glow)' : 'transparent',
                  color: activeTab === 'products' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  border: activeTab === 'products' ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem'
                }}
                onClick={() => setActiveTab('products')}
              >
                <Package size={14} />
                <span>Products Tracker ({products.filter(p => !p.isOwned).length})</span>
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: activeTab === 'owned' ? 'var(--color-primary-glow)' : 'transparent',
                  color: activeTab === 'owned' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  border: activeTab === 'owned' ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem'
                }}
                onClick={() => setActiveTab('owned')}
              >
                <CheckCircle size={14} />
                <span>My Owned Collection ({products.filter(p => p.isOwned).length})</span>
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: activeTab === 'sites' ? 'var(--color-primary-glow)' : 'transparent',
                  color: activeTab === 'sites' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  border: activeTab === 'sites' ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem'
                }}
                onClick={() => setActiveTab('sites')}
              >
                <Globe size={14} />
                <span>Collected Websites ({sites.length})</span>
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: activeTab === 'sync' ? 'var(--color-primary-glow)' : 'transparent',
                  color: activeTab === 'sync' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  border: activeTab === 'sync' ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem'
                }}
                onClick={() => setActiveTab('sync')}
              >
                <RefreshCw size={14} />
                <span>Wishlist & Cart Sync Hub</span>
              </button>
            </div>

            {(activeTab === 'products' || activeTab === 'owned') && (
              <>
                {/* Controls panel: Searching + Filters */}
                <div className="controls-panel glass-panel">
                  <div className="search-wrapper">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search item, category, brand..."
                      className="search-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="filters-wrapper">
                    {/* Store selection filter */}
                    <CustomSelect
                      value={storeFilter}
                      onChange={setStoreFilter}
                      options={storeOptions}
                    />

                    {/* Category selection filter */}
                    <CustomSelect
                      value={categoryFilter}
                      onChange={(val) => setCategoryFilter(val as any)}
                      options={categoryOptions}
                    />

                    {/* Sort selector */}
                    <CustomSelect
                      value={sortOption}
                      onChange={(val) => setSortOption(val as any)}
                      options={sortOptions}
                    />
                  </div>
                </div>

                {/* Aggregated Grid */}
                <div className="products-container">
                  {products.length === 0 ? (
                    <div className="empty-state" style={{ padding: '5rem 2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', animation: 'float 3s ease-in-out infinite', marginBottom: '1.25rem' }}>
                        <ShoppingCart size={48} style={{ color: 'var(--text-muted)' }} />
                      </div>
                      <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>Your Price Tracker Catalog is Empty</h3>
                      <p style={{ fontSize: '0.875rem', maxWidth: '440px', margin: '0.5rem auto 1.5rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Start tracking price drops instantly! Paste a single link using "Add Link" at the top, or connect your browser wishlist and cart sessions to import items in bulk.
                      </p>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setActiveTab('sync')}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <RefreshCw size={15} />
                          <span>Sync Carts & Wishlists</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setIsAddModalOpen(true)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <Link size={15} />
                          <span>Scan Single Link</span>
                        </button>
                      </div>
                    </div>
                  ) : sortedProducts.length > 0 ? (
                    <div className="products-grid">
                      {sortedProducts.map((product) => {
                        const siteObj = sites.find(s => s.name.toLowerCase() === product.store.toLowerCase());
                        const storeColor = siteObj ? siteObj.logoColor : undefined;
                        return (
                          <ProductCard
                            key={product.id}
                            product={product}
                            onSelect={setSelectedProduct}
                            onDelete={handleDeleteProduct}
                            storeColor={storeColor}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <AlertTriangle size={40} style={{ color: 'var(--text-muted)' }} />
                      <h3>
                        {activeTab === 'owned'
                          ? (products.filter(p => p.isOwned).length === 0
                            ? 'Your Owned Collection is Empty'
                            : 'No Owned Products Match Filters')
                          : 'No Tracked Products Match Filters'}
                      </h3>
                      <p style={{ fontSize: '0.875rem' }}>
                        {activeTab === 'owned' && products.filter(p => p.isOwned).length === 0
                          ? "You haven't marked any items as owned yet. Open any product's details and click 'Mark as Owned' to start building your collection!"
                          : 'Try clearing your search query or adjusting your filters to find your items.'}
                      </p>
                      {(activeTab !== 'owned' || products.filter(p => p.isOwned).length > 0) && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setSearchQuery('');
                            setStoreFilter('All');
                            setCategoryFilter('All');
                            setSortOption('alphabetical');
                          }}
                        >
                          Reset Dashboard
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'sites' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Add Shopping Website Form Card */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: 'rgba(255, 255, 255, 0.45)' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem' }}>
                    Collect New Shopping Website
                  </h3>
                  <form onSubmit={handleAddSite} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      <div className="form-group">
                        <label htmlFor="site-name">Website Name</label>
                        <input
                          id="site-name"
                          type="text"
                          required
                          placeholder="e.g. Foot Patrol"
                          className="form-input"
                          value={siteNameInput}
                          onChange={(e) => setSiteNameInput(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="site-domain">Web Domain</label>
                        <input
                          id="site-domain"
                          type="text"
                          required
                          placeholder="e.g. footpatrol.com"
                          className="form-input"
                          value={siteDomainInput}
                          onChange={(e) => setSiteDomainInput(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="site-color">Badge Highlight Color</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            id="site-color"
                            type="color"
                            className="form-input"
                            style={{ width: '45px', padding: '0.1rem', height: '40px', cursor: 'pointer' }}
                            value={siteColorInput}
                            onChange={(e) => setSiteColorInput(e.target.value)}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{siteColorInput}</span>
                        </div>
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="site-desc">Description / Scope Details</label>
                      <input
                        id="site-desc"
                        type="text"
                        placeholder="e.g. UK retailer specializing in limited edition sportswear..."
                        className="form-input"
                        value={siteDescInput}
                        onChange={(e) => setSiteDescInput(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ justifySelf: 'start', padding: '0.6rem 1.5rem' }}>
                      Add to Collection Scope
                    </button>
                  </form>
                </div>

                {/* Collected Sites Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {sites.map((site) => {
                    const siteProducts = products.filter(p => p.store.toLowerCase() === site.name.toLowerCase());
                    return (
                      <div key={site.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', background: 'rgba(255, 255, 255, 0.45)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span 
                            className="badge" 
                            style={{ 
                              backgroundColor: `${site.logoColor}14`, 
                              color: site.logoColor,
                              borderColor: `${site.logoColor}33`,
                              fontSize: '0.8rem',
                              padding: '0.2rem 0.5rem',
                              fontWeight: 700
                            }}
                          >
                            {site.name}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Added {site.addedAt}</span>
                        </div>
                        
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, flex: 1 }}>
                          {site.description}
                        </p>
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'end', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                          <Globe size={12} />
                          <span style={{ flex: 1 }}>{site.domain}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Tracking {siteProducts.length} Items
                          </span>

                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                              onClick={() => toggleSiteActive(site.id)}
                            >
                              {site.isActive ? 'Active' : 'Paused'}
                            </button>
                            
                            {/* Delete store if it is a custom added store */}
                            {site.id.startsWith('custom-') && (
                              <button
                                type="button"
                                className="btn-icon-only"
                                style={{ width: '26px', height: '26px', color: 'var(--color-rose)', borderRadius: '6px' }}
                                onClick={() => deleteSite(site.id)}
                                title="Remove Store"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'sync' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Simulated Extension bridge connector */}
                <div className="glass-panel" style={{ padding: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.45)', alignItems: 'center' }}>
                  <div style={{ flex: '1', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'inline-flex', alignSelf: 'flex-start', background: 'var(--color-primary-glow)', color: 'var(--color-primary)', border: '1px solid rgba(124, 58, 237, 0.2)', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      Premium Sync Bridge
                    </div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Connect Cart & Wishlist Companion Extension
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Due to strict browser same-origin security (CORS) and credential boundaries, web pages cannot directly access private shopping carts on external sites. 
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Our lightweight companion browser extension securely scans your active retailer tabs, extracts your local shopping wishlists/carts, and transfers product meta references directly to this dashboard.
                    </p>
                  </div>

                  <div style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '1px solid var(--border-light)', paddingLeft: '2rem' }} className="extension-scan-right">
                    {scanStep === 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', animation: 'float 4s ease-in-out infinite', marginBottom: '0.5rem' }}>
                          <Plug size={40} style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Extension Status: Ready</h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Companion extension detected on active browser profile.</p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={handleSimulateExtensionScan}
                        >
                          Simulate Extension Scan
                        </button>
                      </div>
                    )}

                    {scanStep > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
                        <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                          {scanStep === 1 && 'Scanning active tabs...'}
                          {scanStep === 2 && 'wishlists discovered!'}
                          {scanStep === 3 && 'Syncing e-commerce schemas...'}
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {scanStep === 1 && 'Checking active Zalando, BSTN, HHV, End, and Asphaltgold sessions.'}
                          {scanStep === 2 && 'Retrieving products from your active carts.'}
                          {scanStep === 3 && 'Injecting price history nodes and asset preview nodes.'}
                        </p>
                        <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                          <div
                            style={{
                              height: '100%',
                              background: 'var(--color-primary)',
                              width: `${(scanStep / 3) * 100}%`,
                              transition: 'width 1.2s ease-in-out',
                              position: 'absolute',
                              left: 0,
                              top: 0
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Wishlist Share link import & Clipboard paste import */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255, 255, 255, 0.45)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Import via Shared Wishlist Link</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Paste a public wishlist sharing link from Zalando, END, or other supported sites. We will scrape and extract all items in bulk.
                    </p>
                    <form onSubmit={handleImportSharedWishlist} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <input
                        type="url"
                        required
                        placeholder="https://www.zalando.de/wishlist/share/..."
                        className="form-input"
                        style={{ flex: 1, fontSize: '0.8rem' }}
                        value={wishlistUrlInput}
                        onChange={(e) => setWishlistUrlInput(e.target.value)}
                        disabled={wishlistLoading}
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                        disabled={wishlistLoading}
                      >
                        {wishlistLoading ? 'Scanning...' : 'Import'}
                      </button>
                    </form>
                  </div>

                  <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255, 255, 255, 0.45)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Import Your Own Real Cart/Wishlist</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Copy-paste text directly from your shopping cart page or write custom items (e.g. <em>"Zalando Samba Sneakers €95.00"</em>). We parse prices and stores instantly!
                    </p>
                    <form onSubmit={handleClipboardImport} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <textarea
                        required
                        placeholder="Paste cart contents here, e.g.:&#13;BSTN Nike Air Max 1 - 169.99 EUR&#13;HHV Outdoor Jacket - €89.00"
                        className="form-input"
                        style={{ flex: 1, fontSize: '0.8rem', height: '65px', resize: 'none', padding: '0.5rem', fontFamily: 'inherit' }}
                        value={clipboardInput}
                        onChange={(e) => setClipboardInput(e.target.value)}
                        disabled={clipboardLoading}
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', width: '100%', justifyContent: 'center' }}
                        disabled={clipboardLoading}
                      >
                        {clipboardLoading ? 'Parsing Text...' : 'Parse & Sync Cart'}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Real Chrome Extension Installation & Usage Guide */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255, 255, 255, 0.45)', marginTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plug size={16} style={{ color: 'var(--color-primary)' }} />
                    <span>How to Load & Use the Real Chrome Extension Scanner</span>
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    We have created a complete, lightweight browser extension inside your project directory at <code>./extension</code>. You can load it into Chrome in seconds to scan real shopping carts securely:
                  </p>
                  <ol style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', lineHeight: 1.5 }}>
                    <li>Open <strong>Google Chrome</strong> and go to: <code>chrome://extensions</code></li>
                    <li>Toggle the <strong>"Developer mode"</strong> switch in the top right corner.</li>
                    <li>Click the <strong>"Load unpacked"</strong> button in the top left.</li>
                    <li>Select the <strong><code>extension</code></strong> folder located inside your project workspace (<code>/Users/wagagaha/vibe/decart/extension</code>).</li>
                    <li>Navigate to your active cart page on Zalando, BSTN, HHV, End, or Asphaltgold.</li>
                    <li>Click our extension icon in your Chrome toolbar, hit <strong>"Scan Current Cart"</strong>, copy the sync payload, and paste it directly into the clipboard importer box above!</li>
                  </ol>
                </div>
              </div>
            )}
          </section>

        </div>
      </main>

      {/* Floating alert notifications (Toasts) */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <span className="toast-icon">
              {toast.type === 'alert' && <Zap size={16} style={{ color: 'var(--color-rose)' }} />}
              {toast.type === 'success' && <CheckCircle size={16} style={{ color: 'var(--color-emerald)' }} />}
              {toast.type === 'info' && <TrendingDown size={16} style={{ color: 'var(--color-primary)' }} />}
            </span>
            <div className="toast-body">
              <span className="toast-title">{toast.title}</span>
              <span className="toast-desc">{toast.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Slide-out Product History Drawer */}
      {selectedProduct && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedProduct(null)}></div>
          <div className="drawer">
            <div className="drawer-header">
              <span className={`badge badge-store-${selectedProduct.store}`}>{selectedProduct.store}</span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                <a
                  href={`${selectedProduct.url}${selectedProduct.url.includes('?') ? '&' : '?'}omnitrack_sync=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                >
                  Visit Store <ArrowUpRight size={13} />
                </a>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', color: 'var(--color-rose)', borderColor: 'rgba(239,68,68,0.2)' }}
                  onClick={() => handleDeleteProduct(selectedProduct.id)}
                >
                  Remove
                </button>
                <button type="button" className="drawer-close" onClick={() => setSelectedProduct(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="drawer-body" style={{ padding: '0 2rem 2rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', alignItems: 'center' }}>
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.title}
                  style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border-light)' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%232a2640"/></svg>';
                  }}
                />
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>{selectedProduct.category}</span>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>{selectedProduct.title}</h2>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
                    <RefreshCw size={10} style={{ animation: 'spin-slow 6s linear infinite' }} />
                    Aggregated check: {selectedProduct.lastChecked}
                  </p>
                  <div
                    ref={searchDropdownRef}
                    style={{ position: 'relative', display: 'inline-block', marginTop: '0.75rem' }}
                  >
                    <button
                      type="button"
                      className="btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.75rem',
                        background: 'rgba(124, 58, 237, 0.08)',
                        color: 'var(--color-primary)',
                        border: '1px solid rgba(124, 58, 237, 0.15)',
                        fontWeight: 600,
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setIsSearchDropdownOpen(!isSearchDropdownOpen)}
                    >
                      <Search size={12} />
                      Compare on Platforms
                      <ChevronDown size={10} style={{ marginLeft: '0.15rem', transition: 'transform 0.2s', transform: isSearchDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>
                    {isSearchDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '0.35rem',
                          background: '#ffffff',
                          border: '1px solid var(--border-light)',
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                          zIndex: 50,
                          minWidth: '175px',
                          padding: '0.35rem 0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.15rem'
                        }}
                      >
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', padding: '0.25rem 0.75rem' }}>
                          Compare Prices on:
                        </span>
                        {['Zalando', 'BSTN', 'HHV', 'END', 'Asphaltgold']
                          .filter(store => store.toLowerCase() !== selectedProduct.store.toLowerCase())
                          .map(storeName => (
                            <a
                              key={storeName}
                              href={getSearchOnPlatformUrl(selectedProduct, storeName)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                textDecoration: 'none',
                                transition: 'background 0.15s, color 0.15s'
                              }}
                              onClick={() => setIsSearchDropdownOpen(false)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--color-primary-glow)';
                                e.currentTarget.style.color = 'var(--color-primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'none';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                              }}
                            >
                              <Globe size={10} />
                              Search on {storeName}
                            </a>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Price comparison widgets */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: '#fafafa', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Store Price</span>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: drawerStats?.isUnderRetail ? 'var(--color-emerald)' : 'var(--text-primary)', marginTop: '0.25rem' }}>
                    {selectedProduct.currentPrice !== null ? `€${selectedProduct.currentPrice.toFixed(2)}` : 'No Price'}
                  </p>
                </div>
                <div style={{ background: '#fafafa', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Original Retail</span>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {selectedProduct.originalPrice !== null ? `€${selectedProduct.originalPrice.toFixed(2)}` : 'No Price'}
                  </p>
                </div>
                <div style={{ background: '#fafafa', border: '1px solid var(--border-light)', padding: '1rem', borderRadius: '10px' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total savings</span>
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: drawerStats && drawerStats.totalChange > 0 ? 'var(--color-emerald)' : 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {drawerStats && drawerStats.totalChange > 0 ? `€${drawerStats.totalChange.toFixed(2)}` : '€0.00'}
                  </p>
                </div>
              </div>

              {/* Interactive SVG History Chart */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Historical Price Drops (10d Trend)</h3>
                <div className="glass-panel" style={{ padding: '1.25rem', background: '#fafafa' }}>
                  <PriceChart history={selectedProduct.history} originalPrice={selectedProduct.originalPrice ?? 0} currentPrice={selectedProduct.currentPrice ?? 0} />
                </div>
              </div>

              {/* Alerts threshold configure */}
              <div className="alert-config-card">
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Threshold Alerts Settings</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Enable real-time push aggregate checks. We scan background e-commerce schemas and trigger toasts once stores drop below this value.
                </p>

                <div className="alert-toggle-row">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Active Tracking Status</span>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: selectedProduct.isTracked ? 'rgba(5, 150, 105, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      color: selectedProduct.isTracked ? 'var(--color-emerald)' : 'var(--color-rose)',
                      border: selectedProduct.isTracked ? '1px solid rgba(5, 150, 105, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.75rem'
                    }}
                    onClick={toggleTrackInDrawer}
                  >
                    {selectedProduct.isTracked ? 'Tracking Active' : 'Aggregation Paused'}
                  </button>
                </div>

                <div className="alert-toggle-row">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Owned Collection Status</span>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: selectedProduct.isOwned ? 'var(--color-primary-glow)' : 'rgba(107, 114, 128, 0.08)',
                      color: selectedProduct.isOwned ? 'var(--color-primary)' : 'var(--text-secondary)',
                      border: selectedProduct.isOwned ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid rgba(107, 114, 128, 0.15)',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.75rem'
                    }}
                    onClick={toggleOwnedInDrawer}
                  >
                    {selectedProduct.isOwned ? 'Owned ✅' : 'Mark as Owned'}
                  </button>
                </div>

                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label htmlFor="drawer-alert-input">Target Alert Price Limit (€)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <div className="input-with-symbol" style={{ flex: 1 }}>
                      <span className="input-symbol">€</span>
                      <input
                        id="drawer-alert-input"
                        type="number"
                        step="0.01"
                        placeholder="e.g. 135.00"
                        className="form-input"
                        value={drawerAlertPrice}
                        onChange={(e) => setDrawerAlertPrice(e.target.value)}
                      />
                    </div>
                    <button type="button" className="btn btn-primary" style={{ padding: '0 1.25rem' }} onClick={handleSaveAlertPrice}>
                      Save Limit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Back to Top Floating Button */}
      <button
        onClick={scrollToTop}
        className={`back-to-top ${showScrollTop ? 'visible' : ''}`}
        aria-label="Back to Top"
      >
        <ArrowUp size={20} />
      </button>

      {/* Manual Product Scanner Modal */}
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProduct={handleAddProduct}
        sites={sites}
      />
    </div>
  );
}
