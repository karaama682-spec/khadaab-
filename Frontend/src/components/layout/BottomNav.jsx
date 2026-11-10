import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  PenSquare,
  Wallet,
  BookOpen,
  Menu,
  Users,
  ClipboardList,
  Award
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { NAV_CONFIG } from '../../constants.jsx';
import { hasNavPermission } from '../../utils/permissionUtils';

const BottomNav = ({ user, currentRole, onOpenSidebar }) => {
  const { t, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Candidate quick items to check for permission
  const candidateItems = [
    {
      id: 'dashboard',
      module: 'Dashboard',
      subModule: null,
      label: language === 'so' ? 'Hoyga' : t('nav.dashboard'),
      path: '/',
      icon: LayoutDashboard
    },
    {
      id: 'quran',
      module: "Qur'aan",
      subModule: 'Jadwalka Cashirada',
      label: "Qur'aan",
      path: '/quran/lessons',
      icon: BookOpen
    },
    {
      id: 'students',
      module: 'Academic Management',
      subModule: 'Students',
      label: language === 'so' ? 'Ardayda' : t('nav.students'),
      path: '/academic/students',
      icon: Users
    },
    {
      id: 'cashbook',
      module: 'Finance',
      subModule: 'Cashbook',
      label: language === 'so' ? 'Khasnada' : t('nav.cashbook'),
      path: '/finance/cashbook',
      icon: Wallet
    },
    {
      id: 'attendance',
      module: 'Attendance',
      subModule: 'Student Attendance',
      label: language === 'so' ? 'Xaadirin' : t('nav.attendance'),
      path: '/attendance/students',
      icon: CalendarCheck
    },
    {
      id: 'marks',
      module: 'Examinations',
      subModule: 'Mark Entry',
      label: language === 'so' ? 'Dhibcaha' : t('nav.markEntry'),
      path: '/exams/marks',
      icon: PenSquare
    },
    {
      id: 'exams',
      module: 'Examinations',
      subModule: 'Exams',
      label: language === 'so' ? 'Imtixaan' : t('nav.exams'),
      path: '/exams',
      icon: ClipboardList
    },
    {
      id: 'results',
      module: 'Examinations',
      subModule: 'Results',
      label: language === 'so' ? 'Natiijo' : t('nav.results'),
      path: '/exams/results',
      icon: Award
    }
  ];

  // Filter candidates strictly to those the current user has permission to read
  const allowedCandidates = candidateItems.filter(item =>
    hasNavPermission(user, currentRole, item.module, item.subModule, NAV_CONFIG)
  );

  // Take up to 4 permitted items + Menu (total 5 buttons)
  const displayItems = allowedCandidates.slice(0, 4);

  // Always append Menu button
  displayItems.push({
    id: 'menu',
    label: language === 'so' ? 'Liiska' : 'Menu',
    isMenu: true,
    icon: Menu
  });

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#080E1A]/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-white/10 shadow-[0_-8px_25px_rgba(0,0,0,0.12)] px-1 py-1 safe-area-bottom print:hidden"
    >
      <div
        className="grid items-center max-w-lg mx-auto"
        style={{ gridTemplateColumns: `repeat(${displayItems.length}, minmax(0, 1fr))` }}
      >
        {displayItems.map((item) => {
          const active = !item.isMenu && isActive(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.isMenu) {
                  onOpenSidebar();
                } else {
                  navigate(item.path);
                }
              }}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-200 group active:scale-90 ${
                active
                  ? 'text-brand-600 dark:text-emerald-400 font-black'
                  : 'text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1 rounded-xl transition-all ${
                    active
                      ? 'bg-brand-50 dark:bg-emerald-500/15 scale-110 shadow-xs'
                      : 'group-hover:bg-slate-100 dark:group-hover:bg-white/5'
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                </div>
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-600 dark:bg-emerald-400 shadow-xs" />
                )}
              </div>
              <span className="text-[10px] tracking-tight leading-tight mt-1 truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
