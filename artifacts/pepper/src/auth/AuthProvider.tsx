import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useLogin,
  useLogout,
  useSignup,
  getGetMeQueryKey,
  type AuthUser,
} from "@workspace/api-client-react";
import {
  registerPasskey as passkeyRegister,
  loginPasskey as passkeyLogin,
  passkeySupported as isPasskeySupported,
} from "./passkey";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  registerPasskey: (email: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  passkeySupported: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetMe();
  const signupMutation = useSignup();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const user = data?.user ?? null;

  const invalidateAll = useCallback(async () => {
    // Identity changed. Await ONLY the identity query so auth-gated routes flip
    // immediately (no redirect bounce), then invalidate everything else in the
    // background. Awaiting a blanket invalidateQueries() blocks on EVERY active
    // query's refetch — a single slow/stuck one (or a transient 502 that then
    // retries) left the auth form stuck on "Just a moment…" forever even though
    // login/signup had already succeeded and the session cookie was set.
    await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const signup = useCallback(
    async (email: string, password: string) => {
      await signupMutation.mutateAsync({ data: { email, password } });
      await invalidateAll();
    },
    [signupMutation, invalidateAll],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ data: { email, password } });
      await invalidateAll();
    },
    [loginMutation, invalidateAll],
  );

  const registerPasskey = useCallback(
    async (email: string) => {
      await passkeyRegister(email);
      await invalidateAll();
    },
    [invalidateAll],
  );

  const loginWithPasskey = useCallback(async () => {
    await passkeyLogin();
    await invalidateAll();
  }, [invalidateAll]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    await invalidateAll();
  }, [logoutMutation, invalidateAll]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user != null,
      signup,
      login,
      registerPasskey,
      loginWithPasskey,
      passkeySupported: isPasskeySupported(),
      logout,
      refresh,
    }),
    [
      user,
      isLoading,
      signup,
      login,
      registerPasskey,
      loginWithPasskey,
      logout,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
