import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, Search, Filter, Monitor, Globe,
  Activity, Clock, Info, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

const formatLogDetails = (details: any) => {
  if (!details) return 'Activity recorded';
  if (typeof details === 'string') return details;
  if (typeof details === 'object') {
    if (details.message) return details.message;
    if (details.comments) return details.comments;
    if (details.integrityStatus) return `File check: ${details.integrityStatus.toUpperCase()}`;
    if (details.approvalCount !== undefined) return `Approval update: ${details.approvalCount}/${details.requiredApprovals} approvers confirmed`;
    if (details.title) return `Document created: ${details.title} (${details.department})`;
    return JSON.stringify(details);
  }
  return String(details);
};

export function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    loadLogs();
    const interval = setInterval(() => {
      loadLogs(true);
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterLogs();
  }, [searchQuery, actionFilter, logs]);

  const loadLogs = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.getAuditLogs();
      setLogs(data.logs || []);
    } catch (error: any) {
      console.error('Failed to load audit logs:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.userName?.toLowerCase().includes(query) ||
          log.action?.toLowerCase().includes(query) ||
          log.resourceId?.toLowerCase().includes(query) ||
          log.userEmail?.toLowerCase().includes(query)
      );
    }
    if (actionFilter !== 'all') {
      filtered = filtered.filter((log) => log.action === actionFilter);
    }
    setFilteredLogs(filtered);
  };

  const getActionTheme = (action: string) => {
    if (action.includes('CREATED') || action.includes('APPROVED')) return { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    if (action.includes('UPDATED') || action.includes('VIEWED')) return { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
    if (action.includes('DELETED') || action.includes('REJECTED')) return { color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
    if (action.includes('LOGIN')) return { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    return { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-medium text-muted-foreground">Loading activity…</p>
      </div>
    );
  }

  const uniqueActions = [...new Set(logs.map(log => log.action))].sort();

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-12">
      {/* Compact Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay p-5 sm:p-6 text-primary-foreground relative overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Activity log</h1>
              <p className="text-primary-foreground/75 text-sm mt-0.5">A record of everything that happens here</p>
            </div>
          </div>
          <div className="text-center px-1">
            <p className="text-xl font-black tabular-nums leading-none">{logs.length}</p>
            <p className="text-[9px] uppercase tracking-widest opacity-75 mt-1">Events</p>
          </div>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <div className="glass rounded-2xl border-border/30 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-8 relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by person, action, or item…"
              className="w-full pl-10 pr-4 py-2.5 bg-background/50 border border-border/30 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
            />
          </div>
          <div className="lg:col-span-4 relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background/50 border border-border/30 rounded-xl outline-none appearance-none text-sm cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              <option value="all">All actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass rounded-2xl border-border/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-foreground/5 border-b border-border/50">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Person</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Details</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Activity className="h-8 w-8 opacity-50" />
                      <p className="text-sm font-medium">Nothing matches your search</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, i) => {
                  const theme = getActionTheme(log.action);
                  return (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.01 }}
                      key={log.id}
                      className="hover:bg-foreground/5 transition-colors group cursor-default"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full glass flex items-center justify-center font-bold text-primary text-[11px] border-primary/20 flex-shrink-0">
                            {log.userName?.charAt(0) || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{log.userName}</p>
                            <p className="text-xs text-muted-foreground truncate">{log.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${theme.bg} ${theme.color} ${theme.border}`}>
                          {log.action?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs">
                          <p className="text-sm leading-snug line-clamp-2 mb-1">{formatLogDetails(log.details)}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Monitor className="h-2.5 w-2.5" /> {log.resourceType}</span>
                            <span>•</span>
                            <span className="font-mono">{log.resourceId?.substring(0, 8)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 text-muted-foreground">
                          <div className="flex items-center gap-2 text-xs">
                            <Globe className="h-3 w-3 text-primary" />
                            {log.ipAddress || 'Internal'}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Monitor className="h-3 w-3 text-primary" />
                            {log.deviceInfo?.browser || 'System'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                          <Clock className="h-3 w-3" />
                          <span>
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            <br />
                            {new Date(log.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* About this log */}
      <div className="glass rounded-2xl border-border/30 p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold">About this log</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1 max-w-3xl">
                Every entry here is permanent and can't be edited. Admin actions,
                document submissions, and file checks are all saved with an exact
                time and the name of the person who did it.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {[
                { title: 'Accountability', desc: 'Once something is logged, it can\'t be taken back' },
                { title: 'Full history', desc: 'See where every document came from and how it changed' },
                { title: 'Kept safe', desc: 'Entries are protected so they can\'t be quietly altered' }
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-[11px] uppercase tracking-widest text-primary font-bold flex items-center gap-1.5">
                    <CheckCircle className="h-3 w-3" /> {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}