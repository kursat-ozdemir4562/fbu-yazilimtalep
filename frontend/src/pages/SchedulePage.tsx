import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/ui';
import { apiRequest } from '../lib/api';
import { DAY_API_VALUES, WEEK_DAYS } from '../lib/constants';
import { classNames, normalizePage, unwrap } from '../lib/utils';
import type { CourseScheduleEntry, Laboratory } from '../types';

const dayNameByApi = Object.fromEntries(
  Object.entries(DAY_API_VALUES).map(([label, api]) => [api, label]),
);
const DAY_ORDER = WEEK_DAYS.map((day) => DAY_API_VALUES[day]);

type WeekDay = (typeof WEEK_DAYS)[number];

function toMinutes(time: string): number {
  const parts = time.slice(0, 5).split(':');
  return Number(parts[0] ?? 0) * 60 + Number(parts[1] ?? 0);
}

interface DayEntry extends CourseScheduleEntry {
  conflict: boolean;
}

function withConflicts(entries: CourseScheduleEntry[]): DayEntry[] {
  const sorted = [...entries].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return sorted.map((entry) => ({
    ...entry,
    conflict: entries.some(
      (other) =>
        other.requestId !== entry.requestId &&
        other.laboratoryId === entry.laboratoryId &&
        toMinutes(other.startTime) < toMinutes(entry.endTime) &&
        toMinutes(other.endTime) > toMinutes(entry.startTime),
    ),
  }));
}

export function SchedulePage() {
  const [laboratoryId, setLaboratoryId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDay, setSelectedDay] = useState<WeekDay | null>(null);

  const scheduleQuery = useQuery({
    queryKey: ['course-schedule'],
    queryFn: async () => unwrap<CourseScheduleEntry[]>(await apiRequest('/requests/schedule')),
  });
  const labsQuery = useQuery({
    queryKey: ['laboratories', 'schedule-filter'],
    queryFn: async () =>
      normalizePage<Laboratory>(
        await apiRequest('/laboratories?page=1&pageSize=100&isActive=true'),
        1,
        100,
      ).items,
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr-TR');
    return (scheduleQuery.data ?? []).filter((entry) => {
      if (laboratoryId && entry.laboratoryId !== laboratoryId) return false;
      if (!term) return true;
      return [entry.courseCode, entry.courseName, entry.instructorEmail, entry.ownerFullName]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('tr-TR').includes(term));
    });
  }, [scheduleQuery.data, laboratoryId, search]);

  const byDay = useMemo(() => {
    const map = new Map<WeekDay, DayEntry[]>();
    for (const day of WEEK_DAYS) {
      const apiDay = DAY_API_VALUES[day];
      map.set(day, withConflicts(filtered.filter((entry) => entry.dayOfWeek === apiDay)));
    }
    return map;
  }, [filtered]);

  const activeDay: WeekDay =
    selectedDay ?? WEEK_DAYS.find((day) => (byDay.get(day)?.length ?? 0) > 0) ?? WEEK_DAYS[0];
  const activeEntries = byDay.get(activeDay) ?? [];

  const conflicts = useMemo(
    () =>
      [...byDay.values()]
        .flat()
        .filter((entry) => entry.conflict)
        .sort((a, b) => {
          const dayDiff = DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
          return dayDiff !== 0 ? dayDiff : toMinutes(a.startTime) - toMinutes(b.startTime);
        }),
    [byDay],
  );

  return (
    <>
      <PageHeader
        eyebrow="Yalnızca sistem yöneticileri görebilir"
        title="Ders Programı"
        description="Gönderilmiş taleplerdeki ders kodu, laboratuvar, gün ve saat bilgilerinden oluşturulan haftalık program."
      />
      <Card className="schedule-toolbar">
        <label className="field">
          <span>Laboratuvar</span>
          <select value={laboratoryId} onChange={(event) => setLaboratoryId(event.target.value)}>
            <option value="">Tüm laboratuvarlar</option>
            {(labsQuery.data ?? []).map((lab) => (
              <option value={lab.id} key={lab.id}>
                {lab.name}
              </option>
            ))}
          </select>
        </label>
        <label className="search-field">
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ders kodu, ders adı veya hoca ara…"
          />
        </label>
      </Card>

      {scheduleQuery.isLoading ? (
        <LoadingState label="Program yükleniyor…" />
      ) : scheduleQuery.isError ? (
        <ErrorState error={scheduleQuery.error} onRetry={() => void scheduleQuery.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Gösterilecek ders programı yok"
          description="Seçilen laboratuvar/arama ölçütlerine uyan, gönderilmiş bir talep bulunamadı."
        />
      ) : (
        <>
          <Card className="schedule-days-card">
            <div className="schedule-day-tabs" role="tablist" aria-label="Haftanın günleri">
              {WEEK_DAYS.map((day) => {
                const entries = byDay.get(day) ?? [];
                const conflictCount = entries.filter((entry) => entry.conflict).length;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeDay === day}
                    className={classNames('schedule-day-tab', activeDay === day && 'schedule-day-tab--active')}
                    key={day}
                    onClick={() => setSelectedDay(day)}
                  >
                    <span className="schedule-day-tab__name">{day}</span>
                    <span className="schedule-day-tab__count">{entries.length}</span>
                    {conflictCount > 0 && (
                      <AlertTriangle className="schedule-day-tab__conflict" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            {activeEntries.length === 0 ? (
              <EmptyState
                title={`${activeDay} için ders yok`}
                description="Seçilen laboratuvar/arama ölçütlerine uyan, bu güne ait gönderilmiş bir talep bulunamadı."
              />
            ) : (
              <ul className="schedule-day-list">
                {activeEntries.map((entry) => (
                  <li key={`${entry.requestId}-${entry.laboratoryId}-${entry.startTime}`}>
                    <Link
                      to={`/talepler/${entry.requestId}`}
                      className={classNames(
                        'schedule-day-item',
                        entry.conflict && 'schedule-day-item--conflict',
                      )}
                    >
                      <div className="schedule-day-item__time">
                        {entry.startTime.slice(0, 5)}–{entry.endTime.slice(0, 5)}
                      </div>
                      <div className="schedule-day-item__body">
                        <div className="schedule-day-item__title">
                          <strong>{entry.courseCode}</strong>
                          <span>{entry.courseName}</span>
                        </div>
                        <div className="schedule-day-item__meta">
                          <span>{entry.laboratoryName}</span>
                          {entry.ownedSections.length > 0 && (
                            <span>Section {entry.ownedSections.join(', ')}</span>
                          )}
                          <span>Sahip: {entry.ownerFullName || '—'}</span>
                          <span>Ders hocası: {entry.instructorEmail || '—'}</span>
                        </div>
                      </div>
                      <div className="schedule-day-item__status">
                        {entry.conflict && (
                          <span className="schedule-day-item__conflict-badge">
                            <AlertTriangle aria-hidden="true" />
                            Çakışma
                          </span>
                        )}
                        <StatusBadge status={entry.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="schedule-conflicts">
            <div className="detail-card__heading">
              <div>
                <CalendarDays />
                <h2>Çakışan kayıtlar</h2>
              </div>
              <small>{conflicts.length} kayıt aynı laboratuvar, gün ve saat aralığını paylaşıyor.</small>
            </div>
            {conflicts.length === 0 ? (
              <EmptyState
                title="Çakışma bulunamadı"
                description="Görüntülenen kapsamda aynı laboratuvarı aynı gün ve saatte kullanan birden fazla talep yok."
              />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Gün</th>
                      <th>Saat</th>
                      <th>Laboratuvar</th>
                      <th>Ders</th>
                      <th>Durum</th>
                      <th>Talep sahibi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflicts.map((entry) => (
                      <tr key={`${entry.requestId}-${entry.laboratoryId}-${entry.startTime}-conflict`}>
                        <td>{dayNameByApi[entry.dayOfWeek] ?? entry.dayOfWeek}</td>
                        <td>
                          {entry.startTime.slice(0, 5)}–{entry.endTime.slice(0, 5)}
                        </td>
                        <td>{entry.laboratoryName}</td>
                        <td>
                          <Link to={`/talepler/${entry.requestId}`} className="conflict-course-link">
                            <strong>{entry.courseCode}</strong>
                            <small>{entry.courseName}</small>
                          </Link>
                        </td>
                        <td>
                          <StatusBadge status={entry.status} />
                        </td>
                        <td>{entry.ownerFullName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
