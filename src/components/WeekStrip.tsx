import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DayEntry } from '../types';
import {
  coverPhoto,
  formatDayNumber,
  formatWeekRange,
  hasContent,
  shiftWeek,
  weekDaysAround,
} from '../hooks/useJournal';

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface Props {
  today: string;
  daysById: Record<string, DayEntry | undefined>;
}

export function WeekStrip({ today, daysById }: Props) {
  const [anchorDate, setAnchorDate] = useState(today);

  const ids = useMemo(() => weekDaysAround(anchorDate), [anchorDate]);
  const isCurrentWeek = ids.includes(today);
  const label = isCurrentWeek ? 'Cette semaine' : formatWeekRange(ids);
  const isPastWeek = ids[ids.length - 1] < today;

  return (
    <div className="week-block">
      <div className="week-head">
        <button
          type="button"
          className="week-nav"
          aria-label="Semaine précédente"
          onClick={() => setAnchorDate((d) => shiftWeek(d, -1))}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="week-label">{label}</div>
        <button
          type="button"
          className="week-nav"
          aria-label="Semaine suivante"
          onClick={() => setAnchorDate((d) => shiftWeek(d, 1))}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {!isCurrentWeek ? (
        <div className="week-today-row">
          <button
            type="button"
            className="week-today-chip"
            onClick={() => setAnchorDate(today)}
          >
            Aujourd&apos;hui
          </button>
        </div>
      ) : null}

      <div className="week-strip">
        {ids.map((id, i) => {
          const entry = daysById[id];
          const isPrivate = entry?.private === true;
          const cover =
            entry && !isPrivate ? coverPhoto(entry) : null;
          const isToday = id === today;
          const has =
            entry && !isPrivate ? hasContent(entry) : false;
          return (
            <Link
              key={id}
              to={`/jour/${id}`}
              className={`week-day${isToday ? ' today' : ''}${has ? ' has-content' : ''}`}
            >
              <span>{DAY_LETTERS[i]}</span>
              <span className="ring">
                {cover ? (
                  <img src={cover} alt="" loading="lazy" />
                ) : (
                  formatDayNumber(id)
                )}
              </span>
            </Link>
          );
        })}
      </div>

      {!isCurrentWeek && isPastWeek ? (
        <p className="week-hint">Touche un jour pour l&apos;ouvrir.</p>
      ) : null}
    </div>
  );
}
