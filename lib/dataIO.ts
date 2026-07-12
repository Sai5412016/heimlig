// lib/dataIO.ts — CSV export/import helpers for transactions
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Transaction, Member } from './supabase';

const DELIM = ';';

function escape(value: string): string {
  let v = value ?? '';
  // Formula-injection guard: a field starting with =, +, -, @ (or tab/CR) is interpreted as
  // a formula by Excel/Sheets when the CSV is opened — a malicious transaction description
  // (e.g. from a shared household member) could run a formula on whoever opens the export.
  // Prefixing with a single quote forces it to be read as plain text.
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (v.includes(DELIM) || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

// Build a CSV string from the full transaction history
export function buildTransactionsCsv(transactions: Transaction[], memberNameById: Record<string, string>): string {
  const header = ['Datum', 'Typ', 'Kategorie', 'Betrag', 'Beschreibung', 'Mitglied'];
  const rows = transactions.map(t => [
    t.transaction_date,
    t.type === 'income' ? 'Einnahme' : 'Ausgabe',
    t.category,
    String(t.amount),
    t.description ?? '',
    t.member_id ? (memberNameById[t.member_id] ?? '') : '',
  ].map(escape).join(DELIM));
  return [header.join(DELIM), ...rows].join('\n');
}

// Write a CSV file to the cache dir and open the share sheet
export async function exportCsv(filename: string, content: string): Promise<string> {
  const file = new File(Paths.cache, filename);
  try { if (file.exists) file.delete(); } catch {}
  file.create();
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export teilen', UTI: 'public.comma-separated-values-text' });
  }
  return file.uri;
}

// Split a single CSV line respecting quoted fields
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

// Parses both German-locale amounts ("1.234,56") and international ones ("1,234.56" /
// "1234.56"). Whichever separator (',' or '.') appears LAST and is followed by 1-2 digits is
// treated as the decimal point; anything before it (including the other separator type) is
// stripped as a thousands grouping. A trailing separator followed by 3+ digits has no decimal
// part and is treated as pure grouping (e.g. "1.234" -> 1234, not 1.234).
function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9,.-]/g, '');
  if (!cleaned) return NaN;
  const lastSep = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  if (lastSep === -1) return parseFloat(cleaned);

  const fraction = cleaned.slice(lastSep + 1);
  const isDecimalSeparator = fraction.length === 1 || fraction.length === 2;
  let whole = cleaned.slice(0, lastSep).replace(/[,.]/g, '');
  let sign = '';
  if (whole.startsWith('-')) { sign = '-'; whole = whole.slice(1); }

  return isDecimalSeparator
    ? parseFloat(`${sign}${whole}.${fraction}`)
    : parseFloat(`${sign}${whole}${fraction}`);
}

export interface ParsedTxRow {
  transaction_date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description?: string;
  memberName?: string;
}

// Parse a transactions CSV (semicolon or comma delimited). Tolerant of column order via header.
export function parseTransactionsCsv(content: string): ParsedTxRow[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delim = lines[0].includes(';') ? ';' : ',';
  const header = splitLine(lines[0], delim).map(h => h.trim().toLowerCase());
  const idx = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));

  const di = idx(['datum', 'date']);
  const ti = idx(['typ', 'type']);
  const ci = idx(['kategorie', 'category']);
  const ai = idx(['betrag', 'amount']);
  const desci = idx(['beschreibung', 'description', 'notiz']);
  const mi = idx(['mitglied', 'member', 'name']);

  const rows: ParsedTxRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], delim);
    const amount = parseAmount(cols[ai] ?? '');
    if (isNaN(amount)) continue;

    const typeRaw = (cols[ti] ?? '').toLowerCase();
    const type: 'income' | 'expense' = (typeRaw.includes('ein') || typeRaw.includes('income')) ? 'income' : 'expense';

    let date = (cols[di] ?? '').trim();
    // Accept DD.MM.YYYY and convert to YYYY-MM-DD
    const m = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) date = `${m[3]}-${m[2]}-${m[1]}`;
    // An unparseable date is a sign the row/column mapping is off — skip the row instead of
    // silently re-dating a historical transaction to "today".
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    rows.push({
      transaction_date: date,
      type,
      category: (cols[ci] ?? 'Sonstiges').trim() || 'Sonstiges',
      amount: Math.abs(amount),
      description: desci >= 0 ? (cols[desci] ?? '').trim() || undefined : undefined,
      memberName: mi >= 0 ? (cols[mi] ?? '').trim() || undefined : undefined,
    });
  }
  return rows;
}

// Map a member name back to an id (case-insensitive)
export function memberIdByName(members: Member[], name?: string): string | undefined {
  if (!name) return undefined;
  const found = members.find(m => m.display_name.toLowerCase() === name.toLowerCase());
  return found?.id;
}
