import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, LogOut, Sparkle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NAV_CONFIG } from '../../constants.jsx';
import { UserRole } from '../../types.js';
import api from '../../services/api';
import { userHasPermission } from '../../utils/permissionUtils';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const Sidebar = ({ user, userRole, isMobileOpen, setIsMobileOpen, onNavigate, onLogout }) => {
  const { t } = useLanguage();
  const [expandedItems, setExpandedItems] = useState([]);
  const [lastExpandedItem, setLastExpandedItem] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(() => {
    const cached = localStorage.getItem('tenantBranding');
    if (cached) {
      try {
        const { logo, name, systemSubtitle } = JSON.parse(cached);
        return { name: name || '', systemSubtitle: systemSubtitle || '', logo: logo || null };
      } catch (e) {
        return { name: '', systemSubtitle: '', logo: null };
      }
    }
    return { name: '', systemSubtitle: '', logo: null };
  });
  const location = useLocation();
  const navRef = useRef(null);
  const itemRefs = useRef({});

  useEffect(() => {
    const fetchTenantData = async () => {
      try {
        const { data } = await api.get('/tenants/me');
        if (data) {
          setTenantInfo({
            name: data.name || '',
            systemSubtitle: data.systemSubtitle || '',
            logo: data.logo || null
          });
        }
      } catch (error) {
        // Fallback gracefully
      }
    };
    fetchTenantData();
  }, []);

  const hasPermission = (label, subLabel = null) => {
    const roleNormalized = typeof userRole === 'string' ? userRole.toLowerCase() : '';

    if (roleNormalized.includes('admin') ||
      roleNormalized.includes('super') ||
      roleNormalized.includes('system') ||
      roleNormalized.includes('owner') ||
      roleNormalized === (UserRole.SUPER_ADMIN || '').toLowerCase()) return true;

    if (!user?.roles || user.roles.length === 0) {
      return false;
    }

    return userHasPermission(user, label, 'Read', subLabel);
  };

  const toggleExpand = (label) => {
    setExpandedItems(prev => {
      const isExpanding = !prev.includes(label);
      if (isExpanding) {
        setLastExpandedItem(label);
      }
      return prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label];
    });
  };

  useEffect(() => {
    if (lastExpandedItem && itemRefs.current[lastExpandedItem] && navRef.current) {
      const itemElement = itemRefs.current[lastExpandedItem];
      const navElement = navRef.current;

      setTimeout(() => {
        const itemRect = itemElement.getBoundingClientRect();
        const navRect = navElement.getBoundingClientRect();

        if (itemRect.bottom > navRect.bottom - 100) {
          itemElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });
        }
      }, 50);
    }
  }, [lastExpandedItem, expandedItems]);

  const isActive = (path) => location.pathname === path;
  const isParentActive = (item) => {
    if (isActive(item.path)) return true;
    return item.subItems?.some((sub) => isActive(sub.path));
  };

  const getFilteredNav = () => {
    return NAV_CONFIG.reduce((acc, item) => {
      const isModuleAllowed = hasPermission(item.label);
      if (!isModuleAllowed) return acc;

      if (item.subItems && item.subItems.length > 0) {
        const visibleSubItems = item.subItems.filter(sub => hasPermission(item.label, sub.label));
        if (visibleSubItems.length > 0) {
          acc.push({ ...item, subItems: visibleSubItems });
        }
      } else {
        acc.push(item);
      }

      return acc;
    }, []);
  };

  const filteredNav = getFilteredNav();
  const roleLabel = user?.roles?.[0]?.name || userRole || 'Super Admin';

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#080E1A] text-slate-300 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -right-24 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl" />

      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3.5 border-b border-white/10 relative z-10 backdrop-blur-md">
        <div className="w-11 h-11 bg-gradient-to-tr from-brand-700 via-brand-600 to-emerald-500 rounded-2xl flex items-center justify-center font-black text-white shadow-xl shadow-brand-950/50 overflow-hidden shrink-0 ring-1 ring-white/25">
          {tenantInfo.logo ? (
            <img src={tenantInfo.logo} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg tracking-tight">{(tenantInfo.name || 'I').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="overflow-hidden min-w-0">
          <span className="text-sm font-black text-white tracking-tight block truncate" title={tenantInfo.name || 'Cumar Binu Khadhaab'}>{tenantInfo.name || 'Cumar Binu Khadhaab'}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400 block truncate">{tenantInfo.systemSubtitle || t('instituteManagement')}</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav ref={navRef} className="flex-1 overflow-y-auto py-5 px-3 space-y-1 custom-scrollbar relative z-10">
        {filteredNav.map((item) => {
          const isExpanded = expandedItems.includes(item.label);
          const active = isParentActive(item);

          return (
            <div key={item.label} className="space-y-0.5">
              <button
                ref={(el) => itemRefs.current[item.label] = el}
                onClick={() => {
                  if (item.subItems && item.subItems.length > 0) {
                    toggleExpand(item.label);
                  } else {
                    onNavigate(item.path);
                    setIsMobileOpen(false);
                  }
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all duration-200 group relative overflow-hidden ${active
                  ? 'bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-600 text-white shadow-lg shadow-brand-900/40 ring-1 ring-white/20 font-bold'
                  : 'text-slate-400 hover:bg-white/6 hover:text-slate-100 font-medium'
                  }`}
              >
                <div className="flex items-center gap-3 relative z-10 min-w-0">
                  <div className={`transition-transform duration-200 group-hover:scale-110 ${active ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}`}>
                    {React.createElement(item.icon, { size: 19 })}
                  </div>
                  <span className="text-sm tracking-tight truncate">
                    {t(item.translationKey) || item.label}
                  </span>
                </div>
                {item.subItems && item.subItems.length > 0 && (
                  <div className={`transition-transform duration-200 relative z-10 ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown size={14} className={active ? 'text-white' : 'text-slate-400'} />
                  </div>
                )}
              </button>

              {item.subItems && item.subItems.length > 0 && isExpanded && (
                <div className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-1">
                  {item.subItems.map(sub => {
                    const subActive = isActive(sub.path);
                    return (
                      <button
                        key={sub.label}
                        onClick={() => {
                          onNavigate(sub.path);
                          setIsMobileOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 group ${subActive
                          ? 'bg-white/15 text-white ring-1 ring-white/15 shadow-sm'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-white/6'
                          }`}
                      >
                        <div className={`transition-colors ${subActive ? 'text-emerald-300' : 'text-slate-500 group-hover:text-emerald-300'}`}>
                          {React.createElement(sub.icon, { size: 15 })}
                        </div>
                        <span className="truncate">{t(sub.translationKey) || sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Card & Logout Footer */}
      <div className="p-4 border-t border-white/10 bg-[#080E1A]/90 backdrop-blur-md relative z-10">
        <div className="mb-2.5 flex items-center gap-3 rounded-2xl bg-white/6 p-2.5 ring-1 ring-white/10 hover:bg-white/10 transition-colors">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-emerald-500 text-xs font-black text-white shadow-md shadow-brand-900/30">
            {(user?.username || user?.fullName || user?.email || 'A').charAt(0).toUpperCase()}
            <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#080E1A] bg-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-white">{user?.username || user?.fullName || 'Admin'}</p>
            <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 transition-all duration-200 group">
          <div className="p-1 rounded-lg bg-white/6 group-hover:bg-rose-500/20 transition-colors">
            <LogOut size={15} />
          </div>
          <span>{t('logout')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 h-screen sticky top-0 bg-[#080E1A] overflow-hidden border-r border-white/10">
        <SidebarContent />
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-[#071124] shadow-2xl transition-transform duration-300 transform">
            <SidebarContent />
            <button
              onClick={() => setIsMobileOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
