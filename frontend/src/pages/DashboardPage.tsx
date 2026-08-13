import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  AppWindow,
  ArrowRight,
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileClock,
  Monitor,
  MonitorCheck,
  Plus,
  Send,
  Timer,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { normalizeNotificationLink } from '../lib/routes';
import { buildQuery, formatDate, normalizePage, statusLabel } from '../lib/utils';
import {
  ROLES,
  type NamedCount,
  type Notification,
  type RequestStats,
  type SoftwareRequest,
  type TrendPoint,
} from '../types';

function softwareNames(request: SoftwareRequest): string {
  return (
    request.items
      .map((item) => item.softwareName)
      .filter(Boolean)
      .join(', ') || 'Program belirtilmedi'
  );
}

function requestDays(request: SoftwareRequest): string[] {
  return request.schedules.map((schedule) => dayLabel(schedule.dayOfWeek));
}

function dayLabel(day: string): string {
  const labels: Record<string, string> = {
    Monday: 'Pazartesi',
    Tuesday: 'Salı',
    Wednesday: 'Çarşamba',
    Thursday: 'Perşembe',
    Friday: 'Cuma',
    Saturday: 'Cumartesi',
    Sunday: 'Pazar',
  };
  return labels[day] ?? day;
}

function BarList({ items }: { items: NamedCount[] }) {
  if (!items.length) return <EmptyState />;
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="horizontal-chart">
      {items.map((item) => (
        <div key={item.id ?? item.name}>
          <span>{item.name}</span>
          <div>
            <i style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <strong>{item.count}</strong>
        </div>
      ))}
    </div>
  );
}

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart);
  if (Number.isNaN(date.getTime())) return weekStart;
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' }).format(date);
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (!points.length) return <EmptyState title="Trend verisi yok" description="Seçili aralıkta talep bulunamadı." />;
  const width = 600;
  const height = 160;
  const paddingX = 12;
  const paddingY = 16;
  const max = Math.max(...points.map((point) => point.count), 1);
  const stepX = points.length > 1 ? (width - paddingX * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => {
    const x = paddingX + stepX * index;
    const y = height - paddingY - (point.count / max) * (height - paddingY * 2);
    return [x, y] as const;
  });
  const linePath = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const lastCoord = coords[coords.length - 1]!;
  const firstCoord = coords[0]!;
  const areaPath = `${linePath} L${lastCoord[0].toFixed(1)},${height - paddingY} L${firstCoord[0].toFixed(1)},${height - paddingY} Z`;

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Haftalık talep trendi">
        <path d={areaPath} className="trend-chart__area" />
        <path d={linePath} className="trend-chart__line" />
        {coords.map(([x, y], index) => {
          const point = points[index]!;
          return (
            <circle cx={x} cy={y} r={3} className="trend-chart__dot" key={point.weekStart}>
              <title>{`${formatWeekLabel(point.weekStart)}: ${point.count} talep`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="trend-chart__labels">
        <span>{formatWeekLabel(points[0]!.weekStart)}</span>
        <span>{formatWeekLabel(points[points.length - 1]!.weekStart)}</span>
      </div>
    </div>
  );
}

interface StatsFilters {
  facultyId: string;
  from: string;
  to: string;
}

const emptyStatsFilters: StatsFilters = { facultyId: '', from: '', to: '' };

function StatsFilterBar({
  value,
  onApply,
}: {
  value: StatsFilters;
  onApply: (filters: StatsFilters) => void;
}) {
  const [draft, setDraft] = useState(value);
  const facultiesQuery = useQuery({
    queryKey: ['faculties', 'dashboard-filter'],
    queryFn: async () =>
      normalizePage<{ id: string; name: string }>(
        await apiRequest('/faculties?page=1&pageSize=100'),
        1,
        100,
      ).items,
  });
  const hasActiveFilters = Boolean(value.facultyId || value.from || value.to);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onApply(draft);
  };
  const clear = () => {
    setDraft(emptyStatsFilters);
    onApply(emptyStatsFilters);
  };

  return (
    <Card className="dashboard-filters">
      <form onSubmit={submit}>
        <label className="field">
          <span>Fakülte</span>
          <select
            value={draft.facultyId}
            onChange={(event) => setDraft({ ...draft, facultyId: event.target.value })}
          >
            <option value="">Tüm fakülteler</option>
            {(facultiesQuery.data ?? []).map((faculty) => (
              <option value={faculty.id} key={faculty.id}>
                {faculty.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Başlangıç tarihi</span>
          <input
            type="date"
            value={draft.from}
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Bitiş tarihi</span>
          <input
            type="date"
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
          />
        </label>
        <div className="dashboard-filters__actions">
          <Button type="submit" variant="secondary">
            Uygula
          </Button>
          {hasActiveFilters && (
            <Button type="button" variant="ghost" onClick={clear}>
              Temizle
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

const statusCards = [
  { status: undefined, label: 'Toplam Talep', icon: ClipboardList, tone: 'blue' },
  { status: 'Draft', label: 'Taslak', icon: FileClock, tone: 'neutral' },
  { status: 'Submitted', label: 'Gönderildi', icon: Send, tone: 'blue' },
  { status: 'UnderReview', label: 'İnceleniyor', icon: CircleDashed, tone: 'purple' },
  { status: 'AwaitingInformation', label: 'Eksik Bilgi', icon: Clock3, tone: 'amber' },
  { status: 'Approved', label: 'Onaylandı', icon: CheckCircle2, tone: 'green' },
  { status: 'InstallationScheduled', label: 'Planlandı', icon: CalendarClock, tone: 'cyan' },
  { status: 'InstallationCompleted', label: 'Tamamlandı', icon: MonitorCheck, tone: 'green' },
] as const;

export function DashboardPage({ scope = 'academic' }: { scope?: 'academic' | 'faculty' }) {
  const { user } = useAuth();
  const requestsPath = scope === 'academic' ? '/requests/my' : '/requests';
  const requestsQuery = useQuery({
    queryKey: ['dashboard-requests', scope],
    queryFn: async () =>
      normalizePage<SoftwareRequest>(
        await apiRequest(`${requestsPath}${buildQuery({ page: 1, pageSize: 50 })}`),
        1,
        50,
      ),
  });
  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'dashboard'],
    queryFn: async () =>
      normalizePage<Notification>(
        await apiRequest(`/notifications${buildQuery({ page: 1, pageSize: 4 })}`),
        1,
        4,
      ),
  });
  const statsQuery = useQuery({
    queryKey: ['dashboard-stats', scope],
    queryFn: async () => apiRequest<RequestStats>('/requests/stats'),
  });
  if (requestsQuery.isLoading) return <LoadingState label="Gösterge paneli hazırlanıyor…" />;
  if (requestsQuery.isError)
    return <ErrorState error={requestsQuery.error} onRetry={() => void requestsQuery.refetch()} />;

  const requests = requestsQuery.data?.items ?? [];
  // Durum sayaçları backend'deki tüm taleplerin gerçek toplamını yansıtır (bu sayfanın altındaki
  // "son talepler" tablosu için çekilen ilk 50 kayıtla sınırlı değildir).
  const counts = (status?: string) => {
    if (!statsQuery.data) return status ? 0 : (requestsQuery.data?.totalCount ?? 0);
    if (!status) return statsQuery.data.totalCount;
    return statsQuery.data.statusCounts.find((entry) => entry.status === status)?.count ?? 0;
  };
  const awaitingInfoRequests =
    scope === 'academic' ? requests.filter((request) => request.status === 'AwaitingInformation') : [];

  return (
    <>
      <PageHeader
        eyebrow={scope === 'academic' ? 'Akademik çalışma alanı' : 'Yetkili fakülte görünümü'}
        title={`Merhaba, ${user?.fullName.split(' ')[0] ?? 'hoş geldiniz'}`}
        description={
          scope === 'academic'
            ? 'Laboratuvar yazılım taleplerinizin son durumunu buradan izleyebilirsiniz.'
            : 'Yetkili olduğunuz fakültelerin taleplerini ve yaklaşan işlerini izleyin.'
        }
        action={
          scope === 'academic' ? (
            <Link className="button button--primary" to="/talep/yeni">
              <Plus aria-hidden="true" /> Yeni talep oluştur
            </Link>
          ) : undefined
        }
      />

      {awaitingInfoRequests.length > 0 && (
        <Card className="action-banner" aria-label="Aksiyon gerekli">
          <span className="action-banner__icon">
            <AlertTriangle aria-hidden="true" />
          </span>
          <div className="action-banner__body">
            <strong>
              {awaitingInfoRequests.length === 1
                ? '1 talebiniz eksik bilgi bekliyor'
                : `${awaitingInfoRequests.length} talebiniz eksik bilgi bekliyor`}
            </strong>
            <span>Yöneticinin istediği bilgileri tamamlamadan talebiniz incelemeye devam edemez.</span>
            <div className="action-banner__list">
              {awaitingInfoRequests.slice(0, 3).map((request) => (
                <Link className="action-banner__item" to={`/talepler/${request.id}`} key={request.id}>
                  <div>
                    <strong>
                      {request.courseCode} · {request.courseName}
                    </strong>
                    {request.statusReason && <small>{request.statusReason}</small>}
                  </div>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </Card>
      )}

      <section className="metric-grid metric-grid--wide" aria-label="Talep özeti">
        {statusCards.map(({ status, label, icon: Icon, tone }) => (
          <Card className="metric-card" key={label}>
            <span className={`metric-card__icon metric-card__icon--${tone}`}>
              <Icon aria-hidden="true" />
            </span>
            <div>
              <span>{label}</span>
              <strong>{counts(status)}</strong>
            </div>
            <span className="metric-card__trend">
              <TrendingUp aria-hidden="true" /> Bu dönem
            </span>
          </Card>
        ))}
      </section>

      <section className="dashboard-grid">
        <Card className="dashboard-panel dashboard-panel--wide">
          <div className="panel-heading">
            <div>
              <h2>Son talepler</h2>
              <p>En son güncellenen yazılım ihtiyaçları</p>
            </div>
            <Link to="/talepler">
              Tümünü gör <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          {requests.length === 0 ? (
            <EmptyState
              title="Henüz talep yok"
              description="İlk laboratuvar yazılım talebinizi oluşturarak başlayın."
            />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Ders</th>
                    <th>Programlar</th>
                    <th>Durum</th>
                    <th>Güncelleme</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.slice(0, 5).map((request) => (
                    <tr key={request.id}>
                      <td>
                        <Link className="table-primary" to={`/talepler/${request.id}`}>
                          {request.courseCode}
                        </Link>
                        <small>{request.courseName}</small>
                      </td>
                      <td>{softwareNames(request)}</td>
                      <td>
                        <StatusBadge status={request.status} />
                      </td>
                      <td>{formatDate(request.updatedAt ?? request.createdAt, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Yaklaşan dersler</h2>
              <p>Kurulumu planlanan oturumlar</p>
            </div>
            <CalendarClock aria-hidden="true" />
          </div>
          <div className="timeline-list">
            {requests
              .filter((request) =>
                ['Approved', 'InstallationScheduled', 'InstallationPlanned'].includes(
                  request.status,
                ),
              )
              .slice(0, 3)
              .map((request) => (
                <div key={request.id}>
                  <span className="timeline-list__time">
                    {requestDays(request)[0] ?? 'Planlanıyor'}
                  </span>
                  <div>
                    <strong>
                      {request.courseCode} · {request.courseName}
                    </strong>
                    <small>
                      {request.laboratories?.map((lab) => lab.name).join(', ') ||
                        'Laboratuvar atanmadı'}
                    </small>
                  </div>
                </div>
              ))}
            {!requests.some((request) =>
              ['Approved', 'InstallationScheduled', 'InstallationPlanned'].includes(request.status),
            ) && (
              <EmptyState
                title="Yaklaşan ders yok"
                description="Planlanan kurulumlar burada görünecek."
              />
            )}
          </div>
        </Card>

        <Card className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Son bildirimler</h2>
              <p>Süreçteki önemli değişiklikler</p>
            </div>
            <Link to="/bildirimler">
              <BellRing aria-label="Bildirimlere git" />
            </Link>
          </div>
          {notificationsQuery.isError ? (
            <ErrorState error={notificationsQuery.error} />
          ) : (
            <div className="compact-list">
              {(notificationsQuery.data?.items ?? []).map((notification) => (
                <Link to={normalizeNotificationLink(notification.link)} key={notification.id}>
                  <span className={`list-dot list-dot--${notification.type ?? 'info'}`} />
                  <div>
                    <strong>{notification.title}</strong>
                    <small>{formatDate(notification.createdAt, true)}</small>
                  </div>
                </Link>
              ))}
              {!notificationsQuery.isLoading && !notificationsQuery.data?.items.length && (
                <EmptyState title="Yeni bildirim yok" description="Güncel durumdasınız." />
              )}
            </div>
          )}
        </Card>
      </section>
    </>
  );
}

export function HomeRedirect() {
  const { user } = useAuth();
  if (user?.roles.includes(ROLES.administrator)) {
    return <AdminDashboardPage />;
  }
  if (user?.roles.includes(ROLES.faculty)) {
    return <DashboardPage scope="faculty" />;
  }
  return <DashboardPage />;
}

export function AdminDashboardPage() {
  const [filters, setFilters] = useState<StatsFilters>(emptyStatsFilters);
  const statsQuery = useQuery({
    queryKey: ['admin-dashboard-stats', filters],
    queryFn: async () =>
      apiRequest<RequestStats>(
        `/requests/stats${buildQuery({
          facultyId: filters.facultyId,
          from: filters.from,
          to: filters.to,
        })}`,
      ),
  });
  if (statsQuery.isLoading) return <LoadingState label="Yönetim paneli hazırlanıyor…" />;
  if (statsQuery.isError)
    return <ErrorState error={statsQuery.error} onRetry={() => void statsQuery.refetch()} />;

  const stats = statsQuery.data;
  const statusCount = (status: string) =>
    stats?.statusCounts.find((entry) => entry.status === status)?.count ?? 0;
  const pendingInstallations =
    statusCount('Approved') + statusCount('InstallationScheduled') + statusCount('InstallationPlanned');
  const completed = statusCount('InstallationCompleted');
  const statusGroups: NamedCount[] = [...(stats?.statusCounts ?? [])]
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({ id: entry.status, name: statusLabel(entry.status), count: entry.count }));

  return (
    <>
      <PageHeader
        eyebrow="Sistem yönetimi"
        title="Genel Gösterge Paneli"
        description="Üniversite genelindeki talepleri, onayları ve kurulum yükünü tek ekrandan yönetin."
        action={
          <Link className="button button--secondary" to="/raporlar">
            Rapor merkezine git <ArrowRight aria-hidden="true" />
          </Link>
        }
      />
      <StatsFilterBar value={filters} onApply={setFilters} />
      <section className="metric-grid metric-grid--admin">
        <Card className="metric-card metric-card--hero">
          <span className="metric-card__icon metric-card__icon--blue">
            <ClipboardList />
          </span>
          <div>
            <span>Toplam talep</span>
            <strong>{stats?.totalCount ?? 0}</strong>
          </div>
          <small>Tüm fakülteler</small>
        </Card>
        <Card className="metric-card">
          <span className="metric-card__icon metric-card__icon--cyan">
            <CalendarClock />
          </span>
          <div>
            <span>Kurulum bekleyen</span>
            <strong>{pendingInstallations}</strong>
          </div>
          <small>Onaylı ve planlanan</small>
        </Card>
        <Card className="metric-card">
          <span className="metric-card__icon metric-card__icon--green">
            <MonitorCheck />
          </span>
          <div>
            <span>Kurulum tamamlanan</span>
            <strong>{completed}</strong>
          </div>
          <small>Bu dönem</small>
        </Card>
      </section>
      <section className="metric-grid metric-grid--admin" aria-label="Süreç süreleri">
        <Card className="metric-card">
          <span className="metric-card__icon metric-card__icon--purple">
            <Timer />
          </span>
          <div>
            <span>Ortalama onay süresi</span>
            <strong>{stats?.averageApprovalDays != null ? `${stats.averageApprovalDays} gün` : '—'}</strong>
          </div>
          <small>Gönderimden onaya kadar geçen süre</small>
        </Card>
        <Card className="metric-card">
          <span className="metric-card__icon metric-card__icon--amber">
            <Wrench />
          </span>
          <div>
            <span>Ortalama kurulum süresi</span>
            <strong>
              {stats?.averageInstallationDays != null ? `${stats.averageInstallationDays} gün` : '—'}
            </strong>
          </div>
          <small>Onaydan kuruluma kadar geçen süre</small>
        </Card>
      </section>
      <section className="dashboard-grid dashboard-grid--admin" aria-label="Talep trendi ve bekleyen işler">
        <Card className="dashboard-panel dashboard-panel--wide">
          <div className="panel-heading">
            <div>
              <h2>Talep trendi</h2>
              <p>Haftalık yeni talep sayısı</p>
            </div>
            <Activity aria-hidden="true" />
          </div>
          <TrendChart points={stats?.trend ?? []} />
        </Card>
        <Card className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Takılı kalan talepler</h2>
              <p>3+ gündür işlem bekleyen</p>
            </div>
            <AlertTriangle aria-hidden="true" />
          </div>
          {(stats?.staleRequests.length ?? 0) === 0 ? (
            <EmptyState title="Bekleyen iş yok" description="Tüm aktif talepler güncel." />
          ) : (
            <div className="compact-list">
              {stats!.staleRequests.map((request) => (
                <Link to={`/talepler/${request.id}`} key={request.id}>
                  <span
                    className={`list-dot list-dot--${request.daysSinceUpdate > 7 ? 'error' : 'warning'}`}
                  />
                  <div>
                    <strong>
                      {request.courseCode} · {request.courseName}
                    </strong>
                    <small>
                      {request.facultyName} · {statusLabel(request.status)} · {request.daysSinceUpdate} gündür bekliyor
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>
      <section className="dashboard-grid dashboard-grid--admin">
        <Card className="dashboard-panel dashboard-panel--wide">
          <div className="panel-heading">
            <div>
              <h2>Talep durumu dağılımı</h2>
              <p>Üniversite genelindeki güncel iş yükü</p>
            </div>
          </div>
          <div aria-label="Talep durumu dağılım grafiği">
            <BarList items={statusGroups} />
          </div>
        </Card>
        <Card className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Hızlı yönetim</h2>
              <p>Sık kullanılan işlemler</p>
            </div>
          </div>
          <div className="quick-links">
            <Link to="/talepler">
              <ClipboardList />
              <span>Talepleri incele</span>
              <ArrowRight />
            </Link>
            <Link to="/kullanicilar">
              <ClipboardCheck />
              <span>Kullanıcıları yönet</span>
              <ArrowRight />
            </Link>
          </div>
        </Card>
      </section>
      <section className="dashboard-grid dashboard-grid--stats" aria-label="Fakülte, laboratuvar ve yazılım dağılımı">
        <Card className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Fakültelere göre talepler</h2>
              <p>En çok talep gönderen fakülteler</p>
            </div>
            <Building2 aria-hidden="true" />
          </div>
          <BarList items={stats?.facultyCounts ?? []} />
        </Card>
        <Card className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Laboratuvarlara göre talepler</h2>
              <p>En çok talep alan laboratuvarlar</p>
            </div>
            <Monitor aria-hidden="true" />
          </div>
          <BarList items={stats?.laboratoryCounts ?? []} />
        </Card>
        <Card className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>En çok istenen yazılımlar</h2>
              <p>Taleplerde en sık geçen programlar</p>
            </div>
            <AppWindow aria-hidden="true" />
          </div>
          <BarList items={stats?.topSoftware ?? []} />
        </Card>
      </section>
    </>
  );
}

export { requestDays, softwareNames };
