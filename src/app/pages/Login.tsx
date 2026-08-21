import { motion } from 'motion/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router';
import { signIn } from '../lib/auth';
import { FileText, Lock, Mail, Moon, Sun, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '../components/Logo';

const TURNSTILE_SITE_KEY = '0x4AAAAAADYZh6RkChDnNRpL';
const CAPTCHA_ENABLED = false;

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(savedMode);
    if (savedMode) document.documentElement.classList.add('dark');

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pending') === 'true') {
      toast.info('Account pending approval', {
        description: 'Please wait for an administrator to approve your account before logging in.',
        duration: 8000,
      });
      window.history.replaceState({}, '', '/login');
    }

    const sessionExpired = sessionStorage.getItem('sessionExpired');
    if (sessionExpired === 'true') {
      sessionStorage.removeItem('sessionExpired');
      toast.info('Your session has expired. Please log in again.', { duration: 5000 });
    }
  }, []);

  const renderTurnstile = useCallback(() => {
    if (!CAPTCHA_ENABLED) { setTurnstileToken('demo-bypass'); setTurnstileReady(true); return; }
    if (!turnstileRef.current || !window.turnstile) return;

    if (widgetIdRef.current !== null) {
      try { window.turnstile.remove(widgetIdRef.current); } catch {}
      widgetIdRef.current = null;
    }

    const id = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: isDarkMode ? 'dark' : 'light',
      callback: (token: string) => setTurnstileToken(token),
      'expired-callback': () => setTurnstileToken(''),
      'error-callback': () => setTurnstileToken(''),
    });
    widgetIdRef.current = id;
    setTurnstileReady(true);
  }, [isDarkMode]);

  useEffect(() => {
    if (window.turnstile) {
      renderTurnstile();
    } else {
      if (!document.getElementById('cf-turnstile-script')) {
        window.onTurnstileLoad = renderTurnstile;
        const script = document.createElement('script');
        script.id = 'cf-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      } else {
        window.onTurnstileLoad = renderTurnstile;
      }
    }
    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [renderTurnstile]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
    if (newMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
      toast.error('Please complete the CAPTCHA verification');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password, turnstileToken);
      toast.success('Login successful');
      navigate('/');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed');
      if (widgetIdRef.current !== null && window.turnstile) window.turnstile.reset(widgetIdRef.current);
      setTurnstileToken('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 sm:p-6 md:p-8 transition-colors duration-500 overflow-x-hidden">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-[440px] z-10"
      >
        {/* Logo Section */}
        <div className="text-center mb-10">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center justify-center mb-6 cursor-default"
          >
            <Logo variant={isDarkMode ? 'dark' : 'light'} className="h-20 w-20" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
            Arkivo
          </h1>
          <p className="text-muted-foreground font-medium">
            Welcome back — sign in to pick up where you left off.
          </p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold ml-1 text-foreground/80">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-background/50 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base placeholder:text-muted-foreground/50 shadow-neu-pressed"
                  placeholder="name@lgu.gov.ph"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-semibold text-foreground/80">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">Forgot?</Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-background/50 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base shadow-neu-pressed"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {CAPTCHA_ENABLED && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold ml-1">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Security Check
                </div>
                <div ref={turnstileRef} className="flex justify-center" />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !turnstileToken}
              className="w-full clay py-4 text-primary-foreground font-bold text-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale shadow-lg flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <div className="h-6 w-6 border-3 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-border/30 text-center">
            <p className="text-sm text-muted-foreground font-medium">
              New to the platform?{' '}
              <Link to="/signup" className="text-primary hover:text-primary/80 font-bold transition-colors">
                Create Account
              </Link>
            </p>
          </div>
        </div>

        {/* Quick Access Tools */}
        <div className="mt-8">
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 glass rounded-2xl text-foreground font-semibold hover:bg-foreground/5 transition-all text-sm shadow-xl"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-400" />}
            {isDarkMode ? 'Light' : 'Dark'} Mode
          </button>
        </div>

        {/* Footer Credits */}
        <div className="mt-12 text-center">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] font-bold text-muted-foreground/60 tracking-tight uppercase">
            <span>Almario</span>
            <span>Bitangcol</span>
            <span>Gale</span>
            <span>Galope</span>
          </div>
          <p className="mt-4 text-[10px] text-muted-foreground/40 font-bold uppercase tracking-[0.2em]">Arkivo • Production v1.0</p>
        </div>
      </motion.div>
    </div>
  );
}
