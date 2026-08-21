import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router';
import { api } from '../lib/api';
import { FileText, Clock, CheckCircle, XCircle, File, TrendingUp, ChevronRight, Activity, Calendar, User as UserIcon } from 'lucide-react';
import { getFileIcon } from '../lib/fileIcons';

export function Dashboard() {
  const { user } = useOutletContext<any>();
  const [stats, setStats] = useState<any>(null);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async (silent = false) => {
    // Skip background refreshes while the tab is hidden to reduce egress.
    if (silent && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      if (!silent) setLoading(true);
      const docsData = await api.getDocuments();

      // Stats are derived from documents the server already filtered by role/access.
      const visibleDocs = docsData.documents || [];

      const calculatedStats = {
        totalDocuments: visibleDocs.length,
        pendingApprovals: visibleDocs.filter((d: any) => d.status === 'pending_approval' || d.status === 'draft').length,
        approvedDocuments: visibleDocs.filter((d: any) => d.status === 'approved').length,
        rejectedDocuments: visibleDocs.filter((d: any) => d.status === 'rejected').length,
      };

      setStats(calculatedStats);
      const sorted = [...visibleDocs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRecentDocs(sorted.slice(0, 5));
    } catch (error: any) {
      console.error('Dashboard load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-bold text-muted-foreground animate-pulse tracking-widest uppercase">Loading…</p>
      </div>
    );
  }

  // Determine label based on user role
  const getTotalLabel = () => {
    if (user?.role === 'super_admin' || user?.role === 'lgu_head') return 'Total Files';
    if (user?.role === 'dept_admin' || user?.role === 'records_officer') return 'Dept Files';
    if (user?.role === 'staff') return 'Your Files';
    return 'Accessible Files';
  };

  const statCards = [
    { label: getTotalLabel(), value: stats?.totalDocuments || 0, icon: FileText, color: 'text-foreground', bg: 'bg-muted' },
    { label: 'Pending', value: stats?.pendingApprovals || 0, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Approved', value: stats?.approvedDocuments || 0, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Rejected', value: stats?.rejectedDocuments || 0, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ];

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 pb-10">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay p-5 sm:p-6 text-primary-foreground relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0 backdrop-blur-md">
              <UserIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">{timeGreeting}, {user?.name?.split(' ')[0]}</h1>
              <p className="text-primary-foreground/75 text-sm mt-0.5">
                {user?.role === 'super_admin' || user?.role === 'lgu_head'
                  ? "Here's everything across the system."
                  : user?.role === 'dept_admin' || user?.role === 'records_officer'
                  ? `Here's what's happening in ${user.department}.`
                  : user?.role === 'staff'
                  ? "Here's a look at your documents."
                  : "Here's what's available to you."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-md">
            <span className="text-xs font-bold capitalize">{user?.role?.replace(/_/g, ' ')}</span>
            <span className="h-1 w-1 rounded-full bg-white/40" />
            <span className="text-xs opacity-75 capitalize">{user?.department}</span>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
            className="glass rounded-2xl p-4 border-border/40 group hover:border-primary/30 transition-all cursor-default outline-none flex items-center gap-3"
          >
            <div className={`${stat.bg} w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black tabular-nums tracking-tighter leading-none">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1 truncate">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Documents
            </h2>
            <Link to="/documents" className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
              View All <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="glass rounded-2xl border-border/30 overflow-hidden shadow-2xl outline-none">
            {recentDocs.length === 0 ? (
              <div className="py-20 text-center">
                <File className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">No activity recorded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {recentDocs.map((doc) => {
                  const DocIcon = getFileIcon(doc.fileType, doc.fileName);
                  return (
                  <Link
                    key={doc.id}
                    to={`/documents/${doc.id}`}
                    className="flex items-center gap-4 p-5 hover:bg-foreground/5 transition-colors group"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-foreground">
                      <DocIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm truncate">{doc.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{doc.department}</span>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      doc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                      doc.status === 'rejected' ? 'bg-rose-500/10 text-rose-500' :
                      'bg-amber-500/10 text-amber-500'
                    }`}>
                      {doc.status}
                    </div>
                  </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Sidebar */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold px-2">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-4">
            <Link
              to="/upload"
              className="clay p-6 shadow-xl flex items-center justify-between group rounded-2xl"
            >
              <div>
                <p className="text-primary-foreground font-bold text-lg">Upload New</p>
                <p className="text-primary-foreground/70 text-xs font-medium">Submit a document</p>
              </div>
              <div className="h-12 w-12 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <FileText className="h-6 w-6" />
              </div>
            </Link>

            <Link
              to="/documents"
              className="glass p-6 border-border/50 shadow-xl flex items-center justify-between group hover:border-primary/40 outline-none rounded-2xl"
            >
              <div>
                <p className="font-bold text-lg">Documents</p>
                <p className="text-muted-foreground text-xs font-medium">Browse all documents</p>
              </div>
              <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </Link>

            <Link
              to="/reports"
              className="glass p-6 border-border/50 shadow-xl flex items-center justify-between group hover:border-primary/40 outline-none rounded-2xl"
            >
              <div>
                <p className="font-bold text-lg">Reports</p>
                <p className="text-muted-foreground text-xs font-medium">Export your data</p>
              </div>
              <div className="h-12 w-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <Activity className="h-6 w-6 text-emerald-500" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}