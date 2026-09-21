import React from 'react';
import { TrendingUp, TrendingDown, ArrowUpRight, Eye } from 'lucide-react';
import { currentCycle, cycleLabel } from '../utils/billingCycle';

const KPICard = ({
  label,
  value,
  trend,
  icon,
  color = 'bg-brand-500',
  description,
  progress,
  onClick,
  onPreview,
  badge,
  badgeColor = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
}) => {
  const isPositive = trend >= 0;
  const hasTrend = Number.isFinite(trend);
  const desc = description || cycleLabel(currentCycle());
  const sparkline = [24, 34, 28, 46, 38, 56, 50];

  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 dark:border-slate-800/80 dark:bg-slate-900/90 ${
        onClick
          ? 'cursor-pointer hover:-translate-y-1.5 hover:border-brand-500/50 hover:shadow-xl hover:shadow-brand-500/10 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-brand-500/50'
          : ''
      }`}
    >
      {/* Ambient background glow on hover */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-500/0 blur-2xl transition-all duration-500 group-hover:bg-brand-500/15" />

      {/* Header with Icon and Action Badges */}
      <div className="relative z-10 mb-4 flex items-center justify-between">
        <div className={`p-3 rounded-2xl ${color} text-white shadow-md shadow-slate-900/10 dark:shadow-none transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
          {icon}
        </div>

        <div className="flex items-center gap-1.5">
          {badge && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
              {badge}
            </span>
          )}

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

          {/* Quick Preview Button */}
          {onPreview && (
            <button
              type="button"
              title="Faahfaahin Degdeg ah / Quick Preview"
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100/90 text-slate-500 transition-all hover:bg-brand-50 hover:text-brand-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              <Eye size={15} />
            </button>
          )}

          {/* Direct Navigation Indicator */}
          {onClick && (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100/80 text-slate-400 transition-all duration-300 group-hover:bg-brand-500 group-hover:text-white group-hover:shadow-md dark:bg-slate-800 dark:text-slate-500">
              <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          )}
        </div>
      </div>

      {/* Main Metric Content */}
      <div className="relative z-10">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <h3 className="text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums dark:text-white md:text-3xl">
          {value}
        </h3>
        <p className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-500 line-clamp-1">
          {desc}
        </p>
      </div>

      {/* Progress or Sparkline */}
      {typeof progress === 'number' ? (
        <div className="relative z-10 mt-4">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
            <span>Heerka</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="relative z-10 mt-4 flex h-6 items-end gap-1">
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

      {/* Bottom Subtle Action Hint */}
      {onClick && (
        <div className="relative z-10 mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] font-semibold text-slate-400 transition-colors group-hover:text-brand-600 dark:border-slate-800/80 dark:group-hover:text-brand-400">
          <span>Guji si aad u furto</span>
          <span className="flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 font-bold">
            Tag Bogga &rarr;
          </span>
        </div>
      )}
    </div>
  );
};

export default KPICard;
