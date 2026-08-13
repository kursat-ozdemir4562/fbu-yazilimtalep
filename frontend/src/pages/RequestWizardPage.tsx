import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleCheck,
  Clock3,
  FileText,
  FlaskConical,
  Link2,
  ListChecks,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldPath,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { useHistory, useParams } from 'react-router-dom';
import { z } from 'zod';
import { SoftwareSelector } from '../components/SoftwareSelector';
import { Button, Card, ErrorState, FieldError, LoadingState, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../lib/api';
import {
  DAY_API_VALUES,
  LANGUAGES,
  WEEK_DAYS,
  WIZARD_STEPS,
  licenseIsPaidLabel,
  licenseToApi,
} from '../lib/constants';
import { classNames, formatDate, getErrorMessage, normalizePage, unwrap } from '../lib/utils';
import type { AcademicTerm, Laboratory, RequestCollectionStatus, SoftwareApplication } from '../types';
import { ROLES } from '../types';

const optionalUrl = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^https?:\/\/[^\s]+$/i.test(value),
    'Geçerli bir HTTP/HTTPS adresi girin.',
  );

const pluginSchema = z.object({
  name: z.string().trim().min(1, 'Eklenti adını girin.').max(200),
  version: z.string().trim().max(100),
  downloadUrl: optionalUrl,
  description: z.string().trim().max(500),
});

const requestItemSchema = z
  .object({
    softwareApplicationId: z.string(),
    otherSoftwareName: z.string().trim().max(250),
    softwareName: z.string().min(1),
    requestedVersion: z.string().trim().max(100),
    licenseType: z.string(),
    originalLicenseType: z.string(),
    licenseOverrideReason: z.string().trim().max(500),
    downloadUrl: optionalUrl,
    language: z.string().min(1, 'Program dilini seçin.'),
    otherLanguage: z.string().trim().max(100),
    noPluginRequired: z.boolean(),
    plugins: z.array(pluginSchema),
  })
  .superRefine((item, context) => {
    if (!item.softwareApplicationId && !item.otherSoftwareName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['softwareApplicationId'],
        message: 'Bir program seçin veya "İstediğim Program Listede Yok" ile ekleyin.',
      });
    }
    if (item.language === 'Diğer' && !item.otherLanguage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['otherLanguage'],
        message: 'Diğer dil bilgisini girin.',
      });
    }
    if (!item.noPluginRequired && item.plugins.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['plugins'],
        message: 'En az bir eklenti ekleyin veya “Eklenti gerekmiyor” seçeneğini işaretleyin.',
      });
    }
  });

const scheduleSchema = z
  .object({
    dayOfWeek: z.string().min(1, 'Ders gününü seçin.'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Başlangıç saatini girin.'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Bitiş saatini girin.'),
  })
  .refine((schedule) => schedule.endTime > schedule.startTime, {
    path: ['endTime'],
    message: 'Bitiş saati başlangıç saatinden sonra olmalıdır.',
  });

const assistantSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Asistanın ad soyadını girin.')
    .max(250, 'Ad soyad en fazla 250 karakter olabilir.'),
  email: z.string().trim().email('Geçerli bir e-posta adresi girin.'),
});

const requestWizardObjectSchema = z.object({
  academicTermId: z.string().min(1, 'Akademik dönem seçimi zorunludur.'),
  facultyId: z.string(),
  courseCode: z
    .string()
    .trim()
    .min(1, 'Ders kodu zorunludur.')
    .max(50, 'Ders kodu en fazla 50 karakter olabilir.'),
  courseName: z
    .string()
    .trim()
    .min(1, 'Ders adı zorunludur.')
    .max(250, 'Ders adı en fazla 250 karakter olabilir.'),
  sectionCount: z
    .number({ invalid_type_error: 'Section sayısını seçin.' })
    .int()
    .min(1, 'Section sayısını seçin.')
    .max(5, 'Section sayısı 1-5 arasında olmalıdır.'),
  hasOtherSectionInstructor: z.boolean(),
  ownedSections: z.array(z.number().int()),
  instructorEmail: z.string().trim().email('Geçerli bir e-posta adresi girin.'),
  description: z.string().trim().max(2000, 'Açıklama en fazla 2000 karakter olabilir.'),
  studentCount: z.number({ invalid_type_error: 'Öğrenci sayısını girin.' }).int().min(0).max(5000),
  items: z.array(requestItemSchema).min(1, 'En az bir program seçmelisiniz.'),
  schedules: z.array(scheduleSchema).min(1, 'En az bir ders günü ve saati eklemelisiniz.'),
  laboratoryIds: z.array(z.string()),
  hasOtherLaboratory: z.boolean(),
  otherLaboratoryName: z.string().trim().max(250, 'En fazla 250 karakter olabilir.'),
  assistants: z.array(assistantSchema),
});

export const requestWizardSchema = requestWizardObjectSchema.superRefine((data, context) => {
  if (data.hasOtherSectionInstructor && data.ownedSections.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ownedSections'],
      message: 'Kendi verdiğiniz section\'ları seçin.',
    });
  }
  if (!data.hasOtherLaboratory && data.laboratoryIds.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['laboratoryIds'],
      message:
        'En az bir laboratuvar seçmelisiniz veya "Dersi vereceğim sınıf listede yok" seçeneğini işaretleyip yerin adını yazmalısınız.',
    });
  }
  if (data.hasOtherLaboratory && !data.otherLaboratoryName.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['otherLaboratoryName'],
      message: 'Dersi vereceğiniz yerin adını yazın.',
    });
  }
});

export type RequestWizardData = z.infer<typeof requestWizardObjectSchema>;

const emptyValues: RequestWizardData = {
  academicTermId: '',
  facultyId: '',
  courseCode: '',
  courseName: '',
  // NaN so the section-count select renders its empty placeholder instead of a pre-selected value.
  sectionCount: NaN,
  hasOtherSectionInstructor: false,
  ownedSections: [],
  instructorEmail: '',
  description: '',
  // NaN (not 0) so the number input renders empty instead of a pre-filled "0" that
  // people mistake for an already-answered field and skip past.
  studentCount: NaN,
  items: [],
  schedules: [{ dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00' }],
  laboratoryIds: [],
  hasOtherLaboratory: false,
  otherLaboratoryName: '',
  assistants: [],
};

const dayLabels: Record<string, string> = Object.fromEntries(
  Object.entries(DAY_API_VALUES).map(([label, value]) => [value, label]),
);

export function isLaboratoryCapacityInsufficient(
  laboratory: Pick<Laboratory, 'capacity' | 'computerCount'>,
  studentCount: number,
): boolean {
  return studentCount > Math.min(laboratory.capacity, laboratory.computerCount);
}

function parseDraftPayload(payloadJson: string, email?: string): RequestWizardData {
  try {
    const rawValue = JSON.parse(payloadJson) as Record<string, unknown>;
    // An empty studentCount is stored as NaN in form state so the input renders blank; JSON has
    // no NaN so it round-trips through the draft payload as null. Drop it so partial() treats it
    // as absent instead of failing the whole draft parse over one still-unanswered field.
    if (rawValue.studentCount === null) delete rawValue.studentCount;
    const parsed = requestWizardObjectSchema.partial().safeParse(rawValue);
    return {
      ...emptyValues,
      ...(parsed.success ? parsed.data : {}),
      instructorEmail: parsed.success
        ? (parsed.data.instructorEmail ?? email ?? '')
        : (email ?? ''),
    } as RequestWizardData;
  } catch {
    return { ...emptyValues, instructorEmail: email ?? '' };
  }
}

export function requestPayload(data: RequestWizardData) {
  return {
    facultyId: data.facultyId || null,
    academicTermId: data.academicTermId,
    courseCode: data.courseCode.trim().toLocaleUpperCase('tr-TR'),
    courseName: data.courseName.trim(),
    sectionCount: data.sectionCount,
    hasOtherSectionInstructor: data.hasOtherSectionInstructor,
    // When the requester teaches every section themselves, this request covers the full
    // 1..sectionCount range — no need to make them pick each number individually.
    ownedSections: data.hasOtherSectionInstructor
      ? data.ownedSections
      : Array.from({ length: data.sectionCount || 0 }, (_, index) => index + 1),
    instructorEmail: data.instructorEmail.trim(),
    description: data.description.trim() || null,
    studentCount: data.studentCount,
    items: data.items.map((item) => ({
      softwareApplicationId: item.softwareApplicationId || null,
      otherSoftwareName: item.otherSoftwareName || null,
      requestedVersion: item.requestedVersion,
      // Older local drafts can contain the Turkish display label, while the
      // API accepts only the LicenseType enum member (for example, "Free").
      licenseType: licenseToApi(item.licenseType),
      licenseOverrideReason: item.licenseOverrideReason || null,
      downloadUrl: item.downloadUrl || null,
      language: item.language,
      otherLanguage: item.otherLanguage || null,
      noPluginRequired: item.noPluginRequired,
      plugins: item.noPluginRequired
        ? []
        : item.plugins.map((plugin) => ({
            ...plugin,
            version: plugin.version || null,
            downloadUrl: plugin.downloadUrl || null,
            description: plugin.description || null,
          })),
    })),
    schedules: data.schedules,
    laboratoryIds: data.laboratoryIds,
    otherLaboratoryName: data.hasOtherLaboratory ? data.otherLaboratoryName.trim() || null : null,
    assistants: data.assistants.map((assistant) => ({
      fullName: assistant.fullName.trim(),
      email: assistant.email.trim(),
    })),
  };
}

function mapExistingRequest(value: unknown, email: string): RequestWizardData {
  const request = unwrap<Record<string, unknown>>(value);
  const rawItems = (request.items ?? []) as Array<Record<string, unknown>>;
  const rawSchedules = (request.schedules ?? []) as Array<Record<string, unknown>>;
  const rawLaboratories = (request.laboratories ?? []) as Array<Record<string, unknown>>;
  const rawAssistants = (request.assistants ?? []) as Array<Record<string, unknown>>;
  return {
    academicTermId: String(request.academicTermId ?? ''),
    facultyId: String(request.facultyId ?? ''),
    courseCode: String(request.courseCode ?? ''),
    courseName: String(request.courseName ?? ''),
    sectionCount: Number(request.sectionCount ?? NaN),
    hasOtherSectionInstructor: Boolean(request.hasOtherSectionInstructor),
    ownedSections: ((request.ownedSections ?? []) as Array<number | string>).map(Number),
    instructorEmail: String(request.instructorEmail ?? email),
    description: String(request.description ?? ''),
    studentCount: Number(request.studentCount ?? 0),
    items: rawItems.map((item) => ({
      softwareApplicationId: String(item.softwareApplicationId ?? ''),
      otherSoftwareName: String(item.otherSoftwareName ?? ''),
      softwareName: String(item.softwareName ?? 'Program'),
      requestedVersion: String(item.requestedVersion ?? ''),
      licenseType: String(item.licenseType ?? 'Unknown'),
      originalLicenseType: String(item.licenseType ?? 'Unknown'),
      licenseOverrideReason: String(item.licenseOverrideReason ?? ''),
      downloadUrl: String(item.downloadUrl ?? ''),
      language: String(item.language ?? 'Türkçe'),
      otherLanguage: String(item.otherLanguage ?? ''),
      noPluginRequired: Boolean(item.noPluginRequired),
      plugins: ((item.plugins ?? []) as Array<Record<string, unknown>>).map((plugin) => ({
        name: String(plugin.name ?? ''),
        version: String(plugin.version ?? ''),
        downloadUrl: String(plugin.downloadUrl ?? ''),
        description: String(plugin.description ?? ''),
      })),
    })),
    schedules: rawSchedules.map((schedule) => ({
      dayOfWeek: String(schedule.dayOfWeek ?? 'Monday'),
      startTime: String(schedule.startTime ?? '09:00').slice(0, 5),
      endTime: String(schedule.endTime ?? '10:00').slice(0, 5),
    })),
    laboratoryIds: rawLaboratories.map((laboratory) =>
      String(laboratory.laboratoryId ?? laboratory.id ?? ''),
    ),
    hasOtherLaboratory: Boolean(request.otherLaboratoryName),
    otherLaboratoryName: String(request.otherLaboratoryName ?? ''),
    assistants: rawAssistants.map((assistant) => ({
      fullName: String(assistant.fullName ?? ''),
      email: String(assistant.email ?? ''),
    })),
  };
}

function AssistantPicker({
  index,
  control,
  register,
  setValue,
  errors,
  onRemove,
}: {
  index: number;
  control: Control<RequestWizardData>;
  register: UseFormRegister<RequestWizardData>;
  setValue: UseFormSetValue<RequestWizardData>;
  errors: FieldErrors<RequestWizardData>;
  onRemove: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const fullName = useWatch({ control, name: `assistants.${index}.fullName` });
  const trimmedSearch = fullName.trim();
  const resultsId = `assistant-results-${index}`;
  const instructorsQuery = useQuery({
    queryKey: ['instructors', 'assistant', trimmedSearch],
    queryFn: () =>
      apiRequest<Array<{ email: string; fullName: string }>>(
        `/instructors/search?q=${encodeURIComponent(trimmedSearch)}&limit=20`,
      ),
    enabled: pickerOpen && trimmedSearch.length >= 2,
  });

  const fullNameField = register(`assistants.${index}.fullName`);

  return (
    <div className="assistant-row">
      <span className="schedule-row__number">{index + 1}</span>
      <label className="field">
        <span>Ad Soyad</span>
        <span className="input-with-icon">
          <Search aria-hidden="true" />
          <input
            {...fullNameField}
            onFocus={() => setPickerOpen(true)}
            onBlur={(event) => {
              fullNameField.onBlur(event);
              window.setTimeout(() => setPickerOpen(false), 150);
            }}
            placeholder="İsim veya e-posta ile arayın…"
            role="combobox"
            aria-expanded={pickerOpen && trimmedSearch.length >= 2}
            aria-controls={resultsId}
            aria-autocomplete="list"
          />
        </span>
        {pickerOpen && trimmedSearch.length >= 2 && (
          <div className="software-results" id={resultsId} role="listbox">
            {(instructorsQuery.data ?? []).map((instructor) => (
              <button
                type="button"
                key={instructor.email}
                role="option"
                aria-selected="false"
                onClick={() => {
                  setValue(`assistants.${index}.fullName`, instructor.fullName, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setValue(`assistants.${index}.email`, instructor.email, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setPickerOpen(false);
                }}
              >
                <span>
                  <strong>{instructor.fullName}</strong>
                  <small>{instructor.email}</small>
                </span>
              </button>
            ))}
            {!instructorsQuery.isFetching && (instructorsQuery.data ?? []).length === 0 && (
              <div className="software-empty">
                <span>Eşleşen kullanıcı bulunamadı.</span>
              </div>
            )}
          </div>
        )}
        <small className="field-hint">Listeden bir isim seçin; e-posta otomatik dolar.</small>
        <FieldError>{errors.assistants?.[index]?.fullName?.message}</FieldError>
      </label>
      <label className="field">
        <span>E-posta</span>
        <input type="email" readOnly {...register(`assistants.${index}.email`)} />
        <small className="field-hint" aria-hidden="true">
          &nbsp;
        </small>
        <FieldError>{errors.assistants?.[index]?.email?.message}</FieldError>
      </label>
      <button
        className="icon-button danger-action"
        type="button"
        onClick={onRemove}
        aria-label={`${index + 1}. asistanı kaldır`}
      >
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  );
}

export function RequestWizardPage() {
  const { id: routeId } = useParams<{ id?: string }>();
  const isEditing = Boolean(routeId);
  const { user, hasRole } = useAuth();
  const { showToast } = useToast();
  const history = useHistory();
  const [step, setStep] = useState(0);
  const [requestId, setRequestId] = useState(routeId);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const autosaveTimer = useRef<number>();
  const {
    register,
    control,
    watch,
    getValues,
    setValue,
    reset,
    trigger,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestWizardData>({
    resolver: zodResolver(requestWizardSchema),
    mode: 'onBlur',
    defaultValues: { ...emptyValues, instructorEmail: user?.email ?? '' },
  });
  const itemsArray = useFieldArray({ control, name: 'items' });
  const schedulesArray = useFieldArray({ control, name: 'schedules' });
  const assistantsArray = useFieldArray({ control, name: 'assistants' });
  const watchedItems = watch('items');
  const watchedSchedules = watch('schedules');
  const watchedLabIds = watch('laboratoryIds');
  const watchedStudentCount = watch('studentCount');
  const watchedSectionCount = watch('sectionCount');
  const watchedHasOtherSectionInstructor = watch('hasOtherSectionInstructor');
  const watchedHasOtherLaboratory = watch('hasOtherLaboratory');
  const watchedOwnedSections = watch('ownedSections');

  // If the requester lowers the section count below a previously picked "owned" number,
  // drop the now-invalid selections instead of silently submitting a stale value.
  useEffect(() => {
    if (!watchedHasOtherSectionInstructor) return;
    const validCount = Number.isFinite(watchedSectionCount) ? watchedSectionCount : 0;
    const pruned = watchedOwnedSections.filter((section) => section <= validCount);
    if (pruned.length !== watchedOwnedSections.length)
      setValue('ownedSections', pruned, { shouldDirty: true, shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedSectionCount, watchedHasOtherSectionInstructor]);

  const existingQuery = useQuery({
    queryKey: ['request', routeId],
    queryFn: () => apiRequest(`/requests/${routeId ?? ''}`),
    enabled: isEditing,
  });
  useEffect(() => {
    if (existingQuery.data) reset(mapExistingRequest(existingQuery.data, user?.email ?? ''));
  }, [existingQuery.data, reset, user?.email]);

  const draftQuery = useQuery({
    queryKey: ['request-draft'],
    queryFn: () => apiRequest<{ payloadJson: string } | undefined>('/requests/draft'),
    enabled: !isEditing,
  });
  useEffect(() => {
    if (draftQuery.data?.payloadJson) reset(parseDraftPayload(draftQuery.data.payloadJson, user?.email));
  }, [draftQuery.data, reset, user?.email]);

  const termsQuery = useQuery({
    queryKey: ['academic-terms'],
    queryFn: async () => {
      const raw = await apiRequest<unknown>('/academic-terms');
      const value = unwrap<AcademicTerm[] | { items: AcademicTerm[] }>(raw);
      return Array.isArray(value) ? value : value.items;
    },
  });
  const labsQuery = useQuery({
    queryKey: ['laboratories', 'active'],
    queryFn: async () =>
      normalizePage<Laboratory>(
        await apiRequest('/laboratories?page=1&pageSize=100&isActive=true'),
        1,
        100,
      ).items,
  });
  // Only the "yeni talep" (create) flow can be closed by an administrator — an already
  // started edit/awaiting-information request must stay editable regardless of this setting.
  const collectionStatusQuery = useQuery({
    queryKey: ['request-collection-status'],
    queryFn: () => apiRequest<RequestCollectionStatus>('/system-settings/request-collection-status'),
    enabled: !isEditing,
  });

  // Administrative staff have no faculty of their own, so they must be able to pick which
  // faculty a request is for (or leave it unset to request on behalf of their own unit).
  // System administrators can also submit requests, so they get the same picker.
  const canChooseFaculty = hasRole(ROLES.administrative, ROLES.administrator);
  const isAdministrativeOnly = hasRole(ROLES.administrative) && !hasRole(ROLES.administrator);
  const facultiesQuery = useQuery({
    queryKey: ['faculties', 'wizard-options'],
    queryFn: async () =>
      normalizePage<{ id: string; name: string }>(
        await apiRequest('/faculties?page=1&pageSize=100'),
        1,
        100,
      ).items,
    enabled: canChooseFaculty,
  });

  const [instructorSearch, setInstructorSearch] = useState('');
  const [instructorPickerOpen, setInstructorPickerOpen] = useState(false);
  const trimmedInstructorSearch = instructorSearch.trim();
  const instructorsQuery = useQuery({
    queryKey: ['instructors', trimmedInstructorSearch],
    queryFn: () =>
      apiRequest<Array<{ email: string; fullName: string }>>(
        `/instructors/search?q=${encodeURIComponent(trimmedInstructorSearch)}&limit=20`,
      ),
    enabled: instructorPickerOpen && trimmedInstructorSearch.length >= 2,
  });

  useEffect(() => {
    if (isEditing) return;
    // React Hook Form intentionally exposes a subscription-based watch API.
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = watch((values) => {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(() => {
        void apiRequest('/requests/draft', {
          method: 'POST',
          body: { payloadJson: JSON.stringify(values) },
        })
          .then(() => setSavedAt(new Date()))
          .catch(() => {
            // Taslak kaydı kritik değil; sunucuya yazılamazsa sessizce yok say.
          });
      }, 450);
    });
    return () => {
      subscription.unsubscribe();
      window.clearTimeout(autosaveTimer.current);
    };
  }, [isEditing, watch]);

  const autosaveMutation = useMutation({
    mutationFn: async (data: RequestWizardData) => {
      const path = requestId ? `/requests/${requestId}` : '/requests';
      const response = await apiRequest<unknown>(path, {
        method: 'POST',
        body: requestPayload(data),
      });
      const saved = unwrap<{ id?: string }>(response);
      if (saved.id) setRequestId(saved.id);
      return saved;
    },
    onSuccess: () => setSavedAt(new Date()),
  });

  // Program → laboratory eşleştirmesi: seçilen kataloğ programlarının her biri en az bir lab ile
  // eşleştirilmişse laboratuvar listesi yalnızca o labların birleşimine daralır. Listede olmayan
  // (otherSoftwareName ile girilen) bir program VEYA henüz hiç lab eşleştirilmemiş bir kataloğ
  // programı varsa filtre tamamen devre dışı kalır (kısıtı bilmediğimiz bir programı gerekçesiyle
  // aslında uygun olabilecek bir labı gizlememek için "fail open").
  const catalogItemIds = useMemo(
    () =>
      [...new Set(watchedItems.map((item) => item.softwareApplicationId).filter(Boolean))].sort(),
    [watchedItems],
  );
  const hasOffCatalogItem = watchedItems.some((item) => !item.softwareApplicationId);
  const softwareLabsQuery = useQuery({
    queryKey: ['software-laboratories', catalogItemIds],
    queryFn: () =>
      Promise.all(
        catalogItemIds.map((id) => apiRequest<SoftwareApplication>(`/software/${id}`)),
      ),
    enabled: catalogItemIds.length > 0,
  });
  const allowedLabIds = useMemo(() => {
    if (hasOffCatalogItem || catalogItemIds.length === 0) return null;
    if (!softwareLabsQuery.data) return null;
    if (softwareLabsQuery.data.some((software) => (software.laboratoryIds ?? []).length === 0))
      return null;
    return new Set(softwareLabsQuery.data.flatMap((software) => software.laboratoryIds ?? []));
  }, [hasOffCatalogItem, catalogItemIds, softwareLabsQuery.data]);
  const visibleLabs = useMemo(
    () => (allowedLabIds ? (labsQuery.data ?? []).filter((lab) => allowedLabIds.has(lab.id)) : (labsQuery.data ?? [])),
    [labsQuery.data, allowedLabIds],
  );
  useEffect(() => {
    if (!allowedLabIds) return;
    const pruned = watchedLabIds.filter((id) => allowedLabIds.has(id));
    if (pruned.length !== watchedLabIds.length)
      setValue('laboratoryIds', pruned, { shouldDirty: true, shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedLabIds]);

  const selectedLabs = useMemo(
    () => (labsQuery.data ?? []).filter((lab) => watchedLabIds.includes(lab.id)),
    [labsQuery.data, watchedLabIds],
  );
  const insufficientLabs = selectedLabs.filter((lab) =>
    isLaboratoryCapacityInsufficient(lab, watchedStudentCount),
  );
  const capacityWarning = insufficientLabs.length > 0;

  const fieldsForStep: Array<Array<FieldPath<RequestWizardData>>> = [
    [
      'academicTermId',
      'courseCode',
      'courseName',
      'sectionCount',
      'ownedSections',
      'instructorEmail',
      'studentCount',
      'assistants',
    ],
    ['items'],
    ['items'],
    ['schedules'],
    ['laboratoryIds', 'otherLaboratoryName'],
    [],
  ];

  const next = async () => {
    // System administrators editing an existing request may leave the Program/Eklenti
    // Bilgileri steps untouched (e.g. legacy items missing a plugin choice); requiring
    // them to fix unrelated stale data just to move on blocks the other steps they can
    // already pass through freely (saat, lab, öğrenci listesi).
    const bypassItemsValidation =
      isEditing && hasRole(ROLES.administrator) && (step === 1 || step === 2);
    const valid = bypassItemsValidation || (await trigger(fieldsForStep[step] ?? []));
    if (!valid) {
      showToast('Devam etmeden önce işaretli alanları kontrol edin.', 'error');
      return;
    }
    if (step > 0) {
      try {
        await autosaveMutation.mutateAsync(getValues());
      } catch (error) {
        showToast(getErrorMessage(error), 'error');
        return;
      }
    }
    setStep((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addSoftware = (software: SoftwareApplication) => {
    const defaultLicense = software.licenseType ?? 'Unknown';
    itemsArray.append({
      softwareApplicationId: software.id,
      otherSoftwareName: '',
      softwareName: software.name,
      requestedVersion: '',
      licenseType: defaultLicense,
      originalLicenseType: defaultLicense,
      licenseOverrideReason: '',
      downloadUrl: software.defaultDownloadUrl ?? '',
      language: software.defaultLanguage ?? 'Türkçe',
      otherLanguage: '',
      noPluginRequired: true,
      plugins: [],
    });
  };

  const addCustomSoftware = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    itemsArray.append({
      softwareApplicationId: '',
      otherSoftwareName: trimmedName,
      softwareName: trimmedName,
      requestedVersion: '',
      licenseType: 'Unknown',
      originalLicenseType: 'Unknown',
      licenseOverrideReason: '',
      downloadUrl: '',
      language: 'Türkçe',
      otherLanguage: '',
      noPluginRequired: true,
      plugins: [],
    });
  };

  const addPlugin = (itemIndex: number) => {
    const current = getValues(`items.${itemIndex}.plugins`);
    setValue(
      `items.${itemIndex}.plugins`,
      [...current, { name: '', version: '', downloadUrl: '', description: '' }],
      { shouldDirty: true },
    );
    setValue(`items.${itemIndex}.noPluginRequired`, false);
  };

  const submitRequest = async (data: RequestWizardData) => {
    try {
      const path = requestId ? `/requests/${requestId}` : '/requests';
      const response = await apiRequest<unknown>(path, {
        method: 'POST',
        body: requestPayload(data),
      });
      const saved = unwrap<{ id?: string }>(response);
      const finalId = saved.id ?? requestId;
      if (!finalId) throw new Error('Talep kimliği alınamadı.');
      const shouldSubmit = !isEditing || hasRole(ROLES.academic, ROLES.administrative);
      if (shouldSubmit) {
        await apiRequest(`/requests/${finalId}/submit`, { method: 'POST' });
      }
      if (!isEditing) await apiRequest('/requests/draft/delete', { method: 'POST' });
      showToast(
        shouldSubmit
          ? 'Talebiniz başarıyla gönderildi.'
          : 'Talep değişiklikleri başarıyla kaydedildi.',
      );
      history.push(`/talepler/${finalId}`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  if (existingQuery.isLoading || draftQuery.isLoading || (!isEditing && collectionStatusQuery.isLoading))
    return <LoadingState label="Talep taslağı yükleniyor…" />;
  if (existingQuery.isError)
    return <ErrorState error={existingQuery.error} onRetry={() => void existingQuery.refetch()} />;

  if (!isEditing && collectionStatusQuery.data && !collectionStatusQuery.data.isOpen) {
    const status = collectionStatusQuery.data;
    const now = new Date();
    const reason = !status.enabled
      ? 'Sistem yöneticisi talep toplamayı manuel olarak kapattı.'
      : status.startDate && new Date(status.startDate) > now
        ? `Talep toplama ${formatDate(status.startDate, true)} tarihinde başlayacak.`
        : status.endDate
          ? `Talep toplama ${formatDate(status.endDate, true)} tarihinde sona erdi.`
          : 'Talep toplama şu anda kapalı.';
    return (
      <>
        <PageHeader
          eyebrow="Laboratuvar yazılım talebi"
          title="Yeni talep oluşturma kapalı"
          description="Sistem yöneticisi talep toplamayı geçici olarak durdurdu."
        />
        <Card className="settings-card">
          <div className="detail-card__heading">
            <div>
              <AlertTriangle />
              <h2>Talep toplama şu anda kapalı</h2>
            </div>
          </div>
          <p>{reason}</p>
          <p className="field-hint">
            Var olan taslaklarınızı düzenlemeye ve gönderilmiş taleplerinizi görüntülemeye devam
            edebilirsiniz.
          </p>
          <div className="settings-record__actions">
            <Button variant="secondary" onClick={() => history.push('/talepler')}>
              Taleplerime dön
            </Button>
          </div>
        </Card>
      </>
    );
  }

  const selectedTerm = termsQuery.data?.find((term) => term.id === watch('academicTermId'));
  const watchedFacultyId = watch('facultyId');
  const resolvedFacultyLabel = canChooseFaculty
    ? (facultiesQuery.data ?? []).find((faculty) => faculty.id === watchedFacultyId)?.name ??
      (isAdministrativeOnly
        ? `Kendi birimim${user?.department ? ` (${user.department})` : ''}`
        : 'Fakülte seçilmedi')
    : (user?.facultyName ?? 'Profilinizden belirlenir');

  return (
    <>
      <PageHeader
        eyebrow="Laboratuvar yazılım talebi"
        title={isEditing ? 'Talebi düzenle' : 'Yeni talep oluştur'}
        description="Dersiniz için gereken yazılımları ve laboratuvar bilgilerini adım adım tamamlayın."
        action={
          <div className="autosave-status" aria-live="polite">
            {autosaveMutation.isPending ? (
              <>
                <Clock3 className="spin" /> Sunucuya kaydediliyor…
              </>
            ) : (
              <>
                <CircleCheck />{' '}
                {savedAt
                  ? `Taslak ${savedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} kaydedildi`
                  : 'Yerel taslak hazır'}
              </>
            )}
          </div>
        }
      />

      <Card className="wizard-shell">
        <ol
          className="wizard-steps"
          aria-label="Talep formu adımları"
          style={
            {
              '--wizard-progress': `${(step / (WIZARD_STEPS.length - 1)) * 100}%`,
            } as CSSProperties
          }
        >
          {WIZARD_STEPS.map((label, index) => (
            <li
              key={label}
              className={classNames(index === step && 'is-current', index < step && 'is-complete')}
              aria-current={index === step ? 'step' : undefined}
            >
              <button
                type="button"
                onClick={() => {
                  if (index <= step) setStep(index);
                }}
                disabled={index > step}
              >
                <span>{index < step ? <Check aria-hidden="true" /> : index + 1}</span>
                <strong>{label}</strong>
              </button>
            </li>
          ))}
        </ol>

        <form
          className="wizard-form"
          onSubmit={(event) => void handleSubmit(submitRequest)(event)}
          noValidate
        >
          <div className="wizard-form__heading">
            <span className="wizard-form__step-badge" aria-hidden="true">
              {step + 1}
            </span>
            <div>
              <span>
                Adım {step + 1} / {WIZARD_STEPS.length}
              </span>
              <h2>{WIZARD_STEPS[step]}</h2>
              <p>{stepDescriptions[step]}</p>
            </div>
          </div>

          {step === 0 && (
            <div className="form-grid">
              <label className="field">
                <span>Akademik dönem *</span>
                <select
                  {...register('academicTermId')}
                  aria-invalid={Boolean(errors.academicTermId)}
                >
                  <option value="">Dönem seçin</option>
                  {(termsQuery.data ?? []).map((term) => (
                    <option value={term.id} key={term.id}>
                      {term.academicYear} {term.termName}
                      {term.isCurrent ? ' · Güncel' : ''}
                    </option>
                  ))}
                </select>
                <FieldError>{errors.academicTermId?.message}</FieldError>
              </label>
              {canChooseFaculty ? (
                <label className="field">
                  <span>Fakülte{isAdministrativeOnly ? '' : ' *'}</span>
                  <select {...register('facultyId')}>
                    {isAdministrativeOnly ? (
                      <option value="">
                        Kendi birimim{user?.department ? ` (${user.department})` : ''}
                      </option>
                    ) : (
                      <option value="">Fakülte seçin</option>
                    )}
                    {(facultiesQuery.data ?? []).map((faculty) => (
                      <option value={faculty.id} key={faculty.id}>
                        {faculty.name}
                      </option>
                    ))}
                  </select>
                  <small className="field-hint">
                    {isAdministrativeOnly
                      ? 'Talebi belirli bir fakülte için mi yoksa kendi biriminiz için mi oluşturduğunuzu seçin.'
                      : 'Talebin hangi fakülte adına oluşturulacağını seçin.'}
                  </small>
                </label>
              ) : (
                <label className="field">
                  <span>Fakülte</span>
                  <input value={user?.facultyName ?? 'Profilinizden belirlenir'} readOnly />
                  <small className="field-hint">
                    Fakülte bilgisi hesabınızdan güvenli biçimde alınır.
                  </small>
                </label>
              )}
              <label className="field">
                <span>Ders kodu *</span>
                <input placeholder="Örn. YZM301" maxLength={50} {...register('courseCode')} />
                <FieldError>{errors.courseCode?.message}</FieldError>
              </label>
              <label className="field">
                <span>Ders adı *</span>
                <input
                  placeholder="Örn. Yazılım Mühendisliği"
                  maxLength={250}
                  {...register('courseName')}
                />
                <FieldError>{errors.courseName?.message}</FieldError>
              </label>
              <label className="field">
                <span>Bu dersin kaç section'ı var? *</span>
                <select {...register('sectionCount', { valueAsNumber: true })}>
                  <option value="">Section sayısını seçin</option>
                  {[1, 2, 3, 4, 5].map((count) => (
                    <option value={count} key={count}>
                      {count}
                    </option>
                  ))}
                </select>
                <FieldError>{errors.sectionCount?.message}</FieldError>
              </label>
              <div className="field field--full">
                <label className="checkbox checkbox--card">
                  <input type="checkbox" {...register('hasOtherSectionInstructor')} />
                  <span>
                    <strong>Diğer section'ları başka bir akademisyen veriyor</strong>
                    <small>
                      İşaretlemezseniz bu dersin tüm section'larını sizin verdiğiniz varsayılır;
                      her section için ayrı ayrı talep girmenize gerek yoktur.
                    </small>
                  </span>
                </label>
                {watchedHasOtherSectionInstructor && (
                  <>
                    <div className="multiselect-grid">
                      {Array.from(
                        { length: Number.isFinite(watchedSectionCount) ? watchedSectionCount : 0 },
                        (_, index) => index + 1,
                      ).map((section) => (
                        <label className="checkbox checkbox--card" key={section}>
                          <input
                            type="checkbox"
                            checked={watchedOwnedSections.includes(section)}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...watchedOwnedSections, section]
                                : watchedOwnedSections.filter((value) => value !== section);
                              setValue('ownedSections', next, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }}
                          />
                          <span>Section {section}</span>
                        </label>
                      ))}
                    </div>
                    <FieldError>{errors.ownedSections?.message}</FieldError>
                  </>
                )}
              </div>
              <label className="field field--full">
                <span>Ders hocası</span>
                <span className="input-with-icon">
                  <Search aria-hidden="true" />
                  <input
                    value={instructorSearch}
                    onChange={(event) => {
                      setInstructorSearch(event.target.value);
                      setInstructorPickerOpen(true);
                    }}
                    onFocus={() => setInstructorPickerOpen(true)}
                    onBlur={() => window.setTimeout(() => setInstructorPickerOpen(false), 150)}
                    placeholder="İsim veya e-posta ile arayın…"
                    role="combobox"
                    aria-expanded={instructorPickerOpen && trimmedInstructorSearch.length >= 2}
                    aria-controls="instructor-results"
                    aria-autocomplete="list"
                  />
                </span>
                {instructorPickerOpen && trimmedInstructorSearch.length >= 2 && (
                  <div className="software-results" id="instructor-results" role="listbox">
                    {(instructorsQuery.data ?? []).map((instructor) => (
                      <button
                        type="button"
                        key={instructor.email}
                        role="option"
                        aria-selected="false"
                        onClick={() => {
                          setValue('instructorEmail', instructor.email, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          setInstructorSearch(instructor.fullName);
                          setInstructorPickerOpen(false);
                        }}
                      >
                        <span>
                          <strong>{instructor.fullName}</strong>
                          <small>{instructor.email}</small>
                        </span>
                      </button>
                    ))}
                    {!instructorsQuery.isFetching && (instructorsQuery.data ?? []).length === 0 && (
                      <div className="software-empty">
                        <span>Eşleşen kullanıcı bulunamadı. E-posta adresini elle girebilirsiniz.</span>
                      </div>
                    )}
                  </div>
                )}
                <small className="field-hint">
                  Bir isim seçtiğinizde e-posta adresi otomatik doldurulur; gerekirse aşağıdan elle
                  değiştirebilirsiniz.
                </small>
              </label>
              <label className="field">
                <span>Ders hocası e-posta adresi *</span>
                <input type="email" {...register('instructorEmail')} />
                <FieldError>{errors.instructorEmail?.message}</FieldError>
              </label>
              <label className="field">
                <span>Beklenen öğrenci sayısı *</span>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  {...register('studentCount', { valueAsNumber: true })}
                />
                <FieldError>{errors.studentCount?.message}</FieldError>
              </label>
              <label className="field field--full">
                <span>Talep açıklaması</span>
                <textarea
                  rows={4}
                  maxLength={2000}
                  placeholder="Ders veya kurulum için bilinmesi gereken ek ayrıntılar…"
                  {...register('description')}
                />
                <FieldError>{errors.description?.message}</FieldError>
              </label>
              <div className="field field--full">
                <span>Asistanlar (opsiyonel)</span>
                <small className="field-hint">
                  Bu derse asistan eklemek isteğe bağlıdır; eklemeden de devam edebilirsiniz.
                </small>
                {assistantsArray.fields.map((field, index) => (
                  <AssistantPicker
                    key={field.id}
                    index={index}
                    control={control}
                    register={register}
                    setValue={setValue}
                    errors={errors}
                    onRemove={() => assistantsArray.remove(index)}
                  />
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Plus aria-hidden="true" />}
                  onClick={() => assistantsArray.append({ fullName: '', email: '' })}
                >
                  Asistan ekle
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="wizard-section">
              <SoftwareSelector
                onSelect={addSoftware}
                onSelectCustom={addCustomSoftware}
                selectedIds={watchedItems
                  .map((item) => item.softwareApplicationId)
                  .filter((id): id is string => Boolean(id))}
              />
              <FieldError>{errors.items?.message}</FieldError>
              <div className="selected-software-list">
                {itemsArray.fields.map((field, index) => (
                  <Card className="selected-software" key={field.id}>
                    <div className="selected-software__heading">
                      <span className="software-results__icon">
                        {watchedItems[index]?.softwareName.slice(0, 2).toLocaleUpperCase('tr-TR')}
                      </span>
                      <div>
                        <strong>{watchedItems[index]?.softwareName}</strong>
                        <small>
                          {watchedItems[index]?.softwareApplicationId
                            ? `Program ${index + 1}`
                            : 'Kataloğa kayıtlı değil — indirme bilgilerini elle girin.'}
                        </small>
                      </div>
                      <button
                        className="icon-button danger-action"
                        type="button"
                        onClick={() => itemsArray.remove(index)}
                        aria-label={`${watchedItems[index]?.softwareName ?? 'Programı'} kaldır`}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                    <div className="form-grid form-grid--compact">
                      <label className="field field--full">
                        <span>İndirme bağlantısı</span>
                        <span className="input-with-icon">
                          <Link2 />
                          <input type="url" {...register(`items.${index}.downloadUrl`)} />
                        </span>
                        <FieldError>{errors.items?.[index]?.downloadUrl?.message}</FieldError>
                      </label>
                      <label className="field">
                        <span>Program dili *</span>
                        <select {...register(`items.${index}.language`)}>
                          {LANGUAGES.map((language) => (
                            <option key={language}>{language}</option>
                          ))}
                        </select>
                      </label>
                      {watchedItems[index]?.language === 'Diğer' && (
                        <label className="field">
                          <span>Dil açıklaması *</span>
                          <input {...register(`items.${index}.otherLanguage`)} />
                          <FieldError>{errors.items?.[index]?.otherLanguage?.message}</FieldError>
                        </label>
                      )}
                    </div>
                  </Card>
                ))}
                {!itemsArray.fields.length && (
                  <div className="selection-placeholder">
                    <ListChecks aria-hidden="true" />
                    <strong>Henüz program seçmediniz</strong>
                    <span>Yukarıdaki alandan en az bir program arayıp ekleyin.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-section">
              {itemsArray.fields.map((field, itemIndex) => (
                <Card className="plugin-card" key={field.id}>
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">Program {itemIndex + 1}</span>
                      <h3>{watchedItems[itemIndex]?.softwareName}</h3>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      icon={<Plus aria-hidden="true" />}
                      onClick={() => addPlugin(itemIndex)}
                    >
                      Eklenti ekle
                    </Button>
                  </div>
                  <label className="checkbox checkbox--card">
                    <input
                      type="checkbox"
                      checked={watchedItems[itemIndex]?.noPluginRequired ?? false}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setValue(`items.${itemIndex}.noPluginRequired`, checked, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        // Rows left over from a previous "Eklenti ekle" click stay in form
                        // state even though they're hidden once this is checked again — an
                        // empty-named row still fails plugin validation silently and blocks
                        // "Kaydet ve devam et", so clear them when opting back out.
                        if (checked) {
                          setValue(`items.${itemIndex}.plugins`, [], {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      }}
                    />
                    <span>
                      <strong>Eklenti gerekmiyor</strong>
                      <small>Bu program ek bir bileşen olmadan kurulacak.</small>
                    </span>
                  </label>
                  {!watchedItems[itemIndex]?.noPluginRequired &&
                    watchedItems[itemIndex]?.plugins.map((_, pluginIndex) => (
                      <div className="plugin-row" key={`${field.id}-${pluginIndex}`}>
                        <div className="form-grid form-grid--compact">
                          <label className="field">
                            <span>Eklenti adı *</span>
                            <input
                              {...register(`items.${itemIndex}.plugins.${pluginIndex}.name`)}
                            />
                            <FieldError>
                              {errors.items?.[itemIndex]?.plugins?.[pluginIndex]?.name?.message}
                            </FieldError>
                          </label>
                          <label className="field">
                            <span>İndirme bağlantısı</span>
                            <input
                              type="url"
                              {...register(`items.${itemIndex}.plugins.${pluginIndex}.downloadUrl`)}
                            />
                            <FieldError>
                              {
                                errors.items?.[itemIndex]?.plugins?.[pluginIndex]?.downloadUrl
                                  ?.message
                              }
                            </FieldError>
                          </label>
                          <label className="field">
                            <span>Açıklama</span>
                            <input
                              {...register(`items.${itemIndex}.plugins.${pluginIndex}.description`)}
                            />
                          </label>
                        </div>
                        <button
                          className="icon-button danger-action"
                          type="button"
                          aria-label="Eklentiyi kaldır"
                          onClick={() => {
                            const plugins = getValues(`items.${itemIndex}.plugins`);
                            setValue(
                              `items.${itemIndex}.plugins`,
                              plugins.filter((_, currentIndex) => currentIndex !== pluginIndex),
                              { shouldDirty: true },
                            );
                          }}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  <FieldError>{errors.items?.[itemIndex]?.plugins?.message}</FieldError>
                </Card>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="wizard-section">
              {schedulesArray.fields.map((field, index) => (
                <div className="schedule-row" key={field.id}>
                  <span className="schedule-row__number">{index + 1}</span>
                  <label className="field">
                    <span>Ders günü *</span>
                    <select {...register(`schedules.${index}.dayOfWeek`)}>
                      {WEEK_DAYS.map((day) => (
                        <option value={DAY_API_VALUES[day]} key={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <span className="field-error-slot" aria-hidden="true" />
                  </label>
                  <label className="field">
                    <span>Başlangıç *</span>
                    <input type="time" {...register(`schedules.${index}.startTime`)} />
                    <span className="field-error-slot" aria-hidden="true" />
                  </label>
                  <label className="field">
                    <span>Bitiş *</span>
                    <input type="time" {...register(`schedules.${index}.endTime`)} />
                    <span className="field-error-slot">
                      <FieldError>{errors.schedules?.[index]?.endTime?.message}</FieldError>
                    </span>
                  </label>
                  <button
                    className="icon-button danger-action"
                    type="button"
                    disabled={schedulesArray.fields.length === 1}
                    onClick={() => schedulesArray.remove(index)}
                    aria-label={`${index + 1}. ders oturumunu kaldır`}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                icon={<Plus aria-hidden="true" />}
                onClick={() =>
                  schedulesArray.append({
                    dayOfWeek: 'Monday',
                    startTime: '09:00',
                    endTime: '10:00',
                  })
                }
              >
                Başka gün ve saat ekle
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="wizard-section">
              {labsQuery.isLoading || softwareLabsQuery.isFetching ? (
                <LoadingState label="Laboratuvarlar yükleniyor…" />
              ) : labsQuery.isError ? (
                <ErrorState error={labsQuery.error} />
              ) : (
                <>
                  {allowedLabIds && (
                    <p className="field-hint">
                      Laboratuvar listesi, seçtiğiniz programlarla eşleştirilmiş laboratuvarlarla
                      sınırlandırıldı.
                    </p>
                  )}
                  {allowedLabIds && visibleLabs.length === 0 && (
                    <div className="alert alert--warning" role="alert">
                      <AlertTriangle aria-hidden="true" />
                      <div>
                        <strong>Eşleşen laboratuvar yok</strong>
                        <span>
                          Seçtiğiniz programlarla eşleştirilmiş aktif bir laboratuvar bulunamadı.
                          Programı gözden geçirin veya yöneticinizden program-laboratuvar
                          eşleştirmesini güncellemesini isteyin.
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
              {!labsQuery.isLoading && !labsQuery.isError && (
                <div className="lab-grid">
                  {visibleLabs.map((lab) => {
                    const selected = watchedLabIds.includes(lab.id);
                    return (
                      <label
                        className={classNames('lab-option', selected && 'is-selected')}
                        key={lab.id}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...watchedLabIds, lab.id]
                              : watchedLabIds.filter((id) => id !== lab.id);
                            setValue('laboratoryIds', next, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }}
                        />
                        <span className="lab-option__check">
                          <Check aria-hidden="true" />
                        </span>
                        <span className="lab-option__icon">
                          <FlaskConical aria-hidden="true" />
                        </span>
                        <span>
                          <strong>{lab.name}</strong>
                          <small>
                            {lab.code} · {lab.building ?? 'Bina bilgisi yok'}{' '}
                            {lab.floor ? `· ${lab.floor}. kat` : ''}
                          </small>
                        </span>
                        <dl>
                          <div>
                            <dt>Kapasite</dt>
                            <dd>{lab.capacity}</dd>
                          </div>
                          <div>
                            <dt>Bilgisayar</dt>
                            <dd>{lab.computerCount}</dd>
                          </div>
                          <div>
                            <dt>İşletim sistemi</dt>
                            <dd>{lab.operatingSystem ?? '—'}</dd>
                          </div>
                          <div>
                            <dt>Bilgisayar türü</dt>
                            <dd>{lab.computerType ?? '—'}</dd>
                          </div>
                        </dl>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="field field--full">
                <label className="checkbox checkbox--card">
                  <input type="checkbox" {...register('hasOtherLaboratory')} />
                  <span>
                    <strong>Dersi vereceğim sınıf listede yok</strong>
                    <small>
                      Ders vereceğiniz yer laboratuvar listesinde yoksa bu kutuyu işaretleyip
                      yerini yazın.
                    </small>
                  </span>
                </label>
                {watchedHasOtherLaboratory && (
                  <label className="field field--full">
                    <span>Dersi vereceğiniz yer</span>
                    <input
                      type="text"
                      placeholder="Örn. Mühendislik Fakültesi B Blok 204"
                      {...register('otherLaboratoryName')}
                    />
                    <FieldError>{errors.otherLaboratoryName?.message}</FieldError>
                  </label>
                )}
              </div>
              <FieldError>{errors.laboratoryIds?.message}</FieldError>
              {capacityWarning && (
                <div className="alert alert--warning" role="alert">
                  <AlertTriangle aria-hidden="true" />
                  <div>
                    <strong>Kapasite uyarısı</strong>
                    <span>
                      {watchedStudentCount} öğrenci;{' '}
                      {insufficientLabs.map((lab) => lab.name).join(', ')} için kullanılabilir
                      bilgisayar veya kapasite sınırını aşıyor. Talebi gönderebilirsiniz; durum
                      yönetici raporuna yansıyacaktır.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="review-grid">
              <div className="review-stats">
                <span className="review-stat review-stat--purple">
                  <span className="review-stat__dot" aria-hidden="true" />
                  <strong>1</strong> <span>ders</span>
                </span>
                <span className="review-stat review-stat--blue">
                  <span className="review-stat__dot" aria-hidden="true" />
                  <strong>{watchedItems.length}</strong> <span>program</span>
                </span>
                <span className="review-stat review-stat--amber">
                  <span className="review-stat__dot" aria-hidden="true" />
                  <strong>{watchedSchedules.length}</strong> <span>gün/saat</span>
                </span>
                <span className="review-stat review-stat--cyan">
                  <span className="review-stat__dot" aria-hidden="true" />
                  <strong>{selectedLabs.length}</strong> <span>laboratuvar</span>
                </span>
                <span className="review-stat review-stat--green">
                  <span className="review-stat__dot" aria-hidden="true" />
                  <strong>{watchedStudentCount}</strong> <span>öğrenci</span>
                </span>
              </div>
              <ReviewSection
                title="Ders bilgileri"
                icon={<FileText />}
                tone="purple"
                onEdit={() => setStep(0)}
              >
                <ReviewRow label="Ders" value={`${watch('courseCode')} · ${watch('courseName')}`} />
                <ReviewRow
                  label="Section"
                  value={
                    watch('hasOtherSectionInstructor')
                      ? `Toplam ${watch('sectionCount') || '—'} section, sizin verdikleriniz: ${
                          watch('ownedSections').join(', ') || '—'
                        }`
                      : `Tüm section'lar (toplam ${watch('sectionCount') || '—'})`
                  }
                />
                <ReviewRow
                  label="Akademik dönem"
                  value={
                    selectedTerm ? `${selectedTerm.academicYear} ${selectedTerm.termName}` : '—'
                  }
                />
                <ReviewRow label="Fakülte" value={resolvedFacultyLabel} />
                <ReviewRow label="Ders hocası" value={watch('instructorEmail')} />
                <ReviewRow label="Öğrenci sayısı" value={String(watchedStudentCount)} />
                <ReviewRow
                  label="Asistanlar"
                  value={
                    watch('assistants').length > 0
                      ? watch('assistants')
                          .map((assistant) => assistant.fullName)
                          .join(', ')
                      : 'Eklenmedi'
                  }
                />
              </ReviewSection>
              <ReviewSection
                title="Programlar ve eklentiler"
                icon={<ListChecks />}
                tone="blue"
                onEdit={() => setStep(1)}
              >
                {watchedItems.map((item, index) => (
                  <div className="review-program" key={itemsArray.fields[index]?.id ?? index}>
                    <strong>{item.softwareName}</strong>
                    <span>
                      {licenseIsPaidLabel(item.licenseType)} · {item.language}
                    </span>
                    <small>
                      {item.noPluginRequired
                        ? 'Eklenti gerekmiyor'
                        : `${item.plugins.map((plugin) => plugin.name).join(', ')} eklentileri`}
                    </small>
                  </div>
                ))}
              </ReviewSection>
              <ReviewSection
                title="Ders gün ve saatleri"
                icon={<Clock3 />}
                tone="amber"
                onEdit={() => setStep(3)}
              >
                {watchedSchedules.map((schedule, index) => (
                  <ReviewRow
                    key={`${schedule.dayOfWeek}-${index}`}
                    label={`Oturum ${index + 1}`}
                    value={`${dayLabels[schedule.dayOfWeek] ?? schedule.dayOfWeek}, ${schedule.startTime}–${schedule.endTime}`}
                  />
                ))}
              </ReviewSection>
              <ReviewSection
                title="Laboratuvarlar"
                icon={<FlaskConical />}
                tone="cyan"
                onEdit={() => setStep(4)}
              >
                {selectedLabs.map((lab) => (
                  <ReviewRow
                    key={lab.id}
                    label={lab.name}
                    value={`${lab.capacity} kişi · ${lab.computerCount} bilgisayar`}
                  />
                ))}
                {watchedHasOtherLaboratory && watch('otherLaboratoryName') && (
                  <ReviewRow
                    label="Listede olmayan sınıf"
                    value={watch('otherLaboratoryName')}
                  />
                )}
                {capacityWarning && (
                  <span className="review-warning">
                    <AlertTriangle /> Kapasite uyarısı bulunuyor
                  </span>
                )}
              </ReviewSection>
              <div className="submission-note">
                <CheckCircle2 aria-hidden="true" />
                <div>
                  <strong>
                    {isEditing && !hasRole(ROLES.academic, ROLES.administrative)
                      ? 'Kaydetmeye hazırsınız'
                      : 'Göndermeye hazırsınız'}
                  </strong>
                  <p>
                    {isEditing && !hasRole(ROLES.academic, ROLES.administrative)
                      ? 'Değişiklikler mevcut talebin durumunu değiştirmeden kaydedilir.'
                      : '“Talebi gönder” dediğinizde kayıt değerlendirmeye açılır.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="wizard-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={step === 0}
              icon={<ArrowLeft aria-hidden="true" />}
              onClick={() => setStep((current) => Math.max(0, current - 1))}
            >
              Geri
            </Button>
            <span className="wizard-actions__spacer" />
            <Button
              type="button"
              variant="secondary"
              icon={<Save aria-hidden="true" />}
              isLoading={autosaveMutation.isPending}
              onClick={() => autosaveMutation.mutate(getValues())}
            >
              {isEditing ? 'Değişiklikleri kaydet' : 'Taslağı kaydet'}
            </Button>
            {step < WIZARD_STEPS.length - 1 ? (
              <Button type="button" onClick={() => void next()}>
                Kaydet ve devam et <ArrowRight aria-hidden="true" />
              </Button>
            ) : (
              <Button type="submit" isLoading={isSubmitting} icon={<Send aria-hidden="true" />}>
                {isEditing && !hasRole(ROLES.academic, ROLES.administrative) ? 'Değişiklikleri kaydet' : 'Talebi gönder'}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </>
  );
}

const stepDescriptions = [
  'Ders ve akademik dönem bilgilerini girin. Fakülteniz hesabınızdan otomatik alınır.',
  'Ana listede arama yaparak bir veya daha fazla program seçin.',
  'Her program için gerekli eklentileri tanımlayın veya eklenti gerekmediğini belirtin.',
  'Dersin gerçekleşeceği günleri ve 24 saat formatında saat aralıklarını ekleyin.',
  'Bir veya daha fazla laboratuvar seçin; kapasite bilgilerini kontrol edin.',
  'Öğrencileri manuel ekleyin veya doğrulamalı XLSX/CSV ön izlemesini kullanın.',
  'Tüm bilgileri kontrol edin ve talebinizi değerlendirmeye gönderin.',
];

function ReviewSection({
  title,
  icon,
  tone,
  onEdit,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: 'purple' | 'blue' | 'amber' | 'cyan' | 'green';
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="review-section">
      <div className="review-section__heading">
        <span className={`review-section__icon review-section__icon--${tone}`}>{icon}</span>
        <h3>{title}</h3>
        <button type="button" onClick={onEdit}>
          Düzenle
        </button>
      </div>
      <div>{children}</div>
    </Card>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="review-row">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}
