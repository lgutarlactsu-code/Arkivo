import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getDeviceInfo } from './deviceInfo';
import { secureLog } from './secureLog';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-c5b85875`;
const SESSION_TOKEN_KEY = 'lgu_session_token';

// Check if we need to perform one-time migration cleanup
const checkMigrationCleanup = () => {
  const migrationComplete = localStorage.getItem('sql_migration_complete');
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  
  if (!migrationComplete && token) {
    secureLog.session('🔄 Performing one-time session cleanup for SQL migration');
    secureLog.session('🗑️  Clearing old session token');
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.setItem('sql_migration_complete', 'true');
    sessionStorage.setItem('sessionExpired', 'true');
  }
};

// Run cleanup check on module load
checkMigrationCleanup();

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  clearanceLevel: number;
  isActive: boolean;
  createdAt: string;
}

export const getSessionToken = (): string | null => {
  try {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    secureLog.session('getSessionToken called', token);
    return token;
  } catch (error) {
    secureLog.error('Error getting session token:', error);
    return null;
  }
};

const setSessionToken = (token: string): void => {
  try {
    secureLog.session('setSessionToken called, storing token', token);
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    secureLog.success('Token stored in localStorage');
    // Verify it was stored
    const stored = localStorage.getItem(SESSION_TOKEN_KEY);
    secureLog.session('Verification - token in storage', stored);
  } catch (error) {
    secureLog.error('Error setting session token:', error);
  }
};

const clearSessionToken = (): void => {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch (error) {
    secureLog.error('Error clearing session token:', error);
  }
};

export const signIn = async (email: string, password: string, turnstileToken?: string): Promise<string | null> => {
  try {
    secureLog.auth('Starting sign in', { email });
    secureLog.api('POST', `${API_BASE}/login`);

    const deviceInfo = getDeviceInfo();

    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Device-Info': JSON.stringify(deviceInfo),
      },
      body: JSON.stringify({ email, password, turnstileToken }),
    });
    
    secureLog.api('Login response status', res.status);
    secureLog.api('Login response headers', Object.fromEntries(res.headers.entries()));
    
    let data;
    try {
      const responseText = await res.text();
      secureLog.api('Raw response', responseText);
      data = JSON.parse(responseText);
      secureLog.api('Parsed response data', data);
    } catch (parseError) {
      secureLog.error('❌ Failed to parse response:', parseError);
      throw new Error('Server returned invalid response. Please check server logs.');
    }
    
    if (!res.ok) {
      const errorMsg = data.error || data.hint || 'Login failed';
      secureLog.error('❌ Login failed:', errorMsg);
      if (data.hint) {
        secureLog.error('💡 Hint:', data.hint);
      }
      throw new Error(errorMsg);
    }
    
    // Store session token
    if (data.token) {
      setSessionToken(data.token);
      secureLog.success('Session token stored successfully');
      return data.token;
    } else {
      secureLog.error('❌ No token in response');
      throw new Error('No authentication token received');
    }
  } catch (error) {
    secureLog.error('❌ Sign in error:', error);
    throw error;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    const token = getSessionToken();
    
    if (token) {
      // Call logout endpoint to invalidate session on server
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Session-Token': token,
        },
      });
    }
    
    // Clear local session token
    clearSessionToken();
    secureLog.success('Logged out successfully');
  } catch (error) {
    secureLog.error('Sign out error:', error);
    // Clear local token even if server request fails
    clearSessionToken();
    throw error;
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  const token = getSessionToken();
  if (!token) {
    secureLog.session('No session token found');
    return null;
  }
  
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Session-Token': token,
      },
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      // Session might be expired or invalid
      if (res.status === 401 || data.needsLogin) {
        secureLog.session('Session expired or invalid, clearing token');
        secureLog.session('Server message:', data.error || 'No error message');
        clearSessionToken();
        
        // Set flag for login page to show session expired message
        sessionStorage.setItem('sessionExpired', 'true');
        
        // Force reload to login page after a short delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }
      return null;
    }
    
    return data.user;
  } catch (error) {
    secureLog.error('Error getting current user:', error);
    // On network errors, also clear the token
    clearSessionToken();
    return null;
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return getSessionToken() !== null;
};