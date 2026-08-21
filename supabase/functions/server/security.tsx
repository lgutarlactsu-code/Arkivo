/**
 * Security Utilities
 * Input validation, sanitization, and rate limiting
 */

// Rate limiting store (in-memory for now)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiter middleware
 * @param maxRequests Maximum requests allowed
 * @param windowMs Time window in milliseconds
 */
export const rateLimit = (maxRequests: number, windowMs: number) => {
  return async (c: any, next: any) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 
               c.req.header('x-real-ip') || 
               'unknown';
    
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();
    const record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      // Start new window
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }
    
    if (record.count >= maxRequests) {
      return c.json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      }, 429);
    }
    
    record.count++;
    return next();
  };
};

/**
 * Clean rate limit store periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Input validation and sanitization
 */
export const validation = {
  /**
   * Validate email format
   */
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  },

  /**
   * Validate password strength
   * Requirements: 8+ chars, uppercase, lowercase, number, special char
   */
  password: (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Sanitize string input to prevent XSS
   */
  sanitizeString: (input: string, maxLength = 1000): string => {
    if (!input) return '';
    
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');
    
    // Trim and limit length
    sanitized = sanitized.trim().slice(0, maxLength);
    
    // Escape HTML entities
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    return sanitized;
  },

  /**
   * Validate UUID format
   */
  uuid: (id: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  },

  /**
   * Validate file type
   */
  fileType: (fileType: string): boolean => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    return allowedTypes.includes(fileType.toLowerCase());
  },

  /**
   * Validate file size (in bytes)
   */
  fileSize: (size: number, maxSize = 10 * 1024 * 1024): boolean => {
    return size > 0 && size <= maxSize; // Default 10MB
  },

  /**
   * Validate department name
   */
  department: (dept: string): boolean => {
    const validDepartments = [
      'administration',
      'finance',
      'engineering',
      'health',
      'social_welfare',
      'agriculture',
      'education',
      'planning',
      'public_works',
      'human_resources',
    ];
    return validDepartments.includes(dept);
  },

  /**
   * Validate user role
   */
  role: (role: string): boolean => {
    const validRoles = [
      'super_admin',
      'lgu_head',
      'dept_admin',
      'records_officer',
      'staff',
      'public',
    ];
    return validRoles.includes(role);
  },

  /**
   * Validate access level
   */
  accessLevel: (level: string): boolean => {
    const validLevels = ['public', 'internal', 'confidential', 'restricted'];
    return validLevels.includes(level);
  },

  /**
   * Validate document status
   */
  status: (status: string): boolean => {
    const validStatuses = ['draft', 'pending_approval', 'approved', 'rejected'];
    return validStatuses.includes(status);
  },
};

/**
 * CSRF Token validation (for future implementation)
 */
export const csrfProtection = {
  /**
   * Generate CSRF token
   */
  generateToken: (): string => {
    return crypto.randomUUID();
  },

  /**
   * Validate CSRF token
   */
  validateToken: (token: string, storedToken: string): boolean => {
    return token === storedToken;
  },
};

/**
 * Secure headers middleware
 */
export const secureHeaders = async (c: any, next: any) => {
  await next();
  
  // Add security headers to response
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co;"
  );
};

/**
 * Brute force protection for login attempts
 */
const loginAttempts = new Map<string, { count: number; lockedUntil?: number }>();

export const loginBruteForceProtection = {
  /**
   * Check if IP/email is locked out
   */
  checkLockout: (identifier: string): { locked: boolean; retryAfter?: number } => {
    const record = loginAttempts.get(identifier);
    
    if (!record) {
      return { locked: false };
    }
    
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
      return {
        locked: true,
        retryAfter: Math.ceil((record.lockedUntil - Date.now()) / 1000),
      };
    }
    
    // Lockout expired, reset
    if (record.lockedUntil && Date.now() >= record.lockedUntil) {
      loginAttempts.delete(identifier);
      return { locked: false };
    }
    
    return { locked: false };
  },

  /**
   * Record failed login attempt
   */
  recordFailedAttempt: (identifier: string): void => {
    const record = loginAttempts.get(identifier) || { count: 0 };
    record.count++;
    
    // Lock after 5 failed attempts for 15 minutes
    if (record.count >= 5) {
      record.lockedUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
    }
    
    loginAttempts.set(identifier, record);
  },

  /**
   * Reset login attempts after successful login
   */
  resetAttempts: (identifier: string): void => {
    loginAttempts.delete(identifier);
  },
};

// Clean login attempts periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttempts.entries()) {
    if (record.lockedUntil && now >= record.lockedUntil) {
      loginAttempts.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * SQL Injection prevention helpers
 * Note: Supabase client already prevents SQL injection,
 * but these helpers provide additional validation
 */
export const sqlSafe = {
  /**
   * Validate that input doesn't contain SQL injection patterns
   */
  validateInput: (input: string): boolean => {
    const sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|UNION)\b)/i,
      /(--|\*|;|\/\*|\*\/|@@|@)/,
      /(\bOR\b.*=.*|'\s*OR\s*'|"\s*OR\s*")/i,
    ];
    
    return !sqlInjectionPatterns.some(pattern => pattern.test(input));
  },
};
