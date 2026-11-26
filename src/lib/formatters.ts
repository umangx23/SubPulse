import { BillingCycle, CurrencyCode, Subscription } from '../types/subpulse';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
};

export function getCurrencySymbol(currency: CurrencyCode): string {
  return CURRENCY_SYMBOLS[currency] || '$';
}

export function formatMoney(amount: number, currency: CurrencyCode = 'USD'): string {
  const sym = getCurrencySymbol(currency);
  const abs = Math.abs(amount);
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const formatted = abs.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${sym}${formatted}` : `${sym}${formatted}`;
}

export function getUserSharePrice(sub: Pick<Subscription, 'price' | 'isShared' | 'splitCount'>): number {
  const splits = sub.isShared && sub.splitCount > 1 ? sub.splitCount : 1;
  // Match clean rounding (e.g., 19.99 / 4 = 4.9975 -> 4.99 or 5.00; keep 2 decimals)
  return Math.floor((sub.price / splits) * 100 + 0.0001) / 100;
}

export function toMonthlyAmount(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
  }
}

export function getMonthlyShare(sub: Subscription): number {
  if (sub.status === 'paused' || sub.status === 'cancelled') return 0;
  const share = getUserSharePrice(sub);
  return toMonthlyAmount(share, sub.cycle);
}

export function formatCycleLabel(cycle: BillingCycle): string {
  return cycle.charAt(0).toUpperCase() + cycle.slice(1);
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatMonthDay(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatWeekdayAndDate(isoDate: string, todayIso = '2026-11-26'): string {
  const diff = daysBetween(todayIso, isoDate);
  if (diff === 0) return `Today · ${formatMonthDay(isoDate)}`;
  if (diff === 1) return `Tomorrow · ${formatMonthDay(isoDate)}`;
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${weekday} · ${formatMonthDay(isoDate)}`;
}

export function daysBetween(startIso: string, endIso: string): number {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const start = Date.UTC(sy, (sm || 1) - 1, sd || 1);
  const end = Date.UTC(ey, (em || 1) - 1, ed || 1);
  return Math.round((end - start) / 86400000);
}

export function computeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SB';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function subscriptionsToCSV(subs: Subscription[]): string {
  const headers = ['Service', 'Category', 'Cycle', 'Status', 'Next Renewal', 'Total Price', 'Split Count', 'Your Share', 'Currency', 'Notes'];
  const rows = subs.map((s) => [
    `"${s.name.replace(/"/g, '""')}"`,
    `"${s.category}"`,
    s.cycle,
    s.status,
    s.nextBillingDate,
    s.price.toFixed(2),
    String(s.splitCount),
    getUserSharePrice(s).toFixed(2),
    s.currency,
    `"${(s.notes || '').replace(/"/g, '""')}"`,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function parseCSVSubscriptions(csvText: string): Partial<Subscription>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const results: Partial<Subscription>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    const clean = cols.map((c) => c.replace(/^"|"$/g, '').trim());
    const name = clean[0];
    if (!name) continue;
    const price = parseFloat(clean[5] || clean[1] || '9.99') || 9.99;
    const cycleRaw = (clean[2] || 'monthly').toLowerCase();
    const cycle: BillingCycle =
      cycleRaw === 'weekly' || cycleRaw === 'quarterly' || cycleRaw === 'yearly' ? cycleRaw : 'monthly';
    const statusRaw = (clean[3] || 'active').toLowerCase();
    const status =
      statusRaw === 'trial' || statusRaw === 'paused' || statusRaw === 'cancelled' ? statusRaw : 'active';
    const nextBillingDate = /^\d{4}-\d{2}-\d{2}$/.test(clean[4] || '') ? clean[4] : '2026-12-05';
    results.push({
      name,
      price,
      cycle,
      status,
      nextBillingDate,
      notes: clean[9] || 'Imported from CSV',
    });
  }
  return results;
}

export function generateICSFeed(subs: Subscription[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SubPulse//Subscription Renewals//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:SubPulse Renewals',
  ];

  for (const sub of subs) {
    if (sub.status === 'cancelled' || sub.status === 'paused') continue;
    const dt = sub.nextBillingDate.replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${sub.id}@subpulse.app`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:${sub.name} renewal (${formatMoney(getUserSharePrice(sub), sub.currency)})`,
      `DESCRIPTION:${sub.status === 'trial' ? 'Free trial ending. ' : ''}Total bill: ${formatMoney(sub.price, sub.currency)}. Manage: ${sub.manageUrl}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
