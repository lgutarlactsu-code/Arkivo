import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router';
import { getCurrentUser, signOut, User } from '../lib/auth';
import { api } from '../lib/api';
import { useDarkMode } from '../contexts/DarkModeContext';
import { Logo } from '../components/Logo';
import {
  FileText,
  Home,
  Upload,
  Users,
  LogOut,
  Bell,
  Menu,
  X,
  BarChart3,
  Settings,
  CheckCircle,
  Info,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Moon,
  Sun,
  CheckCheck
} from 'lucide-react';
import { toast } from 'sonner';

// Maps a notification type to an icon + accent color so the activity feed is scannable.
const NOTIF_STYLES: Record<string, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle, className: 'text-emerald-500 bg-emerald-500/15' },
  warning: { icon: AlertTriangle, className: 'text-amber-500 bg-amber-500/15' },
  error: { icon: XCircle, className: 'text-rose-500 bg-rose-500/15' },
  info: { icon: Info, className: 'text-primary bg-primary/15' },
};

export function Root() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) navigate('/login');
      else setUser(currentUser);
    } catch (error) {
      console.error('User auth failed:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    // Skip network calls while the tab is hidden to avoid wasted egress.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Notification fetch failed:', error);
    }
  }, [user]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (user) {
      loadNotifications();
      // Poll every 2 minutes; refresh immediately when the tab regains focus.
      const interval = setInterval(loadNotifications, 120000);
      const onVisible = () => {
        if (document.visibilityState === 'visible') loadNotifications();
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisible);
      };
    }
  }, [user, loadNotifications]);

  // Optimistically mark a single notification read, then sync with the server.
  const handleNotificationClick = useCallback(async (n: any) => {
    if (n.isRead) return;
    setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, isRead: true } : x)));
    try {
      await api.markNotificationAsRead(n.id);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      loadNotifications();
    }
  }, [loadNotifications]);

  // Mark every notification read in one action.
  const handleMarkAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(x => ({ ...x, isRead: true })));
    try {
      await api.markAllNotificationsAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      loadNotifications();
    }
  }, [loadNotifications]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Signed out securely');
      navigate('/login');
    } catch (error) {
      toast.error('Sign out failed');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <Logo className="h-16 w-16" />
        </motion.div>
        <p className="font-title text-sm font-black tracking-[0.3em] uppercase opacity-40 animate-pulse">Arkivo</p>
      </div>
    );
  }

  if (!user) return null;

  const isAdmin = ['super_admin', 'lgu_head', 'dept_admin'].includes(user.role || '');
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/upload', label: 'Upload', icon: Upload },
    ...(isAdmin ? [
      { path: '/admin', label: 'Admin', icon: Users },
      { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 pb-8 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <Logo className="h-8 w-8 group-hover:scale-105 transition-transform" />
              <span className="font-title font-black text-xl tracking-tight text-foreground">Arkivo</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg'
                        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2 md:gap-3">
              {/* Dark mode toggle */}
              <button
                onClick={toggleDarkMode}
                aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                className="h-10 w-10 glass rounded-full flex items-center justify-center hover:bg-foreground/5 transition-all text-muted-foreground"
              >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label="Notifications"
                  className="relative h-10 w-10 glass rounded-full flex items-center justify-center hover:bg-foreground/5 transition-all"
                >
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground text-[10px] font-black rounded-full flex items-center justify-center shadow-lg border-2 border-background">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifications && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowNotifications(false)}
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="fixed left-3 right-3 top-20 md:absolute md:left-auto md:right-0 md:top-auto md:mt-4 md:w-96 bg-popover text-popover-foreground rounded-3xl shadow-2xl border border-border overflow-hidden z-50 flex flex-col max-h-[75vh] md:max-h-[520px]"
                      >
                        {/* Header */}
                        <div className="p-5 border-b border-border flex justify-between items-center gap-2 flex-shrink-0">
                          <h3 className="font-black text-lg">Activity</h3>
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-tighter">
                            {unreadCount} Unread
                          </span>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-10 text-center text-muted-foreground italic font-medium">All caught up!</div>
                          ) : (
                            notifications.map(n => {
                              const style = NOTIF_STYLES[n.type as string] || NOTIF_STYLES.info;
                              const Icon = style.icon;
                              return (
                                <button
                                  key={n.id}
                                  onClick={() => handleNotificationClick(n)}
                                  className={`w-full text-left p-4 hover:bg-muted transition-colors border-b border-border/60 cursor-pointer ${!n.isRead ? 'bg-primary/10' : 'bg-transparent'}`}
                                >
                                  <div className="flex gap-4">
                                    <div className={`h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${style.className}`}>
                                      <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold truncate">{n.title}</p>
                                      <p className="text-xs font-medium mt-1 leading-relaxed line-clamp-2 text-muted-foreground">{n.message}</p>
                                      <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-wider">
                                        {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ''}
                                      </p>
                                    </div>
                                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {/* Footer actions */}
                        {notifications.length > 0 && (
                          <div className="p-3 border-t border-border flex items-center gap-2 flex-shrink-0 bg-popover">
                            <button
                              onClick={handleMarkAllRead}
                              disabled={unreadCount === 0}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CheckCheck className="h-4 w-4" />
                              Mark all as read
                            </button>
                            <Link
                              to="/documents"
                              onClick={() => setShowNotifications(false)}
                              className="py-2.5 px-4 rounded-2xl bg-muted text-muted-foreground text-xs font-bold uppercase tracking-wider hover:text-foreground transition-colors"
                            >
                              View all
                            </Link>
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Profile - Desktop */}
              <div className="hidden md:flex items-center gap-3 pl-3 border-l border-border/30">
                <Link to="/settings" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="h-10 w-10 rounded-2xl glass flex items-center justify-center font-black text-primary bg-primary/10 border-primary/20">
                    {user?.name?.charAt(0)}
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-sm font-black tracking-tight">{user?.name}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{user?.role?.replace(/_/g, ' ')}</p>
                  </div>
                </Link>
                <button onClick={handleLogout} className="h-10 w-10 glass rounded-full flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 transition-all text-muted-foreground">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile Menu Trigger */}
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden h-10 w-10 glass rounded-full flex items-center justify-center"
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Body */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <Outlet context={{ user, setUser, refreshNotifications: loadNotifications }} />
      </main>

      {/* Mobile Bottom Bar Nav - Removed as requested */}


      {/* Mobile Fullscreen Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-xs glass z-[70] border-l border-border/50 shadow-2xl p-4 flex flex-col"
            >
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2">
                  <Logo className="h-6 w-6" />
                  <span className="font-title font-black text-base tracking-tight">Arkivo</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="h-9 w-9 glass rounded-lg flex items-center justify-center hover:bg-foreground/5 transition-all">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1 flex-1 overflow-y-auto -mx-1 px-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2 mb-1.5">Navigation</p>
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-foreground/5 transition-all group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-sm">{item.label}</span>
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}

                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-2 mt-4 mb-1.5">Account</p>
                <Link
                  to="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-foreground/5 transition-all group"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <Settings className="h-4 w-4" />
                  </div>
                  <span className="font-bold text-sm">Settings</span>
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity" />
                </Link>
              </div>

              <div className="mt-3 pt-3 border-t border-border/40">
                <div className="flex items-center gap-2.5 mb-2.5 px-1">
                  <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center font-black text-primary text-sm flex-shrink-0">
                    {user?.name?.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black tracking-tight text-sm truncate">{user?.name}</p>
                    <p className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider truncate">{user?.role?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 bg-rose-500/10 text-rose-500 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-500/20 transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}