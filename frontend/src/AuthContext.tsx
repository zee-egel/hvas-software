import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  fetchAuthSession,
  loginUser,
  logoutUser,
  signupUser,
  type AuthUser,
} from "./api/client";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (payload: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }) => Promise<void>;
  signup: (payload: {
    fullName: string;
    email: string;
    companyName: string;
    password: string;
    rememberMe?: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      setError(null);
      const session = await fetchAuthSession();
      setUser(session.user);
    } catch (err) {
      console.error("Failed to refresh auth session", err);
      setUser(null);
      setError("Could not verify your session.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (payload: {
      email: string;
      password: string;
      rememberMe?: boolean;
    }) => {
      setError(null);
      const response = await loginUser(payload);
      setUser(response.user);
    },
    [],
  );

  const signup = useCallback(
    async (payload: {
      fullName: string;
      email: string;
      companyName: string;
      password: string;
      rememberMe?: boolean;
    }) => {
      setError(null);
      const response = await signupUser(payload);
      setUser(response.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    setError(null);
    await logoutUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, signup, logout, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
