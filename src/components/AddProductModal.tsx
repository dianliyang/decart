import React, { useState } from 'react';
import { X, Globe, ArrowRight } from 'lucide-react';
import type { Product, ShoppingSite, CategoryName } from '../types';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Product) => void;
  sites: ShoppingSite[];
}

export default function AddProductModal({ isOpen, onClose, onAddProduct, sites }: AddProductModalProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState<Partial<Product> | null>(null);
  const [alertPriceInput, setAlertPriceInput] = useState('');

  if (!isOpen) return null;

  // URL parser simulation
  const handleRetrieve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);

    // Identify store from URL dynamically based on collected sites
    let detectedStore: string = '';
    const matchingSite = sites.find(s => 
      url.toLowerCase().includes(s.domain.toLowerCase()) || 
      url.toLowerCase().includes(s.name.toLowerCase())
    );

    if (matchingSite) {
      detectedStore = matchingSite.name;
    } else {
      // Default to the first active site or dynamic choice
      detectedStore = sites.length > 0 ? sites[0].name : 'Zalando';
    }

    // Identify product type simulation
    let category: CategoryName = 'Sneakers';
    let title = 'Retrieved Premium Item';
    let originalPrice = 120.00;
    let image = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=60'; // Default beautiful red sneaker

    if (url.toLowerCase().includes('vinyl') || url.toLowerCase().includes('record') || url.toLowerCase().includes('music') || detectedStore === 'HHV') {
      category = 'Vinyl & Music';
      title = 'Freddie Gibbs & Madlib - Piñata (10th Anniversary Vinyl)';
      originalPrice = 39.99;
      image = '/vinyl_record.png';
    } else if (url.toLowerCase().includes('jacket') || url.toLowerCase().includes('clothing') || url.toLowerCase().includes('hoodie') || url.toLowerCase().includes('pant')) {
      category = 'Clothing';
      title = 'Carhartt WIP Madison Corduroy Shirt';
      originalPrice = 89.00;
      image = '/outdoor_jacket.png';
    } else {
      // Sneakers/Default
      category = 'Sneakers';
      title = 'Nike Air Max 1 \'86 OG "Big Bubble" Premium';
      originalPrice = 169.99;
      image = '/sneaker_jordan.png';
    }

    // Simulate scraper delay
    setTimeout(() => {
      setLoading(false);
      const parsedData: Partial<Product> = {
        title,
        url,
        store: detectedStore,
        currentPrice: originalPrice, // Un-discounted upon initial discovery
        originalPrice,
        image,
        category,
        trackingSince: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
      setScrapedData(parsedData);
      
      // Default alert threshold at 10% off
      const defaultAlert = Number((originalPrice * 0.9).toFixed(2));
      setAlertPriceInput(defaultAlert.toString());
    }, 1500);
  };

  const handleTrack = () => {
    if (!scrapedData) return;

    const finalAlertPrice = alertPriceInput.trim() ? Number(alertPriceInput) : null;
    
    // Generate full price history
    const initialPrice = scrapedData.originalPrice || 100;
    const history = [
      { date: '10d ago', price: initialPrice },
      { date: '5d ago', price: initialPrice },
      { date: 'Today', price: initialPrice },
    ];

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      title: scrapedData.title || 'Tracked Item',
      url: scrapedData.url || '',
      store: scrapedData.store || 'Zalando',
      currentPrice: scrapedData.currentPrice || initialPrice,
      originalPrice: initialPrice,
      image: scrapedData.image || '',
      category: scrapedData.category || 'Sneakers',
      trackingSince: scrapedData.trackingSince || 'Today',
      alertPrice: finalAlertPrice,
      isTracked: true,
      history,
      lastChecked: 'Just now'
    };

    onAddProduct(newProduct);
    
    // Reset state
    setUrl('');
    setScrapedData(null);
    setAlertPriceInput('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-header">
          <h2>Add New URL to Tracker</h2>
          <p>Paste any product link from Zalando, End, BSTN, or HHV to instantly retrieve catalog data and activate price tracking.</p>
        </div>

        {!scrapedData && !loading && (
          <form onSubmit={handleRetrieve}>
            <div className="form-group">
              <label htmlFor="url-input">Product Web Address</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="url-input"
                  type="url"
                  required
                  placeholder="https://www.zalando.de/adidas-originals-samba-..."
                  className="form-input"
                  style={{ flex: 1 }}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">
                  Scan Link <ArrowRight size={14} />
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Globe size={12} /> Supported Stores:
              </span>
              {sites.map(s => (
                <span
                  key={s.id}
                  className="badge"
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.1rem 0.4rem',
                    backgroundColor: `${s.logoColor}14`,
                    color: s.logoColor,
                    borderColor: `${s.logoColor}33`,
                    opacity: s.isActive ? 1 : 0.4
                  }}
                >
                  {s.name}
                </span>
              ))}
            </div>
          </form>
        )}

        {loading && (
          <div className="scrape-loader">
            <div className="spinner"></div>
            <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Scraping Retail Page...</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Querying site headers & extracting schema.org metadata</p>
          </div>
        )}

        {scrapedData && !loading && (
          <div>
            <div className="scraped-result">
              <img src={scrapedData.image} alt={scrapedData.title} className="scraped-img" />
              <div className="scraped-info">
                <div>
                  <h4 className="scraped-title">{scrapedData.title}</h4>
                  <div className="scraped-store">
                    <span className={`badge badge-store-${scrapedData.store}`}>
                      {scrapedData.store}
                    </span>
                  </div>
                </div>
                <div className="scraped-price-row">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Found Price:</span>
                  <span className="scraped-price">€{scrapedData.originalPrice?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="alert-input">Set Price Target (€)</label>
              <div className="input-with-symbol">
                <span className="input-symbol">€</span>
                <input
                  id="alert-input"
                  type="number"
                  step="0.01"
                  placeholder="Leave empty to track without alerts"
                  className="form-input"
                  value={alertPriceInput}
                  onChange={(e) => setAlertPriceInput(e.target.value)}
                />
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                We will notify you immediately once the store price drops below this amount.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setScrapedData(null)}
              >
                Scan Another URL
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleTrack}
              >
                Track & Aggregate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
