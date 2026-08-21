import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getSessionToken } from './auth';
import { getDeviceInfo } from './deviceInfo';
import { secureLog } from './secureLog';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-c5b85875`;

// Timeout helper
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 15000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    throw error;
  }
};

const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = getSessionToken();
  const deviceInfo = getDeviceInfo();
  
  secureLog.api('authFetch called for:', url);
  secureLog.session('Session token check', token);
  
  if (!token) {
    secureLog.security('No session token found in authFetch');
    secureLog.warn('⚠️  Redirecting to login page...');
    // Clear any stale data
    localStorage.clear();
    // Redirect to login after a short delay
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
    throw new Error('Session expired. Redirecting to login...');
  }
  
  try {
    const fullUrl = `${API_BASE}${url}`;
    secureLog.api('Making request to:', fullUrl);
    
    const res = await fetchWithTimeout(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-Token': token,
        'X-Device-Info': JSON.stringify(deviceInfo),
        ...options.headers,
      },
    }, 15000); // 15 second timeout
    
    secureLog.api('Response status:', res.status);
    
    const data = await res.json();
    
    if (!res.ok) {
      secureLog.error(`API Error on ${url}:`, {
        status: res.status,
        statusText: res.statusText,
        error: data.error,
        needsLogin: data.needsLogin,
      });
      
      // Handle 401 Unauthorized - session expired or invalid
      if (res.status === 401 || data.needsLogin) {
        secureLog.security('Session invalid or expired (401), redirecting to login');
        secureLog.warn('⚠️  Server message:', data.error);
        localStorage.clear();
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
        throw new Error(data.error || 'Session expired. Please log in again.');
      }
      
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    
    secureLog.success('API call successful: ' + url);
    return data;
  } catch (error: any) {
    secureLog.error(`API Request Error on ${url}:`, error);
    
    // Don't double-handle redirects
    if (error.message.includes('Redirecting to login')) {
      throw error;
    }
    
    // Provide user-friendly error messages
    if (error.message.includes('timeout')) {
      throw new Error('Request took too long. Please check your connection and try again.');
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Network error. Please check your internet connection.');
    }
    throw error;
  }
};

export const api = {
  // Helpers
  baseUrl: API_BASE,
  getToken: getSessionToken,
  
  // Auth
  signup: async (userData: any) => {
    const res = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify(userData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
  
  // Documents
  getDocuments: () => authFetch('/documents'),
  getAllDocuments: () => authFetch('/documents'),
  getDocument: (id: string) => authFetch(`/documents/${id}`),
  uploadDocument: (doc: any) => authFetch('/documents', {
    method: 'POST',
    body: JSON.stringify(doc),
  }),
  updateDocument: (id: string, updates: any) => authFetch(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  }),
  submitDocument: (id: string) => authFetch(`/documents/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  }),
  approveDocument: (id: string, comments?: string) => authFetch(`/documents/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comments }),
  }),
  rejectDocument: (id: string, reason: string) => authFetch(`/documents/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
  
  downloadDocument: async (id: string) => {
    const data = await authFetch(`/documents/${id}/download`);
    return data;
  },
  
  // Stats
  getStats: () => authFetch('/stats'),
  
  // Notifications
  getNotifications: () => authFetch('/notifications'),
  markNotificationAsRead: (id: string) => authFetch(`/notifications/${id}/read`, {
    method: 'POST',
  }),
  markAllNotificationsAsRead: () => authFetch('/notifications/read-all', {
    method: 'POST',
  }),
  
  // Users
  getUsers: () => authFetch('/users'),
  getApprovers: () => authFetch('/users/approvers'),
  
  // Password
  changePassword: async (currentPassword: string, newPassword: string) => {
    return authFetch('/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  
  // Profile
  updateName: async (name: string) => {
    return authFetch('/update-name', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  
  // Audit Logs
  getAuditLogs: () => authFetch('/audit-logs'),

  // User Account Approval (Super Admin only)
  approveUserAccount: (userId: string) => authFetch(`/users/${userId}/approve`, {
    method: 'POST',
  }),
  rejectUserAccount: (userId: string, reason?: string) => authFetch(`/users/${userId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
  deleteUser: (userId: string) => authFetch(`/users/${userId}`, {
    method: 'DELETE',
  }),

  // SHA-256 Document Integrity
  verifyDocumentHash: (id: string, fileHash: string) => authFetch(`/documents/${id}/verify-hash`, {
    method: 'POST',
    body: JSON.stringify({ fileHash }),
  }),

  // Multi-approval progress
  getDocumentApprovals: (id: string) => authFetch(`/documents/${id}/approvals`),

  // Version history
  getDocumentVersions: (id: string) => authFetch(`/documents/${id}/versions`),

  // ===== Password reset (admin-mediated) =====
  // Public — no session required
  requestPasswordReset: async (email: string) => {
    const res = await fetch(`${API_BASE}/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  verifyResetToken: async (token: string) => {
    const res = await fetch(`${API_BASE}/password-reset/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ token }),
    });
    return res.json();
  },
  completePasswordReset: async (token: string, newPassword: string) => {
    const res = await fetch(`${API_BASE}/password-reset/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || (data.details ? data.details.join(', ') : 'Reset failed'));
    return data;
  },

  // Super-admin only
  getPasswordResetRequests: () => authFetch('/password-reset/requests'),
  approvePasswordResetRequest: (id: string) => authFetch(`/password-reset/requests/${id}/approve`, {
    method: 'POST',
  }),
  rejectPasswordResetRequest: (id: string, reason?: string) => authFetch(`/password-reset/requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),
};