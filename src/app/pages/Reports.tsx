import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router';
import { api } from '../lib/api';
import {
  FileText, Download, Filter, Building,
  CheckCircle, XCircle, Activity, File, Loader2,
  FileSpreadsheet, Archive, TrendingUp, ChevronDown,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';

type ExportFormat = 'csv' | 'pdf';

export function Reports() {
  const { user } = useOutletContext<any>();
  const [documents, setDocuments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    department: '',
    status: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [docsData, logsData] = await Promise.all([
        user?.role === 'super_admin' || user?.role === 'lgu_head'
          ? api.getAllDocuments()
          : api.getDocuments(),
        api.getAuditLogs()
      ]);
      setDocuments(docsData.documents || []);
      setAuditLogs(logsData.logs || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = [...documents];

    if (filters.dateFrom) {
      filtered = filtered.filter(d => new Date(d.createdAt) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      filtered = filtered.filter(d => new Date(d.createdAt) <= new Date(filters.dateTo));
    }
    if (filters.department) {
      filtered = filtered.filter(d => d.department === filters.department);
    }
    if (filters.status) {
      filtered = filtered.filter(d => d.status === filters.status);
    }

    return filtered;
  };

  const generateCSV = (data: any[], filename: string, sortByField?: string) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Sort data if sortByField is provided
    let sortedData = [...data];
    if (sortByField && data[0][sortByField]) {
      sortedData = sortedData.sort((a, b) => {
        const aVal = a[sortByField]?.toString() || '';
        const bVal = b[sortByField]?.toString() || '';
        return aVal.localeCompare(bVal);
      });
    }

    const headers = Object.keys(sortedData[0]);

    // Add metadata header rows
    const metadataRows = [
      `"ARKIVO - ${filename.replace(/_/g, ' ').toUpperCase()}"`,
      `"Generated on: ${new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}"`,
      `"Total Records: ${sortedData.length}"`,
      '', // Empty row for separation
    ];

    const csvContent = [
      ...metadataRows,
      headers.join(','),
      ...sortedData.map(row =>
        headers.map(header => {
          const value = row[header]?.toString() || '';
          // Escape quotes and wrap in quotes
          return `"${value.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\r\n'); // Use Windows line endings for better Excel compatibility

    // Add BOM for UTF-8 Excel recognition
    const BOM = '﻿';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const generatePDF = (data: any[], filename: string, title: string, sortByField?: string) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Sort data if sortByField is provided
    let sortedData = [...data];
    if (sortByField && data[0][sortByField]) {
      sortedData = sortedData.sort((a, b) => {
        const aVal = a[sortByField]?.toString() || '';
        const bVal = b[sortByField]?.toString() || '';
        return aVal.localeCompare(bVal);
      });
    }

    const headers = Object.keys(sortedData[0]);

    // Create HTML for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @page {
            size: landscape;
            margin: 1cm;
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #0B0E14;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #111827;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #111827;
            font-size: 28px;
            margin: 0 0 10px 0;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .header p {
            color: #6B7280;
            font-size: 12px;
            margin: 0;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          thead {
            background: #111827;
            color: white;
          }
          th {
            padding: 14px 8px;
            text-align: left;
            font-weight: 900;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border: none;
            white-space: nowrap;
          }
          td {
            padding: 12px 8px;
            border-bottom: 1px solid #E5E7EB;
            font-size: 10px;
            font-weight: 500;
            word-wrap: break-word;
            max-width: 200px;
          }
          tbody tr:nth-child(even) {
            background-color: #F9FAFB;
          }
          tbody tr:hover {
            background-color: #F3F4F6;
          }
          tbody tr {
            page-break-inside: avoid;
          }
          @media print {
            tbody tr {
              page-break-inside: avoid;
            }
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #E5E7EB;
            text-align: center;
            font-size: 10px;
            color: #6B7280;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .stats {
            margin: 20px 0;
            padding: 15px;
            background: #F3F4F6;
            border-left: 4px solid #111827;
            border-radius: 4px;
          }
          .stats strong {
            color: #111827;
            font-weight: 900;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ARKIVO</h1>
          <p>${title}</p>
          <p style="margin-top: 10px; color: #9CA3AF;">Generated on ${new Date().toLocaleString()}</p>
        </div>
        <div class="stats">
          <strong>Total Records:</strong> ${sortedData.length} |
          <strong>Filters Applied:</strong> ${
            (filters.dateFrom || filters.dateTo || filters.department || filters.status)
              ? 'Yes'
              : 'None'
          }
        </div>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${sortedData.map(row => `
              <tr>
                ${headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          ARKIVO • LGU DOCUMENT MANAGEMENT SYSTEM • ${new Date().getFullYear()}
        </div>
      </body>
      </html>
    `;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');

    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          URL.revokeObjectURL(url);
        }, 250);
      };
    } else {
      toast.error('Please allow popups to generate PDF');
      URL.revokeObjectURL(url);
    }
  };

  // Helper function to convert MIME type to friendly name
  const getFriendlyFileType = (mimeType: string): string => {
    const mimeMap: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (DOCX)',
      'application/msword': 'Word (DOC)',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (XLSX)',
      'application/vnd.ms-excel': 'Excel (XLS)',
      'image/jpeg': 'Image (JPEG)',
      'image/jpg': 'Image (JPG)',
      'image/png': 'Image (PNG)',
      'text/plain': 'Text File',
      'application/zip': 'ZIP Archive',
    };
    return mimeMap[mimeType] || mimeType || 'Unknown';
  };

  const generateDocumentSummary = async (format: ExportFormat) => {
    setGenerating('document-summary');
    try {
      const filtered = filterDocuments();
      const data = filtered.map(d => ({
        'File Type': getFriendlyFileType(d.fileType),
        Title: d.title || 'Untitled',
        Department: d.department?.replace(/_/g, ' ').toUpperCase() || 'N/A',
        Status: d.status?.replace(/_/g, ' ').toUpperCase() || 'N/A',
        'Access Level': d.accessLevel?.toUpperCase() || 'N/A',
        'Clearance Level': `Level ${d.requiredClearanceLevel || 0}`,
        'File Size KB': d.fileSize ? (d.fileSize / 1024).toFixed(2) : 'N/A',
        'Created Date': d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'N/A',
        Version: `v${d.version || d.versionNumber || 1}`,
      }));

      if (format === 'csv') {
        generateCSV(data, 'document_summary_report', 'File Type');
        toast.success('CSV report downloaded successfully');
      } else {
        generatePDF(data, 'document_summary_report', 'Document Summary Report', 'File Type');
        toast.success('PDF report generated successfully');
      }
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  const generateAuditTrail = async (format: ExportFormat) => {
    setGenerating('audit-trail');
    try {
      let filtered = [...auditLogs];

      if (filters.dateFrom) {
        filtered = filtered.filter(l => new Date(l.timestamp) >= new Date(filters.dateFrom));
      }
      if (filters.dateTo) {
        filtered = filtered.filter(l => new Date(l.timestamp) <= new Date(filters.dateTo));
      }

      const data = filtered.map(l => ({
        'Action Type': (l.action || 'N/A').replace(/_/g, ' ').toUpperCase(),
        User: l.userName || 'System',
        Email: l.userEmail || 'N/A',
        'Document ID': l.documentId || 'N/A',
        Details: typeof l.details === 'object' ? JSON.stringify(l.details) : (l.details || 'No details'),
        Date: l.timestamp ? new Date(l.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'N/A',
        Time: l.timestamp ? new Date(l.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A',
      }));

      if (format === 'csv') {
        generateCSV(data, 'audit_trail_report', 'Action Type');
        toast.success('CSV report downloaded successfully');
      } else {
        generatePDF(data, 'audit_trail_report', 'Audit Trail Report', 'Action Type');
        toast.success('PDF report generated successfully');
      }
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  const generateDepartmentStats = async (format: ExportFormat) => {
    setGenerating('department-stats');
    try {
      const deptMap = documents.reduce((acc: any, d) => {
        const dept = d.department || 'Unassigned';
        if (!acc[dept]) {
          acc[dept] = { total: 0, approved: 0, pending: 0, rejected: 0, draft: 0 };
        }
        acc[dept].total++;
        if (d.status === 'approved') acc[dept].approved++;
        if (d.status === 'pending_approval') acc[dept].pending++;
        if (d.status === 'rejected') acc[dept].rejected++;
        if (d.status === 'draft') acc[dept].draft++;
        return acc;
      }, {});

      const data = Object.entries(deptMap).map(([dept, stats]: [string, any]) => ({
        Department: dept.replace(/_/g, ' ').toUpperCase(),
        'Total Docs': stats.total,
        Approved: stats.approved,
        Pending: stats.pending,
        Rejected: stats.rejected,
        Draft: stats.draft,
        'Approval Rate': `${((stats.approved / stats.total) * 100).toFixed(1)}%`,
      }));

      if (format === 'csv') {
        generateCSV(data, 'department_statistics_report', 'Department');
        toast.success('CSV report downloaded successfully');
      } else {
        generatePDF(data, 'department_statistics_report', 'Department Statistics Report', 'Department');
        toast.success('PDF report generated successfully');
      }
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  const generateApprovalMetrics = async (format: ExportFormat) => {
    setGenerating('approval-metrics');
    try {
      const approvalLogs = auditLogs.filter(l =>
        l.action === 'DOCUMENT_APPROVED' ||
        l.action === 'DOCUMENT_REJECTED' ||
        l.action === 'DOCUMENT_PARTIALLY_APPROVED'
      );

      const data = approvalLogs.map(l => {
        const decision = l.action === 'DOCUMENT_APPROVED' ? 'APPROVED' :
                        l.action === 'DOCUMENT_REJECTED' ? 'REJECTED' :
                        'PARTIALLY APPROVED';
        return {
          Decision: decision,
          'Document ID': l.documentId || 'N/A',
          Approver: l.userName || 'N/A',
          'Approver Email': l.userEmail || 'N/A',
          Date: l.timestamp ? new Date(l.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'N/A',
          Time: l.timestamp ? new Date(l.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A',
          Comments: typeof l.details === 'object' ? JSON.stringify(l.details) : (l.details || 'No comments'),
        };
      });

      if (format === 'csv') {
        generateCSV(data, 'approval_metrics_report', 'Decision');
        toast.success('CSV report downloaded successfully');
      } else {
        generatePDF(data, 'approval_metrics_report', 'Approval Metrics Report', 'Decision');
        toast.success('PDF report generated successfully');
      }
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-sm font-bold text-muted-foreground animate-pulse tracking-widest uppercase">Loading Data...</p>
      </div>
    );
  }

  const departments = [...new Set(documents.map(d => d.department))].filter(Boolean);
  const filteredCount = filterDocuments().length;

  const reportTypes = [
    {
      id: 'document-summary',
      title: 'Document Summary',
      description: 'Complete document list sorted by file type',
      icon: FileText,
      color: 'text-blue-500',
      bg: 'bg-muted',
      action: generateDocumentSummary,
    },
    {
      id: 'audit-trail',
      title: 'Audit Trail',
      description: 'Activity log sorted by action type',
      icon: Activity,
      color: 'text-foreground',
      bg: 'bg-muted',
      action: generateAuditTrail,
    },
    {
      id: 'department-stats',
      title: 'Department Statistics',
      description: 'Stats sorted alphabetically by department',
      icon: Building,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      action: generateDepartmentStats,
    },
    {
      id: 'approval-metrics',
      title: 'Approval Metrics',
      description: 'Decisions sorted by approval status',
      icon: CheckCircle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      action: generateApprovalMetrics,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay p-5 sm:p-6 text-primary-foreground relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md flex-shrink-0">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Generate reports</h1>
              <p className="text-primary-foreground/75 text-sm mt-0.5">
                Export your data as CSV or PDF
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-center px-1">
              <p className="text-xl font-black tabular-nums leading-none">{documents.length}</p>
              <p className="text-[9px] uppercase tracking-widest opacity-75 mt-1">Records</p>
            </div>
            <div className="text-center px-1">
              <p className="text-xl font-black tabular-nums leading-none">{auditLogs.length}</p>
              <p className="text-[9px] uppercase tracking-widest opacity-75 mt-1">Logs</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Records', value: documents.length, icon: FileText, color: 'text-foreground', bg: 'bg-muted' },
          { label: 'Audit Logs', value: auditLogs.length, icon: Activity, color: 'text-foreground', bg: 'bg-muted' },
          { label: 'Departments', value: new Set(documents.map(d => d.department)).size, icon: Building, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Filtered', value: filteredCount, icon: Filter, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            className="glass rounded-2xl p-4 border-border/30 flex items-center gap-3"
          >
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black tabular-nums leading-none">{stat.value}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 truncate">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-2xl p-4 border-border/30"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Filter className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Filters</h2>
              <p className="text-xs text-muted-foreground">Optional — refine by date, department, or status</p>
            </div>
          </div>
          {(filters.dateFrom || filters.dateTo || filters.department || filters.status) && (
            <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" />
              {filteredCount} records
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Date from</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2.5 bg-background/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-medium text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Date to</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2.5 bg-background/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-medium text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Department</label>
            <div className="relative">
              <select
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                className="w-full px-3 py-2.5 bg-background/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none font-medium text-sm cursor-pointer"
              >
                <option value="">All departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept.replace(/_/g, ' ').toUpperCase()}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Status</label>
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2.5 bg-background/50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none font-medium text-sm cursor-pointer"
              >
                <option value="">All status</option>
                <option value="approved">Approved</option>
                <option value="pending_approval">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="draft">Draft</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {(filters.dateFrom || filters.dateTo || filters.department || filters.status) && (
          <button
            onClick={() => setFilters({ dateFrom: '', dateTo: '', department: '', status: '' })}
            className="mt-4 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <XCircle className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </motion.div>

      {/* Section heading */}
      <div className="flex items-center gap-2 pt-1">
        <Download className="h-4 w-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-bold leading-tight">Available reports</h2>
          <p className="text-xs text-muted-foreground">Choose a format to export your data</p>
        </div>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {reportTypes.map((report, i) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className="glass rounded-2xl p-4 border-border/30 hover:border-primary/30 transition-all"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`h-10 w-10 rounded-xl ${report.bg} flex items-center justify-center flex-shrink-0`}>
                <report.icon className={`h-5 w-5 ${report.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold leading-tight">{report.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => report.action('csv')}
                disabled={generating === report.id}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 py-2.5 text-emerald-500 font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
              >
                {generating === report.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Working...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>CSV</span>
                  </>
                )}
              </button>

              <button
                onClick={() => report.action('pdf')}
                disabled={generating === report.id}
                className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 py-2.5 text-rose-500 font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
              >
                {generating === report.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Working...</span>
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4" />
                    <span>PDF</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4 border-border/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-sm font-bold">Export formats</h3>
          </div>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
              <span><strong className="text-emerald-500">CSV:</strong> opens in Excel, Google Sheets, or any spreadsheet app</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
              <span><strong className="text-rose-500">PDF:</strong> a clean, formatted report ready to print</span>
            </li>
          </ul>
        </div>

        <div className="glass rounded-2xl p-4 border-border/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-sm font-bold">How data is sorted</h3>
          </div>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span>Documents by <strong className="text-foreground">file type</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span>Audit logs by <strong className="text-foreground">action type</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span>Departments <strong className="text-foreground">alphabetically</strong></span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
