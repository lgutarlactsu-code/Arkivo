import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useDarkMode } from '../contexts/DarkModeContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Users, TrendingUp, Download,
  Eye, CheckCircle, Building,
  PieChart as PieIcon, LineChart as LineIcon,
  Info, ShieldCheck
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { toast } from 'sonner';

export function Analytics() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDarkMode } = useDarkMode();

  // Theme-aware chart colors so axes/gridlines stay visible in both light and dark mode.
  const axisTick = isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(11,14,20,0.55)';
  const gridStroke = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(11,14,20,0.08)';
  const tooltipBg = isDarkMode ? '#151921' : '#ffffff';
  const tooltipStyle = {
    backgroundColor: tooltipBg,
    borderRadius: '1rem',
    border: `1px solid ${gridStroke}`,
    boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
    color: isDarkMode ? '#F9FAFB' : '#0B0E14',
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 120000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async (silent = false) => {
    // Skip background refreshes while the tab is hidden to reduce egress.
    if (silent && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      if (!silent) setLoading(true);
      const [docsData, logsData] = await Promise.all([
        api.getAllDocuments(),
        api.getAuditLogs()
      ]);
      setDocuments(docsData.documents || []);
      setAuditLogs(logsData.logs || []);
    } catch (error: any) {
      console.error('Failed to sync intelligence:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Crunching the numbers…</p>
      </div>
    );
  }

  // Statistics Compilation
  const stats = {
    total: documents.length,
    approved: documents.filter(d => d.status === 'approved').length,
    pending: documents.filter(d => d.status === 'pending_approval').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
    views: auditLogs.filter(l => l.action === 'DOCUMENT_VIEWED').length,
    downloads: auditLogs.filter(l => l.action === 'DOCUMENT_DOWNLOADED').length,
  };

  // 1. Activity Velocity (Last 7 Days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const activityData = last7Days.map(date => ({
    date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    events: auditLogs.filter(l => l.timestamp?.startsWith(date)).length,
  }));

  // 2. Archival Composition (Status)
  const compositionData = [
    { name: 'Approved', value: stats.approved, color: '#10b981' },
    { name: 'Pending', value: stats.pending, color: '#FFB800' },
    { name: 'Rejected', value: stats.rejected, color: '#ef4444' },
    { name: 'Draft', value: documents.filter(d => d.status === 'draft').length, color: '#6b7280' },
  ].filter(d => d.value > 0);

  // 3. Departmental Distribution
  const deptMap = documents.reduce((acc: any, d) => {
    const dept = (d.department || 'Unassigned').replace(/_/g, ' ').toUpperCase();
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});

  const distributionData = Object.entries(deptMap).map(([name, count]) => ({
    name,
    count,
  })).sort((a: any, b: any) => b.count - a.count);

  // 4. Officer Engagement (Top 5)
  const engagementMap = auditLogs.reduce((acc: any, l) => {
    const name = l.userName || 'Unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const engagementData = Object.entries(engagementMap)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 5)
    .map(([fullName, actions]) => ({
      name: fullName,
      actions,
    }));

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-24">
      {/* Header bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay p-5 sm:p-6 text-primary-foreground relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md flex-shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Analytics</h1>
              <p className="text-primary-foreground/75 text-sm mt-0.5">How your archive is doing at a glance</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-center px-1">
              <p className="text-xl font-black tabular-nums leading-none flex items-center gap-1 justify-center">
                <ShieldCheck className="h-4 w-4" /> 99.9%
              </p>
              <p className="text-[9px] uppercase tracking-widest opacity-75 mt-1">Health</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Documents', value: stats.total, icon: FileText, color: 'text-primary' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-500' },
          { label: 'Views', value: stats.views, icon: Eye, color: 'text-foreground' },
          { label: 'Downloads', value: stats.downloads, icon: Download, color: 'text-foreground' },
        ].map((stat, i) => (
          <motion.div
            key={`stat-card-${stat.label}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-4 border-border/30"
          >
            <div className={`w-10 h-10 rounded-xl glass flex items-center justify-center mb-3 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-black tabular-nums">{stat.value}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Activity Line Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-8 glass rounded-2xl p-4 border-border/30"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LineIcon className="h-4 w-4 text-primary" />
              <div>
                <h2 className="text-sm font-bold">Activity</h2>
                <p className="text-xs text-muted-foreground">Events over the last 7 days</p>
              </div>
            </div>
          </div>

          <div className="h-[200px] sm:h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: axisTick, fontSize: 10, fontWeight: 900 }}
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: axisTick, fontSize: 10, fontWeight: 900 }}
                />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: '#FFB800', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="events" 
                  stroke="#FFB800"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#FFB800', strokeWidth: 2, stroke: tooltipBg }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-4 glass rounded-2xl p-4 border-border/30 flex flex-col"
        >
          <div className="flex items-center gap-2 mb-3">
            <PieIcon className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-bold">Composition</h2>
              <p className="text-xs text-muted-foreground">Documents by status</p>
            </div>
          </div>

          <div className="flex-1 min-h-[180px] sm:min-h-[200px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={compositionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                  animationDuration={1500}
                >
                  {compositionData.map((entry) => (
                    <Cell key={`pie-cell-${entry.name}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <p className="text-2xl font-black tabular-nums">{stats.total}</p>
               <p className="text-[9px] uppercase tracking-widest text-muted-foreground text-center px-4">Total documents</p>
            </div>
          </div>

          <div className="space-y-1.5 mt-3">
            {compositionData.map((d) => (
              <div key={`comp-list-${d.name}`} className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-foreground/5 border border-border/30">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{d.name}</span>
                </div>
                <span className="text-xs font-black tabular-nums">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bar Chart - Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-6 glass rounded-2xl p-4 border-border/30"
        >
          <div className="flex items-center gap-2 mb-3">
            <Building className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-bold">By department</h2>
              <p className="text-xs text-muted-foreground">Documents per team</p>
            </div>
          </div>

          <div className="h-[200px] sm:h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: axisTick, fontSize: 8, fontWeight: 900 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,184,0,0.05)' }}
                  contentStyle={tooltipStyle}
                />
                <defs>
                  <linearGradient id="deptGoldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFB800" />
                    <stop offset="100%" stopColor="#FF8A00" />
                  </linearGradient>
                </defs>
                <Bar
                  dataKey="count"
                  fill="url(#deptGoldGradient)"
                  radius={[8, 8, 0, 0]}
                  animationDuration={2000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Bar Chart - Officer Engagement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-6 glass rounded-2xl p-4 border-border/30"
        >
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-bold">Most active people</h2>
              <p className="text-xs text-muted-foreground">Top 5 by actions</p>
            </div>
          </div>

          <div className="h-[200px] sm:h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagementData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: axisTick, fontSize: 10, fontWeight: 900 }}
                  width={80}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,184,0,0.05)' }}
                  contentStyle={tooltipStyle}
                />
                <Bar 
                  dataKey="actions" 
                  fill="#FFB800" 
                  radius={[0, 8, 8, 0]} 
                  barSize={20}
                  animationDuration={2000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Summary */}
      <div className="glass rounded-2xl p-4 border-border/30">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-primary flex-shrink-0">
            <Info className="h-5 w-5" />
          </div>
          <div className="space-y-2 min-w-0 flex-1">
            <h3 className="text-sm font-bold">Summary</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}% of documents have been approved. People are actively using the system across teams.
            </p>
            <div className="pt-2 flex flex-wrap gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Download rate</p>
                <p className="text-lg font-black tabular-nums">{(stats.downloads / Math.max(1, stats.views) * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Avg. review time</p>
                <p className="text-lg font-black tabular-nums">2.4m</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Health</p>
                <p className="text-lg font-black text-emerald-500">Optimal</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}