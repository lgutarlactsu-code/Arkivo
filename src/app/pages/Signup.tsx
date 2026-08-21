import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { api } from '../lib/api';
import { signIn } from '../lib/auth';
import { FileText, Lock, Mail, User, Building2, Shield, Moon, Sun, ChevronRight } from 'lucide-react';
import { Logo } from '../components/Logo';
import { PasswordRequirements, isPasswordValid } from '../components/PasswordRequirements';
import { toast } from 'sonner';

export function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    department: '',
    role: 'staff',
  });
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(savedMode);
    if (savedMode) document.documentElement.classList.add('dark');
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
    if (newMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid(formData.password)) {
      toast.error('Please meet all password requirements');
      return;
    }
    setLoading(true);
    
    try {
      const result = await api.signup(formData);
      if (result.requiresApproval) {
        toast.success('Account created! Waiting for admin approval', {
          description: 'You will be notified once your account is approved.',
          duration: 8000,
        });
        setTimeout(() => navigate('/login?pending=true'), 2000);
      } else {
        await signIn(formData.email, formData.password);
        toast.success('Account created successfully');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error.message || 'Signup failed');
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
        className="w-full max-w-[480px] z-10 my-8"
      >
        <div className="text-center mb-10">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center justify-center mb-4"
          >
            <Logo variant={isDarkMode ? 'dark' : 'light'} className="h-16 w-16" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
            Join Arkivo
          </h1>
          <p className="text-muted-foreground font-medium">Set up your account — it only takes a minute.</p>
        </div>

        <div className="glass rounded-3xl p-8 shadow-2xl relative">
          <form onSubmit={handleSignup} className="space-y-5">
            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold ml-1 text-foreground/80">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-background/50 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base shadow-neu-pressed"
                    placeholder="Juan Dela Cruz"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold ml-1 text-foreground/80">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-background/50 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base shadow-neu-pressed"
                    placeholder="name@lgu.gov.ph"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold ml-1 text-foreground/80">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={8}
                    className="w-full pl-12 pr-4 py-3.5 bg-background/50 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-base shadow-neu-pressed"
                    placeholder="••••••••"
                  />
                </div>
                <PasswordRequirements password={formData.password} show={formData.password.length > 0} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold ml-1 text-foreground/80">Department</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      required
                      className="w-full pl-12 pr-4 py-3.5 bg-background/50 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none text-sm shadow-neu-pressed"
                    >
                      <option value="">Select...</option>
                      <option value="administration">Administration</option>
                      <option value="finance">Finance</option>
                      <option value="engineering">Engineering</option>
                      <option value="health">Health</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold ml-1 text-foreground/80">Base Role</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full pl-12 pr-4 py-3.5 bg-background/50 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none text-sm shadow-neu-pressed"
                    >
                      <option value="staff">Staff</option>
                      <option value="dept_admin">Department Admin</option>
                      <option value="records_officer">Records Officer</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid(formData.password)}
              className="w-full clay py-4 text-primary-foreground font-bold text-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2 group mt-4"
            >
              {loading ? (
                <div className="h-6 w-6 border-3 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-border/30 text-center">
            <p className="text-sm text-muted-foreground font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:text-primary/80 font-bold transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={toggleDarkMode}
            className="flex items-center gap-2 px-6 py-3 glass rounded-full text-foreground font-semibold hover:bg-foreground/5 transition-all text-sm shadow-xl"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-blue-400" />}
            Switch Theme
          </button>
        </div>

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
