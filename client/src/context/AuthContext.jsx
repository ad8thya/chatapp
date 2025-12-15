import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getToken as loadToken, storeToken, clearToken, getAuthHeader } from '../utils/auth';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => loadToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(
    async (t) => {
      const res = await fetch(`${SERVER}/api/auth/me`, {
        headers: getAuthHeader(t),
      });
      if (!res.ok) throw new Error('unauthenticated');
      return res.json();
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const data = await fetchMe(token);
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          clearToken();
          setToken(null);
          setUser(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, fetchMe]);

  const login = async (newToken, userData) => {
    storeToken(newToken);
    setToken(newToken);
    if (userData) {
      setUser(userData);
    } else {
      try {
        const data = await fetchMe(newToken);
        setUser(data);
      } catch (e) {
        // ignore
      }
    }
  };

  const logout = () => {
    clearToken();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, getAuthHeader }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}


