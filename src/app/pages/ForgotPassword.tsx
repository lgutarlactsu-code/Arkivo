import { motion } from 'motion/react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { Mail, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { toast } from 'sonner';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.requestPasswordReset(email);
      setSubmitted(true);
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong. Please try again.');
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
          <h1 className="text-2xl font-bold tracking-tight mb-2">Forgot your password?</h1>
          <p className="text-muted-foreground font-medium text-sm">
            Reset requests are reviewed by an administrator for security.
          </p>
        </div>

        <div className="glass rounded-3xl p-8 shadow-2xl">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold">Request received</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If an account exists for <span className="font-semibold text-foreground">{email}</span>,
                an administrator has been notified. Once approved, you'll receive an
                email with a secure link to set a new password.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 mt-2 clay px-6 py-3 text-primary-foreground font-bold rounded-2xl hover:brightness-110 transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/15">
                <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  For your protection, an admin manually approves each reset before
                  a link is emailed to you.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold ml-1 text-foreground/80">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-background/50 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base shadow-neu-pressed"
                    placeholder="name@lgu.gov.ph"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full clay py-4 text-primary-foreground font-bold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="h-6 w-6 border-3 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  'Send Reset Request'
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
