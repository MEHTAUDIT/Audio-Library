import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';

interface AuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
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

  const login = (newToken: string) => {
    setToken(newToken);
  };

  const logout = useCallback(() => {
    setToken(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
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
