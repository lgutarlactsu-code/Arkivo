import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { api } from '../lib/api';
import {
  Upload, FileText, ArrowLeft, Shield, Hash, GitBranch,
  CheckCircle, AlertTriangle, Info, Users, Loader2, Search,
  UserCheck, X, ChevronDown, Plus, Trash2, Copy, Check
} from 'lucide-react';
import { toast } from 'sonner';

const computeFileHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// The file-type <select> only offers these MIME types, so we map by extension
// as a fallback when the browser doesn't report a usable `File.type`.
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  txt: 'text/plain',
};
const SUPPORTED_MIMES = new Set(Object.values(EXT_TO_MIME));

// Best-effort detection: trust the browser's MIME when it's one we support,
// otherwise fall back to the file extension.
const detectFileType = (f: File): string => {
  if (f.type && SUPPORTED_MIMES.has(f.type)) return f.type;
  const ext = f.name.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_MIME[ext] || f.type || 'application/pdf';
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  lgu_head: 'LGU Head',
  dept_admin: 'Dept Admin',
  records_officer: 'Records Officer',
};

const ROLE_ORDER: Record<string, number> = {
  super_admin: 0, lgu_head: 1, dept_admin: 2, records_officer: 3,
};

const ROLE_CLEARANCE: Record<string, number> = {
  super_admin: 4,
  lgu_head: 3,
  dept_admin: 2,
  records_officer: 1,
  staff: 0,
};

export function UploadDocument() {
  const { user, refreshNotifications } = useOutletContext<any>();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    department: user?.department || '',
    accessLevel: 'restricted',
    fileType: 'application/pdf',
    requiredClearanceLevel: 0,
  });
  const [file, setFile] = useState<File | null>(null);
  const [titleEdited, setTitleEdited] = useState(false);
  const [fileHash, setFileHash] = useState<string>('');
  const [hashLoading, setHashLoading] = useState(false);
  const [existingVersions, setExistingVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [allApprovers, setAllApprovers] = useState<any[]>([]);
  const [approversLoading, setApproversLoading] = useState(false);
  const [selectedApprovers, setSelectedApprovers] = useState<any[]>([]);
  const [approverSearch, setApproverSearch] = useState('');
  const [showApproverPicker, setShowApproverPicker] = useState(false);
  const [hashCopied, setHashCopied] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    setApproversLoading(true);
    api.getApprovers()
      .then((data: any) => setAllApprovers(data.approvers || []))
      .catch(() => {})
      .finally(() => setApproversLoading(false));
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFileHash('');
    setExistingVersions([]);
    setHashLoading(true);

    // Auto-detect the file type, and auto-fill the title from the file name
    // (unless the user has already typed their own title).
    const detectedType = detectFileType(selectedFile);
    const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '');
    setFormData(prev => ({
      ...prev,
      fileType: detectedType,
      title: titleEdited && prev.title.trim() ? prev.title : nameWithoutExt,
    }));

    try {
      const hash = await computeFileHash(selectedFile);
      setFileHash(hash);
    } catch {
      toast.error('Could not compute file hash');
    } finally {
      setHashLoading(false);
    }
  };

  useEffect(() => {
    if (!file) return;
    api.getDocuments()
      .then((docs: any) => {
        const matches = (docs.documents || []).filter(
          (d: any) => d.baseFileName === file.name || d.fileName === file.name
        );
        setExistingVersions(matches);
      })
      .catch(() => {});
  }, [file]);

  const copyHash = async () => {
    if (!fileHash) return;
    try {
      await navigator.clipboard.writeText(fileHash);
      setHashCopied(true);
      setTimeout(() => setHashCopied(false), 2000);
      toast.success('Hash copied to clipboard');
    } catch {
      toast.error('Failed to copy hash');
    }
  };

  const toggleApprover = (approver: any) => {
    setSelectedApprovers(prev =>
      prev.find(a => a.id === approver.id)
        ? prev.filter(a => a.id !== approver.id)
        : [...prev, approver]
    );
  };

  // Filter approvers: only show users with clearance >= required clearance
  const filteredApprovers = allApprovers
    .filter(a => {
      // Check clearance level first
      const approverClearance = ROLE_CLEARANCE[a.role] ?? 0;
      if (approverClearance < formData.requiredClearanceLevel) return false;

      // Then apply search filter
      const q = approverSearch.toLowerCase();
      return a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.department?.toLowerCase().includes(q);
    })
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));

  // Auto-remove selected approvers when clearance level changes if they no longer qualify
  useEffect(() => {
    setSelectedApprovers(prev =>
      prev.filter(a => (ROLE_CLEARANCE[a.role] ?? 0) >= formData.requiredClearanceLevel)
    );
  }, [formData.requiredClearanceLevel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || selectedApprovers.length === 0) {
      toast.error('Missing required fields');
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const fileData = event.target?.result as string;
      const document = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        fileName: file.name,
        fileType: formData.fileType || file.type,
        fileSize: file.size,
        fileData,
        clientFileHash: fileHash,
        requiredApprovals: selectedApprovers.length,
        requiredApproverIds: selectedApprovers.map(a => a.id),
      };

      try {
        const result = await api.uploadDocument(document);
        toast.success('Document uploaded successfully');
        navigate(`/documents/${result.document.id}`);
        refreshNotifications();
      } catch (error: any) {
        toast.error(error.message || 'Upload failed');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const inputCls = "w-full px-4 py-2.5 bg-background/50 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium";
  const labelCls = "text-[11px] font-bold text-muted-foreground ml-0.5 mb-1.5 block";

  return (
    <div className="max-w-3xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/documents')}
          className="h-9 w-9 glass rounded-xl flex items-center justify-center hover:bg-foreground/5 transition-all group"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Upload a document</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Add a file, choose who can see it, and pick who signs off.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* File picker */}
        <div className="glass rounded-2xl p-4 border-border/30">
          <div className="relative group">
            <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" id="file-upload" />
            <div className={`border-2 border-dashed rounded-xl px-4 py-5 flex items-center gap-4 transition-all ${file ? 'border-primary/50 bg-primary/5' : 'border-border/40 hover:border-primary/30'}`}>
              <div className={`h-11 w-11 rounded-xl clay flex items-center justify-center flex-shrink-0 ${file ? 'brightness-110' : ''}`}>
                <Upload className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{file ? file.name : 'Choose a file or drag it here'}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {file ? formatFileSize(file.size) : 'Up to 10MB — PDF, Word, Excel, or images'}
                </p>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {file && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 space-y-3 overflow-hidden"
              >
                <div className="bg-foreground/5 rounded-xl p-3 border border-border/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[11px] font-bold">Fingerprint (SHA-256)</span>
                      {hashLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    </div>
                    {fileHash && (
                      <button
                        type="button"
                        onClick={copyHash}
                        className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg flex items-center gap-1.5 transition-all"
                      >
                        {hashCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span className="text-[10px] font-bold">{hashCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                  <p className="font-mono text-[11px] break-all leading-relaxed bg-black/20 p-2.5 rounded-lg border border-primary/10 text-foreground/80 select-all">
                    {fileHash || 'Working it out…'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1.5">This lets anyone confirm the file wasn't changed after upload.</p>
                </div>

                {existingVersions.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                    <GitBranch className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 leading-relaxed">
                      Looks like an update — we'll save this as <strong>v{existingVersions.length + 1}</strong>.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Details */}
        <div className="glass rounded-2xl p-4 border-border/30 space-y-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Details
          </h2>

          <div>
            <label className={labelCls}>Title</label>
            <input
              type="text" value={formData.title} required
              onChange={(e) => {
                setTitleEdited(true);
                setFormData({ ...formData, title: e.target.value });
              }}
              className={inputCls}
              placeholder="e.g. FY26 Budget Allocations"
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={formData.description} rows={3}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={`${inputCls} resize-none`}
              placeholder="A short note so approvers know what this is…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>File type</label>
              <div className="relative">
                <select
                  value={formData.fileType} required
                  onChange={(e) => setFormData({ ...formData, fileType: e.target.value })}
                  className={`${inputCls} appearance-none cursor-pointer pr-9`}
                >
                  <option value="application/pdf">PDF Document</option>
                  <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">Word Document (.docx)</option>
                  <option value="application/msword">Word Document (.doc)</option>
                  <option value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">Excel Spreadsheet (.xlsx)</option>
                  <option value="application/vnd.ms-excel">Excel Spreadsheet (.xls)</option>
                  <option value="image/jpeg">JPEG Image</option>
                  <option value="image/png">PNG Image</option>
                  <option value="text/plain">Text File</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={labelCls}>Tags</label>
              <input
                type="text" value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className={inputCls}
                placeholder="budget, final, 2026"
              />
            </div>
          </div>

          <div>
            <label className={`${labelCls} flex items-center gap-1.5`}>
              <Shield className="h-3 w-3 text-primary" /> Who can see this?
            </label>
            <div className="relative">
              <select
                value={`${formData.accessLevel}-${formData.requiredClearanceLevel}`}
                onChange={(e) => {
                  const [accessLevel, clearanceLevel] = e.target.value.split('-');
                  setFormData({ ...formData, accessLevel, requiredClearanceLevel: parseInt(clearanceLevel) });
                }}
                required
                className={`${inputCls} appearance-none cursor-pointer pr-9`}
              >
                <optgroup label="Public — anyone can view">
                  <option value="public-0">Public (all staff & public)</option>
                </optgroup>
                <optgroup label="Department only">
                  <option value="restricted-0">Restricted — all department staff</option>
                  <option value="restricted-1">Restricted — records officers & above</option>
                  <option value="restricted-2">Restricted — dept admins & above</option>
                </optgroup>
                <optgroup label="Confidential — senior leadership">
                  <option value="confidential-3">Confidential — LGU head & super admin</option>
                  <option value="confidential-4">Confidential — super admin only</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Approvers */}
        <div className="glass rounded-2xl p-4 border-border/30 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Who needs to approve
            </h2>
            <span className="px-2.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">
              {selectedApprovers.length} picked
            </span>
          </div>

          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text" placeholder="Search people by name, role, or department…"
              value={approverSearch}
              onChange={e => setApproverSearch(e.target.value)}
              onFocus={() => setShowApproverPicker(true)}
              className={`${inputCls} pl-10`}
            />
          </div>

          {selectedApprovers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence>
                {selectedApprovers.map(a => (
                  <motion.div
                    key={a.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                  >
                    <UserCheck className="h-3 w-3 text-primary" />
                    <span className="text-[11px] font-medium">{a.name}</span>
                    <button type="button" onClick={() => toggleApprover(a)} className="hover:text-rose-500 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <AnimatePresence>
            {showApproverPicker && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="border border-border/40 rounded-xl overflow-hidden max-h-[240px] overflow-y-auto divide-y divide-border/10 bg-card"
              >
                {filteredApprovers.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <Shield className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs font-medium text-muted-foreground">No one here can approve this yet</p>
                    <p className="text-[10px] text-muted-foreground mt-1">This access level needs someone with higher clearance.</p>
                  </div>
                ) : (
                  filteredApprovers.map(approver => {
                    const isSelected = selectedApprovers.some(a => a.id === approver.id);
                    return (
                      <button
                        key={approver.id} type="button"
                        onClick={() => toggleApprover(approver)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-foreground/5 transition-all text-left ${isSelected ? 'bg-primary/5' : ''}`}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-primary border-primary' : 'border-border/50'}`}>
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{approver.name}</p>
                          <p className="text-[10px] font-medium uppercase text-muted-foreground truncate">{ROLE_LABELS[approver.role] || approver.role} • {approver.department}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {formData.requiredClearanceLevel >= 2 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-[10px] font-medium text-foreground/70 leading-relaxed">
                Only people with <strong>Level {formData.requiredClearanceLevel}</strong> clearance or higher can sign off on this.
              </p>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !file || hashLoading || selectedApprovers.length === 0}
          className="w-full clay py-3.5 text-primary-foreground font-bold text-base hover:brightness-110 active:scale-[0.99] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          {loading ? 'Uploading…' : 'Upload document'}
        </button>
      </form>
    </div>
  );
}