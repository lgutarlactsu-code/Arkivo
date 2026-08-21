/**
 * Secure Logging Utility - Client Side
 * Prevents sensitive information from being logged to browser console
 */

// Determine if we're in development mode
const isDevelopment = import.meta.env?.MODE === 'development';

/**
 * Redact sensitive information from strings
 */
const redactSensitive = (value: any): any => {
  if (typeof value === 'string') {
    // Redact email addresses (show first 2 chars + domain)
    value = value.replace(
      /([a-zA-Z0-9._-]{1,2})[a-zA-Z0-9._-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '$1***@$2'
    );
    
    // Redact UUIDs (show first 4 chars only)
    value = value.replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      (match) => `${match.substring(0, 4)}****`
    );
    
    // Redact JWT tokens
    value = value.replace(
      /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
      'eyJ***[REDACTED]***'
    );
    
    // Redact anything that looks like a key
    if (value.includes('key') || value.includes('Key') || value.includes('KEY')) {
      const keyPattern = /[a-zA-Z0-9_-]{20,}/g;
      value = value.replace(keyPattern, '***[REDACTED]***');
    }
  }
  
  return value;
};

/**
 * Redact sensitive fields from objects
 */
const redactObject = (obj: any): any => {
  if (!obj || typeof obj !== 'object') {
    return redactSensitive(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }

  const redacted: any = {};
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'authorization',
    'api_key',
    'apiKey',
    'sessionToken',
    'accessToken',
    'refreshToken',
    'privateKey',
    'serviceKey',
    'anonKey',
    'currentPassword',
    'newPassword',
  ];

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key is sensitive
    if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey.toLowerCase()))) {
      if (typeof value === 'string' && value.length > 0) {
        // Show first 4 characters only
        redacted[key] = value.length > 4 ? `${value.substring(0, 4)}***` : '***';
      } else {
        redacted[key] = '***';
      }
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObject(value);
    } else {
      redacted[key] = redactSensitive(value);
    }
  }

  return redacted;
};

/**
 * Secure logging functions
 */
export const secureLog = {
  /**
   * Log information (auto-redacts sensitive data)
   */
  info: (...args: any[]) => {
    if (!isDevelopment) return; // Don't log in production
    const redacted = args.map(arg => 
      typeof arg === 'object' ? redactObject(arg) : redactSensitive(arg)
    );
    console.log(...redacted);
  },

  /**
   * Log errors (auto-redacts sensitive data)
   */
  error: (...args: any[]) => {
    const redacted = args.map(arg => 
      typeof arg === 'object' ? redactObject(arg) : redactSensitive(arg)
    );
    console.error(...redacted);
  },

  /**
   * Log warnings (auto-redacts sensitive data)
   */
  warn: (...args: any[]) => {
    if (!isDevelopment) return; // Don't log in production
    const redacted = args.map(arg => 
      typeof arg === 'object' ? redactObject(arg) : redactSensitive(arg)
    );
    console.warn(...redacted);
  },

  /**
   * Log authentication events (heavily redacted)
   */
  auth: (message: string, data?: any) => {
    if (!isDevelopment) return;
    
    let redactedData = data;
    if (data) {
      redactedData = {
        ...redactObject(data),
        // Force redact even more for auth
        email: data.email ? `${data.email.substring(0, 2)}***` : undefined,
        userId: data.userId ? `${data.userId.substring(0, 4)}***` : undefined,
      };
    }
    
    console.log(`🔐 [AUTH] ${message}`, redactedData || '');
  },

  /**
   * Log session events (token always redacted)
   */
  session: (message: string, token?: string) => {
    if (!isDevelopment) return;
    
    if (token && token.length > 4) {
      console.log(`🔑 [SESSION] ${message}`, `${token.substring(0, 4)}***`);
    } else {
      console.log(`🔑 [SESSION] ${message}`);
    }
  },

  /**
   * Log API calls (redacts sensitive headers and data)
   */
  api: (method: string, url: string, status?: number) => {
    if (!isDevelopment) return;
    
    const redactedUrl = redactSensitive(url);
    if (status) {
      console.log(`🌐 [API] ${method} ${redactedUrl} - ${status}`);
    } else {
      console.log(`🌐 [API] ${method} ${redactedUrl}`);
    }
  },

  /**
   * Log security events (always logged, even in production)
   */
  security: (event: string, details?: any) => {
    const redacted = details ? redactObject(details) : undefined;
    console.warn(`🚨 [SECURITY] ${event}`, redacted || '');
  },

  /**
   * Debug logging (only in development)
   */
  debug: (...args: any[]) => {
    if (!isDevelopment) return;
    
    const redacted = args.map(arg => 
      typeof arg === 'object' ? redactObject(arg) : redactSensitive(arg)
    );
    console.log('🐛 [DEBUG]', ...redacted);
  },

  /**
   * Success logging
   */
  success: (message: string) => {
    if (!isDevelopment) return;
    console.log(`✅ ${message}`);
  },
};

/**
 * Create a logger instance for a specific module
 */
export const createLogger = (moduleName: string) => {
  return {
    info: (...args: any[]) => secureLog.info(`[${moduleName}]`, ...args),
    error: (...args: any[]) => secureLog.error(`[${moduleName}]`, ...args),
    warn: (...args: any[]) => secureLog.warn(`[${moduleName}]`, ...args),
    debug: (...args: any[]) => secureLog.debug(`[${moduleName}]`, ...args),
    success: (message: string) => secureLog.success(`[${moduleName}] ${message}`),
  };
};

// Export for backward compatibility
export default secureLog;
