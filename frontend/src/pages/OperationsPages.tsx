import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellRing,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  History,
  Mail,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest, downloadFile } from '../lib/api';
import { normalizeNotificationLink } from '../lib/routes';
import {
  buildQuery,
  classNames,
  formatDate,
  getErrorMessage,
  normalizePage,
  unwrap,
} from '../lib/utils';
import { ROLES, type Notification } from '../types';

const reportDefinitions = [
  {
    id: 'requests',
    title: 'Talep raporu',
    description: 'Ders, dönem, durum ve yazılım ayrıntıları',
    icon: FileText,
    adminOnly: false,
  },
  {
    id: 'software',
    title: 'Talep edilen programlar',
    description: 'Talep kapsamındaki program ve sürüm ayrıntıları',
    icon: FileSpreadsheet,
    adminOnly: false,
  },
  {
    id: 'faculties',
    title: 'Fakülte listesi',
    description: 'Fakülte kodu, adı ve aktiflik durumu',
    icon: Users,
    adminOnly: false,
  },
  {
    id: 'laboratories',
    title: 'Laboratuvar envanteri',
    description: 'Fakülte, kapasite, bilgisayar ve işletim sistemi bilgileri',
    icon: SlidersHorizontal,
    adminOnly: false,
  },
  {
    id: 'schedule',
    title: 'Ders Programı / Saat raporu',
    description: 'Talep bazlı gün, saat ve laboratuvar eşleşmeleri (çakışma kontrolü için)',
    icon: CalendarDays,
    // Backend reuses the admin-only schedule calendar data source (GetScheduleAsync), so
    // non-admins would get a 403 — hide the card instead of offering a button that always fails.
    adminOnly: true,
  },
] as const;

export function ReportsPage() {
  const { hasRole } = useAuth();
  const { showToast } = useToast();
  const [format, setFormat] = useState<'xlsx' | 'csv' | 'pdf'>('xlsx');
  const [academicTermId, setAcademicTermId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [downloading, setDownloading] = useState('');
  const isAcademic =
    hasRole(ROLES.academic, ROLES.administrative) && !hasRole(ROLES.administrator, ROLES.faculty);
  const isAdministrator = hasRole(ROLES.administrator);
  const visibleReports = reportDefinitions.filter((report) => !report.adminOnly || isAdministrator);

  const exportReport = async (id: string, title: string) => {
    try {
      setDownloading(id);
      await downloadFile(
        `/reports/${id}${buildQuery(
          id === 'requests' ? { format, academicTermId, facultyId } : { format },
        )}`,
        `${title.toLocaleLowerCase('tr-TR').replace(/\s+/g, '-')}.${format}`,
      );
      showToast('Rapor güvenli biçimde indirildi.');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setDownloading('');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Analiz ve dışa aktarım"
        title="Rapor Merkezi"
        description={
          isAcademic
            ? 'Yalnızca kendi taleplerinizden oluşan raporları indirin.'
            : 'Yetki kapsamınızdaki yazılım, fakülte ve laboratuvar verilerini raporlayın.'
        }
      />
      <Card className="report-filter-bar">
        <div>
          <span className="report-filter-bar__icon">
            <FileBarChart />
          </span>
          <div>
            <strong>Rapor kapsamı</strong>
            <small>Dönem ve fakülte filtreleri yalnızca Talep raporuna uygulanır.</small>
          </div>
        </div>
        {!isAcademic && (
          <label className="field">
            <span>Fakülte kimliği</span>
            <input
              value={facultyId}
              onChange={(event) => setFacultyId(event.target.value)}
              placeholder="Tümü"
            />
          </label>
        )}
        <label className="field">
          <span>Akademik dönem kimliği</span>
          <input
            value={academicTermId}
            onChange={(event) => setAcademicTermId(event.target.value)}
            placeholder="Güncel dönem"
          />
        </label>
        <label className="field">
          <span>Dosya biçimi</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value as typeof format)}
          >
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV (.csv)</option>
            <option value="pdf">PDF (.pdf)</option>
          </select>
        </label>
      </Card>
      <section className="report-grid">
        {visibleReports.map(({ id, title, description, icon: Icon }) => (
          <Card className="report-card" key={id}>
            <span className="report-card__icon">
              <Icon />
            </span>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <Button
              variant="secondary"
              isLoading={downloading === id}
              icon={<Download />}
              onClick={() => void exportReport(id, title)}
            >
              {format.toLocaleUpperCase('tr-TR')} indir
            </Button>
          </Card>
        ))}
      </section>
      <div className="privacy-note">
        <ShieldCheck />
        <p>
          Raporlar oturumunuzdaki kullanıcı ve fakülte yetkileriyle sunucuda filtrelenir. Öğrenci
          ayrıntıları standart raporlara dahil edilmez.
        </p>
      </div>
    </>
  );
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const query = useQuery({
    queryKey: ['notifications', page, filter],
    queryFn: async () =>
      normalizePage<Notification>(
        await apiRequest(
          `/notifications${buildQuery({
            page,
            pageSize: 15,
            unread: filter === 'unread',
          })}`,
        ),
        page,
        15,
      ),
  });
  const readMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest(`/notifications/${notificationId}/read`, { method: 'POST' }),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAllMutation = useMutation({
    mutationFn: () => apiRequest('/notifications/read-all', { method: 'POST' }),
    onSuccess: async () => {
      showToast('Tüm bildirimler okundu olarak işaretlendi.');
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const unreadCount = query.data?.items.filter((item) => !item.isRead).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Uygulama içi bildirimler"
        title="Bildirimler"
        description={`${unreadCount} okunmamış bildiriminiz bulunuyor.`}
        action={
          <Button
            variant="secondary"
            icon={<CheckCheck />}
            isLoading={readAllMutation.isPending}
            onClick={() => readAllMutation.mutate()}
          >
            Tümünü okundu işaretle
          </Button>
        }
      />
      <Card className="notification-panel">
        <div className="notification-tabs" role="tablist">
          <button
            className={classNames(filter === 'all' && 'is-active')}
            onClick={() => {
              setFilter('all');
              setPage(1);
            }}
          >
            Tümü
          </button>
          <button
            className={classNames(filter === 'unread' && 'is-active')}
            onClick={() => {
              setFilter('unread');
              setPage(1);
            }}
          >
            Okunmamış
          </button>
        </div>
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !query.data?.items.length ? (
          <EmptyState title="Bildirim bulunmuyor" description="Güncel durumdasınız." />
        ) : (
          <>
            <div className="notification-list">
              {query.data?.items.map((notification) => (
                <article
                  className={classNames(!notification.isRead && 'is-unread')}
                  key={notification.id}
                >
                  <span
                    className={`notification-list__icon notification-list__icon--${notification.type ?? 'info'}`}
                  >
                    {notification.isRead ? <Bell /> : <BellRing />}
                  </span>
                  <div>
                    <div>
                      <strong>{notification.title}</strong>
                      <time>{formatDate(notification.createdAt, true)}</time>
                    </div>
                    <p>{notification.message}</p>
                    {notification.link && (
                      <Link to={normalizeNotificationLink(notification.link)}>
                        Kayda git <ChevronRight />
                      </Link>
                    )}
                  </div>
                  {!notification.isRead && (
                    <button
                      type="button"
                      onClick={() => readMutation.mutate(notification.id)}
                      aria-label={`${notification.title} bildirimini okundu işaretle`}
                    >
                      <CheckCheck />
                    </button>
                  )}
                </article>
              ))}
            </div>
            <Pagination
              page={query.data?.page ?? page}
              totalPages={query.data?.totalPages ?? 1}
              totalCount={query.data?.totalCount ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}

interface AuditRecord {
  id: string;
  userId?: string;
  userName?: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  createdAt: string;
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');
  const query = useQuery({
    queryKey: ['audit', page, search, actionType],
    queryFn: async () =>
      normalizePage<AuditRecord>(
        await apiRequest(`/audit-logs${buildQuery({ page, pageSize: 20, search, actionType })}`),
        page,
        20,
      ),
  });
  return (
    <>
      <PageHeader
        eyebrow="Güvenlik ve izlenebilirlik"
        title="Audit Log"
        description="Kritik kullanıcı ve veri işlemlerinin değiştirilemez sistem günlüğünü inceleyin."
      />
      <Card className="table-card">
        <div className="management-toolbar">
          <label className="search-field">
            <Search />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Kullanıcı, varlık veya işlem ara…"
            />
          </label>
          <label className="compact-field">
            <select value={actionType} onChange={(event) => setActionType(event.target.value)}>
              <option value="">Tüm işlem türleri</option>
              <option value="LoginSucceeded">Başarılı giriş</option>
              <option value="LoginFailed">Başarısız giriş</option>
              <option value="Created">Kayıt oluşturma</option>
              <option value="Updated">Kayıt güncelleme</option>
              <option value="Deleted">Kayıt silme</option>
              <option value="RequestStatusChanged">Durum değiştirme</option>
            </select>
          </label>
        </div>
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : !query.data?.items.length ? (
          <EmptyState title="Audit kaydı bulunamadı" />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Kullanıcı</th>
                    <th>İşlem</th>
                    <th>Varlık</th>
                    <th>Varlık kimliği</th>
                    <th>IP adresi</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data?.items.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.createdAt, true)}</td>
                      <td>
                        <strong>{record.userName ?? 'Sistem'}</strong>
                        <small>{record.userId ?? '—'}</small>
                      </td>
                      <td>
                        <span className="audit-action">
                          <History /> {record.actionType}
                        </span>
                      </td>
                      <td>{record.entityType ?? '—'}</td>
                      <td>
                        <code>{record.entityId ?? '—'}</code>
                      </td>
                      <td>{record.ipAddress ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={query.data?.page ?? page}
              totalPages={query.data?.totalPages ?? 1}
              totalCount={query.data?.totalCount ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}

interface SystemSettingRecord {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  isSecret: boolean;
}

interface HealthStatus {
  status?: string;
  environment?: string;
  version?: string;
  utcTime?: string;
  checks?: Record<string, string>;
}

export function SettingsPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<
    Record<string, Partial<Pick<SystemSettingRecord, 'value' | 'description'>>>
  >({});
  const settingsQuery = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => unwrap<SystemSettingRecord[]>(await apiRequest('/system-settings')),
  });
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: async () => unwrap<HealthStatus>(await apiRequest('/health')),
    refetchInterval: 60_000,
  });
  const settings = (settingsQuery.data ?? []).map((setting) => ({
    ...setting,
    ...drafts[setting.key],
  }));
  const mutation = useMutation({
    mutationFn: (setting: SystemSettingRecord) =>
      apiRequest(`/system-settings/${encodeURIComponent(setting.key)}`, {
        method: 'PUT',
        body: {
          value: setting.value ?? '',
          description: setting.description?.trim() || null,
          isSecret: setting.isSecret,
        },
      }),
    onSuccess: async (_, setting) => {
      setDrafts((current) => {
        const next = { ...current };
        delete next[setting.key];
        return next;
      });
      showToast('Sistem ayarı kaydedildi.');
      await queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });
  const updateSetting = (
    key: string,
    changes: Partial<Pick<SystemSettingRecord, 'value' | 'description'>>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [key]: { ...current[key], ...changes },
    }));
  };

  const [testRecipient, setTestRecipient] = useState('');
  const testMutation = useMutation({
    mutationFn: async () =>
      unwrap<{ success: boolean; message: string }>(
        await apiRequest('/system-settings/smtp-test', {
          method: 'POST',
          body: { recipient: testRecipient.trim() },
        }),
      ),
    onSuccess: (result) => showToast(result.message, result.success ? 'success' : 'error'),
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  return (
    <>
      <PageHeader
        eyebrow="Sistem yönetimi"
        title="Sistem Ayarları"
        description="Uygulamanın güvenli çalışma sınırlarını ve development entegrasyonlarını yönetin."
      />
      <div className="settings-layout">
        <div>
          <Card className="settings-card">
            <div className="detail-card__heading">
              <div>
                <Settings />
                <h2>Genel ayarlar</h2>
              </div>
            </div>
            {settingsQuery.isLoading ? (
              <LoadingState />
            ) : settingsQuery.isError ? (
              <ErrorState error={settingsQuery.error} />
            ) : settings.length === 0 ? (
              <EmptyState
                title="Tanımlı sistem ayarı yok"
                description="Ayarlar sunucu tarafından tanımlandığında burada görüntülenir."
              />
            ) : (
              <div className="settings-record-list">
                {settings.map((setting) => (
                  <div className="settings-record" key={setting.id || setting.key}>
                    <div className="form-grid">
                      <label className="field">
                        <span>Ayar anahtarı</span>
                        <input value={setting.key} readOnly />
                      </label>
                      <label className="field">
                        <span>Değer</span>
                        <input
                          type={setting.isSecret ? 'password' : 'text'}
                          value={setting.value ?? ''}
                          disabled={setting.isSecret}
                          onChange={(event) =>
                            updateSetting(setting.key, { value: event.target.value })
                          }
                        />
                      </label>
                      <label className="field field--full">
                        <span>Açıklama</span>
                        <textarea
                          rows={2}
                          value={setting.description ?? ''}
                          disabled={setting.isSecret}
                          onChange={(event) =>
                            updateSetting(setting.key, { description: event.target.value })
                          }
                        />
                      </label>
                    </div>
                    <div className="settings-record__actions">
                      {setting.isSecret && (
                        <small>Gizli değerler yalnızca ortam değişkenlerinden yönetilir.</small>
                      )}
                      <Button
                        variant="secondary"
                        disabled={setting.isSecret}
                        isLoading={mutation.isPending && mutation.variables?.key === setting.key}
                        onClick={() => mutation.mutate(setting)}
                      >
                        Bu ayarı kaydet
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card className="settings-card">
            <div className="detail-card__heading">
              <div>
                <Mail />
                <h2>SMTP testi</h2>
              </div>
            </div>
            <p>
              Talep bildirimleri için kullanılan SMTP yapılandırmasını (SmtpHost, SmtpPort,
              SmtpFrom) test etmek için bir adrese deneme e-postası gönderin.
            </p>
            <div className="form-grid">
              <label className="field field--full">
                <span>Alıcı e-posta</span>
                <input
                  type="email"
                  value={testRecipient}
                  placeholder="ornek@fbu.edu.tr"
                  onChange={(event) => setTestRecipient(event.target.value)}
                />
              </label>
            </div>
            <div className="settings-record__actions">
              <Button
                variant="secondary"
                disabled={!testRecipient.trim()}
                isLoading={testMutation.isPending}
                onClick={() => testMutation.mutate()}
              >
                Test e-postası gönder
              </Button>
            </div>
          </Card>
        </div>
        <aside>
          <Card className="health-card">
            <div className="health-card__heading">
              <span
                className={classNames(
                  'health-dot',
                  healthQuery.data?.status?.toLocaleLowerCase('tr-TR') === 'healthy' &&
                    'is-healthy',
                )}
              />
              <div>
                <strong>Sistem sağlığı</strong>
                <small>Son kontrol: şimdi</small>
              </div>
            </div>
            {healthQuery.isLoading ? (
              <LoadingState />
            ) : healthQuery.isError ? (
              <ErrorState error={healthQuery.error} />
            ) : (
              <dl>
                <div>
                  <dt>API</dt>
                  <dd>{healthQuery.data?.status ?? 'Bilinmiyor'}</dd>
                </div>
                <div>
                  <dt>Ortam</dt>
                  <dd>{healthQuery.data?.environment ?? '—'}</dd>
                </div>
                <div>
                  <dt>UTC zamanı</dt>
                  <dd>{formatDate(healthQuery.data?.utcTime, true)}</dd>
                </div>
                {Object.entries(healthQuery.data?.checks ?? {}).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
          <div className="security-reminder">
            <ShieldCheck />
            <div>
              <strong>Hassas ayarlar korunur</strong>
              <p>
                SMTP parolası, JWT anahtarı ve bağlantı dizeleri bu ekranda gösterilmez; ortam
                değişkenlerinden alınır.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
