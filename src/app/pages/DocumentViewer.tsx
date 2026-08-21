import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext, Link } from 'react-router';
import { api } from '../lib/api';
import {
  ArrowLeft, ArrowRight, Download, Lock, CheckCircle, XCircle,
  FileText, Calendar, User, Building, Shield, Clock, Activity,
  GitBranch, Users, AlertTriangle, ShieldCheck, ShieldX,
  ShieldAlert, Loader2, ChevronRight, Share2,
  Trash2, Copy, History, Info, BadgeCheck, Fingerprint, Scan,
  RotateCcw, Eye, EyeOff, Database as DatabaseIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { getFileIcon } from '../lib/fileIcons';

const computeFileHash = async (data: string): Promise<string> => {
  try {
    const base64 = data.includes(',') ? data.split(',')[1] : data;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Hash calculation failed:', error);
    return '';
  }
};

const formatFileSize = (bytes: number): string => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard API blocked or failed, using fallback', err);
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '-9999px';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Copy fallback failed:', err);
    document.body.removeChild(textArea);
    return false;
  }
};

const formatLogDetails = (details: any) => {
  if (!details) return 'Activity entry recorded';
  if (typeof details === 'string') return details;
  if (typeof details === 'object') {
    if (details.message) return details.message;
    if (details.comments) return details.comments;
    if (details.integrityStatus) return `File Check: ${details.integrityStatus.toUpperCase()}`;
    if (details.approvalCount !== undefined) return `Approval Update: ${details.approvalCount}/${details.requiredApprovals} approvers confirmed`;
    if (details.title) return `Document created: ${details.title} (${details.department})`;
    return JSON.stringify(details);
  }
  return String(details);
};

export function DocumentViewer() {
  const { id } = useParams();
  const { user, refreshNotifications } = useOutletContext<any>();
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'versions'>('details');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [requiredApprovers, setRequiredApprovers] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [verifyingHash, setVerifyingHash] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadDocument(); }, [id]);

  useEffect(() => {
    if (activeTab === 'activity' && document) loadAuditLogs();
    if (activeTab === 'versions' && document) loadVersions();
  }, [activeTab, document]);

  useEffect(() => { if (document) loadApprovals(); }, [document]);

  // Release the object URL when navigating away or switching documents.
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  // Reset any loaded preview when the document changes.
  useEffect(() => {
    setPreviewUrl(null);
    setShowPreview(false);
  }, [document?.id]);

  // Lazily fetch the file blob only when the user opts to view the preview.
  // This avoids downloading large base64 payloads on every viewer open.
  const handleTogglePreview = async () => {
    if (previewUrl) { setShowPreview(p => !p); return; }
    if (!document || document.status !== 'approved') return;
    setPreviewLoading(true);
    try {
      let fileData: string | null = document.fileData || null;
      let fileType: string = document.fileType || 'application/pdf';

      if (!fileData) {
        const data = await api.downloadDocument(document.id);
        fileData = data.fileData;
        fileType = data.fileType || fileType;
      }

      if (!fileData) { toast.error('Preview unavailable'); return; }

      const raw = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: fileType });
      setPreviewUrl(URL.createObjectURL(blob));
      setShowPreview(true);
    } catch {
      toast.error('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadDocument = async () => {
    try {
      setLoading(true);
      const data = await api.getDocument(id!);
      setDocument(data.document);
    } catch (error: any) {
      toast.error('Access denied or document not found');
      navigate('/documents');
    } finally {
      setLoading(false);
    }
  };

  const loadApprovals = async () => {
    try {
      const data = await api.getDocumentApprovals(id!);
      setApprovals(data.approvals || []);
      setRequiredApprovers(data.requiredApprovers || []);
    } catch {}
  };

  const loadAuditLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await api.getAuditLogs();
      setAuditLogs((data.logs || []).filter((log: any) => log.resourceId === id));
    } catch {} finally { setLogsLoading(false); }
  };

  const loadVersions = async () => {
    try {
      const data = await api.getDocumentVersions(id!);
      setVersions(data.versions || []);
    } catch {}
  };

  const handleVerifyIntegrity = async () => {
    const fileContent = document?.fileData || document?.fileUrl;
    if (!fileContent || !document?.fileHash) {
      toast.error('No file data available for verification');
      return;
    }
    setVerifyingHash(true);
    try {
      const computedHash = await computeFileHash(fileContent);
      const result = await api.verifyDocumentHash(id!, computedHash);
      if (result.verified) toast.success('File integrity verified: OK');
      else toast.error('Integrity check failed: File may have been modified');
      setDocument((prev: any) => ({ ...prev, integrityStatus: result.integrityStatus }));
    } catch { toast.error('Verification error'); }
    finally { setVerifyingHash(false); }
  };

  const handleDownload = async () => {
    if (document.status !== 'approved' && user?.role !== 'super_admin' && user?.role !== 'lgu_head') {
      toast.error('Document must be fully approved before downloading');
      return;
    }
    try {
      const data = await api.downloadDocument(id!);
      const base64Data = data.fileData.includes(',') ? data.fileData.split(',')[1] : data.fileData;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.fileType });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = data.fileName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      toast.success('Document downloaded successfully');
    } catch { toast.error('Download failed'); }
  };

  const simulateBiometrics = async () => {
    setBiometricLoading(true);
    return new Promise(resolve => setTimeout(resolve, 2500));
  };

  const handleApprove = async () => {
    setActionLoading(true);
    await simulateBiometrics();
    try {
      await api.approveDocument(id!, comments);
      toast.success('Document approved');
      setShowApprovalDialog(false);
      setComments('');
      loadDocument();
      loadApprovals();
      refreshNotifications();
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    } finally {
      setActionLoading(false);
      setBiometricLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setActionLoading(true);
    await simulateBiometrics();
    try {
      await api.rejectDocument(id!, rejectionReason);
      toast.error('Document rejected');
      setShowRejectDialog(false);
      setRejectionReason('');
      loadDocument();
      refreshNotifications();
    } catch (error: any) {
      toast.error(error.message || 'Action failed');
    } finally {
      setActionLoading(false);
      setBiometricLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm('Submit this document for approval? Once submitted, you cannot edit it.')) {
      return;
    }
    setActionLoading(true);
    try {
      await api.submitDocument(id!);
      toast.success('Document submitted for approval');
      loadDocument();
      refreshNotifications();
    } catch (error: any) {
      toast.error(error.message || 'Submit failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-sm font-bold tracking-wide text-muted-foreground">Loading document...</p>
    </div>
  );

  const isSameDept = user?.department === document.department;

  // A user is a target approver if they're on the pending required-approver list.
  // When no explicit approver list exists (legacy docs), fall back to role-based gating below.
  const isTargetApprover = requiredApprovers.length > 0
    ? requiredApprovers.some(ra => String(ra.id) === String(user?.id) && ra.status === 'pending')
    : true;

  const hasAlreadyApproved = approvals.some(a => String(a.approverId) === String(user?.id));

  const canApprove = document.status === 'pending_approval' &&
    !hasAlreadyApproved &&
    isTargetApprover &&
    (user?.role === 'super_admin' || user?.role === 'lgu_head' || (user?.role === 'dept_admin' && isSameDept));

  const isApproved = document.status === 'approved';

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-24 relative">
      {/* Biometric Verification Overlay */}
      <AnimatePresence>
        {biometricLoading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-background/90 backdrop-blur-2xl flex flex-col items-center justify-center gap-8"
          >
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="h-40 w-40 glass rounded-full flex items-center justify-center border-primary/40 shadow-[0_0_50px_rgba(255,184,0,0.2)]"
              >
                <Fingerprint className="h-20 w-20 text-primary" />
              </motion.div>
              <motion.div
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="absolute left-0 right-0 h-1 bg-primary/60 shadow-[0_0_15px_rgba(255,184,0,0.8)] z-10"
              />
            </div>
            <div className="text-center space-y-1.5">
              <h4 className="text-xl font-bold tracking-tight">Verifying your identity</h4>
              <p className="text-sm text-muted-foreground">Please wait a moment...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay p-5 sm:p-6 text-primary-foreground relative overflow-hidden"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/documents')}
            className="h-9 w-9 bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-xl flex items-center justify-center flex-shrink-0 transition-all group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md flex-shrink-0">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight leading-tight break-words [overflow-wrap:anywhere] min-w-0">{document.title}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border self-center flex-shrink-0 ${
                document.status === 'approved' ? 'bg-emerald-500/15 text-emerald-100 border-emerald-300/30' :
                document.status === 'rejected' ? 'bg-rose-500/15 text-rose-100 border-rose-300/30' :
                'bg-amber-500/15 text-amber-100 border-amber-300/30'
              }`}>
                {document.status?.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-primary-foreground/75 text-xs sm:text-sm">
              <span className="flex items-center gap-1.5"><Building className="h-3.5 w-3.5 flex-shrink-0" />{document.department}</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 flex-shrink-0" />{new Date(document.createdAt).toLocaleDateString()}</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 flex-shrink-0" />{document.versionTag || `v${document.version}`}</span>
            </div>
            {/* Actions — wrap to their own row on mobile, inline on desktop */}
            <div className="flex sm:hidden items-center gap-2 mt-3">
              <button onClick={async () => {
                const success = await copyToClipboard(window.location.href);
                if (success) toast.success('Link copied');
                else toast.error('Failed to copy');
              }} className="h-9 w-9 bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-xl flex items-center justify-center transition-all">
                <Share2 className="h-4 w-4" />
              </button>
              <button onClick={handleDownload} className="flex-1 bg-white/15 hover:bg-white/25 backdrop-blur-md px-3.5 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all">
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <button onClick={async () => {
              const success = await copyToClipboard(window.location.href);
              if (success) toast.success('Link copied');
              else toast.error('Failed to copy');
            }} className="h-9 w-9 bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-xl flex items-center justify-center transition-all">
              <Share2 className="h-4 w-4" />
            </button>
            <button onClick={handleDownload} className="bg-white/15 hover:bg-white/25 backdrop-blur-md px-3.5 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all">
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Section */}
        <div className="lg:col-span-8 space-y-4">

          {/* Document Preview */}
          <div className="glass rounded-2xl border-border/30 overflow-hidden outline-none">
            {/* Preview Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                  {(() => { const DocIcon = getFileIcon(document.fileType, document.fileName); return <DocIcon className="h-5 w-5 text-secondary-foreground" />; })()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{document.fileName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{document.fileType} • {formatFileSize(document.fileSize)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isApproved ? (
                  <>
                    <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[11px] font-bold">
                      <CheckCircle className="h-3 w-3" /> Approved
                    </span>
                    <button
                      onClick={handleTogglePreview}
                      disabled={previewLoading}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all disabled:opacity-50 ${showPreview ? 'bg-primary text-primary-foreground' : 'glass hover:bg-foreground/5 border-primary/20'}`}
                    >
                      {previewLoading
                        ? <span className="h-3.5 w-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        : showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {previewLoading ? 'Loading' : showPreview ? 'Hide' : 'Show'}
                    </button>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-foreground/5 text-muted-foreground border border-border rounded-full text-[11px] font-bold">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                )}
              </div>
            </div>

            {/* Preview Body */}
            {isApproved && showPreview && previewUrl ? (
              <div className="relative bg-black/30" style={{ height: '600px' }}>
                <div className="absolute inset-0 pointer-events-none select-none z-10 flex items-center justify-center overflow-hidden opacity-[0.025]">
                  <div className="text-[80px] font-black whitespace-nowrap rotate-[-35deg] uppercase tracking-[0.5em]">
                    OFFICIAL COPY • LGU
                  </div>
                </div>
                {document.fileType?.includes('image') ? (
                  <img src={previewUrl} alt={document.fileName} className="w-full h-full object-contain" />
                ) : (
                  <iframe
                    src={previewUrl}
                    title={document.fileName}
                    className="w-full h-full border-0"
                    style={{ backgroundColor: 'transparent' }}
                  />
                )}
              </div>
            ) : !isApproved ? (
              /* Locked — not yet approved */
              <div className="bg-black/20 min-h-[240px] relative flex flex-col items-center justify-center gap-4 px-6 py-10">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="h-14 w-14 glass rounded-2xl flex items-center justify-center border border-border">
                    <Lock className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">Preview not available yet</p>
                    <p className="text-[13px] text-muted-foreground max-w-xs leading-relaxed">
                      You can view this once all required approvers have approved it.
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full border text-[11px] font-bold ${
                    document.status === 'rejected'
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  }`}>
                    {document.status === 'rejected' ? 'Rejected' : 'Waiting for approval'}
                  </div>
                </div>
              </div>
            ) : (
              /* Approved but preview toggled off — show summary info */
              <div className="bg-foreground/5 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 glass bg-black/20 rounded-xl border border-border/30 col-span-2">
                    <p className="text-[11px] font-bold text-muted-foreground mb-1.5">Fingerprint (SHA-256)</p>
                    <p className="font-mono text-[11px] break-all bg-black/20 p-2.5 rounded-lg text-muted-foreground">{document.fileHash}</p>
                  </div>
                  <div className="p-3 glass bg-black/20 rounded-xl border border-border/30">
                    <p className="text-[11px] font-bold text-muted-foreground mb-1">Uploaded by</p>
                    <p className="text-sm font-bold">{document.authorName}</p>
                  </div>
                  <div className="p-3 glass bg-black/20 rounded-xl border border-border/30">
                    <p className="text-[11px] font-bold text-muted-foreground mb-1">Access level</p>
                    <p className="text-sm font-bold">{document.accessLevel}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="glass p-1 rounded-xl flex gap-1 border-border/30">
            {[
              { id: 'details', label: 'Details', icon: Info },
              { id: 'activity', label: 'Activity', icon: Activity },
              { id: 'versions', label: 'Versions', icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'hover:bg-foreground/5 text-muted-foreground'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'details' && (
              <motion.div
                key="details" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* File Integrity */}
                <div className="glass rounded-2xl p-4 border-border/30 outline-none">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                      <Fingerprint className="h-3.5 w-3.5" />
                      File fingerprint
                    </h2>
                    <button onClick={handleVerifyIntegrity} disabled={verifyingHash} className="glass px-3 py-1.5 rounded-xl text-sm font-bold hover:bg-foreground/5 transition-all flex items-center gap-1.5 border-primary/20 disabled:opacity-50">
                      {verifyingHash ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 text-primary" />}
                      Verify
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground mb-1.5">Fingerprint (SHA-256)</p>
                      <p className="font-mono text-[11px] break-all bg-black/20 p-2.5 rounded-lg text-muted-foreground leading-relaxed">{document.fileHash || '—'}</p>
                    </div>

                    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      document.integrityStatus === 'verified'
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'
                        : 'bg-rose-500/5 border-rose-500/20 text-rose-500'
                    }`}>
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${document.integrityStatus === 'verified' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                        {document.integrityStatus === 'verified' ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold">
                          {document.integrityStatus === 'verified' ? 'File is intact' : 'File mismatch detected'}
                        </p>
                        <p className="text-[13px] opacity-70 leading-relaxed">
                          {document.integrityStatus === 'verified'
                            ? 'The fingerprint matches. No changes detected.'
                            : 'The fingerprint does not match. This file may have been changed.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'activity' && (
              <motion.div
                key="activity" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="glass rounded-2xl p-4 border-border/30 outline-none"
              >
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 mb-3">
                  <Activity className="h-3.5 w-3.5" />
                  Activity
                </h2>

                <div className="space-y-2 relative">
                  <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

                  {logsLoading ? (
                    <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary opacity-40" /></div>
                  ) : auditLogs.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm font-bold">No activity yet.</div>
                  ) : (
                    auditLogs.map((log, i) => (
                      <div key={i} className="flex gap-3 group relative z-10">
                        <div className="h-9 w-9 glass rounded-xl flex items-center justify-center flex-shrink-0 bg-background border-primary/10">
                          <Scan className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 glass bg-foreground/5 px-3 py-2.5 rounded-xl border border-border/50 group-hover:border-primary/20 transition-all">
                          <div className="flex justify-between items-center gap-2 mb-1">
                            <p className="text-sm font-bold">{log.action?.replace(/_/g, ' ')}</p>
                            <span className="text-[11px] text-muted-foreground flex-shrink-0">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="h-5 w-5 rounded-full clay flex items-center justify-center font-bold text-[9px] text-primary-foreground">
                              {log.userName?.charAt(0)}
                            </div>
                            <p className="text-[11px] font-bold text-primary">{log.userName}</p>
                          </div>
                          <p className="text-[13px] text-muted-foreground leading-relaxed border-l border-primary/20 pl-2">{formatLogDetails(log.details)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'versions' && (
              <motion.div
                key="versions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="glass rounded-2xl p-4 border-border/30 space-y-2 outline-none"
              >
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 mb-1">
                  <History className="h-3.5 w-3.5" /> Version history
                </h2>
                {versions.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <History className="h-7 w-7 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-bold">No previous versions</p>
                  </div>
                ) : (
                  versions.map((v, i) => (
                    <Link
                      key={v.id} to={`/documents/${v.id}`}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all group hover:border-primary/40 ${v.id === id ? 'border-primary/30 bg-primary/5' : 'border-border/50 glass bg-foreground/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${v.id === id ? 'clay text-primary-foreground' : 'glass bg-foreground/5 text-primary border-primary/20'}`}>
                          <GitBranch className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm">{v.versionTag || `v${v.version}`}</p>
                            {v.id === id && <span className="text-[11px] font-bold text-primary">(current)</span>}
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                              v.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              {v.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-primary" /> {new Date(v.createdAt).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><User className="h-3 w-3 text-primary" /> {v.authorName}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-30 group-hover:opacity-80 group-hover:translate-x-1 transition-all text-primary" />
                    </Link>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Section: Approval Actions */}
        <div className="lg:col-span-4 space-y-4">

          {/* Submit for Approval - Draft Documents */}
          {document.status === 'draft' && user?.id === document.authorId && (
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass p-4 rounded-2xl border-amber-500/30 bg-amber-500/[0.03] outline-none"
            >
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold">Draft document</h3>
                  <p className="text-[13px] text-amber-500">Ready to submit for approval</p>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={actionLoading}
                  className="w-full clay py-2.5 text-primary-foreground text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Submit for approval
                </button>

                <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                  Once submitted, you can't edit it and it enters the approval flow.
                </p>
              </div>
            </motion.div>
          )}

          {/* Approve / Reject Actions */}
          {canApprove && (
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass p-4 rounded-2xl border-primary/30 bg-primary/[0.03]"
            >
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold">Your approval is needed</h3>
                  <p className="text-[13px] text-primary">Review and respond to this document</p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => setShowApprovalDialog(true)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => setShowRejectDialog(true)}
                    className="w-full py-2.5 rounded-xl glass border-rose-500/20 text-rose-500 hover:bg-rose-500/10 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <ShieldX className="h-4 w-4" />
                    Reject
                  </button>
                </div>

                <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                  Your response is recorded and tied to your account.
                </p>
              </div>
            </motion.div>
          )}

          {/* Document Information */}
          <div className="glass rounded-2xl p-4 border-border/30 outline-none">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 mb-3">
              <Info className="h-3.5 w-3.5" />
              Details
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">Description</label>
                <p className="text-sm leading-relaxed text-foreground">{document.description || 'No description provided.'}</p>
              </div>

              {document.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {document.tags.map((tag: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 glass bg-primary/5 text-primary text-[11px] font-bold rounded-lg border border-primary/10">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="glass bg-foreground/5 p-3 rounded-xl border border-border/50 space-y-1.5">
                {[
                  { l: 'Department', v: document.department || '—' },
                  { l: 'Uploaded by', v: document.authorName || '—' },
                  { l: 'File size', v: formatFileSize(document.fileSize) },
                  { l: 'Access level', v: document.accessLevel || '—' },
                  { l: 'Created', v: document.createdAt ? new Date(document.createdAt).toLocaleString() : '—' },
                  { l: 'Last updated', v: document.updatedAt ? new Date(document.updatedAt).toLocaleString() : '—' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-0">
                    <span className="text-[11px] font-bold text-muted-foreground flex-shrink-0">{item.l}</span>
                    <span className="text-sm font-medium text-right">{item.v}</span>
                  </div>
                ))}

                {/* Clearance Level Display */}
                <div className="flex items-center justify-between py-1.5 pt-2.5 border-t border-primary/20">
                  <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3 text-primary" />
                    Who can see this
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    (document.requiredClearanceLevel || 0) === 0 ? 'bg-emerald-500/10 text-emerald-500' :
                    (document.requiredClearanceLevel || 0) === 1 ? 'bg-blue-500/10 text-blue-500' :
                    (document.requiredClearanceLevel || 0) === 2 ? 'bg-amber-500/10 text-amber-500' :
                    (document.requiredClearanceLevel || 0) === 3 ? 'bg-purple-500/10 text-purple-500' :
                    'bg-rose-500/10 text-rose-500'
                  }`}>
                    Level {document.requiredClearanceLevel || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Approval Chain */}
          <div className="glass rounded-2xl p-4 border-border/30 space-y-3 outline-none">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Approvers
            </h2>

            <div className="space-y-2">
              {requiredApprovers.length > 0 ? (
                requiredApprovers.map((a, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${
                    a.status === 'approved' ? 'border-emerald-500/20 bg-emerald-500/[0.03]' :
                    a.status === 'rejected' ? 'border-rose-500/20 bg-rose-500/[0.03]' :
                    'border-border/50 bg-foreground/5'
                  }`}>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                      a.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                      a.status === 'rejected' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                      'bg-foreground/5 border-border text-muted-foreground'
                    }`}>
                      {a.status === 'approved' ? <CheckCircle className="h-4 w-4" /> :
                       a.status === 'rejected' ? <XCircle className="h-4 w-4" /> :
                       <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{a.name || '—'}</p>
                      <p className="text-[11px] text-muted-foreground">{a.role?.replace(/_/g, ' ') || '—'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        a.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                        a.status === 'rejected' ? 'bg-rose-500/10 text-rose-500' :
                        'bg-amber-500/10 text-amber-500'
                      }`}>
                        {a.status || 'pending'}
                      </span>
                      {a.actedAt && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.actedAt).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-muted-foreground">
                  <p className="text-sm font-bold">No approvers assigned</p>
                </div>
              )}
            </div>

            {document.status === 'pending_approval' && (
              <div className="px-3 py-2 bg-amber-500/5 rounded-xl border border-amber-500/20 flex gap-2 items-start">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-amber-500/90 leading-relaxed">
                  Waiting for all approvers to respond.
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <button onClick={async () => {
              const success = await copyToClipboard(document.fileHash || '');
              if (success) toast.success('File hash copied');
              else toast.error('Failed to copy hash');
            }} className="w-full glass px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between group hover:border-primary/40 transition-all">
              <span className="flex items-center gap-2"><Copy className="h-4 w-4 text-primary" /> Copy fingerprint</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-primary" />
            </button>
            {user?.id === document.authorId && document.status === 'draft' && (
              <button className="w-full glass px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between group hover:border-rose-500/40 transition-all text-rose-500 border-rose-500/10">
                <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Delete document</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Approval Dialog */}
      <AnimatePresence>
        {showApprovalDialog && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowApprovalDialog(false)}
              className="fixed inset-0 bg-background/95 backdrop-blur-3xl"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="glass max-w-md w-full p-5 sm:p-6 rounded-2xl shadow-xl z-[160] border-border relative overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Approve document</h3>
                  <p className="text-sm text-muted-foreground">This will be recorded to your account</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground">Comments (optional)</label>
                  <textarea
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                    placeholder="Add a note for the activity log..."
                    className="w-full h-32 glass bg-black/20 p-3 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 border-border text-sm resize-none placeholder:opacity-40"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex-[2] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Confirm approval
                  </button>
                  <button
                    onClick={() => setShowApprovalDialog(false)}
                    className="flex-1 py-3 glass text-sm font-bold rounded-xl hover:bg-foreground/5 transition-all border-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showRejectDialog && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowRejectDialog(false)}
              className="fixed inset-0 bg-background/95 backdrop-blur-3xl"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="glass max-w-md w-full p-5 sm:p-6 rounded-2xl shadow-xl z-[160] border-rose-500/20 relative overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 bg-rose-500/15 rounded-2xl flex items-center justify-center text-rose-500">
                  <ShieldX className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-rose-500">Reject document</h3>
                  <p className="text-sm text-rose-500/70">This can't be undone</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-rose-500">Reason for rejection (required)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    placeholder="Explain why you're rejecting this document..."
                    className="w-full h-32 glass bg-black/20 p-3 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/40 border-rose-500/10 text-sm resize-none placeholder:opacity-40"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleReject}
                    disabled={actionLoading || !rejectionReason.trim()}
                    className="flex-[2] bg-rose-600 hover:bg-rose-700 text-white py-3 text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Confirm rejection
                  </button>
                  <button
                    onClick={() => setShowRejectDialog(false)}
                    className="flex-1 py-3 glass text-sm font-bold rounded-xl hover:bg-foreground/5 transition-all border-border"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
