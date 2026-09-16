import type { DayEntry, JournalState } from '../types';
import { moodLabel } from '../types';
import { materializePhotosForExport } from './photoStore';

export { materializePhotosForExport } from './photoStore';

function hasContent(d: DayEntry): boolean {
  return !!(
    d.title.trim() ||
    d.story.trim() ||
    d.mood ||
    d.location.trim() ||
    d.photos.length
  );
}

function formatDateLong(id: string): string {
  const [y, m, day] = id.split('-').map(Number);
  const date = new Date(y, m - 1, day);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isDayEntry(value: unknown): value is DayEntry {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    typeof d.title === 'string' &&
    typeof d.story === 'string' &&
    Array.isArray(d.photos)
  );
}

/** Rough validation of a backup JSON object. */
export function validateBackup(data: unknown): data is JournalState {
  if (!data || typeof data !== 'object') return false;
  const s = data as Record<string, unknown>;
  if (typeof s.version !== 'number') return false;
  if (!s.days || typeof s.days !== 'object' || Array.isArray(s.days)) return false;
  for (const key of Object.keys(s.days as object)) {
    if (!isDayEntry((s.days as Record<string, unknown>)[key])) return false;
  }
  return true;
}

export function downloadBackup(state: JournalState): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  triggerDownload(`sillage-sauvegarde-${todayStamp()}.json`, blob);
}

export async function parseBackupFile(file: File): Promise<JournalState> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Fichier JSON invalide.');
  }
  if (!validateBackup(parsed)) {
    throw new Error('Ce fichier n’est pas une sauvegarde Sillage valide.');
  }
  return {
    ...parsed,
    eveningReminder: parsed.eveningReminder ?? false,
    eveningHour:
      typeof parsed.eveningHour === 'number' ? parsed.eveningHour : 21,
    eveningDismissedOn: parsed.eveningDismissedOn,
  };
}

function metaLine(day: DayEntry): string {
  const parts: string[] = [];
  const mood = moodLabel(day.mood);
  if (mood) parts.push(mood);
  if (day.location.trim()) parts.push(day.location.trim());
  return parts.join(' · ');
}

export function buildReadableHtml(state: JournalState): string {
  const days = Object.values(state.days)
    .filter(hasContent)
    .sort((a, b) => b.id.localeCompare(a.id));

  const exportDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const articles = days
    .map((day) => {
      const dateLabel = formatDateLong(day.id);
      const coffre = day.private
        ? ' <span class="coffre">Coffre</span>'
        : '';
      const title = day.title.trim()
        ? `<h2 class="title">${escapeHtml(day.title.trim())}</h2>`
        : '';
      const story = day.story.trim()
        ? `<div class="story">${escapeHtml(day.story).replace(/\n/g, '<br />')}</div>`
        : '';
      const meta = metaLine(day);
      const metaHtml = meta
        ? `<p class="meta">${escapeHtml(meta)}</p>`
        : '';
      const photos =
        day.photos.length > 0
          ? `<div class="photos">${day.photos
              .map(
                (p) =>
                  `<img src="${escapeHtml(p.url)}" alt="" loading="lazy" />`,
              )
              .join('')}</div>`
          : '';

      return `<article class="day">
  <header class="day-head">
    <time datetime="${escapeHtml(day.id)}">${escapeHtml(dateLabel)}</time>${coffre}
  </header>
  ${title}
  ${story}
  ${metaHtml}
  ${photos}
</article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sillage — lecture</title>
<style>
  :root {
    --paper: #f7f1e8;
    --ink: #2a241c;
    --muted: #6b6258;
    --rule: #ddd4c6;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 2.5rem 1.25rem 4rem;
    background: var(--paper);
    color: var(--ink);
    font-family: Georgia, "Times New Roman", Times, serif;
    line-height: 1.65;
    font-size: 1.05rem;
  }
  .wrap { max-width: 38rem; margin: 0 auto; }
  .doc-head {
    border-bottom: 1px solid var(--rule);
    padding-bottom: 1.25rem;
    margin-bottom: 2rem;
  }
  .doc-head h1 {
    margin: 0;
    font-size: 1.85rem;
    font-weight: normal;
    font-style: italic;
    letter-spacing: 0.02em;
  }
  .doc-head .export-date {
    margin: 0.4rem 0 0;
    color: var(--muted);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 0.85rem;
  }
  .day {
    padding: 1.75rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .day:last-of-type { border-bottom: none; }
  .day-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.65rem;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 0.8rem;
    text-transform: capitalize;
    color: var(--muted);
    letter-spacing: 0.02em;
  }
  .coffre {
    font-size: 0.7rem;
    text-transform: none;
    letter-spacing: 0.04em;
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
    color: var(--muted);
  }
  .title {
    margin: 0 0 0.75rem;
    font-size: 1.35rem;
    font-weight: normal;
    line-height: 1.3;
  }
  .story { white-space: normal; margin-bottom: 0.85rem; }
  .meta {
    margin: 0 0 1rem;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .photos {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .photos img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 2px;
  }
  .doc-foot {
    margin-top: 2.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--rule);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 0.78rem;
    color: var(--muted);
  }
  @media print {
    body { padding: 0; background: white; }
    .day { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="doc-head">
    <h1>Sillage</h1>
    <p class="export-date">Export du ${escapeHtml(exportDate)}</p>
  </header>
  ${articles || '<p class="meta">Aucun jour à exporter.</p>'}
  <footer class="doc-foot">
    Document généré localement. Imprime ou enregistre en PDF depuis le navigateur.
  </footer>
</div>
</body>
</html>`;
}

export async function downloadReadableExport(state: JournalState): Promise<void> {
  const full = await materializePhotosForExport(state);
  const html = buildReadableHtml(full);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(`sillage-lecture-${todayStamp()}.html`, blob);
}
