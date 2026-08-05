import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  History,
  Mail,
  Pencil,
  Send,
  Settings2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../lib/api';
import { DAY_API_VALUES, STATUS_LABELS, licenseIsPaidLabel } from '../lib/constants';
import { canChangeRequestStatus, canEditRequest } from '../lib/permissions';
import { formatDate, getErrorMessage, unwrap } from '../lib/utils';
import { ROLES, type RequestStatus } from '../types';

interface RequestDetail {
  id: string;
  ownerUserId: string;
  facultyId: string;
  facultyName: string;
  academicTerm: string;
  courseCode: string;
  courseName: string;
  sectionCount: number;
  hasOtherSectionInstructor: boolean;
  ownedSections: number[];
  instructorEmail: string;
  description?: string;
  status: string;
  administratorNote?: string;
  statusReason?: string;
  studentCount: number;
  hasCapacityWarning?: boolean;
  createdAt: string;
  updatedAt?: string;
  items: Array<{
    id: string;
    softwareApplicationId: string | null;
    otherSoftwareName?: string | null;
    softwareName: string;
    requestedVersion?: string;
    licenseType: string;
    licenseOverrideReason?: string;
    downloadUrl?: string;
    language?: string;
    otherLanguage?: string;
    noPluginRequired: boolean;
    plugins: Array<{ id: string; name: string; version?: string; downloadUrl?: string }>;
  }>;
  schedules: Array<{ id: string; dayOfWeek: string; startTime: string; endTime: string }>;
  laboratories: Array<{
    id: string;
    laboratoryId: string;
    name: string;
    capacity: number;
    computerCount: number;
  }>;
  otherLaboratoryName?: string | null;
  assistants: Array<{ id: string; fullName: string; email: string }>;
  installationPersonnel?: string;
  installationDate?: string;
  installedVersion?: string;
  installationLaboratoryIds?: string[];
  installationNote?: string;
}

const dayNameByApi = Object.fromEntries(
  Object.entries(DAY_API_VALUES).map(([label, api]) => [api, label]),
);

const statusOptions: RequestStatus[] = [
  'UnderReview',
  'AwaitingInformation',
  'Approved',
  'Rejected',
  'InstallationScheduled',
  'InstallationCompleted',
  'Cancelled',
];

export function RequestDetailPage() {
  const { id } = useParams<{ id?: string }>();
  const { user, hasRole } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<RequestStatus>('UnderReview');
  const [reason, setReason] = useState('');
  const [administratorNote, setAdministratorNote] = useState('');
  const [installationPersonnel, setInstallationPersonnel] = useState('');
  const [installationDate, setInstallationDate] = useState('');
  const [installedVersion, setInstalledVersion] = useState('');
  const [installationLaboratoryIds, setInstallationLaboratoryIds] = useState<string[]>([]);
  const [installationNote, setInstallationNote] = useState('');

  const query = useQuery({
    queryKey: ['request', id],
    queryFn: async () => unwrap<RequestDetail>(await apiRequest(`/requests/${id ?? ''}`)),
    enabled: Boolean(id),
  });
  const submitMutation = useMutation({
    mutationFn: () => apiRequest(`/requests/${id ?? ''}/submit`, { method: 'POST' }),
    onSuccess: async () => {
      showToast('Talep değerlendirmeye gönderildi.');
      await queryClient.invalidateQueries({ queryKey: ['request', id] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });
  const statusMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/requests/${id ?? ''}/status`, {
        method: 'POST',
        body: {
          status: nextStatus,
          reason: reason || null,
          administratorNote: administratorNote || null,
          installationPersonnel: installationPersonnel || null,
          installationDate: installationDate || null,
          installedVersion: installedVersion || null,
          installationLaboratoryIds:
            nextStatus === 'InstallationCompleted' ? installationLaboratoryIds : [],
          installationNote: installationNote || null,
        },
      }),
    onSuccess: async () => {
      setStatusModalOpen(false);
      showToast('Talep durumu güncellendi.');
      await queryClient.invalidateQueries({ queryKey: ['request', id] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  if (query.isLoading) return <LoadingState label="Talep ayrıntıları yükleniyor…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <EmptyState title="Talep bulunamadı" />;
  const request = query.data;
  const canManageStatus = canChangeRequestStatus(user, request);
  const canEdit = canEditRequest(user, request);

  return (
    <>
      <div className="back-row">
        <Link to="/talepler">
          <ArrowLeft aria-hidden="true" /> Talep listesine dön
        </Link>
      </div>
      <PageHeader
        eyebrow={`${request.courseCode} · ${request.academicTerm}`}
        title={request.courseName}
        description={`Talep no: ${request.id} · ${formatDate(request.createdAt, true)} tarihinde oluşturuldu`}
        action={
          <div className="page-header__button-group">
            {canEdit && (
              <Link className="button button--secondary" to={`/talepler/${request.id}/duzenle`}>
                <Pencil aria-hidden="true" /> Düzenle
              </Link>
            )}
            {request.status === 'Draft' && hasRole(ROLES.academic, ROLES.administrative) && (
              <Button
                icon={<Send aria-hidden="true" />}
                isLoading={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                Gönder
              </Button>
            )}
            {canManageStatus && (
              <Button
                icon={<Settings2 aria-hidden="true" />}
                onClick={() => {
                  setInstallationLaboratoryIds(request.installationLaboratoryIds ?? []);
                  setStatusModalOpen(true);
                }}
              >
                Durumu değiştir
              </Button>
            )}
          </div>
        }
      />

      <div className="detail-layout">
        <div className="detail-layout__main">
          <Card className="detail-card">
            <div className="detail-card__heading">
              <div>
                <GraduationCap />
                <h2>Ders ve talep bilgileri</h2>
              </div>
              <StatusBadge status={request.status} />
            </div>
            <dl className="detail-list detail-list--grid">
              <div>
                <dt>Ders kodu</dt>
                <dd>{request.courseCode}</dd>
              </div>
              <div>
                <dt>Ders adı</dt>
                <dd>{request.courseName}</dd>
              </div>
              <div>
                <dt>Section</dt>
                <dd>
                  {request.hasOtherSectionInstructor
                    ? `Toplam ${request.sectionCount}, verdikleri: ${request.ownedSections.join(', ') || '—'}`
                    : `Tüm section'lar (toplam ${request.sectionCount})`}
                </dd>
              </div>
              <div>
                <dt>Fakülte</dt>
                <dd>{request.facultyName}</dd>
              </div>
              <div>
                <dt>Akademik dönem</dt>
                <dd>{request.academicTerm}</dd>
              </div>
              <div>
                <dt>Öğretim elemanı</dt>
                <dd>
                  <Mail /> {request.instructorEmail}
                </dd>
              </div>
              <div>
                <dt>Öğrenci sayısı</dt>
                <dd>{request.studentCount}</dd>
              </div>
              <div className="detail-list__full">
                <dt>Talep açıklaması</dt>
                <dd>{request.description || 'Açıklama eklenmemiş.'}</dd>
              </div>
              <div className="detail-list__full">
                <dt>Asistanlar</dt>
                <dd>
                  {request.assistants.length > 0 ? (
                    <ul className="plain-list">
                      {request.assistants.map((assistant) => (
                        <li key={assistant.id}>
                          {assistant.fullName} <small>({assistant.email})</small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    'Asistan eklenmedi.'
                  )}
                </dd>
              </div>
            </dl>
            {request.hasCapacityWarning && (
              <div className="alert alert--warning">
                <FlaskConical />
                <span>Öğrenci sayısı seçilen laboratuvar kapasitesini aşıyor.</span>
              </div>
            )}
          </Card>

          <Card className="detail-card">
            <div className="detail-card__heading">
              <div>
                <Settings2 />
                <h2>İstenen programlar</h2>
              </div>
              <span className="count-pill">{request.items.length} program</span>
            </div>
            <div className="software-detail-list">
              {request.items.map((item) => (
                <article key={item.id}>
                  <div className="software-detail-list__title">
                    <span className="software-results__icon">
                      {item.softwareName.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <h3>
                        {item.softwareName}
                        {!item.softwareApplicationId && (
                          <span className="badge badge--amber">Kataloğa kayıtlı değil</span>
                        )}
                      </h3>
                      <p>
                        {licenseIsPaidLabel(item.licenseType)} · {item.language}
                      </p>
                    </div>
                    {item.downloadUrl && (
                      <a href={item.downloadUrl} target="_blank" rel="noreferrer">
                        İndirme sayfası <ExternalLink />
                      </a>
                    )}
                  </div>
                  {item.licenseOverrideReason && (
                    <div className="inline-note">
                      <strong>Lisans notu:</strong> {item.licenseOverrideReason}
                    </div>
                  )}
                  <div className="plugin-chips">
                    {item.noPluginRequired ? (
                      <span>Eklenti gerekmiyor</span>
                    ) : (
                      item.plugins.map((plugin) => <span key={plugin.id}>{plugin.name}</span>)
                    )}
                  </div>
                </article>
              ))}
            </div>
          </Card>

        </div>

        <aside className="detail-layout__aside">
          <Card className="detail-card">
            <div className="detail-card__heading">
              <div>
                <CalendarDays />
                <h2>Ders programı</h2>
              </div>
            </div>
            <div className="schedule-detail-list">
              {request.schedules.map((schedule) => (
                <div key={schedule.id}>
                  <span>{dayNameByApi[schedule.dayOfWeek] ?? schedule.dayOfWeek}</span>
                  <strong>
                    {schedule.startTime.slice(0, 5)}–{schedule.endTime.slice(0, 5)}
                  </strong>
                </div>
              ))}
            </div>
          </Card>
          <Card className="detail-card">
            <div className="detail-card__heading">
              <div>
                <FlaskConical />
                <h2>Laboratuvarlar</h2>
              </div>
            </div>
            <div className="lab-detail-list">
              {request.laboratories.map((lab) => (
                <div key={lab.id}>
                  <strong>{lab.name}</strong>
                  <small>
                    {lab.capacity} kişi · {lab.computerCount} bilgisayar
                  </small>
                </div>
              ))}
              {request.otherLaboratoryName && (
                <div>
                  <strong>{request.otherLaboratoryName}</strong>
                  <small>Listede olmayan sınıf</small>
                </div>
              )}
            </div>
          </Card>
          <Card className="detail-card">
            <div className="detail-card__heading">
              <div>
                <History />
                <h2>Süreç bilgisi</h2>
              </div>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Oluşturulma</dt>
                <dd>{formatDate(request.createdAt, true)}</dd>
              </div>
              <div>
                <dt>Son güncelleme</dt>
                <dd>{formatDate(request.updatedAt, true)}</dd>
              </div>
              {request.statusReason && (
                <div>
                  <dt>Durum açıklaması</dt>
                  <dd>{request.statusReason}</dd>
                </div>
              )}
              {request.administratorNote && (
                <div>
                  <dt>Yönetici notu</dt>
                  <dd>{request.administratorNote}</dd>
                </div>
              )}
            </dl>
          </Card>
        </aside>
      </div>

      <Modal
        open={statusModalOpen}
        title="Talep durumunu değiştir"
        description={`${request.courseCode} talebi için kontrollü bir durum geçişi uygulayın.`}
        onClose={() => setStatusModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusModalOpen(false)}>
              Vazgeç
            </Button>
            <Button
              isLoading={statusMutation.isPending}
              onClick={() => statusMutation.mutate()}
              disabled={
                (['Rejected', 'AwaitingInformation'].includes(nextStatus) && !reason.trim()) ||
                (nextStatus === 'InstallationCompleted' &&
                  (!installationPersonnel ||
                    !installationDate ||
                    !installedVersion ||
                    installationLaboratoryIds.length === 0))
              }
            >
              Durumu güncelle
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field field--full">
            <span>Yeni durum *</span>
            <select
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value as RequestStatus)}
            >
              {statusOptions.map((status) => (
                <option value={status} key={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          {['Rejected', 'AwaitingInformation'].includes(nextStatus) && (
            <label className="field field--full">
              <span>{nextStatus === 'Rejected' ? 'Ret nedeni' : 'İstenen eksik bilgi'} *</span>
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
          <label className="field field--full">
            <span>Yönetici notu</span>
            <textarea
              rows={2}
              value={administratorNote}
              onChange={(event) => setAdministratorNote(event.target.value)}
            />
          </label>
          {nextStatus === 'InstallationCompleted' && (
            <>
              <label className="field">
                <span>Kurulumu yapan personel *</span>
                <input
                  value={installationPersonnel}
                  onChange={(event) => setInstallationPersonnel(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Kurulum tarihi *</span>
                <input
                  type="datetime-local"
                  value={installationDate}
                  onChange={(event) => setInstallationDate(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Kurulan sürüm *</span>
                <input
                  value={installedVersion}
                  onChange={(event) => setInstalledVersion(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Kurulum notu</span>
                <input
                  value={installationNote}
                  onChange={(event) => setInstallationNote(event.target.value)}
                />
              </label>
              <fieldset className="field field--full">
                <legend>Kurulum yapılan laboratuvarlar *</legend>
                <div className="toggle-list">
                  {request.laboratories.map((laboratory) => (
                    <label key={laboratory.laboratoryId}>
                      <span>
                        <strong>{laboratory.name}</strong>
                        <small>{laboratory.computerCount} bilgisayar</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={installationLaboratoryIds.includes(laboratory.laboratoryId)}
                        onChange={(event) =>
                          setInstallationLaboratoryIds((current) =>
                            event.target.checked
                              ? [...current, laboratory.laboratoryId]
                              : current.filter((id) => id !== laboratory.laboratoryId),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
