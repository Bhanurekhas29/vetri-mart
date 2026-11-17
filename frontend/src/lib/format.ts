// Turns numbers from the server into text for the screen.

// "1099.00" -> "₹1,099"   "5990.50" -> "₹5,990.50"   (Indian grouping: 12,34,567)
export function formatRupees(amount: string | number): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '₹0';
  const hasPaise = Math.round(Math.abs(n) * 100) % 100 !== 0;
  const [whole, paise] = Math.abs(n).toFixed(hasPaise ? 2 : 0).split('.');
  let grouped = whole;
  if (whole.length > 3) {
    const lastThree = whole.slice(-3);
    const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${lastThree}`;
  }
  return `${n < 0 ? '-' : ''}₹${grouped}${paise ? `.${paise}` : ''}`;
}

// 3725 -> "01:02:05"    90061 -> "1d 01:01:01"
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${days > 0 ? `${days}d ` : ''}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// "just now", "5 min ago", "3 hours ago", "Yesterday", then the date ("12 Nov 2026").
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 45) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// "12 Nov 2026"
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// "12 Nov, 4:30 pm" (the phone's own time zone; the server sends UTC)
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}
