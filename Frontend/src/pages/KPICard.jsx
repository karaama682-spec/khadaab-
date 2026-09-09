
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Current billing period: 25th of one month → 24th of the next.
const currentPeriodLabel = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const start = d >= 25 ? new Date(y, m, 25) : new Date(y, m - 1, 25);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 24);
  const fmt = (dt) => dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
};

const KPICard = ({ label, value, trend, icon, color, description, progress }) => {
  const isPositive = trend >= 0;
  const hasTrend = Number.isFinite(trend);
  const desc = description || currentPeriodLabel();
  const sparkline = [24, 34, 28, 46, 38, 56, 50];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-100/90 bg-white/95 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-card-hover dark:border-slate-800/80 dark:bg-slate-900/90 dark:hover:border-brand-500/40 group">
      {/* Subtle radial light highlight on hover */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-brand-500/0 blur-2xl transition-all duration-500 group-hover:bg-brand-500/10" />

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={`p-3 rounded-2xl ${color} text-white shadow-md shadow-slate-900/10 dark:shadow-none group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
          {icon}
        </div>
        {hasTrend && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight ${
            isPositive
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          }`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight">{value}</h3>
        <p className="mt-1 text-xs font-medium text-slate-400">{desc}</p>
      </div>
      {typeof progress === 'number' ? (
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 relative z-10">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      ) : (
        <div className="mt-5 flex h-7 items-end gap-1 relative z-10">
          {sparkline.map((height, index) => (
            <span
              key={index}
              className={`flex-1 rounded-t-sm transition-all duration-300 group-hover:opacity-100 ${
                isPositive 
                  ? 'bg-emerald-500/25 group-hover:bg-emerald-500/40' 
                  : 'bg-rose-500/25 group-hover:bg-rose-500/40'
              }`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default KPICard;
