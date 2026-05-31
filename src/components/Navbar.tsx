import { TrendingDown, Plus, Activity, Landmark, LineChart } from 'lucide-react';

interface NavbarProps {
  totalTracked: number;
  totalSavings: number;
  isSimulating: boolean;
  unreadCount: number;
  onToggleSimulation: () => void;
  onOpenAddModal: () => void;
}

export default function Navbar({
  totalTracked,
  totalSavings,
  isSimulating,
  onToggleSimulation,
  onOpenAddModal,
}: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="container">
        {/* Brand Logo */}
        <div className="brand">
          <LineChart size={24} style={{ color: 'var(--color-primary)' }} />
          <span>OmniTrack</span>
        </div>

        {/* Global Statistics Indicators */}
        <div style={{ display: 'none', alignItems: 'center', gap: '2rem' }} className="nav-stats-desktop">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={16} className="text-muted" />
            <div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Tracking</p>
              <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{totalTracked} Products</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Landmark size={16} style={{ color: 'var(--color-emerald)' }} />
            <div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Saved</p>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-emerald)' }}>€{totalSavings.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="nav-actions">
          {/* Price Dropping Simulator Trigger */}
          <button
            type="button"
            className={`btn btn-sim ${isSimulating ? 'simulating' : ''}`}
            onClick={onToggleSimulation}
            title={isSimulating ? 'Pause price simulation' : 'Trigger random e-commerce price drop'}
          >
            <TrendingDown size={16} />
            <span>{isSimulating ? 'Live Sim Active' : 'Simulate Drop'}</span>
          </button>

          {/* Add URL Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenAddModal}
          >
            <Plus size={16} />
            <span>Add Link</span>
          </button>
        </div>
      </div>

      {/* Embedded styles to handle show/hide desktop stats easily on mobile responsive */}
      <style dangerouslySetInnerHTML={{ __html: `
        .nav-stats-desktop {
          display: none !important;
        }
        @media (min-width: 768px) {
          .nav-stats-desktop {
            display: flex !important;
          }
        }
      `}} />
    </nav>
  );
}
