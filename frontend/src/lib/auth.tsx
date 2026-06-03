import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';

const AUTH_LANDING_PATH_KEY = 'authLandingPath';

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(globalThis.atob(padded));
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
};

const hasAdminClaim = (payload: Record<string, unknown>) => {
  if (payload.isAdmin === true) {
    return true;
  }

  const claimValues = [
    payload.role,
    payload.userType,
    payload.accountType,
    payload.type,
    payload.primaryRole,
    payload.defaultRole,
  ];

  const roles = [
    ...(Array.isArray(payload.roles) ? payload.roles : []),
    ...(Array.isArray(payload.authorities) ? payload.authorities : []),
    ...(Array.isArray(payload.permissions) ? payload.permissions : []),
  ]
    .flat()
    .filter((value): value is string => typeof value === 'string');

  return [...claimValues, ...roles]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase())
    .some((value) => value.includes('admin') || value.includes('owner') || value.includes('staff') || value.includes('manager'));
};

const extractLandingPathFromToken = (token: string): string | null => {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return null;
  }

  const landingPath = payload.landingPath ?? payload.redirectTo ?? payload.defaultRoute;
  if (typeof landingPath === 'string' && landingPath.startsWith('/')) {
    return landingPath;
  }

  if (hasAdminClaim(payload)) {
    return '/admin';
  }

  const claimValues = [
    payload.userType,
    payload.accountType,
    payload.type,
  ];

  const roles = [
    ...(Array.isArray(payload.roles) ? payload.roles : []),
    ...(Array.isArray(payload.authorities) ? payload.authorities : []),
    ...(Array.isArray(payload.permissions) ? payload.permissions : []),
  ]
    .flat()
    .filter((value): value is string => typeof value === 'string');

  const normalizedClaims = [...claimValues, ...roles]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase());

  if (normalizedClaims.some((value) => value.includes('user') || value.includes('listener') || value.includes('member') || value.includes('customer'))) {
    return '/library';
  }

  return null;
};

export const hasAdminAccess = (token: string | null = localStorage.getItem('token')) => {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  return Boolean(payload && hasAdminClaim(payload));
};

export const getAuthRedirectPath = (token: string | null = localStorage.getItem('token')) => {
  if (!token) {
    return '/library';
  }

  return (
    extractLandingPathFromToken(token) ??
    localStorage.getItem(AUTH_LANDING_PATH_KEY) ??
    '/library'
  );
};

export const setAuthLandingPath = (path: string) => {
  localStorage.setItem(AUTH_LANDING_PATH_KEY, path);
};

interface AuthContextType {
  token: string | null;
  login: (token: string, tenantSubdomain?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem('token');
    const lastActivity = localStorage.getItem('lastActivity');
    
    // Check if session has expired due to inactivity
    if (storedToken && lastActivity) {
      const timeSinceActivity = Date.now() - parseInt(lastActivity, 10);
      if (timeSinceActivity > SESSION_TIMEOUT_MS) {
        // Session expired - clear token
        localStorage.removeItem('token');
        localStorage.removeItem('tenantSubdomain');
        localStorage.removeItem('lastActivity');
        return null;
      }
    }
    return storedToken;
  });
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update activity timestamp
  const updateActivity = useCallback(() => {
    if (token) {
      localStorage.setItem('lastActivity', Date.now().toString());
      
      // Reset the inactivity timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        // Auto-logout after inactivity and redirect to login
        console.log('Session expired due to inactivity');
        setToken(null);
        // Redirect to login page
        if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
          window.location.href = '/login?expired=true';
        }
      }, SESSION_TIMEOUT_MS);
    }
  }, [token]);

  // Track user activity
  useEffect(() => {
    if (!token) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Throttle activity updates to avoid too many localStorage writes
    let lastUpdate = 0;
    const throttledUpdate = () => {
      const now = Date.now();
      if (now - lastUpdate > 60000) { // Update at most once per minute
        lastUpdate = now;
        updateActivity();
      }
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, throttledUpdate, { passive: true });
    });

    // Initial activity update
    updateActivity();

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledUpdate);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [token, updateActivity]);

  // Setup axios interceptor to handle token
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('lastActivity', Date.now().toString());
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('tenantSubdomain');
      localStorage.removeItem('lastActivity');
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Setup axios interceptor to handle 401/403 responses
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        // Only handle 401 (Unauthorized) - not 403 (Forbidden) which may be permission-related
        if (error.response?.status === 401) {
          // Only logout if we thought we were authenticated
          const hasToken = localStorage.getItem('token');
          if (hasToken) {
            console.log('Received 401 - token expired or invalid');
            setToken(null);
            // Only redirect if we're on an admin page
            if (window.location.pathname.startsWith('/admin')) {
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = (newToken: string, tenantSubdomain = 'demo') => {
    localStorage.setItem('tenantSubdomain', tenantSubdomain);
    setToken(newToken);
  };

  const logout = useCallback(() => {
    setToken(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token, isAdmin: hasAdminAccess(token) }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
