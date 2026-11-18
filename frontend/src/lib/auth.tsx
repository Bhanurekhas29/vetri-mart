// Who is logged in. Any screen can call useAuth() to read it or to log in and out.
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, setAuthFailureHandler } from './api';
import { queryClient } from './query-client';
import { clearTokens, getFlag, getTokens, saveTokens, setFlag } from './storage';
import type { AuthResponse, User } from './types';

type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: Status;
  user: User | null;
  // true once the user has been through the welcome screens (login or "continue as guest")
  entryDone: boolean;
  signIn: (auth: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  completeEntry: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);
const ENTRY_FLAG = 'entry_done';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [entryDone, setEntryDone] = useState(false);

  const markSignedOut = useCallback(() => {
    setUser(null);
    setStatus('signedOut');
    queryClient.clear(); // forget the previous person's data
  }, []);

  // When the app starts: check for a saved login and load the profile.
  useEffect(() => {
    setAuthFailureHandler(markSignedOut);
    let cancelled = false;
    (async () => {
      const [tokens, entry] = await Promise.all([getTokens(), getFlag(ENTRY_FLAG)]);
      if (cancelled) return;
      setEntryDone(entry);
      if (!tokens.refresh) {
        setStatus('signedOut');
        return;
      }
      try {
        const { data } = await api.get<User>('me/');
        if (cancelled) return;
        setUser(data);
        setStatus('signedIn');
      } catch {
        if (cancelled) return;
        // If the login was rejected, the failure handler has already logged us out.
        // If the phone is just offline, keep the saved login and let the user retry later.
        const after = await getTokens();
        setStatus(after.refresh ? 'signedIn' : 'signedOut');
      }
    })();
    return () => {
      cancelled = true;
      setAuthFailureHandler(null);
    };
  }, [markSignedOut]);

  const completeEntry = useCallback(async () => {
    setEntryDone(true);
    await setFlag(ENTRY_FLAG);
  }, []);

  const signIn = useCallback(
    async (auth: AuthResponse) => {
      await saveTokens(auth.access, auth.refresh);
      queryClient.clear();
      setUser(auth.user);
      setStatus('signedIn');
      await completeEntry();
    },
    [completeEntry],
  );

  const signOut = useCallback(async () => {
    const { refresh } = await getTokens();
    if (refresh) {
      try {
        await api.post('auth/logout/', { refresh });
      } catch {
        // Even if the server cannot be reached, we still log out on this phone.
      }
    }
    await clearTokens();
    markSignedOut();
  }, [markSignedOut]);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<User>('me/');
      setUser(data);
      setStatus('signedIn');
    } catch {
      // keep what we have
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ status, user, entryDone, signIn, signOut, setUser, refreshUser, completeEntry }),
    [status, user, entryDone, signIn, signOut, refreshUser, completeEntry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// A screen that sent the shopper to log in (for example the heart on a product page) can ask to be reopened afterwards.
// The request expires after 10 minutes, so abandoning the login does not send a later login somewhere unexpected.
let postLoginRoute: { path: string; at: number } | null = null;

export function setPostLoginRoute(path: string | null) {
  postLoginRoute = path ? { path, at: Date.now() } : null;
}

// After a successful login: close the login screens and land on the app (or return to where the shopper was).
export function finishAuth() {
  const back = postLoginRoute && Date.now() - postLoginRoute.at < 10 * 60 * 1000 ? postLoginRoute.path : null;
  postLoginRoute = null;
  // Go straight back to the app in ONE move. (Closing the login screens one after another could show a screen from
  // earlier in the stack, such as the code screen, for a moment.)
  if (router.canDismiss()) router.dismissTo('/(tabs)');
  else router.replace('/(tabs)');
  if (back) router.push(back);
}
