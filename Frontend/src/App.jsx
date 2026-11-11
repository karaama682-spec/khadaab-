import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar.jsx';
import Navbar from './components/layout/Navbar.jsx';
import BottomNav from './components/layout/BottomNav.jsx';
import Login from './pages/Login.jsx';
import api from './services/api';
import { applyBrandColors, getDefaultColors } from './utils/colorUtils';
import DashboardOverview from './pages/DashboardOverview.jsx';

import ClassesManagement from './pages/ClassesManagement.jsx';
import SubjectsManagement from './pages/SubjectsManagement.jsx';
import TeachersManagement from './pages/TeachersManagement.jsx';
import StudentsManagement from './pages/StudentsManagement.jsx';
import GuardiansManagement from './pages/GuardiansManagement.jsx';
import ExitStudents from './pages/ExitStudents.jsx';
import StudentAttendanceManagement from './pages/StudentAttendanceManagement.jsx';
import TeacherAttendanceManagement from './pages/TeacherAttendanceManagement.jsx';
import SessionSettings from './pages/SessionSettings.jsx';
import ExamDashboard from './pages/ExamDashboard.jsx';
import ExamsManagement from './pages/ExamsManagement.jsx';
import ExamSchedule from './pages/ExamSchedule.jsx';
import ExamMarks from './pages/ExamMarks.jsx';
import ExamResults from './pages/ExamResults.jsx';
import ClassPromotion from './pages/ClassPromotion.jsx';
import StudentAttendanceReport from './pages/StudentAttendanceReport.jsx';
import FeePaymentReport from './pages/FeePaymentReport.jsx';
import CashbookManagement from './pages/CashbookManagement.jsx';
import GuardianPaymentReport from './pages/GuardianPaymentReport.jsx';
import CashbookCategoryReport from './pages/CashbookCategoryReport.jsx';
import CashbookPaymentReport from './pages/CashbookPaymentReport.jsx';
import PayersManagement from './pages/PayersManagement.jsx';
import MonthlyPayments from './pages/MonthlyPayments.jsx';
import SalariesManagement from './pages/SalariesManagement.jsx';
import ExpensesManagement from './pages/ExpensesManagement.jsx';
import TransactionsManagement from './pages/TransactionsManagement.jsx';
import WalletsManagement from './pages/WalletsManagement.jsx';
import BranchesManagement from './pages/BranchesManagement.jsx';
import UsersList from './pages/UsersList.jsx';
import RolesPermissions from './pages/RolesPermissions.jsx';
import ActivityLogs from './pages/ActivityLogs.jsx';
import BusinessProfile from './pages/BusinessProfile.jsx';
import SystemPreferences from './pages/settings/SystemPreferences.jsx';
import QuranManagement from './pages/QuranManagement.jsx';
import QuranLessonManagement from './pages/QuranLessonManagement.jsx';

import { UserRole } from './types.js';
import { NAV_CONFIG } from './constants.jsx';
import { userHasPermission, hasNavPermission, getDefaultLandingPath } from './utils/permissionUtils';
import { useLanguage } from './i18n/LanguageContext.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';

const RoleGuard = ({ children, currentRole, user }) => {
  const location = useLocation();
  const path = location.pathname;

  const isAllowed = () => {
    const roleNormalized = typeof currentRole === 'string' ? currentRole.toLowerCase() : '';
    const isSpecialRole = roleNormalized.includes('admin') || 
                         roleNormalized.includes('super') || 
                         roleNormalized.includes('owner') ||
                         roleNormalized.includes('system');

    if (isSpecialRole) return true;

    // For root path '/', strictly verify if user is authorized for Dashboard!
    if (path === '/') {
      return hasNavPermission(user, currentRole, 'Dashboard', null, NAV_CONFIG);
    }

    const matchingNavItem = NAV_CONFIG.find(item => {
      if (item.path === path) return true;
      if (item.subItems?.some(sub => sub.path === path)) return true;
      if (item.path !== '/' && path.startsWith(item.path)) return true;
      return false;
    });

    if (matchingNavItem) {
      let subLabel = null;
      if (matchingNavItem.subItems) {
        const subItem = matchingNavItem.subItems.find(sub => path.startsWith(sub.path));
        if (subItem) subLabel = subItem.label;
      }
      return hasNavPermission(user, currentRole, matchingNavItem.label, subLabel, NAV_CONFIG);
    }

    return true;
  };

  if (!isAllowed()) {
    console.warn('Access Denied:', { path, currentRole });
    const landingPath = getDefaultLandingPath(user, currentRole, NAV_CONFIG);
    // If already on the landing path or loop avoided, go to landingPath
    if (landingPath !== path) {
      return <Navigate to={landingPath} replace />;
    }
  }

  return <>{children}</>;
};

const App = () => {
  const { t, setLanguage } = useLanguage();
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [currentRole, setCurrentRole] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (localStorage.getItem('theme') === 'dark') return true;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem('theme')) return true;
    return false;
  });

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setCurrentRole(null);
      setBranches([]);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('tenant:updated', fetchTenantSettings);

    const cachedBranding = localStorage.getItem('tenantBranding');
    if (cachedBranding) {
      try {
        const { brandColor, accentColor, name } = JSON.parse(cachedBranding);
        applyBrandColors(brandColor, accentColor);
        if (name) document.title = name;
      } catch (e) {
        console.warn('Failed to parse cached branding');
      }
    }

    // Clear any legacy persistent login so password is required upon fresh opening
    localStorage.removeItem('userInfo');

    const userInfo = sessionStorage.getItem('userInfo');
    if (userInfo) {
      try {
        const parsedUser = JSON.parse(userInfo);
        setUser(parsedUser);
        const resolvedRole = parsedUser.role || parsedUser.roles?.[0]?.name?.toUpperCase().replace(/ /g, '_');
        setCurrentRole(resolvedRole);
        setLoading(false);
        fetchBranches();
        fetchTenantSettings();
        api.get('/settings').then(({ data }) => {
          if (data?.localization?.language) setLanguage(data.localization.language);
        }).catch(() => {});

        // If user is at root path but does not have permission for Dashboard, redirect to landing module
        if (!hasNavPermission(parsedUser, resolvedRole, 'Dashboard', null, NAV_CONFIG)) {
          const defaultPath = getDefaultLandingPath(parsedUser, resolvedRole, NAV_CONFIG);
          if (window.location.hash === '#/' || !window.location.hash || window.location.hash === '#') {
            window.location.hash = defaultPath;
          }
        }
      } catch (e) {
        sessionStorage.removeItem('userInfo');
        setUser(null);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    // Warm-up & Keep-alive ping so backend is warm immediately and stays awake
    api.get('/health', { skipCache: true }).catch(() => {});
    const warmUpInterval = setInterval(() => {
      api.get('/health', { skipCache: true }).catch(() => {});
    }, 9 * 60 * 1000);

    return () => {
      clearInterval(warmUpInterval);
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('tenant:updated', fetchTenantSettings);
    };
  }, []);

  const fetchTenantSettings = async () => {
    try {
      const { data } = await api.get('/tenants/me');
      const brandColor = data?.settings?.brandColor || getDefaultColors().brandColor;
      const accentColor = data?.settings?.accentColor || getDefaultColors().accentColor;

      localStorage.setItem('tenantBranding', JSON.stringify({
        brandColor,
        accentColor,
        name: data?.name,
        systemSubtitle: data?.systemSubtitle,
        logo: data?.logo
      }));

      document.title = data?.name || 'salaax aldaareyn';

      applyBrandColors(brandColor, accentColor);
    } catch (error) {
      console.error('Failed to fetch tenant settings:', error);
      const { brandColor, accentColor } = getDefaultColors();
      applyBrandColors(brandColor, accentColor);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data } = await api.get('/branches');
      setBranches(data.branches || data);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData) => {
    sessionStorage.setItem('userInfo', JSON.stringify(userData));
    localStorage.removeItem('userInfo');
    const resolvedRole = userData.role || userData.roles?.[0]?.name?.toUpperCase().replace(/ /g, '_');
    setUser(userData);
    setCurrentRole(resolvedRole);
    fetchBranches();
    fetchTenantSettings();

    const targetPath = getDefaultLandingPath(userData, resolvedRole, NAV_CONFIG);
    if (window.location.hash !== `#${targetPath}` && window.location.hash !== targetPath) {
      window.location.hash = targetPath;
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('userInfo');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('tenantBranding');
    setUser(null);
    setCurrentRole(null);
    setBranches([]);

    const { brandColor, accentColor } = getDefaultColors();
    applyBrandColors(brandColor, accentColor);
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        {!user ? (
          <Login onLogin={handleLogin} />
        ) : (
          <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors print:block print:min-h-0 print:h-auto print:bg-white">
            <div className="print:hidden">
              <Sidebar
                user={user}
                userRole={currentRole}
                isMobileOpen={isSidebarOpen}
                setIsMobileOpen={setIsSidebarOpen}
                onNavigate={(path) => {
                  window.location.hash = path;
                }}
                onLogout={handleLogout}
              />
            </div>

            <div className="flex flex-col flex-1 min-w-0 print:block print:w-full print:h-auto">
              <div className="print:hidden">
                <Navbar
                  user={user}
                  currentRole={currentRole}
                  onMenuClick={() => setIsSidebarOpen(true)}
                  isDarkMode={isDarkMode}
                  toggleDarkMode={toggleDarkMode}
                  onLogout={handleLogout}
                />
              </div>

              <main className="flex-1 bg-slate-50 dark:bg-slate-950 overflow-y-auto overflow-x-hidden print:overflow-visible print:h-auto print:block print:bg-white print:p-0 pb-20 lg:pb-0">
                <RoleGuard currentRole={currentRole} user={user}>
                  <Routes>
                    <Route path="/" element={<DashboardOverview />} />
                    <Route path="/quran" element={<Navigate to="/quran/plan-registration" replace />} />
                    <Route path="/quran/plan-registration" element={<QuranManagement />} />
                    <Route path="/quran/surahs" element={<QuranManagement />} />
                    <Route path="/quran/lessons" element={<QuranLessonManagement />} />

                    {/* Academic Management */}
                    <Route path="/academic/classes" element={<ClassesManagement />} />
                    <Route path="/academic/subjects" element={<SubjectsManagement />} />
                    <Route path="/academic/teachers" element={<TeachersManagement />} />
                    <Route path="/academic/students" element={<StudentsManagement />} />
                    <Route path="/academic/guardians" element={<GuardiansManagement />} />
                    <Route path="/academic/exit-students" element={<ExitStudents />} />
                    <Route path="/academic/promotion" element={<ClassPromotion />} />

                    {/* Attendance & Reports Management */}
                    <Route path="/attendance/students" element={<StudentAttendanceManagement />} />
                    <Route path="/reports/payments" element={<FeePaymentReport />} />
                    <Route path="/reports/attendance" element={<StudentAttendanceReport />} />
                    <Route path="/reports/responsibility" element={<GuardianPaymentReport />} />
                    <Route path="/reports/category-summary" element={<CashbookCategoryReport />} />
                    <Route path="/reports/payment-report" element={<CashbookPaymentReport />} />
                    <Route path="/attendance/teachers" element={<TeacherAttendanceManagement />} />
                    <Route path="/attendance/session-settings" element={<SessionSettings />} />

                    {/* Examinations */}
                    <Route path="/exams/dashboard" element={<ExamDashboard />} />
                    <Route path="/exams" element={<ExamsManagement />} />
                    <Route path="/exams/schedule" element={<ExamSchedule />} />
                    <Route path="/exams/marks" element={<ExamMarks />} />
                    <Route path="/exams/results" element={<ExamResults />} />

                    {/* Finance Management */}
                    <Route path="/finance/cashbook" element={<CashbookManagement />} />
                    <Route path="/finance/payers" element={<PayersManagement />} />
                    <Route path="/finance/monthly-payments" element={<MonthlyPayments />} />
                    <Route path="/finance/payments" element={<Navigate to="/finance/cashbook" replace />} />
                    <Route path="/finance/salaries" element={<SalariesManagement />} />
                    <Route path="/finance/expenses" element={<ExpensesManagement />} />
                    <Route path="/finance/transactions" element={<TransactionsManagement />} />
                    <Route path="/finance/wallets" element={<WalletsManagement />} />

                    {/* Structure */}
                    <Route path="/structure/branches" element={<BranchesManagement />} />

                    {/* Access & Users */}
                    <Route path="/access/users" element={<UsersList />} />
                    <Route path="/access/roles" element={<RolesPermissions />} />
                    <Route path="/access/logs" element={<ActivityLogs />} />
                    <Route path="/settings/profile" element={<BusinessProfile />} />
                    <Route path="/settings/preferences" element={<SystemPreferences />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </RoleGuard>
              </main>

              <footer className="py-4 px-8 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 text-xs text-center print:hidden hidden lg:block">
                &copy; {new Date().getFullYear()} {t('nav.instituteManagement')}
              </footer>

              {/* Mobile Bottom Navigation Bar (Phone thumb navigation) */}
              <div className="print:hidden">
                <BottomNav
                  user={user}
                  currentRole={currentRole}
                  onOpenSidebar={() => setIsSidebarOpen(true)}
                />
              </div>
            </div>
          </div>
        )}
      </Router>
    </ErrorBoundary>
  );
};

export default App;
