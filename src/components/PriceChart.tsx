import { useState } from 'react';
import type { PriceHistoryPoint } from '../types';

interface PriceChartProps {
  history: PriceHistoryPoint[];
  originalPrice: number;
  currentPrice: number;
}

export default function PriceChart({ history, originalPrice, currentPrice }: PriceChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!history || history.length === 0) {
    return <div className="text-muted">No price history available</div>;
  }

  // Dimensions
  const svgWidth = 500;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 30;

  // Extract prices and dates
  const prices = history.map((h) => h.price);
  const maxPrice = Math.max(...prices, originalPrice);
  const minPrice = Math.min(...prices);

  // Add padding to range
  const priceRange = maxPrice - minPrice;
  const yMin = priceRange === 0 ? minPrice - 10 : minPrice - (priceRange * 0.1);
  const yMax = priceRange === 0 ? maxPrice + 10 : maxPrice + (priceRange * 0.15);
  const yScale = yMax - yMin;

  // Calculate coordinates
  const points = history.map((point, index) => {
    const x = paddingX + (index / (history.length - 1)) * (svgWidth - paddingX * 2);
    const y = svgHeight - paddingY - ((point.price - yMin) / yScale) * (svgHeight - paddingY * 2);
    return { x, y, price: point.price, date: point.date };
  });

  // SVG Path description for the line
  let pathD = '';
  let areaD = '';

  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    points.forEach((p, index) => {
      if (index > 0) {
        pathD += ` L ${p.x} ${p.y}`;
      }
    });

    // Create area path closed at the bottom
    areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`;
  }

  const isPriceDrop = currentPrice < originalPrice;
  const lineColor = isPriceDrop ? '#10b981' : '#8b5cf6'; // Emerald for price drops, purple otherwise
  const glowFilter = isPriceDrop ? 'url(#glow-emerald)' : 'url(#glow-purple)';

  // Generate grid lines
  const gridLines = [];
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const ratio = i / gridCount;
    const y = paddingY + ratio * (svgHeight - paddingY * 2);
    const val = yMax - ratio * yScale;
    gridLines.push({ y, value: val.toFixed(2) });
  }

  return (
    <div className="chart-svg-wrapper" style={{ width: '100%', height: '100%' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="chart-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Neon Glow Filters */}
          <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Gradients */}
          <linearGradient id="chart-gradient-purple" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="chart-gradient-emerald" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line
              x1={paddingX}
              y1={line.y}
              x2={svgWidth - paddingX}
              y2={line.y}
              className="chart-grid-line"
            />
            <text
              x={paddingX - 8}
              y={line.y + 3}
              textAnchor="end"
              className="chart-axis-text"
            >
              €{line.value}
            </text>
          </g>
        ))}

        {/* Date Labels (X-Axis) */}
        {points.map((p, i) => {
          // Show every other label to avoid crowding
          if (history.length > 8 && i % 2 !== 0 && i !== history.length - 1) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={svgHeight - paddingY + 16}
              textAnchor="middle"
              className="chart-axis-text"
            >
              {p.date}
            </text>
          );
        })}

        {/* Shaded Area Under Line */}
        {areaD && (
          <path
            d={areaD}
            fill={isPriceDrop ? 'url(#chart-gradient-emerald)' : 'url(#chart-gradient-purple)'}
            style={{ transition: 'all 0.5s ease' }}
          />
        )}

        {/* Glowing price trend line */}
        {pathD && (
          <path
            d={pathD}
            stroke={lineColor}
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={glowFilter}
            style={{ transition: 'all 0.5s ease' }}
          />
        )}

        {/* Interactive Data Node Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 7 : 4}
            fill="var(--bg-surface-solid)"
            stroke={lineColor}
            strokeWidth={hoveredIndex === i ? 3 : 2}
            className="chart-dot"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {/* Interactive Hover Tooltip */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <g className="chart-tooltip-group" transform={`translate(${points[hoveredIndex].x}, ${points[hoveredIndex].y - 28})`}>
            {/* Tooltip Background */}
            <rect
              x="-45"
              y="-18"
              width="90"
              height="28"
              rx="6"
              fill="var(--bg-surface-solid)"
              stroke={lineColor}
              strokeWidth="1.5"
              className="chart-tooltip-bg"
            />
            {/* Tooltip text */}
            <text
              x="0"
              y="0"
              className="chart-tooltip-text"
            >
              €{points[hoveredIndex].price.toFixed(2)}
            </text>
            <text
              x="0"
              y="8"
              fill="#9ca3af"
              fontSize="7px"
              textAnchor="middle"
            >
              {points[hoveredIndex].date}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
