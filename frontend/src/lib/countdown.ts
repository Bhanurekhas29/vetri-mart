// A countdown that ticks every second.
//
// The server says "N seconds left" at the moment it answers. We count down from the moment the phone
// received that answer, so a wrong clock on the phone cannot make the timer wrong.
import { useEffect, useState } from 'react';

export function useCountdown(secondsLeft: number, receivedAt: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return Math.max(0, Math.round((receivedAt + secondsLeft * 1000 - now) / 1000));
}
