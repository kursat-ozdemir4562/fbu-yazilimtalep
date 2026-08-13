import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Filter,
  LayoutGrid,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Fragment, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  StatusBadge,
} from '../components/ui';
import { apiRequest } from '../lib/api';
import { DAY_API_VALUES, STATUS_LABELS, STATUS_TONES, WEEK_DAYS } from '../lib/constants';
import { classNames, normalizePage, unwrap } from '../lib/utils';
import type { CourseScheduleEntry, Laboratory, RequestStatus } from '../types';

const dayNameByApi = Object.fromEntries(
  Object.entries(DAY_API_VALUES).map(([label, api]) => [api, label]),
);

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

interface ScheduleFilters {
  search: string;
  day: WeekDay | '';
  laboratoryId: string;
  status: RequestStatus | '';
  conflictOnly: boolean;
}

const emptyFilters: ScheduleFilters = {
  search: '',
  day: '',
  laboratoryId: '',
  status: '',
  conflictOnly: false,
};

const filterLabels: Record<keyof ScheduleFilters, string> = {
  search: 'Arama',
  day: 'Gün',
  laboratoryId: 'Laboratuvar',
  status: 'Durum',
  conflictOnly: 'Çakışma',
};

function ScheduleFilterBar({
  value,
  labs,
  onApply,
}: {
  value: ScheduleFilters;
  labs: Laboratory[];
  onApply: (filters: ScheduleFilters) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [expanded, setExpanded] = useState(false);
  const activeFilters = (Object.keys(value) as (keyof ScheduleFilters)[]).filter((key) =>
    key === 'conflictOnly' ? value.conflictOnly : Boolean(value[key]),
  );

  const filterLabelValue = (key: keyof ScheduleFilters): string => {
    if (key === 'laboratoryId') return labs.find((lab) => lab.id === value.laboratoryId)?.name ?? value.laboratoryId;
    if (key === 'status') return STATUS_LABELS[value.status as RequestStatus] ?? value.status;
    if (key === 'conflictOnly') return 'Yalnızca çakışanlar';
    if (key === 'day') return value.day;
    return value.search;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onApply(draft);
  };
  const clear = () => {
    setDraft(emptyFilters);
    onApply(emptyFilters);
  };
  const removeFilter = (key: keyof ScheduleFilters) => {
    const next = { ...value, [key]: key === 'conflictOnly' ? false : '' };
    setDraft(next);
    onApply(next);
  };

  return (
    <Card className="filter-card">
      <form onSubmit={submit}>
        <div className="filter-card__main">
          <label className="search-field">
            <Search aria-hidden="true" />
            <span className="sr-only">Ders programında ara</span>
            <input
              value={draft.search}
              onChange={(event) => setDraft({ ...draft, search: event.target.value })}
              placeholder="Ders kodu, ders adı veya hoca ara…"
            />
          </label>
          <label className="compact-field">
            <span className="sr-only">Gün</span>
            <select
              value={draft.day}
              onChange={(event) => setDraft({ ...draft, day: event.target.value as WeekDay | '' })}
            >
              <option value="">Tüm günler</option>
              {WEEK_DAYS.map((day) => (
                <option value={day} key={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" icon={<Search aria-hidden="true" />}>
            Ara
          </Button>
          <Button
            type="button"
            variant="secondary"
            icon={<SlidersHorizontal aria-hidden="true" />}
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            Gelişmiş filtre
          </Button>
        </div>
        {expanded && (
          <div className="filter-card__advanced">
            <label className="field">
              <span>Laboratuvar</span>
              <select
                value={draft.laboratoryId}
                onChange={(event) => setDraft({ ...draft, laboratoryId: event.target.value })}
              >
                <option value="">Tüm laboratuvarlar</option>
                {labs.map((lab) => (
                  <option value={lab.id} key={lab.id}>
                    {lab.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Durum</span>
              <select
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value as RequestStatus | '' })}
              >
                <option value="">Tüm durumlar</option>
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <option value={status} key={status}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Çakışma</span>
              <select
                value={draft.conflictOnly ? 'ONLY' : 'ALL'}
                onChange={(event) => setDraft({ ...draft, conflictOnly: event.target.value === 'ONLY' })}
              >
                <option value="ALL">Tümü</option>
                <option value="ONLY">Yalnızca çakışanlar</option>
              </select>
            </label>
          </div>
        )}
      </form>
      {activeFilters.length > 0 && (
        <div className="active-filters" aria-label="Aktif filtreler">
          <Filter aria-hidden="true" />
          <span>Aktif filtreler:</span>
          {activeFilters.map((key) => (
            <button
              type="button"
              key={key}
              onClick={() => removeFilter(key)}
              aria-label={`${filterLabels[key]} filtresini kaldır`}
            >
              {filterLabels[key]}: {filterLabelValue(key)} <X aria-hidden="true" />
            </button>
          ))}
          <button className="clear-filter" type="button" onClick={clear}>
            Tümünü temizle
          </button>
        </div>
      )}
    </Card>
  );
}

type TimedEntry = DayEntry & { startMin: number; endMin: number };
type LanedEntry = TimedEntry & { lane: number; lanes: number };

function clusterOverlaps(entries: DayEntry[]): TimedEntry[][] {
  const withMinutes: TimedEntry[] = entries
    .map((entry) => ({ ...entry, startMin: toMinutes(entry.startTime), endMin: toMinutes(entry.endTime) }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const clusters: { end: number; entries: TimedEntry[] }[] = [];
  for (const entry of withMinutes) {
    const last = clusters[clusters.length - 1];
    if (last && entry.startMin < last.end) {
      last.entries.push(entry);
      last.end = Math.max(last.end, entry.endMin);
    } else {
      clusters.push({ end: entry.endMin, entries: [entry] });
    }
  }
  return clusters.map((cluster) => cluster.entries);
}

// Bir zaman diliminde ikiden fazla ders üst üste binerse şeritler okunamayacak
// kadar daralıyor — MAX_VISIBLE_LANES'i aşan kayıtlar "+N daha" rozetinde
// toplanıp popup ile gösteriliyor.
const MAX_VISIBLE_LANES = 3;

function assignLanes(clusterEntries: TimedEntry[]): LanedEntry[] {
  const sorted = [...clusterEntries].sort((a, b) => a.startMin - b.startMin);
  const active: { endMin: number; lane: number }[] = [];
  let maxLane = 0;
  const laned = sorted.map((entry) => {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if ((active[i]?.endMin ?? Infinity) <= entry.startMin) active.splice(i, 1);
    }
    const usedLanes = new Set(active.map((item) => item.lane));
    let lane = 0;
    while (usedLanes.has(lane)) lane += 1;
    active.push({ endMin: entry.endMin, lane });
    maxLane = Math.max(maxLane, lane);
    return { ...entry, lane, lanes: 0 };
  });
  return laned.map((entry) => ({ ...entry, lanes: maxLane + 1 }));
}

function ScheduleCalendar({
  entries,
  onSelectEntry,
  onSelectOverflow,
}: {
  entries: DayEntry[];
  onSelectEntry: (entry: DayEntry) => void;
  onSelectOverflow: (entries: DayEntry[]) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<WeekDay, DayEntry[]>();
    for (const day of WEEK_DAYS) {
      const apiDay = DAY_API_VALUES[day];
      map.set(day, entries.filter((entry) => entry.dayOfWeek === apiDay));
    }
    return map;
  }, [entries]);

  const { startHour, endHour } = useMemo(() => {
    if (entries.length === 0) return { startHour: 8, endHour: 18 };
    const starts = entries.map((entry) => toMinutes(entry.startTime));
    const ends = entries.map((entry) => toMinutes(entry.endTime));
    return {
      startHour: Math.max(0, Math.floor(Math.min(...starts) / 60)),
      endHour: Math.min(24, Math.ceil(Math.max(...ends) / 60)),
    };
  }, [entries]);

  const hourPx = 110;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const calHeight = (endHour - startHour) * hourPx;

  return (
    <>
      <div className="schedule-calendar__legend">
        <span>Renkli çizgi = durum · kırmızı tarama = çakışma</span>
      </div>
      <div className="table-scroll">
        <div
          className="schedule-calendar"
          style={
            {
              '--schedule-cal-height': `${calHeight}px`,
              '--schedule-hour-px': `${hourPx}px`,
            } as CSSProperties
          }
        >
          <div className="schedule-calendar__head">
            <div />
            {WEEK_DAYS.map((day) => (
              <div className="schedule-calendar__day-head" key={day}>
                <div className="name">{day}</div>
                <div className="count">{(byDay.get(day) ?? []).length} ders</div>
              </div>
            ))}
          </div>
          <div className="schedule-calendar__body">
            <div className="schedule-calendar__axis">
              {hours.map((hour) => (
                <div
                  className="schedule-calendar__axis-label"
                  style={{ top: `${(hour - startHour) * hourPx}px` }}
                  key={hour}
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {WEEK_DAYS.map((day) => {
              const clusters = clusterOverlaps(byDay.get(day) ?? []).map((cluster) => assignLanes(cluster));
              return (
                <div className="schedule-calendar__day" key={day}>
                  {clusters.map((laned) => {
                    const trueLanes = laned[0]?.lanes ?? 1;
                    const overflowing = trueLanes > MAX_VISIBLE_LANES;
                    const visible = overflowing
                      ? laned.filter((entry) => entry.lane < MAX_VISIBLE_LANES - 1)
                      : laned;
                    const hidden = overflowing
                      ? laned.filter((entry) => entry.lane >= MAX_VISIBLE_LANES - 1)
                      : [];
                    const showLanes = Math.min(trueLanes, MAX_VISIBLE_LANES);
                    const widthPct = 100 / showLanes;
                    const clusterKey = `${day}-${laned[0]?.requestId ?? 'c'}-${laned[0]?.startTime ?? ''}`;

                    return (
                      <Fragment key={clusterKey}>
                        {visible.map((entry) => {
                          const top = (entry.startMin - startHour * 60) * (hourPx / 60);
                          const height = (entry.endMin - entry.startMin) * (hourPx / 60);
                          const leftPct = entry.lane * widthPct;
                          return (
                            <button
                              type="button"
                              key={`${entry.requestId}-${entry.laboratoryId}-${entry.startTime}`}
                              onClick={() => onSelectEntry(entry)}
                              className={classNames('schedule-event', entry.conflict && 'schedule-event--conflict')}
                              style={
                                {
                                  top: `${top}px`,
                                  height: `${Math.max(height - 3, 56)}px`,
                                  left: `calc(${leftPct}% + 2px)`,
                                  width: `calc(${widthPct}% - 5px)`,
                                  '--stripe': `var(--${STATUS_TONES[entry.status]})`,
                                } as CSSProperties
                              }
                            >
                              <span className="schedule-event__code">{entry.courseCode}</span>
                              <span className="schedule-event__name">{entry.courseName}</span>
                              <span className="schedule-event__meta">
                                <span>
                                  {entry.laboratoryName} · {entry.startTime.slice(0, 5)}–
                                  {entry.endTime.slice(0, 5)}
                                </span>
                                {entry.conflict && (
                                  <span className="schedule-event__conflict-badge">
                                    <AlertTriangle aria-hidden="true" /> Çakışma
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                        {hidden.length > 0 &&
                          (() => {
                            const hiddenStart = Math.min(...hidden.map((entry) => entry.startMin));
                            const hiddenEnd = Math.max(...hidden.map((entry) => entry.endMin));
                            const top = (hiddenStart - startHour * 60) * (hourPx / 60);
                            const height = (hiddenEnd - hiddenStart) * (hourPx / 60);
                            const leftPct = (MAX_VISIBLE_LANES - 1) * widthPct;
                            const hasConflict = hidden.some((entry) => entry.conflict);
                            return (
                              <button
                                type="button"
                                onClick={() => onSelectOverflow(hidden)}
                                className={classNames(
                                  'schedule-event',
                                  'schedule-event--overflow',
                                  hasConflict && 'schedule-event--conflict',
                                )}
                                style={
                                  {
                                    top: `${top}px`,
                                    height: `${Math.max(height - 3, 56)}px`,
                                    left: `calc(${leftPct}% + 2px)`,
                                    width: `calc(${widthPct}% - 5px)`,
                                  } as CSSProperties
                                }
                                aria-label={`${hidden.length} ders daha`}
                              >
                                <span className="schedule-event__overflow-count">+{hidden.length}</span>
                                <span className="schedule-event__overflow-label">daha</span>
                              </button>
                            );
                          })()}
                      </Fragment>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function ScheduleDayAccordion({
  byDay,
  conflictOnly,
  openDays,
  onToggle,
  onSelectEntry,
}: {
  byDay: Map<WeekDay, DayEntry[]>;
  conflictOnly: boolean;
  openDays: Record<string, boolean>;
  onToggle: (day: WeekDay) => void;
  onSelectEntry: (entry: DayEntry) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Gün</th>
            <th>Ders sayısı</th>
            <th className="table-actions-cell" />
          </tr>
        </thead>
        <tbody>
          {WEEK_DAYS.map((day) => {
            const dayEntries = byDay.get(day) ?? [];
            const rows = conflictOnly ? dayEntries.filter((entry) => entry.conflict) : dayEntries;
            const conflictCount = dayEntries.filter((entry) => entry.conflict).length;
            const isOpen = Boolean(openDays[day]);
            return (
              <Fragment key={day}>
                <tr
                  className="audit-row"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => onToggle(day)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onToggle(day);
                    }
                  }}
                >
                  <td>{day}</td>
                  <td>
                    {rows.length} ders
                    {conflictCount > 0 && (
                      <>
                        {' · '}
                        <span style={{ color: 'var(--red)', fontWeight: 700 }}>{conflictCount} çakışma</span>
                      </>
                    )}
                  </td>
                  <td className="table-actions-cell">
                    {isOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="lab-row-detail">
                    <td colSpan={3}>
                      {rows.length === 0 ? (
                        <EmptyState
                          title={`${day} için ders yok`}
                          description="Seçilen filtrelere uyan, bu güne ait bir kayıt bulunamadı."
                        />
                      ) : (
                        <>
                          <p className="lab-row-detail__meta">{rows.length} kayıt bulundu</p>
                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Saat</th>
                                  <th>Ders</th>
                                  <th>Laboratuvar</th>
                                  <th>Durum</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((entry) => (
                                  <tr key={`${entry.requestId}-${entry.laboratoryId}-${entry.startTime}`}>
                                    <td>
                                      <span>
                                        {entry.startTime.slice(0, 5)}–{entry.endTime.slice(0, 5)}
                                      </span>
                                      {entry.conflict && (
                                        <span className="badge badge--red" style={{ marginTop: '0.3rem' }}>
                                          <AlertTriangle aria-hidden="true" /> Çakışma
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="table-primary table-primary--button"
                                        onClick={() => onSelectEntry(entry)}
                                      >
                                        {entry.courseCode}
                                      </button>
                                      <small>{entry.courseName}</small>
                                    </td>
                                    <td>{entry.laboratoryName}</td>
                                    <td>
                                      <StatusBadge status={entry.status} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EntryDetailBody({ entry }: { entry: DayEntry }) {
  return (
    <>
      {entry.conflict && (
        <div className="alert alert--error" style={{ marginBottom: '1rem' }}>
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Çakışma tespit edildi</strong>
            <span>
              Bu kayıt, aynı laboratuvarı aynı gün ve saat aralığında kullanan başka bir talep ile
              çakışıyor.
            </span>
          </div>
        </div>
      )}
      <dl className="detail-list--grid">
        <div>
          <dt>Durum</dt>
          <dd>
            <StatusBadge status={entry.status} />
          </dd>
        </div>
        <div>
          <dt>Gün</dt>
          <dd>{dayNameByApi[entry.dayOfWeek] ?? entry.dayOfWeek}</dd>
        </div>
        <div>
          <dt>Saat</dt>
          <dd>
            {entry.startTime.slice(0, 5)}–{entry.endTime.slice(0, 5)}
          </dd>
        </div>
        <div>
          <dt>Section</dt>
          <dd>{entry.ownedSections.length > 0 ? entry.ownedSections.join(', ') : '—'}</dd>
        </div>
        <div className="detail-list__full">
          <dt>Laboratuvar</dt>
          <dd>{entry.laboratoryName}</dd>
        </div>
        <div>
          <dt>Talep sahibi</dt>
          <dd>{entry.ownerFullName || entry.ownerEmail || '—'}</dd>
        </div>
        <div>
          <dt>Ders hocası</dt>
          <dd>{entry.instructorEmail || '—'}</dd>
        </div>
      </dl>
    </>
  );
}

function OverflowModalBody({
  entries,
  onSelectEntry,
}: {
  entries: DayEntry[];
  onSelectEntry: (entry: DayEntry) => void;
}) {
  const sorted = [...entries].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Saat</th>
            <th>Ders</th>
            <th>Laboratuvar</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr key={`${entry.requestId}-${entry.laboratoryId}-${entry.startTime}`}>
              <td>
                <span>
                  {entry.startTime.slice(0, 5)}–{entry.endTime.slice(0, 5)}
                </span>
                {entry.conflict && (
                  <span className="badge badge--red" style={{ marginTop: '0.3rem' }}>
                    <AlertTriangle aria-hidden="true" /> Çakışma
                  </span>
                )}
              </td>
              <td>
                <button
                  type="button"
                  className="table-primary table-primary--button"
                  onClick={() => onSelectEntry(entry)}
                >
                  {entry.courseCode}
                </button>
                <small>{entry.courseName}</small>
              </td>
              <td>{entry.laboratoryName}</td>
              <td>
                <StatusBadge status={entry.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SchedulePage() {
  const [filters, setFilters] = useState<ScheduleFilters>(emptyFilters);
  const [view, setView] = useState<'day' | 'calendar'>('day');
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [detailEntry, setDetailEntry] = useState<DayEntry | null>(null);
  const [overflowEntries, setOverflowEntries] = useState<DayEntry[] | null>(null);

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
    const term = filters.search.trim().toLocaleLowerCase('tr-TR');
    return (scheduleQuery.data ?? []).filter((entry) => {
      if (filters.laboratoryId && entry.laboratoryId !== filters.laboratoryId) return false;
      if (filters.day && entry.dayOfWeek !== DAY_API_VALUES[filters.day]) return false;
      if (filters.status && entry.status !== filters.status) return false;
      if (!term) return true;
      return [entry.courseCode, entry.courseName, entry.instructorEmail, entry.ownerFullName]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('tr-TR').includes(term));
    });
  }, [scheduleQuery.data, filters]);

  const byDay = useMemo(() => {
    const map = new Map<WeekDay, DayEntry[]>();
    for (const day of WEEK_DAYS) {
      const apiDay = DAY_API_VALUES[day];
      map.set(day, withConflicts(filtered.filter((entry) => entry.dayOfWeek === apiDay)));
    }
    return map;
  }, [filtered]);

  const allEntries = useMemo(() => [...byDay.values()].flat(), [byDay]);
  const conflictCount = useMemo(() => allEntries.filter((entry) => entry.conflict).length, [allEntries]);
  const visibleEntries = filters.conflictOnly ? allEntries.filter((entry) => entry.conflict) : allEntries;

  const toggleDay = (day: WeekDay) => setOpenDays((current) => ({ ...current, [day]: !current[day] }));

  return (
    <>
      <PageHeader
        eyebrow="Yalnızca sistem yöneticileri görebilir"
        title="Ders Programı"
        description="Gönderilmiş taleplerdeki ders kodu, laboratuvar, gün ve saat bilgilerinden oluşturulan haftalık program."
        action={
          <Button
            variant="secondary"
            icon={<RefreshCcw aria-hidden="true" />}
            onClick={() => void scheduleQuery.refetch()}
          >
            Yenile
          </Button>
        }
      />

      <ScheduleFilterBar value={filters} labs={labsQuery.data ?? []} onApply={setFilters} />

      {scheduleQuery.isLoading ? (
        <LoadingState label="Program yükleniyor…" />
      ) : scheduleQuery.isError ? (
        <ErrorState error={scheduleQuery.error} onRetry={() => void scheduleQuery.refetch()} />
      ) : (scheduleQuery.data ?? []).length === 0 ? (
        <EmptyState
          title="Gösterilecek ders programı yok"
          description="Sistemde henüz gönderilmiş, ders programına yansıyan bir talep yok."
        />
      ) : (
        <Card className="table-card">
          <div className="table-toolbar">
            <div>
              <strong>Ders programı listesi</strong>
              <span>
                {visibleEntries.length} kayıt bulundu
                {conflictCount > 0 && (
                  <>
                    {' · '}
                    <span style={{ color: 'var(--red)', fontWeight: 700 }}>{conflictCount} çakışma</span>
                  </>
                )}
              </span>
            </div>
            <div className="view-toggle">
              <Button
                type="button"
                variant={view === 'day' ? 'primary' : 'secondary'}
                icon={<LayoutGrid aria-hidden="true" />}
                onClick={() => setView('day')}
              >
                Güne göre
              </Button>
              <Button
                type="button"
                variant={view === 'calendar' ? 'primary' : 'secondary'}
                icon={<CalendarDays aria-hidden="true" />}
                onClick={() => setView('calendar')}
              >
                Takvim
              </Button>
            </div>
            <div />
          </div>

          {visibleEntries.length === 0 ? (
            <EmptyState
              title="Kayıt bulunamadı"
              description="Seçilen filtrelere uyan bir ders programı kaydı yok."
            />
          ) : view === 'day' ? (
            <ScheduleDayAccordion
              byDay={byDay}
              conflictOnly={filters.conflictOnly}
              openDays={openDays}
              onToggle={toggleDay}
              onSelectEntry={setDetailEntry}
            />
          ) : (
            <ScheduleCalendar
              entries={visibleEntries}
              onSelectEntry={setDetailEntry}
              onSelectOverflow={setOverflowEntries}
            />
          )}
        </Card>
      )}

      <Modal
        open={Boolean(detailEntry)}
        title={detailEntry?.courseCode ?? ''}
        description={detailEntry?.courseName}
        onClose={() => setDetailEntry(null)}
        footer={
          detailEntry && (
            <Link
              className="button button--ghost"
              to={`/talepler/${detailEntry.requestId}`}
              onClick={() => setDetailEntry(null)}
            >
              Tam sayfada aç
            </Link>
          )
        }
      >
        {detailEntry && <EntryDetailBody entry={detailEntry} />}
      </Modal>

      <Modal
        open={Boolean(overflowEntries)}
        title="Bu saat aralığındaki diğer dersler"
        description={overflowEntries ? `${overflowEntries.length} ders daha` : undefined}
        onClose={() => setOverflowEntries(null)}
      >
        {overflowEntries && (
          <OverflowModalBody
            entries={overflowEntries}
            onSelectEntry={(entry) => {
              setOverflowEntries(null);
              setDetailEntry(entry);
            }}
          />
        )}
      </Modal>
    </>
  );
}
