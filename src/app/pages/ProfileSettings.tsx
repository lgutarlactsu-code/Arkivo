import { motion } from 'motion/react';
import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { User, Shield, Moon, Sun, Edit2, Building2, Mail, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDarkMode } from '../contexts/DarkModeContext';
import { api } from '../lib/api';

export function ProfileSettings() {
  const { user, setUser } = useOutletContext<any>();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [saving, setSaving] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');

  const handleNameUpdate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const response = await api.updateName(newName);
      setUser(response.user);
      toast.success('Name updated');
      setEditingName(false);
    } catch (error: any) {
      toast.error(error.message || "Couldn't save that — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <div className="mb-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Your profile</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Your account details and how the app looks to you.</p>
      </div>

      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 border-border/30"
      >
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <div className="h-16 w-16 clay rounded-2xl flex items-center justify-center text-primary-foreground">
              <User className="h-8 w-8" />
            </div>
            {!editingName && (
              <button
                onClick={() => { setNewName(user?.name || ''); setEditingName(true); }}
                className="absolute -bottom-1.5 -right-1.5 h-7 w-7 glass rounded-full flex items-center justify-center text-primary border-border hover:scale-110 transition-transform"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-background/50 border border-border/50 rounded-xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
                <button onClick={handleNameUpdate} disabled={saving} className="h-9 w-9 flex items-center justify-center bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditingName(false)} className="h-9 w-9 flex items-center justify-center glass rounded-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold tracking-tight truncate">{user?.name}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" /> {user?.email}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
          <div className="bg-foreground/5 p-3 rounded-xl flex items-center gap-2.5">
            <Shield className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Role</p>
              <p className="text-sm font-bold capitalize truncate">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
          <div className="bg-foreground/5 p-3 rounded-xl flex items-center gap-2.5">
            <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Department</p>
              <p className="text-sm font-bold capitalize truncate">{user?.department}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Appearance */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-5 border-border/30"
      >
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Appearance</h3>
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-between p-3.5 bg-foreground/5 rounded-xl transition-all hover:bg-foreground/10"
        >
          <div className="flex items-center gap-3">
            {isDarkMode ? <Moon className="h-5 w-5 text-foreground" /> : <Sun className="h-5 w-5 text-amber-500" />}
            <div className="text-left">
              <p className="font-bold text-sm">{isDarkMode ? 'Dark mode' : 'Light mode'}</p>
              <p className="text-[11px] text-muted-foreground">Tap to switch</p>
            </div>
          </div>
          <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-primary' : 'bg-muted'}`}>
            <div className={`h-4 w-4 rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-4' : ''}`} />
          </div>
        </button>
      </motion.div>
    </div>
  );
}
