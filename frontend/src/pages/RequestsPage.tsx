import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Eye,
  Filter,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
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
  StatusBadge,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../lib/api';
import { DAY_API_VALUES, STATUS_LABELS, WEEK_DAYS } from '../lib/constants';
import { canChangeRequestStatus, canEditRequest } from '../lib/permissions';
import { buildQuery, formatDate, getErrorMessage, normalizePage, unwrap } from '../lib/utils';
import {
  ROLES,
  type AcademicTerm,
  type Laboratory,
  type RequestStatus,
  type SoftwareRequest,
} from '../types';
import { requestDays, softwareNames } from './DashboardPage';

export interface RequestFilters {
  search: string;
  status: string;
  academicTermId: string;
  facultyId: string;
  laboratoryId: string;
  dayOfWeek: string;
  from: string;
  to: string;
}

const emptyFilters: RequestFilters = {
  search: '',
  status: '',
  academicTermId: '',
  facultyId: '',
  laboratoryId: '',
  dayOfWeek: '',
  from: '',
  to: '',
};

const bulkStatusOptions: RequestStatus[] = [
  'UnderReview',
  'AwaitingInformation',
  'Approved',
  'Rejected',
  'InstallationScheduled',
  'Cancelled',
];

const filterLabels: Record<keyof RequestFilters, string> = {
  search: 'Arama',
  status: 'Durum',
  academicTermId: 'Dönem',
  facultyId: 'Fakülte',
  laboratoryId: 'Laboratuvar',
  dayOfWeek: 'Ders günü',
  from: 'Başlangıç',
  to: 'Bitiş',
};

export function RequestFilterBar({
  value,
  onApply,
}: {
  value: RequestFilters;
  onApply: (filters: RequestFilters) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [expanded, setExpanded] = useState(false);
  const activeFilters = Object.entries(value).filter(([, filterValue]) => filterValue);

  const facultiesQuery = useQuery({
    queryKey: ['faculties', 'filter-options'],
    queryFn: async () =>
      normalizePage<{ id: string; name: string }>(
        await apiRequest('/faculties?page=1&pageSize=100'),
        1,
        100,
      ).items,
  });
  const termsQuery = useQuery({
    queryKey: ['academic-terms', 'filter-options'],
    queryFn: async () => {
      const raw = await apiRequest<unknown>('/academic-terms');
      const parsed = unwrap<AcademicTerm[] | { items: AcademicTerm[] }>(raw);
      return Array.isArray(parsed) ? parsed : parsed.items;
    },
  });
  const labsQuery = useQuery({
    queryKey: ['laboratories', 'filter-options'],
    queryFn: async () =>
      normalizePage<Laboratory>(
        await apiRequest('/laboratories?page=1&pageSize=100&isActive=true'),
        1,
        100,
      ).items,
  });
  const filterLabelValue = (key: keyof RequestFilters, filterValue: string): string => {
    if (key === 'facultyId')
      return facultiesQuery.data?.find((faculty) => faculty.id === filterValue)?.name ?? filterValue;
    if (key === 'academicTermId') {
      const term = termsQuery.data?.find((item) => item.id === filterValue);
      return term ? `${term.academicYear} ${term.termName}` : filterValue;
    }
    if (key === 'laboratoryId')
      return labsQuery.data?.find((lab) => lab.id === filterValue)?.name ?? filterValue;
    if (key === 'status') return STATUS_LABELS[filterValue as RequestStatus] ?? filterValue;
    if (key === 'dayOfWeek')
      return WEEK_DAYS.find((day) => DAY_API_VALUES[day] === filterValue) ?? filterValue;
    return filterValue;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onApply(draft);
  };
  const clear = () => {
    setDraft(emptyFilters);
    onApply(emptyFilters);
  };
  const removeFilter = (key: keyof RequestFilters) => {
    const next = { ...value, [key]: '' };
    setDraft(next);
    onApply(next);
  };

  return (
    <Card className="filter-card">
      <form onSubmit={submit}>
        <div className="filter-card__main">
          <label className="search-field">
            <Search aria-hidden="true" />
            <span className="sr-only">Taleplerde ara</span>
            <input
              value={draft.search}
              onChange={(event) => setDraft({ ...draft, search: event.target.value })}
              placeholder="Ders kodu, ders adı veya program ara…"
            />
          </label>
          <label className="compact-field">
            <span className="sr-only">Talep durumu</span>
            <select
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value })}
            >
              <option value="">Tüm durumlar</option>
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <option value={status} key={status}>
                  {label}
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
              <span>Akademik dönem</span>
              <select
                value={draft.academicTermId}
                onChange={(event) => setDraft({ ...draft, academicTermId: event.target.value })}
              >
                <option value="">Tüm dönemler</option>
                {(termsQuery.data ?? []).map((term) => (
                  <option value={term.id} key={term.id}>
                    {term.academicYear} {term.termName}
                  </option>
                ))}
              </select>
            </label>
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
              <span>Laboratuvar</span>
              <select
                value={draft.laboratoryId}
                onChange={(event) => setDraft({ ...draft, laboratoryId: event.target.value })}
              >
                <option value="">Tüm laboratuvarlar</option>
                {(labsQuery.data ?? []).map((lab) => (
                  <option value={lab.id} key={lab.id}>
                    {lab.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Ders günü</span>
              <select
                value={draft.dayOfWeek}
                onChange={(event) => setDraft({ ...draft, dayOfWeek: event.target.value })}
              >
                <option value="">Tüm günler</option>
                {WEEK_DAYS.map((day) => (
                  <option value={DAY_API_VALUES[day]} key={day}>
                    {day}
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
          </div>
        )}
      </form>
      {activeFilters.length > 0 && (
        <div className="active-filters" aria-label="Aktif filtreler">
          <Filter aria-hidden="true" />
          <span>Aktif filtreler:</span>
          {activeFilters.map(([key, filterValue]) => (
            <button
              type="button"
              key={key}
              onClick={() => removeFilter(key as keyof RequestFilters)}
              aria-label={`${filterLabels[key as keyof RequestFilters]} filtresini kaldır`}
            >
              {filterLabels[key as keyof RequestFilters]}:{' '}
              {filterLabelValue(key as keyof RequestFilters, filterValue)} <X aria-hidden="true" />
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

export function RequestsPage() {
  const [filters, setFilters] = useState<RequestFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState('createdAt_desc');
  const [copyTarget, setCopyTarget] = useState<SoftwareRequest | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkNextStatus, setBulkNextStatus] = useState<RequestStatus>('UnderReview');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkAdministratorNote, setBulkAdministratorNote] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();
  const scope: 'academic' | 'faculty' | 'administrator' = user?.roles.includes(ROLES.administrator)
    ? 'administrator'
    : user?.roles.includes(ROLES.faculty)
      ? 'faculty'
      : 'academic';
  const endpoint = scope === 'academic' ? '/requests/my' : '/requests';

  const query = useQuery({
    queryKey: ['requests', scope, page, pageSize, sort, filters],
    queryFn: async () =>
      normalizePage<SoftwareRequest>(
        await apiRequest(
          `${endpoint}${buildQuery({
            page,
            pageSize,
            sortBy: sort.split('_')[0],
            descending: sort.endsWith('_desc'),
            search: filters.search,
            status: filters.status,
            academicTermId: filters.academicTermId,
            facultyId: filters.facultyId,
            laboratoryId: filters.laboratoryId,
            dayOfWeek: filters.dayOfWeek,
            from: filters.from,
            to: filters.to,
          })}`,
        ),
        page,
        pageSize,
      ),
  });

  const copyMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/requests/${copyTarget?.id ?? ''}/copy`, { method: 'POST' }),
    onSuccess: async () => {
      setCopyTarget(null);
      showToast('Talep yeni bir taslak olarak kopyalandı.');
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/requests/${id}/delete`, { method: 'POST' }),
    onSuccess: async () => {
      showToast('Talep silindi.');
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const selectionKey = `${scope}|${page}|${pageSize}|${sort}|${JSON.stringify(filters)}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setSelectedIds([]);
  }

  const currentPageIds = (query.data?.items ?? []).map((request) => request.id);
  const allCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id));
  const selectedRequests = (query.data?.items ?? []).filter((request) =>
    selectedIds.includes(request.id),
  );
  const deletableSelected = selectedRequests.filter(
    (request) =>
      scope === 'administrator' || (scope === 'academic' && request.status === 'Draft'),
  );
  const statusChangeableSelected = selectedRequests.filter((request) =>
    canChangeRequestStatus(user, request),
  );

  const toggleSelectAll = () => {
    setSelectedIds((current) =>
      allCurrentPageSelected
        ? current.filter((id) => !currentPageIds.includes(id))
        : Array.from(new Set([...current, ...currentPageIds])),
    );
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        deletableSelected.map((request) =>
          apiRequest(`/requests/${request.id}/delete`, { method: 'POST' }),
        ),
      );
      return results;
    },
    onSuccess: async (results) => {
      const failed = results.filter((result) => result.status === 'rejected').length;
      const succeeded = results.length - failed;
      setBulkDeleteOpen(false);
      setSelectedIds([]);
      showToast(
        `${succeeded} talep silindi.${failed ? ` ${failed} talep silinemedi.` : ''}`,
        failed ? 'error' : 'success',
      );
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        statusChangeableSelected.map((request) =>
          apiRequest(`/requests/${request.id}/status`, {
            method: 'POST',
            body: {
              status: bulkNextStatus,
              reason: bulkReason || null,
              administratorNote: bulkAdministratorNote || null,
              installationLaboratoryIds: [],
            },
          }),
        ),
      );
      return results;
    },
    onSuccess: async (results) => {
      const failed = results.filter((result) => result.status === 'rejected').length;
      const succeeded = results.length - failed;
      setBulkStatusOpen(false);
      setBulkReason('');
      setBulkAdministratorNote('');
      setSelectedIds([]);
      showToast(
        `${succeeded} talebin durumu güncellendi.${failed ? ` ${failed} talep güncellenemedi.` : ''}`,
        failed ? 'error' : 'success',
      );
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const applyFilters = (next: RequestFilters) => {
    setFilters(next);
    setPage(1);
  };
  const title =
    scope === 'academic'
      ? 'Taleplerim'
      : scope === 'faculty'
        ? 'Fakülte Talepleri'
        : 'Bütün Talepler';

  return (
    <>
      <PageHeader
        eyebrow={scope === 'administrator' ? 'Sistem yönetimi' : 'Yazılım talepleri'}
        title={title}
        description="Talepleri arayın, filtreleyin ve süreçteki durumlarını takip edin."
        action={
          scope === 'academic' ? (
            <Link className="button button--primary" to="/talep/yeni">
              <Plus aria-hidden="true" /> Yeni talep
            </Link>
          ) : (
            <Button
              variant="secondary"
              icon={<RefreshCcw aria-hidden="true" />}
              onClick={() => void query.refetch()}
            >
              Yenile
            </Button>
          )
        }
      />

      <RequestFilterBar value={filters} onApply={applyFilters} />

      <Card className="table-card">
        <div className="table-toolbar">
          <div>
            <strong>Talep listesi</strong>
            <span>{query.data?.totalCount ?? 0} kayıt bulundu</span>
          </div>
          <div>
            <label>
              <span className="sr-only">Sıralama</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="createdAt_desc">En yeni kayıtlar</option>
                <option value="createdAt_asc">En eski kayıtlar</option>
                <option value="courseCode_asc">Ders kodu A–Z</option>
                <option value="status_asc">Duruma göre</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Sayfa başına kayıt</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10 / sayfa</option>
                <option value={25}>25 / sayfa</option>
                <option value={50}>50 / sayfa</option>
              </select>
            </label>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="bulk-toolbar">
            <strong>{selectedIds.length} talep seçildi</strong>
            <Button variant="ghost" onClick={() => setSelectedIds([])}>
              Seçimi temizle
            </Button>
            <div className="bulk-toolbar__actions">
              {statusChangeableSelected.length > 0 && (
                <Button
                  variant="secondary"
                  icon={<SlidersHorizontal aria-hidden="true" />}
                  onClick={() => {
                    setBulkNextStatus('UnderReview');
                    setBulkReason('');
                    setBulkAdministratorNote('');
                    setBulkStatusOpen(true);
                  }}
                >
                  Toplu durum değiştir ({statusChangeableSelected.length})
                </Button>
              )}
              {deletableSelected.length > 0 && (
                <Button
                  variant="danger"
                  icon={<Trash2 aria-hidden="true" />}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  Toplu sil ({deletableSelected.length})
                </Button>
              )}
            </div>
          </div>
        )}

        {query.isLoading ? (
          <LoadingState label="Talepler yükleniyor…" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !query.data?.items.length ? (
          <EmptyState
            title="Talep bulunamadı"
            description={
              Object.values(filters).some(Boolean)
                ? 'Filtreleri değiştirerek yeniden deneyin.'
                : 'Henüz oluşturulmuş bir talep yok.'
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="select-cell">
                      <input
                        type="checkbox"
                        checked={allCurrentPageSelected}
                        onChange={toggleSelectAll}
                        aria-label="Sayfadaki tüm talepleri seç"
                      />
                    </th>
                    <th>Ders</th>
                    {scope !== 'academic' && <th>Talep sahibi / Akademisyen</th>}
                    <th>Programlar</th>
                    <th>Fakülte / dönem</th>
                    <th>Ders günü / laboratuvar</th>
                    <th>Durum</th>
                    <th>Oluşturulma</th>
                    <th className="table-actions-cell">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data?.items.map((request) => (
                    <tr key={request.id}>
                      <td className="select-cell">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(request.id)}
                          onChange={() => toggleSelectOne(request.id)}
                          aria-label={`${request.courseCode} talebini seç`}
                        />
                      </td>
                      <td>
                        <Link className="table-primary" to={`/talepler/${request.id}`}>
                          {request.courseCode}
                        </Link>
                        <small>
                          {request.courseName} ·{' '}
                          {request.hasOtherSectionInstructor
                            ? `Section ${request.ownedSections.join(', ')}`
                            : `Tüm section'lar (${request.sectionCount})`}
                        </small>
                      </td>
                      {scope !== 'academic' && (
                        <td>
                          <span>{request.ownerFullName || request.ownerEmail || '—'}</span>
                          <small>{request.instructorEmail || '—'}</small>
                        </td>
                      )}
                      <td>
                        <span className="truncate-cell" title={softwareNames(request)}>
                          {softwareNames(request)}
                        </span>
                      </td>
                      <td>
                        <span>{request.facultyName || '—'}</span>
                        <small>{request.academicTerm || '—'}</small>
                      </td>
                      <td>
                        <span>{requestDays(request).join(', ') || '—'}</span>
                        <small>
                          {[...(request.laboratories?.map((lab) => lab.name) ?? []), request.otherLaboratoryName]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </small>
                      </td>
                      <td>
                        <StatusBadge status={request.status} />
                      </td>
                      <td>{formatDate(request.createdAt)}</td>
                      <td className="table-actions-cell">
                        <div className="row-actions">
                          <Link
                            to={`/talepler/${request.id}`}
                            aria-label={`${request.courseCode} talebini görüntüle`}
                          >
                            <Eye aria-hidden="true" />
                          </Link>
                          {canEditRequest(user, request) && (
                            <Link
                              to={`/talepler/${request.id}/duzenle`}
                              aria-label={`${request.courseCode} talebini düzenle`}
                            >
                              <Pencil aria-hidden="true" />
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() => setCopyTarget(request)}
                            aria-label={`${request.courseCode} talebini kopyala`}
                          >
                            <Copy aria-hidden="true" />
                          </button>
                          {(scope === 'administrator' ||
                            (scope === 'academic' && request.status === 'Draft')) && (
                            <button
                              type="button"
                              className="danger-action"
                              onClick={() => {
                                const message =
                                  scope === 'administrator' && request.status !== 'Draft'
                                    ? 'Bu talebi kalıcı olarak silmek istediğinizden emin misiniz?'
                                    : 'Bu taslağı silmek istediğinizden emin misiniz?';
                                if (window.confirm(message)) {
                                  deleteMutation.mutate(request.id);
                                }
                              }}
                              aria-label={`${request.courseCode} talebini sil`}
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          )}
                        </div>
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
        open={Boolean(copyTarget)}
        title="Talebi kopyala"
        description="Seçili talep yeni bir taslak olarak oluşturulacaktır."
        onClose={() => setCopyTarget(null)}
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setCopyTarget(null)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              isLoading={copyMutation.isPending}
              onClick={() => copyMutation.mutate()}
            >
              Taslak kopya oluştur
            </Button>
          </>
        }
      >
        <div className="copy-summary">
          <strong>
            {copyTarget?.courseCode} · {copyTarget?.courseName}
          </strong>
          <span>{copyTarget ? softwareNames(copyTarget) : ''}</span>
        </div>
      </Modal>

      <Modal
        open={bulkDeleteOpen}
        title="Seçili talepler silinsin mi?"
        description="Bu işlem geri alınamaz."
        onClose={() => setBulkDeleteOpen(false)}
        size="small"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkDeleteOpen(false)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              isLoading={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate()}
            >
              Talepleri sil
            </Button>
          </>
        }
      >
        <div className="danger-confirmation">
          <Trash2 />
          <p>
            <strong>{deletableSelected.length}</strong> talep kalıcı olarak silinecek.
            {selectedIds.length > deletableSelected.length && (
              <>
                {' '}
                Seçilen {selectedIds.length - deletableSelected.length} talep için silme yetkiniz
                olmadığından bunlar atlanacak.
              </>
            )}
          </p>
        </div>
      </Modal>

      <Modal
        open={bulkStatusOpen}
        title="Seçili taleplerin durumunu toplu değiştir"
        description={`${statusChangeableSelected.length} talep için kontrollü bir durum geçişi uygulanacak.`}
        onClose={() => setBulkStatusOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkStatusOpen(false)}>
              Vazgeç
            </Button>
            <Button
              isLoading={bulkStatusMutation.isPending}
              onClick={() => bulkStatusMutation.mutate()}
              disabled={
                ['Rejected', 'AwaitingInformation'].includes(bulkNextStatus) && !bulkReason.trim()
              }
            >
              Durumu güncelle
            </Button>
          </>
        }
      >
        <div className="form-grid">
          {selectedIds.length > statusChangeableSelected.length && (
            <div className="alert alert--warning field--full">
              <span>
                Seçilen {selectedIds.length - statusChangeableSelected.length} talep için durum
                değiştirme yetkiniz olmadığından bunlar atlanacak.
              </span>
            </div>
          )}
          <label className="field field--full">
            <span>Yeni durum *</span>
            <select
              value={bulkNextStatus}
              onChange={(event) => setBulkNextStatus(event.target.value as RequestStatus)}
            >
              {bulkStatusOptions.map((status) => (
                <option value={status} key={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <small className="field-hint">
              &quot;Kurulum Tamamlandı&quot; durumu, kurulum bilgileri her talebe özel olduğundan
              toplu işlemde sunulmaz; bu durumu talebin kendi sayfasından değiştirin.
            </small>
          </label>
          {['Rejected', 'AwaitingInformation'].includes(bulkNextStatus) && (
            <label className="field field--full">
              <span>{bulkNextStatus === 'Rejected' ? 'Ret nedeni' : 'İstenen eksik bilgi'} *</span>
              <textarea
                rows={3}
                value={bulkReason}
                onChange={(event) => setBulkReason(event.target.value)}
              />
            </label>
          )}
          <label className="field field--full">
            <span>Yönetici notu</span>
            <textarea
              rows={2}
              value={bulkAdministratorNote}
              onChange={(event) => setBulkAdministratorNote(event.target.value)}
            />
          </label>
        </div>
      </Modal>
    </>
  );
}
