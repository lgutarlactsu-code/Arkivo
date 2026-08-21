import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { Lock, ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { PasswordRequirements, isPasswordValid } from '../components/PasswordRequirements';
import { toast } from 'sonner';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'done'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) {
        setStatus('invalid');
        return;
      }
      try {
        const res = await api.verifyResetToken(token);
        if (!active) return;
        if (res.valid) {
          setEmail(res.email || '');
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      } catch {
        if (active) setStatus('invalid');
      }
    })();
    return () => { active = false; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid(password)) {
      toast.error('Please meet all password requirements');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.completePasswordReset(token, password);
      setStatus('done');
      toast.success('Password reset successfully');
      setTimeout(() => navigate('/login'), 2500);
    } catch (error: any) {
      toast.error(error.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 sm:p-6 md:p-8 transition-colors duration-500 overflow-x-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-[440px] z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Logo variant={isDarkMode ? 'dark' : 'light'} className="h-14 w-14" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Set a new password</h1>
          {status === 'valid' && email && (
            <p className="text-muted-foreground font-medium text-sm">for {email}</p>
          )}
        </div>

        <div className="glass rounded-3xl p-8 shadow-2xl">
          {status === 'checking' && (
            <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Verifying your reset link…</p>
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-500">
                <XCircle className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold">Link invalid or expired</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This reset link is no longer valid. Reset links expire after 1 hour
                and can be used only once. Please submit a new request.
              </p>
              <Link
                to="/forgot-password"
                className="inline-flex items-center justify-center gap-2 clay px-6 py-3 text-primary-foreground font-bold rounded-2xl hover:brightness-110 transition-all"
              >
                Request a new link
              </Link>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold">Password updated</h2>
              <p className="text-sm text-muted-foreground">
                You can now sign in with your new password. Redirecting…
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 clay px-6 py-3 text-primary-foreground font-bold rounded-2xl hover:brightness-110 transition-all"
              >
                Go to Sign In
              </Link>
            </div>
          )}

          {status === 'valid' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold ml-1 text-foreground/80">New Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-background/50 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base shadow-neu-pressed"
                    placeholder="••••••••"
                  />
                </div>
                <PasswordRequirements password={password} show={password.length > 0} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold ml-1 text-foreground/80">Confirm Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-background/50 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base shadow-neu-pressed"
                    placeholder="••••••••"
                  />
                </div>
                {confirm.length > 0 && confirm !== password && (
                  <p className="text-xs text-rose-500 font-medium ml-1">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !isPasswordValid(password) || password !== confirm}
                className="w-full clay py-4 text-primary-foreground font-bold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="h-6 w-6 border-3 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  'Reset Password'
                )}
              </button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Link>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
