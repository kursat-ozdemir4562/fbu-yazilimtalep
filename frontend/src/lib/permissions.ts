import { ROLES, type User } from '../types';

export const FACULTY_PERMISSIONS = {
  view: 1,
  edit: 2,
  report: 4,
  changeStatus: 8,
} as const;

export function hasFacultyPermission(
  user: User | null | undefined,
  facultyId: string | undefined,
  permission: number,
): boolean {
  if (!user || !facultyId) return false;
  if (user.roles.includes(ROLES.administrator)) return true;
  // A FacultyAuthorizedUser's own faculty is implicitly fully authorized, mirroring the backend's
  // ResourceAuthorizationService.AllowedFacultyIdsAsync — no separate UserFacultyPermissions grant
  // needed for their own faculty, only for covering an additional one.
  if (
    user.roles.includes(ROLES.faculty) &&
    user.facultyId &&
    user.facultyId.toLocaleLowerCase('tr-TR') === facultyId.toLocaleLowerCase('tr-TR')
  ) {
    return true;
  }
  return Boolean(
    user.authorizedFaculties?.some(
      (faculty) =>
        faculty.id.toLocaleLowerCase('tr-TR') === facultyId.toLocaleLowerCase('tr-TR') &&
        (faculty.permissions & permission) === permission,
    ),
  );
}

interface RequestAccessTarget {
  facultyId?: string;
  ownerUserId?: string;
  status?: string;
}

export function canEditRequest(
  user: User | null | undefined,
  request: RequestAccessTarget,
): boolean {
  if (!user) return false;
  if (user.roles.includes(ROLES.administrator)) return true;
  if (
    (user.roles.includes(ROLES.academic) || user.roles.includes(ROLES.administrative)) &&
    (!request.ownerUserId || request.ownerUserId === user.id) &&
    ['Draft', 'AwaitingInformation'].includes(request.status ?? '')
  ) {
    return true;
  }
  return (
    user.roles.includes(ROLES.faculty) &&
    hasFacultyPermission(user, request.facultyId, FACULTY_PERMISSIONS.edit)
  );
}

export function canChangeRequestStatus(
  user: User | null | undefined,
  request: RequestAccessTarget,
): boolean {
  if (!user) return false;
  return (
    user.roles.includes(ROLES.administrator) ||
    (user.roles.includes(ROLES.faculty) &&
      hasFacultyPermission(user, request.facultyId, FACULTY_PERMISSIONS.changeStatus))
  );
}
