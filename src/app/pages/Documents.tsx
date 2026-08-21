import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { Search, Filter, FileText, ChevronRight, Calendar, Building2, ShieldCheck, Tag, Info, LayoutGrid, List, TrendingUp, Archive } from 'lucide-react';
import { getFileIcon } from '../lib/fileIcons';

export function Documents() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [letterFilter, setLetterFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    let filtered = [...documents];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.title?.toLowerCase().includes(q) || 
        d.description?.toLowerCase().includes(q) ||
        d.id?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') filtered = filtered.filter(d => d.status === statusFilter);
    if (departmentFilter !== 'all') filtered = filtered.filter(d => d.department === departmentFilter);
    if (letterFilter !== 'all') filtered = filtered.filter(d => d.title?.charAt(0).toUpperCase() === letterFilter);
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setFilteredDocs(filtered);
  }, [searchQuery, statusFilter, departmentFilter, letterFilter, documents]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await api.getDocuments();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-black tracking-widest uppercase opacity-40">Loading documents…</p>
      </div>
    );
  }

  const approvedCount = documents.filter(d => d.status === 'approved').length;
  const pendingCount = documents.filter(d => d.status === 'pending_approval' || d.status === 'draft').length;

  return (
    <div className="space-y-4 pb-12">
      {/* Overview */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay p-5 sm:p-6 text-primary-foreground relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0 backdrop-blur-md">
              <Archive className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Documents</h1>
              <p className="text-primary-foreground/75 text-sm mt-0.5">Browse and filter everything in one place.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {[
              { label: 'Total', value: documents.length },
              { label: 'Approved', value: approvedCount },
              { label: 'Pending', value: pendingCount },
            ].map((s) => (
              <div key={s.label} className="text-center px-1 flex-1 sm:flex-none min-w-[56px]">
                <p className="text-xl font-black tabular-nums leading-none">{s.value}</p>
                <p className="text-[9px] uppercase tracking-widest opacity-75 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Search and Filters Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-3 sm:p-4 border-border/30 outline-none"
      >
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, description, or ID…"
              className="w-full pl-10 pr-4 py-2.5 bg-background/50 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
            />
          </div>
          <div className="flex gap-2.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2.5 bg-background/50 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none text-sm font-medium cursor-pointer"
            >
              <option value="all">All status</option>
              <option value="approved">Approved</option>
              <option value="pending_approval">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2.5 bg-background/50 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none text-sm font-medium cursor-pointer"
            >
              <option value="all">All depts</option>
              <option value="administration">Admin</option>
              <option value="finance">Finance</option>
              <option value="engineering">Engineering</option>
            </select>
          </div>
        </div>

        {/* Alphabet filter */}
        <div className="flex flex-wrap items-center justify-center gap-1 mt-3">
          <Filter className="h-3.5 w-3.5 text-primary flex-shrink-0 mr-1" />
          <button
            onClick={() => setLetterFilter('all')}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
              letterFilter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-foreground/5 text-muted-foreground'
            }`}
          >
            All
          </button>
          {alphabet.map((letter) => (
            <button
              key={letter}
              onClick={() => setLetterFilter(letter)}
              className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all flex items-center justify-center ${
                letterFilter === letter ? 'bg-primary text-primary-foreground' : 'hover:bg-foreground/5 text-muted-foreground'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Results Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 glass px-2.5 py-1.5 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl border-border/30 shadow-lg">
            <FileText className="h-3.5 w-3.5 md:h-5 md:w-5 text-primary flex-shrink-0" />
            <span className="text-xs md:text-sm font-black tracking-tight">
              {filteredDocs.length}
            </span>
          </div>
          <div className="flex bg-muted rounded-lg md:rounded-xl p-0.5 md:p-1 border border-border/30 shadow-inner">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 md:p-2 rounded-md md:rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 md:p-2 rounded-md md:rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </button>
          </div>
        </div>
        <Link to="/upload" className="clay px-3 py-1.5 md:px-5 md:py-2.5 text-xs md:text-sm font-black text-primary-foreground rounded-xl md:rounded-2xl shadow-xl hover:brightness-110 hover:scale-105 active:scale-95 transition-all whitespace-nowrap flex items-center gap-1.5 md:gap-2">
          <FileText className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span className="hidden sm:inline">New Upload</span>
        </Link>
      </motion.div>

      {/* Document Grid/List - Optimized for Mobile visibility */}
      <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5" : "space-y-2.5"}>
        <AnimatePresence mode="popLayout">
          {filteredDocs.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-20 text-center glass rounded-3xl border-dashed border-border/30 outline-none"
            >
              <Info className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-bold italic tracking-wide">No documents match your search.</p>
            </motion.div>
          ) : (
            filteredDocs.map((doc, i) => {
              const DocIcon = getFileIcon(doc.fileType, doc.fileName);
              return (
              <motion.div
                layout
                key={doc.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="group relative"
              >
                {viewMode === 'grid' ? (
                  <Link
                    to={`/documents/${doc.id}`}
                    className="block glass rounded-2xl p-4 border-border/30 hover:border-primary/50 transition-all active:scale-[0.98] overflow-hidden outline-none"
                  >
                    {/* Status Badge */}
                    <div className={`absolute top-0 right-0 px-3 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest ${
                      doc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                      doc.status === 'rejected' ? 'bg-rose-500/10 text-rose-500' :
                      'bg-amber-500/10 text-amber-500'
                    }`}>
                      {doc.status}
                    </div>

                    <div className="flex items-start gap-3 mb-3">
                      <div className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                        <DocIcon className="h-6 w-6 text-secondary-foreground" />
                      </div>
                      <div className="min-w-0 pr-8">
                        <h3 className="font-bold text-base tracking-tight truncate leading-tight">{doc.title}</h3>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                          <Building2 className="h-3 w-3" />
                          {doc.department}
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                      {doc.description || 'No description for this document.'}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="px-2 py-0.5 bg-foreground/5 rounded-md text-[9px] font-bold uppercase tracking-tight flex items-center gap-1">
                        <ShieldCheck className="h-2.5 w-2.5 text-primary" />
                        {doc.accessLevel?.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-0.5 bg-foreground/5 rounded-md text-[9px] font-bold uppercase tracking-tight flex items-center gap-1">
                        <Tag className="h-2.5 w-2.5 text-primary" />
                        {doc.versionTag || `v${doc.version || 1}`}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-border/20 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-5 w-5 rounded-full bg-foreground/10 flex items-center justify-center font-black text-[9px] text-primary flex-shrink-0">
                          {doc.authorName?.charAt(0) || 'U'}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground truncate">{doc.authorName}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground flex-shrink-0">
                        <Calendar className="h-3 w-3" />
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <Link
                    to={`/documents/${doc.id}`}
                    className="flex items-center gap-4 glass rounded-xl p-3 border-border/30 hover:border-primary/50 transition-all active:scale-[0.99] group outline-none"
                  >
                    <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <DocIcon className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-black text-base tracking-tight truncate">{doc.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          doc.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                          doc.status === 'rejected' ? 'bg-rose-500/10 text-rose-500' :
                          'bg-amber-500/10 text-amber-500'
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                          <Building2 className="h-2.5 w-2.5" />
                          {doc.department}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                          <Calendar className="h-2.5 w-2.5" />
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-2 pr-4">
                      <span className="px-2 py-1 glass rounded-lg text-[8px] font-black uppercase tracking-tighter flex items-center gap-1.5">
                        <ShieldCheck className="h-2.5 w-2.5 text-primary" />
                        {doc.accessLevel?.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-1 glass rounded-lg text-[8px] font-black uppercase tracking-tighter flex items-center gap-1.5">
                        <Tag className="h-2.5 w-2.5 text-primary" />
                        {doc.versionTag || `v${doc.version || 1}`}
                      </span>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors pr-2" />
                  </Link>
                )}
              </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}