// The delivery pincode shown in the Home bar (and used later for delivery checks).
//
// Which pincode wins:
//   1. one the user typed (the phone remembers it),
//   2. otherwise the pincode of their default address, when they are logged in,
//   3. otherwise none: the app asks once.
import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from './api';
import { useAuth } from './auth';
import { getFlag, getText, setFlag, setText } from './storage';
import type { Address } from './types';

const PINCODE_KEY = 'pincode';
const ASKED_FLAG = 'pincode_asked';

type PincodeState = {
  pincode: string | null;
  ready: boolean; // false until the phone's memory has been read
  askedBefore: boolean; // true once the user has been shown the question (answered or skipped)
  setPincode: (value: string) => Promise<void>;
  markAsked: () => Promise<void>;
};

const PincodeContext = createContext<PincodeState | null>(null);

export function PincodeProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [saved, setSaved] = useState<string | null>(null);
  const [askedBefore, setAskedBefore] = useState(true); // assume asked until we know, so the question never flashes
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [text, asked] = await Promise.all([getText(PINCODE_KEY), getFlag(ASKED_FLAG)]);
      if (cancelled) return;
      setSaved(text && /^\d{6}$/.test(text) ? text : null);
      setAskedBefore(asked);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A logged-in user's default address gives a pincode with no typing.
  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => (await api.get<Address[]>('addresses/')).data,
    enabled: status === 'signedIn',
  });
  const defaultPincode = addresses?.find((a) => a.is_default)?.pincode ?? null;

  const setPincode = useCallback(async (value: string) => {
    setSaved(value);
    setAskedBefore(true);
    await Promise.all([setText(PINCODE_KEY, value), setFlag(ASKED_FLAG)]);
  }, []);

  const markAsked = useCallback(async () => {
    setAskedBefore(true);
    await setFlag(ASKED_FLAG);
  }, []);

  const value = useMemo<PincodeState>(
    () => ({ pincode: saved ?? defaultPincode, ready, askedBefore, setPincode, markAsked }),
    [saved, defaultPincode, ready, askedBefore, setPincode, markAsked],
  );

  return <PincodeContext.Provider value={value}>{children}</PincodeContext.Provider>;
}

export function usePincode(): PincodeState {
  const ctx = useContext(PincodeContext);
  if (!ctx) throw new Error('usePincode must be used inside PincodeProvider');
  return ctx;
}
