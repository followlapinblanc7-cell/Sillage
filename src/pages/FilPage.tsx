import { Link } from 'react-router-dom';
import { BrandHeader } from '../components/BrandHeader';
import { DayCard } from '../components/DayCard';
import { SampleBanner } from '../components/SampleBanner';
import { WeekStrip } from '../components/WeekStrip';
import { type JournalApi } from '../hooks/useJournal';

interface Props {
  journal: JournalApi;
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

  if (contentDays.length === 0) {
    return (
      <div>
        <BrandHeader />
        {showEveningBanner ? (
          <div className="evening-banner" role="status">
            <div>
              <strong>Et si tu écrivais aujourd&apos;hui ?</strong>
              Un geste discret, rien d&apos;obligatoire.
            </div>
            <div className="evening-banner-actions">
              <Link to={`/jour/${today}`}>Écrire</Link>
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
            Écrire aujourd&apos;hui
          </Link>
          <p className="empty-hint">
            « Titre, histoire, puis le reste si tu veux. »
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BrandHeader />
      {showSamplesBanner ? <SampleBanner onRemove={removeSamples} /> : null}
      {showEveningBanner ? (
        <div className="evening-banner" role="status">
          <div>
            <strong>Et si tu écrivais aujourd&apos;hui ?</strong>
            Un geste discret, rien d&apos;obligatoire.
          </div>
          <div className="evening-banner-actions">
            <Link to={`/jour/${today}`}>Écrire</Link>
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

      {hasToday && todayEntry ? (
        <>
          <div className="section-label">Aujourd&apos;hui</div>
          <DayCard day={todayEntry} featured />
        </>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <Link to={`/jour/${today}`} className="btn-primary">
            Écrire aujourd&apos;hui
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
