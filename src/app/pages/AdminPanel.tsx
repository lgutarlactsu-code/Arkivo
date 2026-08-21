import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router';
import { api } from '../lib/api';
import {
  Users, Shield, CheckCircle,
  UserX, Clock, ShieldAlert, Award,
  Search,
  Settings, Database, Fingerprint,
  MoreVertical, Mail, Building, LayoutGrid, List,
  Trash2, KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const ROLE_ORDER: Record<string, number> = {
  'super_admin': 4,
  'lgu_head': 3,
  'dept_admin': 2,
  'records_officer': 1,
  'staff': 0
};

const ROLE_LABELS: Record<string, string> = {
  'super_admin': 'System Admin',
  'lgu_head': 'Executive Officer',
  'dept_admin': 'Department Admin',
  'records_officer': 'Records Officer',
  'staff': 'Staff'
};

export function AdminPanel() {
  const { user } = useOutletContext<any>();
  const [users, setUsers] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [processingResetId, setProcessingResetId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    if (user?.role === 'super_admin') loadResetRequests();
  }, []);

  const loadResetRequests = async () => {
    try {
      const data = await api.getPasswordResetRequests();
      // Show only actionable (pending) requests at the top of the queue
      setResetRequests((data.requests || []).filter((r: any) => r.status === 'pending'));
    } catch (error: any) {
      // Table may not exist yet until migration 006 is applied — fail quietly
      console.warn('Could not load reset requests:', error.message);
    }
  };

  const handleApproveReset = async (id: string) => {
    setProcessingResetId(id);
    try {
      const res = await api.approvePasswordResetRequest(id);
      if (res.emailSent) {
        toast.success('Reset link emailed to the user');
      } else if (res.fallbackLink) {
        // Email delivery not configured — let the admin copy the link
        await navigator.clipboard.writeText(res.fallbackLink).catch(() => {});
        toast.success('Reset link copied to clipboard', {
          description: 'Email delivery is not configured yet. Share this link with the user.',
          duration: 10000,
        });
      } else {
        toast.success('Reset request approved');
      }
      loadResetRequests();
    } catch (error: any) {
      toast.error(error.message || 'Could not approve request');
    } finally {
      setProcessingResetId(null);
    }
  };

  const handleRejectReset = async (id: string) => {
    const reason = prompt('Why are you declining this reset request? (optional)') ?? '';
    setProcessingResetId(id);
    try {
      await api.rejectPasswordResetRequest(id, reason);
      toast.error('Reset request declined');
      loadResetRequests();
    } catch (error: any) {
      toast.error(error.message || 'Could not decline request');
    } finally {
      setProcessingResetId(null);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      const allUsers = data.users || [];
      
      const pending = allUsers.filter((u: any) => u.approvalStatus === 'pending');
      const approved = allUsers.filter((u: any) => u.approvalStatus === 'approved' || !u.approvalStatus);
      
      const sortedUsers = approved.sort((a: any, b: any) => {
        const levelA = ROLE_ORDER[a.role] ?? -1;
        const levelB = ROLE_ORDER[b.role] ?? -1;
        return levelB - levelA;
      });
      
      setUsers(sortedUsers);
      setPendingUsers(pending);
      setStats({
        total: approved.length,
        pending: pending.length,
        active: approved.filter((u: any) => u.isActive).length,
        admins: approved.filter((u: any) => ['super_admin', 'lgu_head', 'dept_admin'].includes(u.role)).length,
      });
    } catch (error: any) {
      toast.error('Could not load the people list');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (userId: string) => {
    setProcessingUserId(userId);
    try {
      await api.approveUserAccount(userId);
      toast.success('Access granted');
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Could not approve');
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    const reason = prompt('Why are you turning down this request? (kept for the record)');
    if (!reason) return;

    setProcessingUserId(userId);
    try {
      await api.rejectUserAccount(userId, reason);
      toast.error('Sign-up turned down');
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Could not turn down');
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${userName}? This action cannot be undone.`)) {
      return;
    }

    setProcessingUserId(userId);
    setMenuOpenId(null);
    try {
      await api.deleteUser(userId);
      toast.success('Account deleted');
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Could not delete');
    } finally {
      setProcessingUserId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-sm font-black tracking-widest uppercase opacity-40 text-primary">Loading people…</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20">
      {/* Header bar */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay p-5 sm:p-6 text-primary-foreground relative overflow-hidden"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md flex-shrink-0">
            <Fingerprint className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold leading-tight">Admin</h1>
            <p className="text-primary-foreground/75 text-xs sm:text-sm mt-0.5 truncate">Manage people and their access</p>
          </div>
          {/* Stats + activity link inline on desktop */}
          <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
            <div className="text-center px-1">
              <p className="text-xl font-black tabular-nums leading-none">{stats.total ?? 0}</p>
              <p className="text-[9px] uppercase tracking-widest opacity-75 mt-1">People</p>
            </div>
            <div className="text-center px-1">
              <p className="text-xl font-black tabular-nums leading-none">{stats.pending ?? 0}</p>
              <p className="text-[9px] uppercase tracking-widest opacity-75 mt-1">Waiting</p>
            </div>
            <Link to="/audit" className="bg-white/15 hover:bg-white/25 transition-colors rounded-xl px-3.5 py-2.5 text-sm font-bold flex items-center gap-2 backdrop-blur-md">
              <Database className="h-4 w-4" /> Activity log
            </Link>
          </div>
          {/* Compact activity link on mobile */}
          <Link to="/audit" className="sm:hidden h-11 w-11 bg-white/15 hover:bg-white/25 transition-colors rounded-xl flex items-center justify-center backdrop-blur-md flex-shrink-0">
            <Database className="h-5 w-5" />
          </Link>
        </div>
        {/* Stats row on mobile */}
        <div className="flex sm:hidden items-center gap-2 mt-4">
          <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-center">
            <p className="text-lg font-black tabular-nums leading-none">{stats.total ?? 0}</p>
            <p className="text-[9px] uppercase tracking-widest opacity-75 mt-1">People</p>
          </div>
          <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-center">
            <p className="text-lg font-black tabular-nums leading-none">{stats.pending ?? 0}</p>
            <p className="text-[9px] uppercase tracking-widest opacity-75 mt-1">Waiting</p>
          </div>
        </div>
      </motion.div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'People', value: stats.total, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Waiting for approval', value: stats.pending, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Active', value: stats.active, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Admins', value: stats.admins, icon: Award, color: 'text-foreground', bg: 'bg-muted' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-4 border-border/30 flex items-center gap-3"
          >
            <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black tabular-nums leading-none">{stat.value}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 truncate">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Password reset requests */}
      <AnimatePresence>
        {user?.role === 'super_admin' && resetRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass rounded-2xl p-4 border-primary/20"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary flex-shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold leading-tight">Password reset requests</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Approve to email a secure reset link (valid 1 hour)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {resetRequests.map((r: any) => (
                <div key={r.id} className="bg-background/50 p-3.5 rounded-xl border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary text-sm flex-shrink-0">
                      {r.name?.charAt(0) ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm leading-tight truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
                    <button
                      onClick={() => handleApproveReset(r.id)}
                      disabled={processingResetId === r.id}
                      className="flex-1 sm:flex-none clay px-4 py-2.5 rounded-xl text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {processingResetId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Mail className="h-4 w-4" /> Send Link</>)}
                    </button>
                    <button
                      onClick={() => handleRejectReset(r.id)}
                      disabled={processingResetId === r.id}
                      className="flex-1 sm:flex-none bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending sign-ups */}
      <AnimatePresence>
        {user?.role === 'super_admin' && pendingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-gold rounded-2xl p-4 border-amber-500/20"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500 flex-shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold leading-tight">Pending sign-ups</h2>
                <p className="text-xs text-muted-foreground mt-0.5">People waiting for your approval</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {pendingUsers.map((u: any) => (
                <div key={u.id} className="bg-background/50 p-3.5 rounded-xl border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/40 transition-colors">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-black text-amber-500 text-sm flex-shrink-0">
                        {u.name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm leading-tight truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                       <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-lg border border-amber-500/20">
                          {ROLE_LABELS[u.role] || u.role}
                       </span>
                       <span className="px-2.5 py-1 bg-muted/50 text-[10px] font-bold rounded-lg border border-border/50">
                          {u.department}
                       </span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
                    <button
                      onClick={() => handleApproveUser(u.id)}
                      disabled={processingUserId === u.id}
                      className="flex-1 sm:flex-none clay px-4 py-2.5 rounded-xl text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50 flex items-center justify-center"
                    >
                      {processingUserId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleRejectUser(u.id)}
                      disabled={processingUserId === u.id}
                      className="flex-1 sm:flex-none bg-rose-500/10 border border-rose-500/20 text-rose-500 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* People directory */}
      <div className="glass rounded-2xl p-4 border-border/30 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Everyone
            </h2>
            <div className="flex bg-muted rounded-xl p-1 border border-border/30">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative group max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search by name, email or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border/50 bg-background/50 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" : "space-y-2.5"}>
          <AnimatePresence mode="popLayout">
            {filteredUsers.length === 0 ? (
               <div className="col-span-full py-16 text-center rounded-xl border border-dashed border-border/40 text-muted-foreground">
                  <UserX className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-bold">No people match your search</p>
               </div>
            ) : (
              filteredUsers.map((u, i) => (
                <motion.div
                  layout
                  key={u.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: i * 0.02 }}
                  className={viewMode === 'grid'
                    ? "glass p-4 rounded-2xl border border-border/40 hover:border-primary/40 group transition-colors relative outline-none focus:outline-none"
                    : "glass p-3 rounded-xl border border-border/40 hover:border-primary/40 group transition-colors relative flex flex-col md:flex-row items-center justify-between gap-3 outline-none focus:outline-none"
                  }
                >
                  {viewMode === 'grid' ? (
                    <div className="flex flex-col gap-3 w-full">
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 bg-primary/10 rounded-xl flex items-center justify-center font-black text-base text-primary flex-shrink-0">
                          {u.name?.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate group-hover:text-primary transition-colors leading-tight">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate lowercase flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 flex-shrink-0" /> {u.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div className={`h-2 w-2 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span className={`text-[10px] font-bold ${u.isActive ? 'text-emerald-500' : 'text-rose-500'}`}>
                             {u.isActive ? 'Active' : 'Locked'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 bg-muted/40 rounded-xl border border-border/30">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Role</p>
                          <p className="text-xs font-bold text-primary capitalize truncate">{u.role?.replace(/_/g, ' ')}</p>
                        </div>
                        <div className="p-2.5 bg-muted/40 rounded-xl border border-border/30">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                             <Building className="h-3 w-3" /> Dept
                          </p>
                          <p className="text-xs font-bold truncate text-foreground">{u.department}</p>
                        </div>
                      </div>

                      <div className="p-2.5 bg-muted/40 rounded-xl border border-border/30">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                             <Shield className="h-3 w-3" /> Access
                          </p>
                          <p className="text-[10px] font-bold text-primary">Level {u.clearanceLevel || 0}</p>
                        </div>
                        <div className="flex gap-0.5">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < (u.clearanceLevel || 0) ? 'bg-primary' : 'bg-border/40'}`} />
                          ))}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-border/40 flex items-center justify-between">
                         <p className="text-[10px] text-muted-foreground">
                            Registered {new Date(u.createdAt).toLocaleDateString()}
                         </p>
                         <div className="relative">
                           <button
                             onClick={() => setMenuOpenId(menuOpenId === u.id ? null : u.id)}
                             className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-foreground/5 transition-all"
                           >
                              <MoreVertical className="h-4 w-4 opacity-50" />
                           </button>
                           <AnimatePresence>
                             {menuOpenId === u.id && (
                               <>
                                 <motion.div
                                   initial={{ opacity: 0 }}
                                   animate={{ opacity: 1 }}
                                   exit={{ opacity: 0 }}
                                   onClick={() => setMenuOpenId(null)}
                                   className="fixed inset-0 z-40"
                                 />
                                 <motion.div
                                   initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                   animate={{ opacity: 1, scale: 1, y: 0 }}
                                   exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                   className="absolute right-0 mt-2 w-44 glass rounded-xl shadow-lg border border-border/50 overflow-hidden z-50"
                                 >
                                   {user?.role === 'super_admin' && (
                                     <button
                                       onClick={() => handleDeleteUser(u.id, u.name)}
                                       className="w-full px-4 py-2.5 text-left hover:bg-rose-500/10 transition-all flex items-center gap-2.5 text-rose-500 border-b border-border/50"
                                     >
                                       <Trash2 className="h-4 w-4" />
                                       <span className="text-sm font-bold">Delete account</span>
                                     </button>
                                   )}
                                   <button
                                     onClick={() => setMenuOpenId(null)}
                                     className="w-full px-4 py-2.5 text-left hover:bg-foreground/5 transition-all text-sm font-medium text-muted-foreground"
                                   >
                                     Close
                                   </button>
                                 </motion.div>
                               </>
                             )}
                           </AnimatePresence>
                         </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-1 min-w-0 w-full md:w-auto">
                        <div className="h-9 w-9 bg-primary/10 rounded-xl flex items-center justify-center font-black text-sm text-primary flex-shrink-0">
                          {u.name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate group-hover:text-primary transition-colors leading-tight">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate lowercase">{u.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 md:gap-5 flex-1 justify-end flex-wrap md:flex-nowrap w-full md:w-auto">
                        <div className="hidden lg:block text-right">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Department</p>
                          <p className="text-xs font-bold truncate">{u.department}</p>
                        </div>
                        <div className="text-right min-w-[70px]">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Access</p>
                          <p className="text-xs font-bold text-primary">Level {u.clearanceLevel || 0}</p>
                        </div>
                        <div className="text-right min-w-[90px]">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Role</p>
                          <p className="text-xs font-bold text-primary capitalize">{u.role?.replace(/_/g, ' ')}</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/50 rounded-xl border border-border/40 min-w-[76px] justify-center">
                           <div className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                           <span className={`text-[10px] font-bold ${u.isActive ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {u.isActive ? 'Active' : 'Locked'}
                           </span>
                        </div>
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === u.id ? null : u.id)}
                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-foreground/5 transition-all"
                          >
                             <MoreVertical className="h-4 w-4 opacity-50" />
                          </button>
                          <AnimatePresence>
                            {menuOpenId === u.id && (
                              <>
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  onClick={() => setMenuOpenId(null)}
                                  className="fixed inset-0 z-40"
                                />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                  className="absolute right-0 mt-2 w-44 glass rounded-xl shadow-lg border border-border/50 overflow-hidden z-50"
                                >
                                  {user?.role === 'super_admin' && (
                                    <button
                                      onClick={() => handleDeleteUser(u.id, u.name)}
                                      className="w-full px-4 py-2.5 text-left hover:bg-rose-500/10 transition-all flex items-center gap-2.5 text-rose-500 border-b border-border/50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="text-sm font-bold">Delete account</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setMenuOpenId(null)}
                                    className="w-full px-4 py-2.5 text-left hover:bg-foreground/5 transition-all text-sm font-medium text-muted-foreground"
                                  >
                                    Close
                                  </button>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* How access works */}
      <div className="glass rounded-2xl p-4 border-border/30">
         <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
               <Settings className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
               <h3 className="text-base font-bold text-foreground">How access works</h3>
               <p className="text-sm leading-relaxed text-muted-foreground max-w-4xl">
                  Access levels decide what each person can see and do.
                  Level 4 (Admin) can see everything. Level 3 (Executive) can approve documents across departments.
                  Level 2 (Department Admin) is limited to their own department.
                  Levels 1 and 0 have everyday access. Every role change and promotion
                  is saved to the activity log so there's always a record.
               </p>
            </div>
         </div>
      </div>

      {/* Processing overlay */}
      <AnimatePresence>
        {processingUserId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-background/80 backdrop-blur-md flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3">
               <Loader2 className="h-10 w-10 text-primary animate-spin" />
               <p className="text-sm font-bold text-primary">Saving changes…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);