export const ROLES = {
  academic: 'Academic',
  administrative: 'Administrative',
  faculty: 'FacultyAuthorizedUser',
  administrator: 'SystemAdministrator',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export interface User {
  id: string;
  fullName: string;
  email: string;
  roles: UserRole[];
  facultyId?: string;
  facultyName?: string;
  department?: string;
  authorizedFaculties?: Array<{ id: string; name: string; permissions: number }>;
  // Sunucu eski 'dark'/'light' değerlerini de döndürebilir (bkz. normalizeTheme); bu yüzden
  // burada geniş bir string tipi tutulur, dar Theme birleşimine dönüştürme ThemeContext'te olur.
  themePreference?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface LoginResponse extends AuthTokens {
  user?: User;
}

export type RequestStatus =
  | 'Draft'
  | 'Submitted'
  | 'UnderReview'
  | 'AwaitingInformation'
  | 'Approved'
  | 'Rejected'
  | 'InstallationScheduled'
  | 'InstallationPlanned'
  | 'InstallationCompleted'
  | 'Cancelled';

export interface SoftwareApplication {
  id: string;
  name: string;
  manufacturer?: string;
  version?: string;
  licenseType?: string;
  isPaid?: boolean;
  defaultDownloadUrl?: string;
  defaultLanguage?: string;
  supportedOperatingSystems?: string[];
  isActive?: boolean;
  laboratoryIds?: string[];
}

export interface SoftwareRequest {
  id: string;
  ownerUserId: string;
  ownerFullName?: string;
  ownerEmail?: string;
  facultyId: string;
  courseCode: string;
  courseName: string;
  sectionCount: number;
  hasOtherSectionInstructor: boolean;
  ownedSections: number[];
  instructorEmail?: string;
  items: Array<{
    softwareApplicationId: string | null;
    otherSoftwareName?: string | null;
    softwareName: string;
    requestedVersion?: string;
  }>;
  facultyName: string;
  academicTerm: string;
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
  status: string;
  createdAt: string;
  updatedAt?: string;
  studentCount: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  link?: string;
}


export interface CourseScheduleEntry {
  requestId: string;
  courseCode: string;
  courseName: string;
  ownedSections: number[];
  instructorEmail?: string;
  ownerFullName?: string;
  ownerEmail?: string;
  status: RequestStatus;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  laboratoryId: string;
  laboratoryName: string;
}

export interface Laboratory {
  id: string;
  name: string;
  code: string;
  building?: string;
  floor?: string;
  capacity: number;
  computerCount: number;
  operatingSystem?: string;
  computerType?: string;
  isActive?: boolean;
}

export interface AcademicTerm {
  id: string;
  academicYear: string;
  termName: string;
  isCurrent?: boolean;
  requestEndDate?: string;
  isActive?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface ApiEnvelope<T> {
  data?: T;
  result?: T;
  message?: string;
  errors?: Record<string, string[] | string>;
}
