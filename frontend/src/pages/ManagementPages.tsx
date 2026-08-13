import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CircleOff,
  Edit3,
  FlaskConical,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
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
import { apiRequest } from '../lib/api';
import { licenseFromApi } from '../lib/constants';
import { buildQuery, formatDate, getErrorMessage, normalizePage } from '../lib/utils';
import { ROLES } from '../types';

type ManagementKind = 'software' | 'faculties' | 'laboratories' | 'users' | 'permissions' | 'terms';

interface FieldConfig {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'textarea' | 'email';
  required?: boolean;
  createOnly?: boolean;
  options?: Array<{ value: string; label: string }>;
}

interface ManagementConfig {
  title: string;
  description: string;
  singular: string;
  endpoint: string;
  fields: FieldConfig[];
  columns: Array<{ key: string; label: string }>;
  createEnabled?: boolean;
}

const roleOptions = [
  { value: 'Academic', label: 'Akademisyen' },
  { value: 'Administrative', label: 'İdari Personel' },
  { value: 'FacultyAuthorizedUser', label: 'Fakülte Yetkilisi' },
  { value: 'SystemAdministrator', label: 'Sistem Yöneticisi' },
];

const configs: Record<ManagementKind, ManagementConfig> = {
  software: {
    title: 'Program Yönetimi',
    description: 'Ana program kataloğunu ve lisans varsayılanlarını yönetin.',
    singular: 'program',
    endpoint: '/software',
    columns: [
      { key: 'name', label: 'Program' },
      { key: 'manufacturer', label: 'Üretici' },
      { key: 'licenseType', label: 'Ücretli/Ücretsiz' },
      { key: 'supportedOperatingSystems', label: 'İşletim sistemi' },
      { key: 'isActive', label: 'Durum' },
    ],
    fields: [
      { key: 'name', label: 'Program adı', required: true },
      { key: 'manufacturer', label: 'Üretici' },
      {
        key: 'licenseType',
        label: 'Ücretli/Ücretsiz',
        type: 'select',
        required: true,
        options: [
          { value: 'Paid', label: 'Ücretli' },
          { value: 'Free', label: 'Ücretsiz' },
        ],
      },
      { key: 'defaultDownloadUrl', label: 'Varsayılan indirme bağlantısı' },
      { key: 'defaultLanguage', label: 'Varsayılan dil' },
      { key: 'supportedOperatingSystems', label: 'Desteklenen işletim sistemleri' },
      { key: 'description', label: 'Açıklama', type: 'textarea' },
      { key: 'laboratoryIds', label: 'İlişkili laboratuvarlar' },
      { key: 'isActive', label: 'Aktif', type: 'checkbox' },
    ],
  },
  faculties: {
    title: 'Fakülte Yönetimi',
    description: 'Akademisyen profillerine atanabilecek fakülte kayıtlarını yönetin.',
    singular: 'fakülte',
    endpoint: '/faculties',
    columns: [
      { key: 'name', label: 'Fakülte' },
      { key: 'code', label: 'Kod' },
      { key: 'description', label: 'Açıklama' },
      { key: 'isActive', label: 'Durum' },
      { key: 'updatedAt', label: 'Güncelleme' },
    ],
    fields: [
      { key: 'name', label: 'Fakülte adı', required: true },
      { key: 'code', label: 'Fakülte kodu', required: true },
      { key: 'description', label: 'Açıklama', type: 'textarea' },
      { key: 'isActive', label: 'Aktif', type: 'checkbox' },
    ],
  },
  laboratories: {
    title: 'Laboratuvar Yönetimi',
    description: 'Kapasite, bilgisayar sayısı ve işletim sistemi bilgilerini güncel tutun.',
    singular: 'laboratuvar',
    endpoint: '/laboratories',
    columns: [
      { key: 'name', label: 'Laboratuvar' },
      { key: 'code', label: 'Kod' },
      { key: 'building', label: 'Bina / kat' },
      { key: 'capacity', label: 'Kapasite' },
      { key: 'computerCount', label: 'Bilgisayar' },
      { key: 'operatingSystem', label: 'İşletim sistemi' },
      { key: 'computerType', label: 'Bilgisayar türü' },
      { key: 'isActive', label: 'Durum' },
    ],
    fields: [
      { key: 'name', label: 'Laboratuvar adı', required: true },
      { key: 'code', label: 'Kod', required: true },
      { key: 'building', label: 'Bina' },
      { key: 'floor', label: 'Kat' },
      { key: 'capacity', label: 'Kapasite', type: 'number', required: true },
      { key: 'computerCount', label: 'Bilgisayar sayısı', type: 'number', required: true },
      { key: 'operatingSystem', label: 'İşletim sistemi' },
      { key: 'computerType', label: 'Bilgisayar türü' },
      { key: 'description', label: 'Açıklama', type: 'textarea' },
      { key: 'isActive', label: 'Aktif', type: 'checkbox' },
    ],
  },
  users: {
    title: 'Kullanıcı Yönetimi',
    description: 'Kullanıcıları oluşturun, rolleri ve hesap durumlarını yönetin.',
    singular: 'kullanıcı',
    endpoint: '/users',
    columns: [
      { key: 'fullName', label: 'Kullanıcı' },
      { key: 'email', label: 'E-posta' },
      { key: 'roles', label: 'Roller' },
      { key: 'facultyId', label: 'Fakülte' },
      { key: 'department', label: 'Bölüm / Birim' },
      { key: 'isActive', label: 'Durum' },
    ],
    fields: [
      { key: 'fullName', label: 'Ad soyad', required: true },
      {
        key: 'email',
        label: 'E-posta',
        type: 'email',
        required: true,
        createOnly: true,
      },
      {
        key: 'password',
        label: 'Geçici parola',
        required: true,
        createOnly: true,
      },
      { key: 'role', label: 'Birincil rol', type: 'select', options: roleOptions, required: true },
      { key: 'facultyId', label: 'Fakülte' },
      { key: 'department', label: 'Bölüm / Birim' },
      { key: 'isActive', label: 'Aktif', type: 'checkbox' },
    ],
  },
  permissions: {
    title: 'Rol ve Yetki Yönetimi',
    description:
      'Fakülte yetkililerinin görüntüleme, düzenleme, raporlama ve durum izinlerini yönetin.',
    singular: 'yetki',
    endpoint: '/users',
    createEnabled: false,
    columns: [
      { key: 'fullName', label: 'Kullanıcı' },
      { key: 'roles', label: 'Rol' },
      { key: 'authorizedFaculties', label: 'Fakülte izinleri' },
      { key: 'isActive', label: 'Durum' },
    ],
    fields: [
      { key: 'facultyId', label: 'Fakülte', required: true },
      { key: 'canView', label: 'Görüntüleme', type: 'checkbox' },
      { key: 'canEdit', label: 'Düzenleme', type: 'checkbox' },
      { key: 'canReport', label: 'Raporlama', type: 'checkbox' },
      { key: 'canChangeStatus', label: 'Durum değiştirme', type: 'checkbox' },
    ],
  },
  terms: {
    title: 'Akademik Dönem Yönetimi',
    description: 'Talep toplama tarihlerini ve güncel akademik dönemi belirleyin.',
    singular: 'akademik dönem',
    endpoint: '/academic-terms',
    columns: [
      { key: 'academicYear', label: 'Akademik yıl' },
      { key: 'termName', label: 'Dönem' },
      { key: 'startDate', label: 'Dönem başlangıcı' },
      { key: 'requestEndDate', label: 'Talep sonu' },
      { key: 'isCurrent', label: 'Güncel' },
      { key: 'isActive', label: 'Durum' },
    ],
    fields: [
      { key: 'academicYear', label: 'Akademik yıl', required: true },
      {
        key: 'termName',
        label: 'Dönem adı',
        type: 'select',
        required: true,
        options: ['Güz', 'Bahar', 'Yaz Okulu'].map((value) => ({ value, label: value })),
      },
      { key: 'startDate', label: 'Dönem başlangıcı', type: 'date', required: true },
      { key: 'endDate', label: 'Dönem bitişi', type: 'date', required: true },
      { key: 'requestStartDate', label: 'Talep başlangıcı', type: 'date', required: true },
      { key: 'requestEndDate', label: 'Talep bitişi', type: 'date', required: true },
      { key: 'isCurrent', label: 'Güncel dönem', type: 'checkbox' },
      { key: 'isActive', label: 'Aktif', type: 'checkbox' },
    ],
  },
};

function initialRecord(config: ManagementConfig): Record<string, unknown> {
  return Object.fromEntries(
    config.fields.map((field) => [
      field.key,
      field.key === 'laboratoryIds' ? [] : field.type === 'checkbox' ? true : '',
    ]),
  );
}

function displayValue(value: unknown, key: string): string {
  if (key === 'licenseType') return value ? licenseFromApi(String(value)) : '—';
  if (typeof value === 'boolean') return value ? 'Aktif' : 'Pasif';
  if (Array.isArray(value)) {
    if (key === 'authorizedFaculties') {
      return value
        .map((item) => {
          if (typeof item !== 'object' || item === null) return String(item);
          const faculty = item as { name?: unknown; permissions?: unknown };
          const permissions = Number(faculty.permissions ?? 0);
          const labels = [
            permissions & 1 ? 'Görüntüle' : '',
            permissions & 2 ? 'Düzenle' : '',
            permissions & 4 ? 'Raporla' : '',
            permissions & 8 ? 'Durum' : '',
          ].filter(Boolean);
          return `${String(faculty.name ?? 'Fakülte')} (${labels.join(', ') || 'izin yok'})`;
        })
        .join('; ');
    }
    return value
      .map((item) =>
        typeof item === 'object' && item !== null && 'name' in item
          ? String((item as { name: unknown }).name)
          : String(item),
      )
      .join(', ');
  }
  if (key.toLocaleLowerCase('tr-TR').includes('date') || key.endsWith('At')) {
    return formatDate(String(value ?? ''));
  }
  return String(value ?? '—') || '—';
}

export function ManagementPage({ kind }: { kind: ManagementKind }) {
  const config = configs[kind];
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(initialRecord(config));
  const [confirmDelete, setConfirmDelete] = useState<Record<string, unknown> | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkLabOpen, setBulkLabOpen] = useState(false);
  const [bulkLabMode, setBulkLabMode] = useState<'add' | 'replace'>('add');
  const [bulkLabSelection, setBulkLabSelection] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ['management', kind, page, pageSize, appliedSearch],
    queryFn: async () =>
      normalizePage<Record<string, unknown>>(
        await apiRequest(
          `${config.endpoint}${buildQuery({ page, pageSize, search: appliedSearch })}`,
        ),
        page,
        pageSize,
      ),
  });
  const facultiesQuery = useQuery({
    queryKey: ['management-faculty-options'],
    queryFn: async () =>
      normalizePage<Record<string, unknown>>(
        await apiRequest('/faculties?page=1&pageSize=100'),
        1,
        100,
      ).items,
    enabled: ['users', 'permissions'].includes(kind),
  });
  const facultyOptions = (facultiesQuery.data ?? []).map((faculty) => ({
    value: String(faculty.id ?? ''),
    label: String(faculty.name ?? faculty.id ?? ''),
  }));
  const laboratoriesQuery = useQuery({
    queryKey: ['management-laboratory-options'],
    queryFn: async () =>
      normalizePage<Record<string, unknown>>(
        await apiRequest('/laboratories?page=1&pageSize=100&isActive=true'),
        1,
        100,
      ).items,
    enabled: kind === 'software',
  });
  const laboratoryOptions = (laboratoriesQuery.data ?? []).map((lab) => ({
    value: String(lab.id ?? ''),
    label: String(lab.name ?? lab.id ?? ''),
  }));
  const saveMutation = useMutation({
    mutationFn: async () => {
      const id = editing?.id;
      const endpoint =
        kind === 'permissions' && id
          ? `/users/${String(id)}/faculty-permissions`
          : id
            ? `${config.endpoint}/${String(id)}`
            : config.endpoint;
      return apiRequest(endpoint, {
        method: 'POST',
        body: buildManagementPayload(kind, form, Boolean(id)),
      });
    },
    onSuccess: async () => {
      showToast(
        `${config.singular[0]?.toLocaleUpperCase('tr-TR')}${config.singular.slice(1)} kaydedildi.`,
      );
      setEditing(null);
      setForm(initialRecord(config));
      await queryClient.invalidateQueries({ queryKey: ['management', kind] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${config.endpoint}/${id}/delete`, { method: 'POST' }),
    onSuccess: async () => {
      setConfirmDelete(null);
      showToast(`${config.singular} pasif hale getirildi.`);
      await queryClient.invalidateQueries({ queryKey: ['management', kind] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });
  const canBulkDelete = !['permissions', 'users'].includes(kind);
  const currentPageIds = (query.data?.items ?? []).map((record) => String(record.id ?? ''));
  const allCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id));

  const selectionKey = `${kind}|${page}|${pageSize}|${appliedSearch}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setSelectedIds([]);
  }

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
        selectedIds.map((id) => apiRequest(`${config.endpoint}/${id}/delete`, { method: 'POST' })),
      );
      return results;
    },
    onSuccess: async (results) => {
      const failed = results.filter((result) => result.status === 'rejected').length;
      const succeeded = results.length - failed;
      setBulkDeleteOpen(false);
      setSelectedIds([]);
      showToast(
        `${succeeded} kayıt pasif hale getirildi.${failed ? ` ${failed} kayıt işlenemedi.` : ''}`,
        failed ? 'error' : 'success',
      );
      await queryClient.invalidateQueries({ queryKey: ['management', kind] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const bulkLabMutation = useMutation({
    mutationFn: async () => {
      const targets = (query.data?.items ?? []).filter((record) =>
        selectedIds.includes(String(record.id ?? '')),
      );
      const results = await Promise.allSettled(
        targets.map((record) => {
          const currentLabs = Array.isArray(record.laboratoryIds)
            ? (record.laboratoryIds as string[])
            : [];
          const nextLabs =
            bulkLabMode === 'replace'
              ? bulkLabSelection
              : Array.from(new Set([...currentLabs, ...bulkLabSelection]));
          const recordForm = {
            ...Object.fromEntries(
              config.fields.map((field) => [
                field.key,
                field.key === 'laboratoryIds'
                  ? nextLabs
                  : (record[field.key] ?? (field.type === 'checkbox' ? true : '')),
              ]),
            ),
          };
          return apiRequest(`${config.endpoint}/${String(record.id)}`, {
            method: 'POST',
            body: buildManagementPayload(kind, recordForm, true),
          });
        }),
      );
      return results;
    },
    onSuccess: async (results) => {
      const failed = results.filter((result) => result.status === 'rejected').length;
      const succeeded = results.length - failed;
      setBulkLabOpen(false);
      setBulkLabSelection([]);
      setSelectedIds([]);
      showToast(
        `${succeeded} program güncellendi.${failed ? ` ${failed} kayıt işlenemedi.` : ''}`,
        failed ? 'error' : 'success',
      );
      await queryClient.invalidateQueries({ queryKey: ['management', kind] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });

  const openCreate = () => {
    setEditing({});
    setForm(initialRecord(config));
  };
  const openEdit = (record: Record<string, unknown>) => {
    setEditing(record);
    const roles = Array.isArray(record.roles) ? record.roles : [];
    const authorizedFaculties = Array.isArray(record.authorizedFaculties)
      ? (record.authorizedFaculties as Array<Record<string, unknown>>)
      : [];
    const selectedFaculty = authorizedFaculties[0];
    const permissionValue = Number(selectedFaculty?.permissions ?? 0);
    setForm({
      ...initialRecord(config),
      ...Object.fromEntries(
        config.fields.map((field) => [
          field.key,
          Array.isArray(record[field.key]) ? record[field.key] : (record[field.key] ?? ''),
        ]),
      ),
      ...(kind === 'users' ? { role: String(roles[0] ?? '') } : {}),
      ...(kind === 'permissions'
        ? {
            facultyId: selectedFaculty?.id ?? '',
            canView: Boolean(permissionValue & 1),
            canEdit: Boolean(permissionValue & 2),
            canReport: Boolean(permissionValue & 4),
            canChangeStatus: Boolean(permissionValue & 8),
          }
        : {}),
    });
  };
  const updateField = (key: string, value: unknown) => {
    if (kind === 'permissions' && key === 'facultyId') {
      const authorizedFaculties = Array.isArray(editing?.authorizedFaculties)
        ? (editing.authorizedFaculties as Array<Record<string, unknown>>)
        : [];
      const selectedFaculty = authorizedFaculties.find(
        (faculty) => String(faculty.id) === String(value),
      );
      const permissions = Number(selectedFaculty?.permissions ?? 0);
      setForm((current) => ({
        ...current,
        facultyId: value,
        canView: Boolean(permissions & 1),
        canEdit: Boolean(permissions & 2),
        canReport: Boolean(permissions & 4),
        canChangeStatus: Boolean(permissions & 8),
      }));
      return;
    }
    setForm((current) => ({ ...current, [key]: value }));
  };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  };
  const isEditing = Boolean(editing?.id);
  const visibleFields = config.fields.filter((field) => !(field.createOnly && isEditing));
  const formValid = visibleFields
    .filter((field) => field.required)
    .every((field) => String(form[field.key] ?? '').trim());

  return (
    <>
      <PageHeader
        eyebrow="Sistem yönetimi"
        title={config.title}
        description={config.description}
        action={
          config.createEnabled === false ? undefined : (
            <Button icon={<Plus />} onClick={openCreate}>
              Yeni {config.singular}
            </Button>
          )
        }
      />
      <Card className="table-card">
        <div className="management-toolbar">
          <form className="search-field" onSubmit={submitSearch}>
            <Search />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`${config.title} içinde ara…`}
            />
            <button type="submit" aria-label="Ara">
              <Search />
            </button>
          </form>
          <Button variant="ghost" icon={<RefreshCcw />} onClick={() => void query.refetch()}>
            Yenile
          </Button>
        </div>
        {selectedIds.length > 0 && (
          <div className="bulk-toolbar">
            <strong>{selectedIds.length} kayıt seçildi</strong>
            <Button variant="ghost" onClick={() => setSelectedIds([])}>
              Seçimi temizle
            </Button>
            <div className="bulk-toolbar__actions">
              {kind === 'software' && (
                <Button
                  variant="secondary"
                  icon={<FlaskConical aria-hidden="true" />}
                  onClick={() => {
                    setBulkLabMode('add');
                    setBulkLabSelection([]);
                    setBulkLabOpen(true);
                  }}
                >
                  Toplu laboratuvar düzenle
                </Button>
              )}
              {canBulkDelete && (
                <Button
                  variant="danger"
                  icon={<Trash2 aria-hidden="true" />}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  Toplu sil
                </Button>
              )}
            </div>
          </div>
        )}
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !query.data?.items.length ? (
          <EmptyState
            title={`${config.singular[0]?.toLocaleUpperCase('tr-TR')}${config.singular.slice(1)} bulunamadı`}
            description={
              appliedSearch ? 'Arama ölçütünüzü değiştirin.' : 'İlk kaydı oluşturabilirsiniz.'
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {canBulkDelete && (
                      <th className="select-cell">
                        <input
                          type="checkbox"
                          checked={allCurrentPageSelected}
                          onChange={toggleSelectAll}
                          aria-label="Sayfadaki tüm kayıtları seç"
                        />
                      </th>
                    )}
                    {config.columns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                    <th className="table-actions-cell">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data?.items.map((record) => (
                    <tr key={String(record.id)}>
                      {canBulkDelete && (
                        <td className="select-cell">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(String(record.id))}
                            onChange={() => toggleSelectOne(String(record.id))}
                            aria-label="Kaydı seç"
                          />
                        </td>
                      )}
                      {config.columns.map((column) => (
                        <td key={column.key}>
                          {column.key === 'isActive' ? (
                            <span
                              className={`badge badge--${record[column.key] === false ? 'neutral' : 'green'}`}
                            >
                              {record[column.key] === false ? (
                                <>
                                  <CircleOff /> Pasif
                                </>
                              ) : (
                                <>
                                  <Check /> Aktif
                                </>
                              )}
                            </span>
                          ) : (
                            <span className={column === config.columns[0] ? 'table-primary' : ''}>
                              {column.key === 'facultyId'
                                ? (facultyOptions.find(
                                    (option) => option.value === String(record.facultyId ?? ''),
                                  )?.label ?? '—')
                                : displayValue(record[column.key], column.key)}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="table-actions-cell">
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => openEdit(record)}
                            aria-label="Kaydı düzenle"
                          >
                            {kind === 'permissions' ? <ShieldCheck /> : <Edit3 />}
                          </button>
                          {!['permissions', 'users'].includes(kind) && (
                            <button
                              className="danger-action"
                              type="button"
                              onClick={() => setConfirmDelete(record)}
                              aria-label="Kaydı pasif hale getir"
                            >
                              <Trash2 />
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
              extra={
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
                    <option value={20}>20 / sayfa</option>
                    <option value={50}>50 / sayfa</option>
                    <option value={100}>100 / sayfa</option>
                  </select>
                </label>
              }
            />
          </>
        )}
      </Card>

      <Modal
        open={editing !== null}
        title={`${editing?.id ? 'Düzenle' : 'Yeni'} ${config.singular}`}
        description="Zorunlu alanları doldurun. Değişiklikler audit log kaydına yansıtılır."
        onClose={() => setEditing(null)}
        size="large"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Vazgeç
            </Button>
            <Button
              isLoading={saveMutation.isPending}
              disabled={!formValid}
              onClick={() => saveMutation.mutate()}
            >
              Değişiklikleri kaydet
            </Button>
          </>
        }
      >
        <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
          {visibleFields.map((field) =>
            field.key === 'laboratoryIds' ? (
              <div className="field field--full" key={field.key}>
                <span>{field.label}</span>
                <div className="multiselect-grid">
                  {laboratoryOptions.length === 0 ? (
                    <small>Kayıtlı aktif laboratuvar yok.</small>
                  ) : (
                    laboratoryOptions.map((option) => {
                      const current = Array.isArray(form.laboratoryIds)
                        ? (form.laboratoryIds as string[])
                        : [];
                      const selected = current.includes(option.value);
                      return (
                        <label className="checkbox checkbox--card" key={option.value}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) =>
                              updateField(
                                'laboratoryIds',
                                event.target.checked
                                  ? [...current, option.value]
                                  : current.filter((id) => id !== option.value),
                              )
                            }
                          />
                          <span>
                            <strong>{option.label}</strong>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <small className="field-hint">
                  Bu programın kurulu olduğu laboratuvarları işaretleyin — talep sihirbazında lab
                  seçimi bu eşleştirmeyle daraltılır. Hiçbiri seçilmezse (henüz eşleştirilmemiş
                  programlar için) lab listesi kısıtlanmaz.
                </small>
              </div>
            ) : field.type === 'checkbox' ? (
              <label className="checkbox checkbox--card" key={field.key}>
                <input
                  type="checkbox"
                  checked={Boolean(form[field.key])}
                  onChange={(event) => updateField(field.key, event.target.checked)}
                />
                <span>
                  <strong>{field.label}</strong>
                </span>
              </label>
            ) : (
              <label
                className={`field ${field.type === 'textarea' ? 'field--full' : ''}`}
                key={field.key}
              >
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                {field.key === 'facultyId' && facultyOptions.length > 0 ? (
                  <select
                    value={String(form[field.key] ?? '')}
                    onChange={(event) => updateField(field.key, event.target.value)}
                  >
                    <option value="">Fakülte seçin</option>
                    {facultyOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'select' ? (
                  <select
                    value={String(form[field.key] ?? '')}
                    onChange={(event) => updateField(field.key, event.target.value)}
                  >
                    <option value="">Seçin</option>
                    {field.options?.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={String(form[field.key] ?? '')}
                    onChange={(event) => updateField(field.key, event.target.value)}
                  />
                ) : (
                  <input
                    type={field.type ?? 'text'}
                    value={String(form[field.key] ?? '')}
                    onChange={(event) => updateField(field.key, event.target.value)}
                  />
                )}
              </label>
            ),
          )}
        </form>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        title={`${config.singular[0]?.toLocaleUpperCase('tr-TR')}${config.singular.slice(1)} pasif yapılsın mı?`}
        description="Kayıt kalıcı olarak silinmez; geçmiş ve ilişkiler korunur."
        onClose={() => setConfirmDelete(null)}
        size="small"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              isLoading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(String(confirmDelete?.id ?? ''))}
            >
              Pasif hale getir
            </Button>
          </>
        }
      >
        <div className="danger-confirmation">
          <CircleOff />
          <p>
            <strong>{displayValue(confirmDelete?.name ?? confirmDelete?.fullName, 'name')}</strong>{' '}
            artık seçim listelerinde görünmeyecek.
          </p>
        </div>
      </Modal>

      <Modal
        open={bulkDeleteOpen}
        title="Seçili kayıtlar pasif yapılsın mı?"
        description="Kayıtlar kalıcı olarak silinmez; geçmiş ve ilişkiler korunur."
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
              Pasif hale getir
            </Button>
          </>
        }
      >
        <div className="danger-confirmation">
          <CircleOff />
          <p>
            <strong>{selectedIds.length}</strong> kayıt artık seçim listelerinde görünmeyecek.
          </p>
        </div>
      </Modal>

      <Modal
        open={bulkLabOpen}
        title="Seçili programların laboratuvarlarını toplu düzenle"
        description={`${selectedIds.length} program için laboratuvar eşleştirmesini güncelleyin.`}
        onClose={() => setBulkLabOpen(false)}
        size="large"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkLabOpen(false)}>
              Vazgeç
            </Button>
            <Button
              isLoading={bulkLabMutation.isPending}
              disabled={bulkLabSelection.length === 0}
              onClick={() => bulkLabMutation.mutate()}
            >
              Uygula
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field field--full">
            <span>Uygulama şekli</span>
            <select
              value={bulkLabMode}
              onChange={(event) => setBulkLabMode(event.target.value as 'add' | 'replace')}
            >
              <option value="add">Mevcut laboratuvarlara ekle</option>
              <option value="replace">Seçilenlerle değiştir</option>
            </select>
          </label>
          <div className="field field--full">
            <span>Laboratuvarlar</span>
            <div className="multiselect-grid">
              {laboratoryOptions.length === 0 ? (
                <small>Kayıtlı aktif laboratuvar yok.</small>
              ) : (
                laboratoryOptions.map((option) => {
                  const selected = bulkLabSelection.includes(option.value);
                  return (
                    <label className="checkbox checkbox--card" key={option.value}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          setBulkLabSelection((current) =>
                            event.target.checked
                              ? [...current, option.value]
                              : current.filter((id) => id !== option.value),
                          )
                        }
                      />
                      <span>
                        <strong>{option.label}</strong>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <small className="field-hint">
              {bulkLabMode === 'add'
                ? 'İşaretlenen laboratuvarlar, seçili her programın mevcut laboratuvar listesine eklenir.'
                : 'Seçili her program, yalnızca işaretlenen laboratuvarlarla eşleştirilecek şekilde güncellenir.'}
            </small>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function buildManagementPayload(
  kind: ManagementKind,
  form: Record<string, unknown>,
  isEditing: boolean,
): Record<string, unknown> {
  if (kind === 'permissions') {
    const permissions =
      (form.canView ? 1 : 0) |
      (form.canEdit ? 2 : 0) |
      (form.canReport ? 4 : 0) |
      (form.canChangeStatus ? 8 : 0);
    return {
      facultyId: String(form.facultyId ?? '').trim(),
      permissions,
    };
  }

  if (kind === 'users') {
    const common = {
      fullName: String(form.fullName ?? '').trim(),
      facultyId: String(form.facultyId ?? '').trim() || null,
      department: String(form.department ?? '').trim() || null,
      roles: [String(form.role ?? '')].filter(Boolean),
    };
    return isEditing
      ? { ...common, isActive: Boolean(form.isActive) }
      : {
          email: String(form.email ?? '').trim(),
          ...common,
          password: String(form.password ?? ''),
        };
  }

  const payload = Object.fromEntries(
    Object.entries(form).map(([key, value]) => [
      key,
      ['capacity', 'computerCount'].includes(key) ? Number(value) : value,
    ]),
  );
  // The catalog form only collects a single Ücretli/Ücretsiz choice (licenseType: 'Paid'|'Free');
  // isPaid is kept in sync from it since other features (reports, dashboards) still read isPaid directly.
  if (kind === 'software') payload.isPaid = form.licenseType === 'Paid';
  return payload;
}

interface Suggestion {
  id: string;
  name: string;
  manufacturer?: string;
  description?: string;
  downloadUrl?: string;
  isPaid: boolean;
  licenseType: string;
  language?: string;
  requiredOperatingSystem?: string;
  additionalNote?: string;
  status: string;
  createdByUserId?: string;
  createdAt: string;
  rejectionReason?: string;
}

interface SuggestionReviewForm {
  name: string;
  manufacturer: string;
  description: string;
  downloadUrl: string;
  isPaid: boolean;
  language: string;
  requiredOperatingSystem: string;
}

const emptySuggestionReview: SuggestionReviewForm = {
  name: '',
  manufacturer: '',
  description: '',
  downloadUrl: '',
  isPaid: false,
  language: '',
  requiredOperatingSystem: '',
};

export function SoftwareSuggestionsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const scope: 'mine' | 'all' | 'review' = user?.roles.includes(ROLES.administrator)
    ? 'review'
    : user?.roles.includes(ROLES.faculty)
      ? 'all'
      : 'mine';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<Suggestion | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [reason, setReason] = useState('');
  const [reviewForm, setReviewForm] = useState<SuggestionReviewForm>(emptySuggestionReview);
  const endpoint = scope === 'mine' ? '/software/suggestions/my' : '/software/suggestions';
  const query = useQuery({
    queryKey: ['software-suggestions', scope, page],
    queryFn: async () =>
      normalizePage<Suggestion>(
        await apiRequest(
          scope === 'mine' ? endpoint : `${endpoint}${buildQuery({ page, pageSize: 15 })}`,
        ),
        page,
        15,
      ),
  });
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(`/software/suggestions/${target?.id ?? ''}/${decision}`, {
        method: 'POST',
        body:
          decision === 'reject'
            ? { reason }
            : {
                name: reviewForm.name.trim() || null,
                manufacturer: reviewForm.manufacturer.trim() || null,
                description: reviewForm.description.trim() || null,
                downloadUrl: reviewForm.downloadUrl.trim() || null,
                isPaid: reviewForm.isPaid,
                licenseType: reviewForm.isPaid ? 'Paid' : 'Free',
                language: reviewForm.language.trim() || null,
                requiredOperatingSystem: reviewForm.requiredOperatingSystem.trim() || null,
              },
      }),
    onSuccess: async () => {
      setTarget(null);
      setReason('');
      setReviewForm(emptySuggestionReview);
      showToast(
        decision === 'approve' ? 'Program önerisi onaylandı.' : 'Program önerisi reddedildi.',
      );
      await queryClient.invalidateQueries({ queryKey: ['software-suggestions'] });
    },
    onError: (error) => showToast(getErrorMessage(error), 'error'),
  });
  const title = scope === 'mine' ? 'Program Önerilerim' : 'Program Önerileri';
  const pendingCount = useMemo(
    () => query.data?.items.filter((suggestion) => suggestion.status === 'Pending').length ?? 0,
    [query.data?.items],
  );
  const visibleSuggestions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR');
    if (!normalizedSearch) return query.data?.items ?? [];
    return (query.data?.items ?? []).filter((suggestion) =>
      [suggestion.name, suggestion.manufacturer]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(normalizedSearch)),
    );
  }, [query.data?.items, search]);
  const openDecision = (suggestion: Suggestion, nextDecision: 'approve' | 'reject') => {
    setDecision(nextDecision);
    setTarget(suggestion);
    setReason('');
    setReviewForm({
      name: suggestion.name,
      manufacturer: suggestion.manufacturer ?? '',
      description: suggestion.description ?? '',
      downloadUrl: suggestion.downloadUrl ?? '',
      isPaid: suggestion.isPaid,
      language: suggestion.language ?? '',
      requiredOperatingSystem: suggestion.requiredOperatingSystem ?? '',
    });
  };

  return (
    <>
      <PageHeader
        eyebrow={scope === 'mine' ? 'Yazılım kataloğu' : 'Değerlendirme merkezi'}
        title={title}
        description={
          scope === 'mine'
            ? 'Ana listede olmayan programlar için verdiğiniz önerilerin sonucunu izleyin.'
            : `${pendingCount} öneri değerlendirme bekliyor.`
        }
      />
      <Card className="table-card">
        <div className="management-toolbar">
          <label className="search-field">
            <Search />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Program veya üretici ara…"
            />
          </label>
        </div>
        {query.isLoading ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : !visibleSuggestions.length ? (
          <EmptyState title="Program önerisi bulunmuyor" />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Program</th>
                    <th>Üretici</th>
                    <th>Ücretli/Ücretsiz</th>
                    <th>Öneren kimliği</th>
                    <th>Tarih</th>
                    <th>Durum</th>
                    {scope === 'review' && <th>İşlem</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleSuggestions.map((suggestion) => (
                    <tr key={suggestion.id}>
                      <td>
                        <strong className="table-primary">{suggestion.name}</strong>
                        {suggestion.rejectionReason && (
                          <small>Ret: {suggestion.rejectionReason}</small>
                        )}
                      </td>
                      <td>{suggestion.manufacturer || '—'}</td>
                      <td>{suggestion.isPaid ? 'Ücretli' : 'Ücretsiz'}</td>
                      <td>{suggestion.createdByUserId || '—'}</td>
                      <td>{formatDate(suggestion.createdAt)}</td>
                      <td>
                        <SuggestionBadge status={suggestion.status} />
                      </td>
                      {scope === 'review' && (
                        <td>
                          {suggestion.status === 'Pending' ? (
                            <div className="decision-actions">
                              <button
                                type="button"
                                onClick={() => openDecision(suggestion, 'approve')}
                              >
                                <Check /> Onayla
                              </button>
                              <button
                                type="button"
                                onClick={() => openDecision(suggestion, 'reject')}
                              >
                                <X /> Reddet
                              </button>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
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
        open={target !== null}
        title={decision === 'approve' ? 'Program önerisini onayla' : 'Program önerisini reddet'}
        description={target ? `${target.name} önerisi için kararınızı doğrulayın.` : undefined}
        onClose={() => setTarget(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Vazgeç
            </Button>
            <Button
              variant={decision === 'reject' ? 'danger' : 'primary'}
              isLoading={mutation.isPending}
              disabled={
                (decision === 'reject' && !reason.trim()) ||
                (decision === 'approve' && !reviewForm.name.trim())
              }
              onClick={() => mutation.mutate()}
            >
              {decision === 'approve' ? 'Onayla ve ana listeye ekle' : 'Öneriyi reddet'}
            </Button>
          </>
        }
      >
        {decision === 'approve' ? (
          <div className="form-grid">
            <div className="alert alert--success field--full">
              <Check />
              <span>Alanları doğrulayın; onaylanan kayıt ana program kataloğuna aktarılır.</span>
            </div>
            <label className="field">
              <span>Program adı *</span>
              <input
                value={reviewForm.name}
                onChange={(event) =>
                  setReviewForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Üretici</span>
              <input
                value={reviewForm.manufacturer}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    manufacturer: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Program dili</span>
              <input
                value={reviewForm.language}
                onChange={(event) =>
                  setReviewForm((current) => ({ ...current, language: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Gerekli işletim sistemi</span>
              <input
                value={reviewForm.requiredOperatingSystem}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    requiredOperatingSystem: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field field--full">
              <span>İndirme bağlantısı</span>
              <input
                type="url"
                value={reviewForm.downloadUrl}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    downloadUrl: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field field--full">
              <span>Açıklama</span>
              <textarea
                rows={3}
                value={reviewForm.description}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <label className="checkbox checkbox--card field--full">
              <input
                type="checkbox"
                checked={reviewForm.isPaid}
                onChange={(event) =>
                  setReviewForm((current) => ({
                    ...current,
                    isPaid: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Ücretli program</strong>
              </span>
            </label>
          </div>
        ) : (
          <label className="field">
            <span>Ret nedeni *</span>
            <textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        )}
      </Modal>
    </>
  );
}

function SuggestionBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    Pending: { label: 'Onay Bekliyor', tone: 'amber' },
    Approved: { label: 'Onaylandı', tone: 'green' },
    Rejected: { label: 'Reddedildi', tone: 'red' },
  };
  const value = map[status] ?? { label: status, tone: 'neutral' };
  return <span className={`badge badge--${value.tone}`}>{value.label}</span>;
}
