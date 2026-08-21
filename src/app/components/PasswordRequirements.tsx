import { motion, AnimatePresence } from 'motion/react';
import { Check, X } from 'lucide-react';

// Mirrors the server-side rules in supabase/functions/server/security.tsx
export const passwordRules = [
  { key: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number', label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character (!@#$…)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export const isPasswordValid = (password: string) =>
  passwordRules.every((r) => r.test(password));

interface Props {
  password: string;
  // Only render the checklist once the user starts typing
  show?: boolean;
  className?: string;
}

export function PasswordRequirements({ password, show = true, className = '' }: Props) {
  const met = passwordRules.filter((r) => r.test(password)).length;
  const strength = met === 0 ? 0 : met / passwordRules.length;
  const strengthLabel =
    met <= 2 ? 'Weak' : met <= 4 ? 'Good' : 'Strong';
  const strengthColor =
    met <= 2 ? 'bg-rose-500' : met <= 4 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={`overflow-hidden ${className}`}
        >
          <div className="pt-3 space-y-3">
            {/* Strength meter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Password strength
                </span>
                <span
                  className={`text-[11px] font-bold ${
                    met <= 2 ? 'text-rose-500' : met <= 4 ? 'text-amber-500' : 'text-emerald-500'
                  }`}
                >
                  {password ? strengthLabel : '—'}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${strengthColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${strength * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Checklist */}
            <ul className="space-y-1.5">
              {passwordRules.map((rule) => {
                const ok = rule.test(password);
                return (
                  <li key={rule.key} className="flex items-center gap-2 text-xs">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors ${
                        ok ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </span>
                    <span className={ok ? 'text-foreground/80 font-medium' : 'text-muted-foreground'}>
                      {rule.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
