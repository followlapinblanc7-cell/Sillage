import { Link } from 'react-router-dom';
import type { DayEntry } from '../types';
import {
  coverPhoto,
  formatDayNumber,
  hasContent,
  weekDaysAround,
} from '../hooks/useJournal';

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface Props {
  today: string;
  daysById: Record<string, DayEntry | undefined>;
}

export function WeekStrip({ today, daysById }: Props) {
  const ids = weekDaysAround(today);

  return (
    <div className="week-block">
      <div className="week-label">La semaine</div>
      <div className="week-strip">
        {ids.map((id, i) => {
          const entry = daysById[id];
          const cover = entry ? coverPhoto(entry) : null;
          const isToday = id === today;
          const has = entry ? hasContent(entry) : false;
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
    </div>
  );
}
