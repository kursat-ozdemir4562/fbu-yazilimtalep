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

const HOUR_HEIGHT = 64;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

function toMinutes(time: string): number {
  const parts = time.slice(0, 5).split(':');
  return Number(parts[0] ?? 0) * 60 + Number(parts[1] ?? 0);
}

interface PositionedEntry extends CourseScheduleEntry {
  top: number;
  height: number;
  left: number;
  width: number;
  conflict: boolean;
}

function layoutDay(entries: CourseScheduleEntry[], startHour: number): PositionedEntry[] {
  const sorted = [...entries].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  const trackEnds: number[] = [];
  const withTrack = sorted.map((entry) => {
    const start = toMinutes(entry.startTime);
    const end = toMinutes(entry.endTime);
    let trackIndex = trackEnds.findIndex((trackEnd) => trackEnd <= start);
    if (trackIndex === -1) {
      trackIndex = trackEnds.length;
      trackEnds.push(end);
    } else {
      trackEnds[trackIndex] = end;
    }
    return { entry, trackIndex, start, end };
  });
  const trackCount = trackEnds.length || 1;
  return withTrack.map(({ entry, trackIndex, start, end }) => ({
    ...entry,
    top: ((start - startHour * 60) / 60) * HOUR_HEIGHT,
    height: Math.max(30, ((end - start) / 60) * HOUR_HEIGHT - 4),
    left: (trackIndex / trackCount) * 100,
    width: (1 / trackCount) * 100,
    conflict: entries.some(
      (other) =>
        other.requestId !== entry.requestId &&
        other.laboratoryId === entry.laboratoryId &&
        toMinutes(other.startTime) < end &&
        toMinutes(other.endTime) > start,
    ),
  }));
}

export function SchedulePage() {
  const [laboratoryId, setLaboratoryId] = useState('');
  const [search, setSearch] = useState('');

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

  const { startHour, endHour } = useMemo(() => {
    if (filtered.length === 0) return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
    const allMinutes = filtered.flatMap((entry) => [toMinutes(entry.startTime), toMinutes(entry.endTime)]);
    const start = Math.min(DEFAULT_START_HOUR, Math.floor(Math.min(...allMinutes) / 60));
    const end = Math.max(DEFAULT_END_HOUR, Math.ceil(Math.max(...allMinutes) / 60));
    return { startHour: start, endHour: Math.min(24, end) };
  }, [filtered]);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);

  const byDay = useMemo(() => {
    const map = new Map<string, PositionedEntry[]>();
    for (const day of WEEK_DAYS) {
      const apiDay = DAY_API_VALUES[day];
      map.set(day, layoutDay(filtered.filter((entry) => entry.dayOfWeek === apiDay), startHour));
    }
    return map;
  }, [filtered, startHour]);

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
          <Card className="schedule-grid-card">
            <div className="schedule-grid">
              <div className="schedule-grid__corner" />
              {WEEK_DAYS.map((day) => (
                <div className="schedule-grid__day-header" key={day}>
                  {day}
                </div>
              ))}
              <div className="schedule-grid__hours">
                {hours.map((hour) => (
                  <div className="schedule-grid__hour-label" key={hour} style={{ height: HOUR_HEIGHT }}>
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              {WEEK_DAYS.map((day) => (
                <div
                  className="schedule-grid__day"
                  key={day}
                  style={{ height: hours.length * HOUR_HEIGHT }}
                >
                  {hours.slice(1).map((hour) => (
                    <div
                      className="schedule-grid__hour-line"
                      key={hour}
                      style={{ top: (hour - startHour) * HOUR_HEIGHT }}
                    />
                  ))}
                  {byDay.get(day)?.map((entry) => (
                    <Link
                      to={`/talepler/${entry.requestId}`}
                      className={classNames('schedule-event', entry.conflict && 'schedule-event--conflict')}
                      key={`${entry.requestId}-${entry.laboratoryId}-${entry.startTime}`}
                      style={{
                        top: entry.top,
                        height: entry.height,
                        left: `${entry.left}%`,
                        width: `calc(${entry.width}% - 4px)`,
                      }}
                      title={`${entry.courseCode} — ${entry.courseName} (Section ${entry.ownedSections.join(', ')})\n${entry.laboratoryName}\n${entry.startTime.slice(0, 5)}–${entry.endTime.slice(0, 5)}\nSahip: ${entry.ownerFullName ?? '—'}\nDers hocası: ${entry.instructorEmail ?? '—'}\n\nTalebi görüntülemek için tıklayın`}
                    >
                      {entry.conflict && <AlertTriangle className="schedule-event__conflict-icon" aria-hidden="true" />}
                      <strong>{entry.courseCode}</strong>
                      <span>{entry.laboratoryName}</span>
                      <small>
                        {entry.startTime.slice(0, 5)}–{entry.endTime.slice(0, 5)}
                      </small>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
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
