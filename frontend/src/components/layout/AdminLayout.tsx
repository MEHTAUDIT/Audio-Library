import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Upload,
  FolderUp,
  FileAudio,
  CheckCircle,
  Archive,
  Settings,
  LogOut,
  Menu,
  X,
  Library,
  ListMusic,  // icon for Series nav item
  ChevronRight,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/Tooltip';
import { useAuth } from '../../lib/auth';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  description: string;
}

const navItems: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    path: '/admin',
    description: 'Overview and statistics',
  },
  {
    icon: Upload,
    label: 'Upload',
    path: '/admin/upload',
    description: 'Upload new audio files',
  },
  {
    icon: FolderUp,
    label: 'Bulk Upload',
    path: '/admin/bulk-upload',
    description: 'Import from folder structure',
  },
  {
    icon: FileAudio,
    label: 'Staging',
    path: '/admin/staging',
    description: 'Draft audio awaiting publication',
  },
  {
    icon: CheckCircle,
    label: 'Published',
    path: '/admin/published',
    description: 'Live audio visible to users',
  },
  {
    icon: ListMusic,
    label: 'Series',
    path: '/admin/series',
    description: 'Manage series and collections',
  },
  {
    icon: Archive,
    label: 'Archived',
    path: '/admin/archived',
    description: 'Archived audio content',
  },
];

const secondaryNavItems: NavItem[] = [
  {
    icon: Library,
    label: 'View Library',
    path: '/library',
    description: 'See public audio library',
  },
  {
    icon: Settings,
    label: 'Settings',
    path: '/admin/settings',
    description: 'Account and app settings',
  },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
        {/* Mobile header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-50 flex items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-700 to-accent-600 flex items-center justify-center shadow-sm">
              <FileAudio className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-base">Audio Admin</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 rounded-xl hover:bg-slate-100 transition-colors active:scale-95"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-slate-900/50 z-40 pt-16"
              onClick={() => setMobileMenuOpen(false)}
            >
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-72 h-full bg-white shadow-xl p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <nav className="space-y-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${
                        isActive(item.path)
                          ? 'bg-gradient-to-r from-primary-600 to-accent-500 text-white shadow-lg'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
                </nav>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 260 : 72 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="hidden lg:flex fixed left-0 top-0 h-screen flex-col bg-white border-r border-slate-200 z-30"
        >
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-700 to-accent-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent-200">
                <FileAudio className="w-5 h-5 text-white" />
              </div>
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex flex-col"
                  >
                    <span className="font-bold text-slate-900 whitespace-nowrap">Audio Library</span>
                    <span className="text-xs text-slate-500">Admin Portal</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-hidden">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
                        active
                          ? 'bg-gradient-to-r from-primary-600 to-accent-500 text-white shadow-lg shadow-accent-200'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon
                        className={`w-5 h-5 flex-shrink-0 ${
                          active ? 'text-white' : 'text-slate-500 group-hover:text-accent-600'
                        }`}
                      />
                      <AnimatePresence>
                        {sidebarOpen && (
                          <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="font-medium whitespace-nowrap"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  </TooltipTrigger>
                  {!sidebarOpen && (
                    <TooltipContent side="right">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-slate-400 text-xs">{item.description}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}

            <div className="pt-5 mt-5 border-t border-slate-100 space-y-2">
              {secondaryNavItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${
                          active
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <AnimatePresence>
                          {sidebarOpen && (
                            <motion.span
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="font-medium whitespace-nowrap"
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </Link>
                    </TooltipTrigger>
                    {!sidebarOpen && (
                      <TooltipContent side="right">
                        <p className="font-medium">{item.label}</p>
                        <p className="text-slate-400 text-xs">{item.description}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-slate-100">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all group"
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="font-medium whitespace-nowrap"
                      >
                        Logout
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </TooltipTrigger>
              {!sidebarOpen && (
                <TooltipContent side="right">
                  <p className="font-medium">Logout</p>
                  <p className="text-slate-400 text-xs">Sign out of your account</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </motion.aside>

        {/* Main content */}
        <main
          className={`min-h-screen transition-all duration-300 pt-16 lg:pt-0 ${
            sidebarOpen ? 'lg:ml-[260px]' : 'lg:ml-[72px]'
          }`}
        >
          <div className="p-4 sm:p-6 lg:p-10 max-w-[1600px] mx-auto">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}