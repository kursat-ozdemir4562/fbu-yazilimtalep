import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileClock,
  Lightbulb,
  MonitorCheck,
  Plus,
  Send,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
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
import { ROLES, type Notification, type SoftwareRequest } from '../types';

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
  const suggestionsQuery = useQuery({
    queryKey: ['suggestions', 'dashboard', scope],
    queryFn: async () => {
      const path = scope === 'academic' ? '/software/suggestions/my' : '/software/suggestions';
      return normalizePage<{ id: string; name: string; status: string; createdAt: string }>(
        await apiRequest(`${path}${buildQuery({ page: 1, pageSize: 4 })}`),
        1,
        4,
      );
    },
  });

  if (requestsQuery.isLoading) return <LoadingState label="Gösterge paneli hazırlanıyor…" />;
  if (requestsQuery.isError)
    return <ErrorState error={requestsQuery.error} onRetry={() => void requestsQuery.refetch()} />;

  const requests = requestsQuery.data?.items ?? [];
  const counts = (status?: string) =>
    status
      ? requests.filter((request) => request.status === status).length
      : (requestsQuery.data?.totalCount ?? 0);

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

        <Card className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Program önerileri</h2>
              <p>Değerlendirme bekleyen öneriler</p>
            </div>
            <Lightbulb aria-hidden="true" />
          </div>
          {suggestionsQuery.isError ? (
            <ErrorState error={suggestionsQuery.error} />
          ) : (
            <div className="compact-list">
              {(suggestionsQuery.data?.items ?? []).map((suggestion) => (
                <Link to="/oneriler" key={suggestion.id}>
                  <span className="list-icon">
                    <ClipboardCheck aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{suggestion.name}</strong>
                    <small>
                      {statusLabel(suggestion.status)} · {formatDate(suggestion.createdAt)}
                    </small>
                  </div>
                </Link>
              ))}
              {!suggestionsQuery.isLoading && !suggestionsQuery.data?.items.length && (
                <EmptyState
                  title="Bekleyen öneri yok"
                  description="Yeni öneriler burada listelenecek."
                />
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
  const requestsQuery = useQuery({
    queryKey: ['admin-dashboard-requests'],
    queryFn: async () =>
      normalizePage<SoftwareRequest>(
        await apiRequest(`/requests${buildQuery({ page: 1, pageSize: 100 })}`),
        1,
        100,
      ),
  });
  const suggestionsQuery = useQuery({
    queryKey: ['admin-dashboard-suggestions'],
    queryFn: async () =>
      normalizePage<{ id: string; status: string }>(
        await apiRequest('/software/suggestions?page=1&pageSize=100'),
        1,
        100,
      ),
  });

  if (requestsQuery.isLoading) return <LoadingState label="Yönetim paneli hazırlanıyor…" />;
  if (requestsQuery.isError)
    return <ErrorState error={requestsQuery.error} onRetry={() => void requestsQuery.refetch()} />;

  const requests = requestsQuery.data?.items ?? [];
  const pendingInstallations = requests.filter((item) =>
    ['Approved', 'InstallationScheduled', 'InstallationPlanned'].includes(item.status),
  ).length;
  const completed = requests.filter((item) => item.status === 'InstallationCompleted').length;
  const statusGroups = Object.entries(
    requests.reduce<Record<string, number>>((groups, request) => {
      groups[request.status] = (groups[request.status] ?? 0) + 1;
      return groups;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxStatus = Math.max(...statusGroups.map(([, count]) => count), 1);

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
      <section className="metric-grid metric-grid--admin">
        <Card className="metric-card metric-card--hero">
          <span className="metric-card__icon metric-card__icon--blue">
            <ClipboardList />
          </span>
          <div>
            <span>Toplam talep</span>
            <strong>{requestsQuery.data?.totalCount ?? 0}</strong>
          </div>
          <small>Tüm fakülteler</small>
        </Card>
        <Card className="metric-card">
          <span className="metric-card__icon metric-card__icon--amber">
            <Lightbulb />
          </span>
          <div>
            <span>Onay bekleyen öneri</span>
            <strong>{suggestionsQuery.data?.totalCount ?? 0}</strong>
          </div>
          <small>Yönetici aksiyonu gerekli</small>
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
      <section className="dashboard-grid dashboard-grid--admin">
        <Card className="dashboard-panel dashboard-panel--wide">
          <div className="panel-heading">
            <div>
              <h2>Talep durumu dağılımı</h2>
              <p>Üniversite genelindeki güncel iş yükü</p>
            </div>
          </div>
          <div className="horizontal-chart" aria-label="Talep durumu dağılım grafiği">
            {statusGroups.map(([status, count]) => (
              <div key={status}>
                <span>{statusLabel(status)}</span>
                <div>
                  <i style={{ width: `${(count / maxStatus) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
            {!statusGroups.length && <EmptyState />}
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
            <Link to="/oneriler">
              <Lightbulb />
              <span>Önerileri değerlendir</span>
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
    </>
  );
}

export { requestDays, softwareNames };
