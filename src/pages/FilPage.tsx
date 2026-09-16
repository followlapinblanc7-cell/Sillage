import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { DayCard } from '../components/DayCard';
import { SampleBanner } from '../components/SampleBanner';
import { WeekStrip } from '../components/WeekStrip';
import {
  coverPhoto,
  formatDateShort,
  pickTraceDay,
  type JournalApi,
} from '../hooks/useJournal';

interface Props {
  journal: JournalApi;
}

function oneLineExcerpt(text: string, max = 90): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
}

export function FilPage({ journal }: Props) {
  const {
    today,
    state,
    visibleDays,
    showSamplesBanner,
    removeSamples,
    eveningReminder,
    eveningHour,
    eveningDismissedOn,
    dismissEveningReminder,
    traceDayId,
    traceShownOn,
    traceDismissedOn,
    dismissTrace,
    ensureTraceDay,
  } = journal;

  const contentDays = visibleDays;
  const todayEntry = state.days[today];
  const hasToday =
    !!todayEntry &&
    !todayEntry.private &&
    contentDays.some((d) => d.id === today);
  const older = contentDays.filter((d) => d.id !== today);

  const localHour = new Date().getHours();
  // Banner when reminder is on, evening hour reached, and nothing
  // visible as "written today" on Fil (empty or private-only).
  const showEveningBanner =
    eveningReminder &&
    localHour >= eveningHour &&
    !hasToday &&
    eveningDismissedOn !== today;

  const traceDay = useMemo(() => {
    if (contentDays.length === 0) return null;
    if (older.length === 0) return null;
    if (traceDismissedOn === today) return null;
    return pickTraceDay(contentDays, today, {
      storedDayId: traceDayId,
      storedShownOn: traceShownOn,
    });
  }, [
    contentDays,
    older.length,
    today,
    traceDayId,
    traceShownOn,
    traceDismissedOn,
  ]);

  useEffect(() => {
    if (traceDay) ensureTraceDay(traceDay.id);
  }, [traceDay, ensureTraceDay]);

  if (contentDays.length === 0) {
    return (
      <div>
        <BrandHeader />
        {showEveningBanner ? (
          <div className="evening-banner" role="status">
            <div>
              <strong>Et si tu gardais un peu d&apos;aujourd&apos;hui ?</strong>
              Un geste discret, rien d&apos;obligatoire.
            </div>
            <div className="evening-banner-actions">
              <Link to={`/jour/${today}`}>Garder</Link>
              <button
                type="button"
                onClick={() => dismissEveningReminder(today)}
              >
                Plus tard
              </button>
            </div>
          </div>
        ) : null}
        <div className="empty-state">
          <p className="empty-quote">
            « Rien n&apos;est trop petit pour rester ici. »
          </p>
          <Link to={`/jour/${today}`} className="btn-primary">
            Garder aujourd&apos;hui
          </Link>
          <p className="empty-hint">
            « Titre, souvenir, puis le reste si tu veux. »
          </p>
        </div>
      </div>
    );
  }

  const traceThumb = traceDay ? coverPhoto(traceDay) : null;
  const traceTitle = traceDay
    ? traceDay.title.trim() || 'Sans titre'
    : '';
  const traceExcerpt = traceDay ? oneLineExcerpt(traceDay.story) : '';

  return (
    <div>
      <BrandHeader />
      {showSamplesBanner ? <SampleBanner onRemove={removeSamples} /> : null}
      {showEveningBanner ? (
        <div className="evening-banner" role="status">
          <div>
            <strong>Et si tu gardais un peu d&apos;aujourd&apos;hui ?</strong>
            Un geste discret, rien d&apos;obligatoire.
          </div>
          <div className="evening-banner-actions">
            <Link to={`/jour/${today}`}>Garder</Link>
            <button
              type="button"
              onClick={() => dismissEveningReminder(today)}
            >
              Plus tard
            </button>
          </div>
        </div>
      ) : null}

      <WeekStrip today={today} daysById={state.days} />

      {traceDay ? (
        <div className="trace-card" role="complementary" aria-label="Une trace">
          <Link to={`/jour/${traceDay.id}`} className="trace-card-main">
            {traceThumb ? (
              <img
                className="trace-card-thumb"
                src={traceThumb}
                alt=""
                loading="lazy"
              />
            ) : null}
            <div className="trace-card-body">
              <p className="trace-card-eyebrow">Une trace</p>
              <p className="trace-card-date">{formatDateShort(traceDay.id)}</p>
              <h3 className="trace-card-title">{traceTitle}</h3>
              {traceExcerpt ? (
                <p className="trace-card-excerpt">{traceExcerpt}</p>
              ) : null}
            </div>
          </Link>
          <button
            type="button"
            className="trace-card-dismiss"
            onClick={() => dismissTrace(today)}
          >
            Plus tard
          </button>
        </div>
      ) : null}

      {hasToday && todayEntry ? (
        <>
          <div className="section-label">Aujourd&apos;hui</div>
          <DayCard day={todayEntry} featured />
        </>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <Link to={`/jour/${today}`} className="btn-primary">
            Garder aujourd&apos;hui
          </Link>
        </div>
      )}

      {older.length > 0 ? (
        <>
          <div className="section-label">Avant aujourd&apos;hui</div>
          {older.map((d) => (
            <DayCard key={d.id} day={d} />
          ))}
        </>
      ) : null}
    </div>
  );
}
