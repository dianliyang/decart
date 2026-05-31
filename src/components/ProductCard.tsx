
import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onDelete: (id: string) => void;
  storeColor?: string;
}

export default function ProductCard({ product, onSelect, onDelete, storeColor }: ProductCardProps) {
  const {
    title,
    store,
    currentPrice,
    originalPrice,
    image,
    category,
    history
  } = product;

  // Calculate discount percentage
  const hasDiscount = currentPrice !== null && originalPrice !== null && currentPrice < originalPrice;
  const discountPercent = hasDiscount
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : 0;

  // Build a small sparkline SVG path
  const prices = history.map((h) => h.price).filter((p) => p !== null && p !== undefined);
  const minVal = prices.length > 0 ? Math.min(...prices) : 0;
  const maxVal = prices.length > 0 ? Math.max(...prices) : 0;
  const range = maxVal - minVal;
  
  const sparklineHeight = 24;
  const sparklineWidth = 120;
  
  let sparklinePath = '';
  if (prices.length > 1) {
    const coords = prices.map((price, i) => {
      const x = (i / (prices.length - 1)) * sparklineWidth;
      const y = range === 0 
        ? sparklineHeight / 2 
        : sparklineHeight - 4 - ((price - minVal) / range) * (sparklineHeight - 8);
      return { x, y };
    });
    
    sparklinePath = `M ${coords[0].x} ${coords[0].y}`;
    coords.forEach((c, idx) => {
      if (idx > 0) sparklinePath += ` L ${c.x} ${c.y}`;
    });
  }

  const sparklineColor = hasDiscount ? '#10b981' : '#8b5cf6';

  return (
    <article className="product-card" onClick={() => onSelect(product)} style={{ cursor: 'pointer' }}>
      {/* Remove button — top-left, visible on card hover */}
      <button
        type="button"
        className="card-remove-btn"
        title="Remove from tracker"
        onClick={(e) => { e.stopPropagation(); onDelete(product.id); }}
      >
        ×
      </button>

      {/* Image Container */}
      <div className="product-image-container">
        <img
          src={image}
          alt={title}
          className="product-image"
          loading="lazy"
          onError={(e) => {
            // Fallback gradient in case URL fails to load
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%232a2640"/></svg>';
          }}
        />
        {/* Discount Badge stays on image */}
        {hasDiscount && (
          <span className="product-discount-badge">
            -{discountPercent}%
          </span>
        )}
        {/* Owned Badge stays on image */}
        {product.isOwned && (
          <span className="product-owned-badge">
            Owned
          </span>
        )}
      </div>

      {/* Details Section */}
      <div className="product-details">
        {/* Store badge + category inline row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
          <span
            className={`badge product-store-badge-inline badge-store-${store}`}
            style={storeColor ? {
              backgroundColor: `${storeColor}14`,
              color: storeColor,
              borderColor: `${storeColor}33`
            } : undefined}
          >
            {store}
          </span>
          <span className="product-category" style={{ marginBottom: 0 }}>{category}</span>
        </div>
        <h3 className="product-title" title={title}>
          {title}
        </h3>

        {/* Pricing Area */}
        <div className="product-price-section">
          <span className={`current-price ${hasDiscount ? 'discounted' : ''}`}>
            {currentPrice !== null ? `€${currentPrice.toFixed(2)}` : 'No Price Listed'}
          </span>
          {hasDiscount && originalPrice !== null && (
            <span className="original-price">
              €{originalPrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Sparkline Visualizer */}
        <div className="product-sparkline-wrapper">
          {prices.length > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <svg width={sparklineWidth} height={sparklineHeight} style={{ overflow: 'visible' }}>
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke={sparklineColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                10d trend
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Awaiting data...
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
