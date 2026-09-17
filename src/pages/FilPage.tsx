import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { CeJourLa } from '../components/CeJourLa';
import { DayCard } from '../components/DayCard';
import { SampleBanner } from '../components/SampleBanner';
import { WeekStrip } from '../components/WeekStrip';
import {
  coverPhoto,
  formatDateShort,
  pickTraceDay,
  sameDayPastYears,
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

  const ceJourLaDays = useMemo(
    () => sameDayPastYears(contentDays, today),
    [contentDays, today],
  );
  const ceJourLaIds = useMemo(
    () => new Set(ceJourLaDays.map((d) => d.id)),
    [ceJourLaDays],
  );

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
    // Keep distinct from « Ce jour-là » (same month-day across years).
    const pool = contentDays.filter((d) => !ceJourLaIds.has(d.id));
    if (pool.every((d) => d.id === today)) return null;
    return pickTraceDay(pool, today, {
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
    ceJourLaIds,
  ]);

  useEffect(() => {
    if (traceDay) ensureTraceDay(traceDay.id);
  }, [traceDay, ensureTraceDay]);

  const tracesList = useMemo(() => {
    return older.filter(
      (d) => d.id !== traceDay?.id && !ceJourLaIds.has(d.id),
    );
  }, [older, traceDay, ceJourLaIds]);

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
          <div className="fil-cal-row" style={{ justifyContent: 'center', marginTop: 18 }}>
            <Link to="/calendrier" className="fil-cal-link">
              Calendrier
            </Link>
          </div>
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

      <div className="fil-cal-row">
        <Link to="/calendrier" className="fil-cal-link">
          Calendrier
        </Link>
      </div>

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

      <CeJourLa days={ceJourLaDays} />

      {traceDay || tracesList.length > 0 ? (
        <section className="traces-section" aria-label="Traces">
          <div className="section-label">Traces</div>
          <p className="traces-sub">Des jours que tu as déjà gardés.</p>

          {traceDay ? (
            <div
              className="trace-hero"
              role="complementary"
              aria-label="Une trace"
            >
              <Link to={`/jour/${traceDay.id}`} className="trace-hero-main">
                {traceThumb ? (
                  <img
                    className="trace-hero-cover"
                    src={traceThumb}
                    alt=""
                    loading="lazy"
                  />
                ) : null}
                <div className="trace-hero-body">
                  <p className="trace-hero-eyebrow">Une trace</p>
                  <p className="trace-hero-date">
                    {formatDateShort(traceDay.id)}
                  </p>
                  <h3 className="trace-hero-title">{traceTitle}</h3>
                  {traceExcerpt ? (
                    <p className="trace-hero-excerpt">{traceExcerpt}</p>
                  ) : null}
                  <p className="trace-hero-line">
                    Pour ne pas oublier que c&apos;était réel.
                  </p>
                </div>
              </Link>
              <button
                type="button"
                className="trace-hero-dismiss"
                onClick={() => dismissTrace(today)}
              >
                Plus tard
              </button>
            </div>
          ) : null}

          {tracesList.map((d) => (
            <DayCard key={d.id} day={d} showDate showCover />
          ))}
        </section>
      ) : null}
    </div>
  );
}
