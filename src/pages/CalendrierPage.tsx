import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDayNumber,
  formatMonthYear,
  monthGrid,
  shiftMonth,
  type JournalApi,
} from '../hooks/useJournal';

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_NAMES = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
];

interface Props {
  journal: JournalApi;
}

export function CalendrierPage({ journal }: Props) {
  const { today, visibleDays } = journal;
  const [anchor, setAnchor] = useState(today);

  const ym = anchor.slice(0, 7);
  const label = formatMonthYear(ym);
  const isCurrentMonth = today.slice(0, 7) === ym;

  const cells = useMemo(() => monthGrid(ym), [ym]);

  const writtenIds = useMemo(() => {
    const set = new Set<string>();
    for (const d of visibleDays) {
      if (d.id.startsWith(ym)) set.add(d.id);
    }
    return set;
  }, [visibleDays, ym]);

  const writtenCount = writtenIds.size;

  const sub =
    writtenCount === 0
      ? 'Pas encore de trace ce mois-ci.'
      : writtenCount === 1
        ? '1 jour gardé ce mois-ci'
        : `${writtenCount} jours gardés ce mois-ci`;

  return (
    <div className="calendrier-page">
      <Link to="/" className="btn-ghost calendrier-back">
        ← Fil
      </Link>
      <h1 className="page-title">Calendrier</h1>
      <p className="page-sub">{sub}</p>

      <div className="cal-block" aria-label={`Calendrier — ${label}`}>
        <div className="cal-head">
          <button
            type="button"
            className="week-nav"
            aria-label="Mois précédent"
            onClick={() => setAnchor((a) => shiftMonth(a, -1))}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="cal-label" aria-live="polite">
            {label}
          </div>
          <button
            type="button"
            className="week-nav"
            aria-label="Mois suivant"
            onClick={() => setAnchor((a) => shiftMonth(a, 1))}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {!isCurrentMonth ? (
          <div className="week-today-row">
            <button
              type="button"
              className="week-today-chip"
              onClick={() => setAnchor(today)}
            >
              Aujourd&apos;hui
            </button>
          </div>
        ) : null}

        <div className="cal-weekdays" aria-hidden="true">
          {DAY_LETTERS.map((letter, i) => (
            <span key={`${letter}-${i}`} className="cal-weekday">
              {letter}
            </span>
          ))}
        </div>

        <div
          className="cal-grid"
          role="grid"
          aria-label={label}
        >
          {cells.map((cell, i) => {
            const has = writtenIds.has(cell.id);
            const isToday = cell.id === today;
            const dayNum = formatDayNumber(cell.id);
            const weekday = DAY_NAMES[i % 7];
            const a11y = [
              `${weekday} ${dayNum}`,
              !cell.inMonth ? 'hors mois' : null,
              isToday ? "aujourd'hui" : null,
              has ? 'souvenir écrit' : 'vide',
            ]
              .filter(Boolean)
              .join(', ');

            return (
              <Link
                key={cell.id}
                to={`/jour/${cell.id}`}
                role="gridcell"
                className={[
                  'cal-day',
                  cell.inMonth ? '' : 'outside',
                  isToday ? 'today' : '',
                  has ? 'has-content' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={a11y}
                aria-current={isToday ? 'date' : undefined}
              >
                <span className="cal-day-num">{dayNum}</span>
                {has ? (
                  <span className="cal-day-dot" aria-hidden="true" />
                ) : (
                  <span className="cal-day-dot empty" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <p className="cal-hint">
        Touche un jour pour l&apos;ouvrir — même s&apos;il est encore vide.
      </p>
    </div>
  );
}
