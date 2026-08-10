import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellRing,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  History,
  KeyRound,
  Mail,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
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
  Modal,
  PageHeader,
  Pagination,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest, downloadFile } from '../lib/api';
import { ManagementPage } from './ManagementPages';
import { normalizeNotificationLink } from '../lib/routes';
import {
  buildQuery,
  classNames,
  formatDate,
  getErrorMessage,
  normalizePage,
  setTimeZone,
  unwrap,
} from '../lib/utils';
import { ROLES, type Notification, type RequestCollectionStatus } from '../types';

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
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  LoginSucceeded: 'Başarılı giriş',
  LoginFailed: 'Başarısız giriş',
  Logout: 'Çıkış yapıldı',
  Created: 'Kayıt oluşturma',
  Updated: 'Kayıt güncelleme',
  Deleted: 'Kayıt silme',
  RequestSubmitted: 'Talep gönderildi',
  RequestStatusChanged: 'Talep durumu değiştirildi',
  FacultyChanged: 'Fakülte değiştirildi',
  SoftwareCreated: 'Yazılım oluşturuldu',
  SoftwareSuggested: 'Yazılım önerildi',
  SuggestionApproved: 'Öneri onaylandı',
  SuggestionRejected: 'Öneri reddedildi',
  UserCreated: 'Kullanıcı oluşturuldu',
  UserRoleChanged: 'Kullanıcı rolü değiştirildi',
  UserFacultyPermissionChanged: 'Kullanıcı fakülte yetkisi değiştirildi',
  ReportDownloaded: 'Rapor indirildi',
  RefreshTokenRotated: 'Oturum jetonu yenilendi',
  RefreshTokenRevoked: 'Oturum jetonu iptal edildi',
};

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  Authentication: 'Kimlik doğrulama',
  ApplicationUser: 'Kullanıcı',
  RefreshToken: 'Oturum jetonu',
  SoftwareSuggestion: 'Yazılım önerisi',
  SoftwareRequest: 'Yazılım talebi',
  UserFacultyPermission: 'Kullanıcı fakülte yetkisi',
  RequestReport: 'Talep raporu',
  ScheduleReport: 'Program raporu',
  SoftwareReport: 'Yazılım raporu',
  FacultyReport: 'Fakülte raporu',
  LaboratoryReport: 'Laboratuvar raporu',
};

function auditActionLabel(actionType: string): string {
  return AUDIT_ACTION_LABELS[actionType] ?? actionType;
}

function auditEntityLabel(entityType?: string): string {
  if (!entityType) return '—';
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType;
}

function formatAuditJson(value?: string): string | null {
  if (!value) return null;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);
  const query = useQuery({
    queryKey: ['audit', page, search, actionType],
    queryFn: async () =>
      normalizePage<AuditRecord>(
        await apiRequest(`/audit-logs${buildQuery({ page, pageSize: 20, search, actionType })}`),
        page,
        20,
      ),
  });
  const oldValuesText = formatAuditJson(selectedRecord?.oldValues);
  const newValuesText = formatAuditJson(selectedRecord?.newValues);
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
                    <th className="table-actions-cell" />
                  </tr>
                </thead>
                <tbody>
                  {query.data?.items.map((record) => (
                    <tr
                      key={record.id}
                      className="audit-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedRecord(record)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedRecord(record);
                        }
                      }}
                      aria-label={`${auditActionLabel(record.actionType)} kaydının detayını görüntüle`}
                    >
                      <td>{formatDate(record.createdAt, true)}</td>
                      <td>
                        <strong>{record.userName ?? 'Sistem'}</strong>
                        <small>{record.userId ?? '—'}</small>
                      </td>
                      <td>
                        <span className="audit-action">
                          <History /> {auditActionLabel(record.actionType)}
                        </span>
                      </td>
                      <td>{auditEntityLabel(record.entityType)}</td>
                      <td>
                        <code>{record.entityId ?? '—'}</code>
                      </td>
                      <td>{record.ipAddress ?? '—'}</td>
                      <td className="table-actions-cell">
                        <ChevronRight aria-hidden="true" />
                      </td>
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

      <Modal
        open={selectedRecord !== null}
        title={selectedRecord ? auditActionLabel(selectedRecord.actionType) : ''}
        description="Audit kaydının tüm ayrıntıları."
        onClose={() => setSelectedRecord(null)}
        size="large"
      >
        {selectedRecord && (
          <dl className="detail-list detail-list--grid">
            <div>
              <dt>Tarih</dt>
              <dd>{formatDate(selectedRecord.createdAt, true)}</dd>
            </div>
            <div>
              <dt>İşlem türü</dt>
              <dd>
                {auditActionLabel(selectedRecord.actionType)} <small>({selectedRecord.actionType})</small>
              </dd>
            </div>
            <div>
              <dt>Kullanıcı</dt>
              <dd>{selectedRecord.userName ?? 'Sistem'}</dd>
            </div>
            <div>
              <dt>Kullanıcı kimliği</dt>
              <dd>
                <code>{selectedRecord.userId ?? '—'}</code>
              </dd>
            </div>
            <div>
              <dt>Varlık</dt>
              <dd>{auditEntityLabel(selectedRecord.entityType)}</dd>
            </div>
            <div>
              <dt>Varlık kimliği</dt>
              <dd>
                <code>{selectedRecord.entityId ?? '—'}</code>
              </dd>
            </div>
            <div>
              <dt>IP adresi</dt>
              <dd>{selectedRecord.ipAddress ?? '—'}</dd>
            </div>
            <div className="detail-list__full">
              <dt>Tarayıcı / istemci</dt>
              <dd>{selectedRecord.userAgent ?? '—'}</dd>
            </div>
            {oldValuesText && (
              <div className="detail-list__full">
                <dt>Eski değerler</dt>
                <dd>
                  <pre className="audit-json">{oldValuesText}</pre>
                </dd>
              </div>
            )}
            {newValuesText && (
              <div className="detail-list__full">
                <dt>Yeni değerler</dt>
                <dd>
                  <pre className="audit-json">{newValuesText}</pre>
                </dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
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

// Bu anahtarlar artık "Genel Ayarlar"daki ham liste yerine kendi SMTP sekmesinde
// (SmtpSettingsTab) düzenleniyor; ikisinde birden görünmemesi için Genel Ayarlar bu
// anahtarları filtreler.
const SMTP_SETTING_KEYS = ['SmtpHost', 'SmtpPort', 'SmtpFrom', 'SmtpEnableSsl', 'NotificationEmail'];

// Aynı desen: "Talep Toplama" sekmesinin (RequestCollectionSettingsTab) kendi anahtarları,
// Genel Ayarlar'daki ham listede tekrar görünmesin diye filtrelenir.
const REQUEST_COLLECTION_SETTING_KEYS = [
  'RequestCollectionEnabled',
  'RequestCollectionStartDate',
  'RequestCollectionEndDate',
];

type SettingsTab =
  | 'zaman-dilimi'
  | 'genel'
  | 'smtp'
  | 'saml'
  | 'ad'
  | 'talep-toplama'
  | 'kullanicilar'
  | 'audit';

const settingsTabs: Array<{ id: SettingsTab; label: string; icon: typeof Settings }> = [
  { id: 'zaman-dilimi', label: 'Zaman Dilimi', icon: Clock },
  { id: 'genel', label: 'Genel Ayarlar', icon: SlidersHorizontal },
  { id: 'smtp', label: 'SMTP / Bildirim', icon: Mail },
  { id: 'saml', label: 'SAML / Entra ID', icon: KeyRound },
  { id: 'ad', label: 'AD Entegrasyonu', icon: Users },
  { id: 'talep-toplama', label: 'Talep Toplama', icon: CalendarClock },
  { id: 'kullanicilar', label: 'Kullanıcı Yönetimi', icon: UserCog },
  { id: 'audit', label: 'Audit Log', icon: History },
];

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('zaman-dilimi');

  return (
    <>
      <PageHeader
        eyebrow="Sistem yönetimi"
        title="Sistem Ayarları"
        description="Uygulamanın güvenli çalışma sınırlarını ve development entegrasyonlarını yönetin."
      />
      <div className="settings-tabs" role="tablist">
        {settingsTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={classNames(tab === id && 'is-active')}
            onClick={() => setTab(id)}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {tab === 'zaman-dilimi' && <TimeZoneSettings />}
      {tab === 'genel' && <GeneralSettings />}
      {tab === 'smtp' && <SmtpSettingsTab />}
      {tab === 'saml' && <SamlSettingsTab />}
      {tab === 'ad' && <AdIntegrationSettings />}
      {tab === 'talep-toplama' && <RequestCollectionSettingsTab />}
      {tab === 'kullanicilar' && <ManagementPage kind="users" />}
      {tab === 'audit' && <AuditPage />}
    </>
  );
}

const timeZoneOptions = [
  { value: 'Europe/Istanbul', label: 'İstanbul (UTC+3)' },
  { value: 'Etc/UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'Londra' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'America/New_York', label: 'New York' },
];

function TimeZoneSettings() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => unwrap<SystemSettingRecord[]>(await apiRequest('/system-settings')),
  });
  const currentValue =
    settingsQuery.data?.find((setting) => setting.key === 'SystemTimeZone')?.value ?? 'Europe/Istanbul';
  const [selected, setSelected] = useState(currentValue);
  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest('/system-settings/SystemTimeZone', {
        method: 'POST',
        body: {
          value: selected,
          description: 'Tarih/saat gösterimlerinde kullanılan IANA zaman dilimi kimliği',
          isSecret: false,
        },
      }),
    onSuccess: async () => {
      setTimeZone(selected);
      showToast('Zaman dilimi kaydedildi.');
      await queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  return (
    <Card className="settings-card">
      <div className="detail-card__heading">
        <div>
          <Clock />
          <h2>Zaman Dilimi</h2>
        </div>
      </div>
      {settingsQuery.isLoading ? (
        <LoadingState />
      ) : settingsQuery.isError ? (
        <ErrorState error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} />
      ) : (
        <>
          <div className="form-grid">
            <label className="field">
              <span>Sistem zaman dilimi</span>
              <select value={selected} onChange={(event) => setSelected(event.target.value)}>
                {timeZoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="field-hint">
            Tarih ve saat gösterimleri bu değere göre biçimlenir. Kayıtlar UTC saklanır.
          </p>
          <div className="settings-record__actions">
            <Button
              variant="secondary"
              disabled={selected === currentValue}
              isLoading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Kaydet
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

interface LdapSettingsForm {
  enabled: boolean;
  primaryHost: string;
  primaryPort: number;
  secondaryHost: string;
  secondaryPort: string;
  bindDn: string;
  bindPassword: string;
  academicOu: string;
  administrativeOu: string;
  syncIntervalHours: number;
  syncTimeOfDay: string;
}

const emptyLdapForm: LdapSettingsForm = {
  enabled: false,
  primaryHost: '',
  primaryPort: 636,
  secondaryHost: '',
  secondaryPort: '',
  bindDn: '',
  bindPassword: '',
  academicOu: '',
  administrativeOu: '',
  syncIntervalHours: 12,
  syncTimeOfDay: '',
};

interface LdapSettingsDto {
  enabled: boolean;
  primaryHost: string;
  primaryPort: number;
  secondaryHost: string | null;
  secondaryPort: number | null;
  bindDn: string;
  hasBindPassword: boolean;
  academicOu: string;
  administrativeOu: string;
  syncIntervalHours: number;
  syncTimeOfDay: string | null;
}

interface SamlSettingsDto {
  enabled: boolean;
  idpEntityId: string;
  idpSsoUrl: string;
  idpSloUrl: string | null;
  certificate: string;
  emailAttribute: string;
  displayNameAttribute: string;
  nameIdMapping: string;
  spEntityId: string;
  spAcsUrl: string;
  spMetadataUrl: string;
}

interface SamlSettingsForm {
  enabled: boolean;
  idpEntityId: string;
  idpSsoUrl: string;
  idpSloUrl: string;
  certificate: string;
  emailAttribute: string;
  displayNameAttribute: string;
  nameIdMapping: string;
}

const emptySamlForm: SamlSettingsForm = {
  enabled: false,
  idpEntityId: '',
  idpSsoUrl: '',
  idpSloUrl: '',
  certificate: '',
  emailAttribute: '',
  displayNameAttribute: '',
  nameIdMapping: '',
};

function SamlSettingsTab() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SamlSettingsForm>(emptySamlForm);
  const [formLoaded, setFormLoaded] = useState(false);
  const settingsQuery = useQuery({
    queryKey: ['saml-settings'],
    queryFn: async () => unwrap<SamlSettingsDto>(await apiRequest('/admin/saml-settings')),
  });
  if (settingsQuery.data && !formLoaded) {
    const data = settingsQuery.data;
    setForm({
      enabled: data.enabled,
      idpEntityId: data.idpEntityId,
      idpSsoUrl: data.idpSsoUrl,
      idpSloUrl: data.idpSloUrl ?? '',
      certificate: data.certificate,
      emailAttribute: data.emailAttribute,
      displayNameAttribute: data.displayNameAttribute,
      nameIdMapping: data.nameIdMapping,
    });
    setFormLoaded(true);
  }
  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest('/admin/saml-settings', {
        method: 'POST',
        body: {
          enabled: form.enabled,
          idpEntityId: form.idpEntityId.trim(),
          idpSsoUrl: form.idpSsoUrl.trim(),
          idpSloUrl: form.idpSloUrl.trim() || null,
          certificate: form.certificate.trim(),
          emailAttribute: form.emailAttribute.trim(),
          displayNameAttribute: form.displayNameAttribute.trim(),
          nameIdMapping: form.nameIdMapping.trim(),
        },
      }),
    onSuccess: async () => {
      showToast(
        form.enabled
          ? 'SAML ayarları kaydedildi ve etkinleştirildi — bir sonraki girişten itibaren geçerli.'
          : 'SAML ayarları kaydedildi.',
      );
      await queryClient.invalidateQueries({ queryKey: ['saml-settings'] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  return (
    <Card className="settings-card">
      <div className="detail-card__heading">
        <div>
          <KeyRound />
          <h2>SAML / Microsoft Entra ID</h2>
        </div>
      </div>
      {settingsQuery.isLoading ? (
        <LoadingState />
      ) : settingsQuery.isError ? (
        <ErrorState error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} />
      ) : (
        <>
          <div className="toggle-list">
            <label>
              <span>
                <strong>SAML ile girişi etkinleştir</strong>
                <small>
                  Kapalıyken (veya hiç kaydedilmemişse) sunucudaki mevcut yapılandırma
                  kullanılmaya devam eder.
                </small>
              </span>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>SP Entity ID</span>
              <input value={settingsQuery.data?.spEntityId ?? ''} readOnly />
            </label>
            <label className="field">
              <span>SP ACS URL</span>
              <input value={settingsQuery.data?.spAcsUrl ?? ''} readOnly />
            </label>
            <label className="field field--full">
              <span>SP Metadata URL</span>
              <input value={settingsQuery.data?.spMetadataUrl ?? ''} readOnly />
              <small className="field-hint">
                Bu üç alan sunucu adresinden otomatik hesaplanır, buradan değiştirilemez.
              </small>
            </label>
            <label className="field">
              <span>IdP Entity ID</span>
              <input
                value={form.idpEntityId}
                onChange={(event) => setForm((current) => ({ ...current, idpEntityId: event.target.value }))}
                placeholder="https://sts.windows.net/…/"
              />
            </label>
            <label className="field">
              <span>IdP SSO URL</span>
              <input
                value={form.idpSsoUrl}
                onChange={(event) => setForm((current) => ({ ...current, idpSsoUrl: event.target.value }))}
                placeholder="https://login.microsoftonline.com/…/saml2"
              />
            </label>
            <label className="field">
              <span>IdP SLO URL (opsiyonel)</span>
              <input
                value={form.idpSloUrl}
                onChange={(event) => setForm((current) => ({ ...current, idpSloUrl: event.target.value }))}
                placeholder="https://login.microsoftonline.com/…/saml2"
              />
            </label>
            <label className="field field--full">
              <span>X.509 Sertifikası</span>
              <textarea
                rows={8}
                value={form.certificate}
                onChange={(event) => setForm((current) => ({ ...current, certificate: event.target.value }))}
                placeholder="-----BEGIN CERTIFICATE-----&#10;…&#10;-----END CERTIFICATE-----"
              />
            </label>
            <label className="field">
              <span>E-posta Attribute</span>
              <input
                value={form.emailAttribute}
                onChange={(event) => setForm((current) => ({ ...current, emailAttribute: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Görünen Ad Attribute</span>
              <input
                value={form.displayNameAttribute}
                onChange={(event) => setForm((current) => ({ ...current, displayNameAttribute: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>NameID Mapping</span>
              <input
                value={form.nameIdMapping}
                onChange={(event) => setForm((current) => ({ ...current, nameIdMapping: event.target.value }))}
              />
            </label>
          </div>
          <p className="field-hint">
            Roller SAML üzerinden atanmaz — AD senkronundan gelen OU bilgisine göre otomatik
            belirlenir (Academic/Administrative), Fakülte Yetkilisi ve Sistem Yöneticisi
            rolleri Kullanıcı Yönetimi ekranından elle verilir.
          </p>
          <div className="settings-record__actions">
            <Button variant="secondary" isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              SAML ayarlarını kaydet
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function AdIntegrationSettings() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<LdapSettingsForm>(emptyLdapForm);
  const [formLoaded, setFormLoaded] = useState(false);
  const statusQuery = useQuery({
    queryKey: ['ad-sync-status'],
    queryFn: async () =>
      unwrap<{ isConfigured: boolean; lastSyncedAt: string | null; syncedUserCount: number }>(
        await apiRequest('/admin/ad-sync'),
      ),
  });
  const settingsQuery = useQuery({
    queryKey: ['ad-sync-settings'],
    queryFn: async () => unwrap<LdapSettingsDto>(await apiRequest('/admin/ad-sync/settings')),
  });
  if (settingsQuery.data && !formLoaded) {
    const data = settingsQuery.data;
    setForm({
      enabled: data.enabled,
      primaryHost: data.primaryHost,
      primaryPort: data.primaryPort,
      secondaryHost: data.secondaryHost ?? '',
      secondaryPort: data.secondaryPort?.toString() ?? '',
      bindDn: data.bindDn,
      bindPassword: '',
      academicOu: data.academicOu,
      administrativeOu: data.administrativeOu,
      syncIntervalHours: data.syncIntervalHours,
      syncTimeOfDay: data.syncTimeOfDay ?? '',
    });
    setFormLoaded(true);
  }
  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest('/admin/ad-sync/settings', {
        method: 'POST',
        body: {
          enabled: form.enabled,
          primaryHost: form.primaryHost.trim(),
          primaryPort: form.primaryPort,
          secondaryHost: form.secondaryHost.trim() || null,
          secondaryPort: form.secondaryPort ? Number(form.secondaryPort) : null,
          bindDn: form.bindDn.trim(),
          bindPassword: form.bindPassword || null,
          academicOu: form.academicOu.trim(),
          administrativeOu: form.administrativeOu.trim(),
          syncIntervalHours: form.syncIntervalHours,
          syncTimeOfDay: form.syncTimeOfDay || null,
        },
      }),
    onSuccess: async () => {
      showToast('AD/LDAP bağlantı ayarları kaydedildi.');
      setForm((current) => ({ ...current, bindPassword: '' }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ad-sync-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['ad-sync-status'] }),
      ]);
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });
  const syncMutation = useMutation({
    mutationFn: async () =>
      unwrap<{ created: number; updated: number; deactivated: number; facultiesCreated: number }>(
        await apiRequest('/admin/ad-sync', { method: 'POST' }),
      ),
    onSuccess: async (result) => {
      showToast(
        `Senkronizasyon tamamlandı: ${result.created} yeni, ${result.updated} güncellendi, ${result.deactivated} pasifleştirildi.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['ad-sync-status'] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  return (
    <>
      <Card className="settings-card">
        <div className="detail-card__heading">
          <div>
            <Users />
            <h2>AD Entegrasyonu — Bağlantı Ayarları</h2>
          </div>
        </div>
        {settingsQuery.isLoading ? (
          <LoadingState />
        ) : settingsQuery.isError ? (
          <ErrorState error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} />
        ) : (
          <>
            <div className="toggle-list">
              <label>
                <span>
                  <strong>AD senkronizasyonunu etkinleştir</strong>
                  <small>Kapalıyken bu ekrandaki değerler yok sayılır.</small>
                </span>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
              </label>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Birincil DC</span>
                <input
                  value={form.primaryHost}
                  onChange={(event) => setForm((current) => ({ ...current, primaryHost: event.target.value }))}
                  placeholder="10.2.0.11"
                />
              </label>
              <label className="field">
                <span>Birincil DC portu</span>
                <input
                  type="number"
                  value={form.primaryPort}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, primaryPort: Number(event.target.value) || 636 }))
                  }
                />
              </label>
              <label className="field">
                <span>Yedek DC (opsiyonel)</span>
                <input
                  value={form.secondaryHost}
                  onChange={(event) => setForm((current) => ({ ...current, secondaryHost: event.target.value }))}
                  placeholder="10.2.0.12"
                />
              </label>
              <label className="field">
                <span>Yedek DC portu</span>
                <input
                  type="number"
                  value={form.secondaryPort}
                  onChange={(event) => setForm((current) => ({ ...current, secondaryPort: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Bind DN</span>
                <input
                  value={form.bindDn}
                  onChange={(event) => setForm((current) => ({ ...current, bindDn: event.target.value }))}
                  placeholder="CN=Lab Query,OU=SERVICES,OU=FBU USER,DC=fbu,DC=edu,DC=tr"
                />
              </label>
              <label className="field">
                <span>Bind şifresi</span>
                <input
                  type="password"
                  value={form.bindPassword}
                  onChange={(event) => setForm((current) => ({ ...current, bindPassword: event.target.value }))}
                  placeholder={settingsQuery.data?.hasBindPassword ? '••••••••  (değiştirmek için doldurun)' : ''}
                />
              </label>
              <label className="field">
                <span>Academic OU</span>
                <input
                  value={form.academicOu}
                  onChange={(event) => setForm((current) => ({ ...current, academicOu: event.target.value }))}
                  placeholder="OU=ACADEMIC,OU=FBU USER,DC=fbu,DC=edu,DC=tr"
                />
              </label>
              <label className="field">
                <span>Administrative OU</span>
                <input
                  value={form.administrativeOu}
                  onChange={(event) => setForm((current) => ({ ...current, administrativeOu: event.target.value }))}
                  placeholder="OU=ADMINISTRATIVE,OU=FBU USER,DC=fbu,DC=edu,DC=tr"
                />
              </label>
              <label className="field">
                <span>Senkron sıklığı (saat)</span>
                <input
                  type="number"
                  min={1}
                  value={form.syncIntervalHours}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, syncIntervalHours: Number(event.target.value) || 12 }))
                  }
                />
              </label>
              <label className="field">
                <span>Günün belirli saatinde çalıştır (UTC, opsiyonel)</span>
                <input
                  type="time"
                  value={form.syncTimeOfDay}
                  onChange={(event) => setForm((current) => ({ ...current, syncTimeOfDay: event.target.value }))}
                />
                <small className="field-hint">
                  Doldurulursa senkron sıklığı yerine günde bir kez bu saatte (UTC) çalışır.
                </small>
              </label>
            </div>
            <div className="settings-record__actions">
              <Button variant="secondary" isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                Bağlantı ayarlarını kaydet
              </Button>
            </div>
          </>
        )}
      </Card>
      <Card className="settings-card">
      <div className="detail-card__heading">
        <div>
          <Users />
          <h2>AD Entegrasyonu — Durum</h2>
        </div>
      </div>
      <p>
        Kurumsal Active Directory dizininden akademisyen ve idari personel hesaplarını
        senkronize edin.
      </p>
      {statusQuery.isLoading ? (
        <LoadingState />
      ) : statusQuery.isError ? (
        <ErrorState error={statusQuery.error} onRetry={() => void statusQuery.refetch()} />
      ) : !statusQuery.data?.isConfigured ? (
        <div className="security-reminder">
          <ShieldCheck />
          <div>
            <strong>LDAP yapılandırılmamış</strong>
            <p>Yukarıdaki bağlantı ayarlarını doldurup kaydedin ve etkinleştirin.</p>
          </div>
        </div>
      ) : (
        <>
          <dl className="ad-sync-status">
            <div>
              <dt>Son senkronizasyon</dt>
              <dd>
                {statusQuery.data.lastSyncedAt
                  ? formatDate(statusQuery.data.lastSyncedAt, true)
                  : 'Henüz çalıştırılmadı'}
              </dd>
            </div>
            <div>
              <dt>Dizinden gelen kullanıcı sayısı</dt>
              <dd>{statusQuery.data.syncedUserCount}</dd>
            </div>
          </dl>
          <div className="settings-record__actions">
            <Button
              variant="secondary"
              icon={<RefreshCw size={16} aria-hidden="true" />}
              isLoading={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              Şimdi senkronize et
            </Button>
          </div>
        </>
      )}
      </Card>
    </>
  );
}

function GeneralSettings() {
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
  const settings = (settingsQuery.data ?? [])
    .filter(
      (setting) =>
        !SMTP_SETTING_KEYS.includes(setting.key) &&
        !REQUEST_COLLECTION_SETTING_KEYS.includes(setting.key),
    )
    .map((setting) => ({
      ...setting,
      ...drafts[setting.key],
    }));
  const mutation = useMutation({
    mutationFn: (setting: SystemSettingRecord) =>
      apiRequest(`/system-settings/${encodeURIComponent(setting.key)}`, {
        method: 'POST',
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

  return (
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
  );
}

interface SmtpSettingsForm {
  host: string;
  port: string;
  from: string;
  enableSsl: boolean;
  notificationEmail: string;
}

const emptySmtpForm: SmtpSettingsForm = {
  host: '',
  port: '25',
  from: '',
  enableSsl: false,
  notificationEmail: '',
};

function SmtpSettingsTab() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SmtpSettingsForm>(emptySmtpForm);
  const [formLoaded, setFormLoaded] = useState(false);
  const settingsQuery = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => unwrap<SystemSettingRecord[]>(await apiRequest('/system-settings')),
  });
  const findValue = (key: string) =>
    settingsQuery.data?.find((setting) => setting.key === key)?.value ?? '';
  if (settingsQuery.data && !formLoaded) {
    setForm({
      host: findValue('SmtpHost'),
      port: findValue('SmtpPort') || '25',
      from: findValue('SmtpFrom'),
      enableSsl: findValue('SmtpEnableSsl').toLowerCase() === 'true',
      notificationEmail: findValue('NotificationEmail'),
    });
    setFormLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries: Array<{ key: string; value: string; description: string }> = [
        {
          key: 'SmtpHost',
          value: form.host.trim(),
          description: 'Talep bildirimi e-postaları için SMTP sunucu adresi',
        },
        { key: 'SmtpPort', value: form.port.trim() || '25', description: 'SMTP sunucu portu' },
        {
          key: 'SmtpFrom',
          value: form.from.trim(),
          description: 'Bildirim e-postalarının gönderen adresi',
        },
        {
          key: 'SmtpEnableSsl',
          value: form.enableSsl ? 'true' : 'false',
          description: "SMTP bağlantısında TLS/SSL kullanılsın mı ('true' veya 'false')",
        },
        {
          key: 'NotificationEmail',
          value: form.notificationEmail.trim(),
          description:
            'Yeni yazılım talebi bildirimlerinin gönderileceği ortak e-posta adresi (mail grubu). Sistem yöneticilerine ayrı ayrı gönderilmez.',
        },
      ];
      await Promise.all(
        entries.map((entry) =>
          apiRequest(`/system-settings/${encodeURIComponent(entry.key)}`, {
            method: 'POST',
            body: { value: entry.value, description: entry.description, isSecret: false },
          }),
        ),
      );
    },
    onSuccess: async () => {
      showToast('SMTP ayarları kaydedildi.');
      await queryClient.invalidateQueries({ queryKey: ['system-settings'] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

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
    <Card className="settings-card">
      <div className="detail-card__heading">
        <div>
          <Mail />
          <h2>SMTP / Bildirim E-postası</h2>
        </div>
      </div>
      {settingsQuery.isLoading ? (
        <LoadingState />
      ) : settingsQuery.isError ? (
        <ErrorState error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} />
      ) : (
        <>
          <div className="form-grid">
            <label className="field">
              <span>SMTP Sunucu</span>
              <input
                value={form.host}
                onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))}
                placeholder="10.2.0.22"
              />
            </label>
            <label className="field">
              <span>Port</span>
              <input
                value={form.port}
                onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))}
                placeholder="25"
              />
            </label>
            <label className="field">
              <span>Gönderen Adresi</span>
              <input
                type="email"
                value={form.from}
                onChange={(event) => setForm((current) => ({ ...current, from: event.target.value }))}
                placeholder="yazilimtalep@fbu.edu.tr"
              />
            </label>
          </div>
          <div className="toggle-list">
            <label>
              <span>
                <strong>TLS/SSL kullan</strong>
                <small>SMTP sunucusu şifreli bağlantı gerektiriyorsa etkinleştirin.</small>
              </span>
              <input
                type="checkbox"
                checked={form.enableSsl}
                onChange={(event) => setForm((current) => ({ ...current, enableSsl: event.target.checked }))}
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="field field--full">
              <span>Bildirim E-posta Adresi (Mail Grubu)</span>
              <input
                type="email"
                value={form.notificationEmail}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notificationEmail: event.target.value }))
                }
                placeholder="yazilim-bildirim@fbu.edu.tr"
              />
              <small className="field-hint">
                Yeni talep bildirimleri artık tüm sistem yöneticilerine tek tek değil, buraya
                tanımlanan adrese (ör. bir mail grubu) gönderilir. Boş bırakılırsa yönetici
                bildirim e-postası gönderilmez — uygulama içi bildirimler (çan ikonu) bundan
                etkilenmez. Talebi oluşturan kullanıcıya giden onay e-postası bu ayardan bağımsız
                olarak her zaman gönderilir.
              </small>
            </label>
          </div>
          <div className="settings-record__actions">
            <Button variant="secondary" isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              SMTP ayarlarını kaydet
            </Button>
          </div>

          <div className="detail-card__heading" style={{ marginTop: '1.5rem' }}>
            <div>
              <Mail />
              <h2>SMTP Testi</h2>
            </div>
          </div>
          <p>Yukarıdaki yapılandırmayı test etmek için bir adrese deneme e-postası gönderin.</p>
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
        </>
      )}
    </Card>
  );
}

interface RequestCollectionForm {
  enabled: boolean;
  startDate: string;
  endDate: string;
}

const emptyRequestCollectionForm: RequestCollectionForm = { enabled: true, startDate: '', endDate: '' };

function RequestCollectionSettingsTab() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RequestCollectionForm>(emptyRequestCollectionForm);
  const [formLoaded, setFormLoaded] = useState(false);
  const settingsQuery = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => unwrap<SystemSettingRecord[]>(await apiRequest('/system-settings')),
  });
  const statusQuery = useQuery({
    queryKey: ['request-collection-status'],
    queryFn: () => apiRequest<RequestCollectionStatus>('/system-settings/request-collection-status'),
  });
  const findValue = (key: string) => settingsQuery.data?.find((setting) => setting.key === key)?.value ?? '';
  if (settingsQuery.data && !formLoaded) {
    setForm({
      enabled: findValue('RequestCollectionEnabled') !== 'false',
      startDate: findValue('RequestCollectionStartDate'),
      endDate: findValue('RequestCollectionEndDate'),
    });
    setFormLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries: Array<{ key: string; value: string; description: string }> = [
        {
          key: 'RequestCollectionEnabled',
          value: form.enabled ? 'true' : 'false',
          description:
            "Yeni talep oluşturma (Yeni Talep butonu) açık mı? 'false' yapılırsa tarih aralığından bağımsız olarak tamamen kapanır.",
        },
        {
          key: 'RequestCollectionStartDate',
          value: form.startDate,
          description: 'Talep toplama başlangıç tarihi (yyyy-MM-dd). Boşsa alt sınır yok.',
        },
        {
          key: 'RequestCollectionEndDate',
          value: form.endDate,
          description: 'Talep toplama bitiş tarihi (yyyy-MM-dd). Boşsa üst sınır yok.',
        },
      ];
      await Promise.all(
        entries.map((entry) =>
          apiRequest(`/system-settings/${encodeURIComponent(entry.key)}`, {
            method: 'POST',
            body: { value: entry.value, description: entry.description, isSecret: false },
          }),
        ),
      );
    },
    onSuccess: async () => {
      showToast('Talep toplama ayarları kaydedildi.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['system-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['request-collection-status'] }),
      ]);
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  return (
    <Card className="settings-card">
      <div className="detail-card__heading">
        <div>
          <CalendarClock />
          <h2>Talep Toplama</h2>
        </div>
      </div>
      {settingsQuery.isLoading ? (
        <LoadingState />
      ) : settingsQuery.isError ? (
        <ErrorState error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} />
      ) : (
        <>
          <p>
            "Yeni Talep" butonuyla yeni talep oluşturmayı buradan kontrol edin. Kapatıldığında
            akademisyenler ve idari personel yeni talep gönderemez; taslak düzenleme ve daha önce
            gönderilmiş taleplerin görüntülenmesi bundan etkilenmez.
          </p>
          {statusQuery.data && (
            <div className={classNames('badge', statusQuery.data.isOpen ? 'badge--green' : 'badge--red')}>
              {statusQuery.data.isOpen ? 'Şu an: Açık' : 'Şu an: Kapalı'}
            </div>
          )}
          <div className="toggle-list">
            <label>
              <span>
                <strong>Talep toplama açık</strong>
                <small>
                  Kapatırsanız aşağıdaki tarih aralığından bağımsız olarak talep toplama anında
                  kapanır — acil durum anahtarı budur.
                </small>
              </span>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Başlangıç tarihi (opsiyonel)</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Bitiş tarihi (opsiyonel)</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
              />
            </label>
          </div>
          <p className="field-hint">
            Her iki tarih de boş bırakılırsa yalnızca yukarıdaki anahtar geçerli olur. Tarihler
            girilirse talep toplama yalnızca bu aralıkta (ve anahtar açıkken) otomatik olarak
            açık olur.
          </p>
          <div className="settings-record__actions">
            <Button variant="secondary" isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              Talep toplama ayarlarını kaydet
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
