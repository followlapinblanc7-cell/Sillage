import { Link } from 'react-router-dom';
import type { DayEntry } from '../types';
import { moodLabel } from '../types';
import { coverPhoto, formatDateShort } from '../hooks/useJournal';

function excerpt(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trimEnd() + '…';
}

interface Props {
  day: DayEntry;
  featured?: boolean;
  showDate?: boolean;
}

export function DayCard({ day, featured, showDate = false }: Props) {
  const cover = coverPhoto(day);
  const mood = moodLabel(day.mood);
  const n = day.photos.length;
  const metaParts = [
    showDate ? formatDateShort(day.id) : null,
    mood || null,
    day.location.trim() || null,
    n ? `${n} photo${n > 1 ? 's' : ''}` : null,
  ].filter(Boolean);

  return (
    <Link
      to={`/jour/${day.id}`}
      className={`day-card${featured ? ' featured' : ''}`}
    >
      {cover && featured ? (
        <img className="day-card-thumb" src={cover} alt="" loading="lazy" />
      ) : null}
      <h3 className="day-card-title">
        {day.title.trim() || 'Sans titre'}
      </h3>
      {day.story.trim() ? (
        <p className="day-card-excerpt">{excerpt(day.story)}</p>
      ) : null}
      {metaParts.length > 0 ? (
        <div className="day-card-meta">{metaParts.join(' · ')}</div>
      ) : null}
    </Link>
  );
}
