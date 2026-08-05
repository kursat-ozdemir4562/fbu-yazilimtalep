import { buildManagementPayload } from '../pages/ManagementPages';
import { canChangeRequestStatus, canEditRequest } from '../lib/permissions';
import { normalizeNotificationLink } from '../lib/routes';
import { ROLES, type User } from '../types';

describe('Backend sözleşmesi yardımcıları', () => {
  it('backend bildirim bağlantılarını frontend rotalarına çevirir', () => {
    expect(normalizeNotificationLink('/requests/req-42')).toBe('/talepler/req-42');
    expect(normalizeNotificationLink('/admin/software-suggestions/sug-7')).toBe('/bildirimler');
    expect(normalizeNotificationLink('/software/soft-3')).toBe('/bildirimler');
    expect(normalizeNotificationLink('https://example.com')).toBe('/bildirimler');
  });

  it('fakülte izin bayraklarını talep aksiyonlarına uygular', () => {
    const user: User = {
      id: 'faculty-user',
      email: 'yetkili@fbu.edu.tr',
      fullName: 'Fakülte Yetkilisi',
      roles: [ROLES.faculty],
      authorizedFaculties: [{ id: 'faculty-1', name: 'Mühendislik', permissions: 2 }],
    };
    const request = { facultyId: 'faculty-1', status: 'Approved' };
    expect(canEditRequest(user, request)).toBe(true);
    expect(canChangeRequestStatus(user, request)).toBe(false);
  });

  it('kullanıcı create/update DTO gövdelerini ayrı üretir', () => {
    const form = {
      email: ' yeni@fbu.edu.tr ',
      fullName: ' Yeni Kullanıcı ',
      facultyId: '',
      password: 'Test-Password-123!',
      role: ROLES.academic,
      isActive: false,
    };
    expect(buildManagementPayload('users', form, false)).toEqual({
      email: 'yeni@fbu.edu.tr',
      fullName: 'Yeni Kullanıcı',
      facultyId: null,
      department: null,
      roles: [ROLES.academic],
      password: 'Test-Password-123!',
    });
    expect(buildManagementPayload('users', form, true)).toEqual({
      fullName: 'Yeni Kullanıcı',
      facultyId: null,
      department: null,
      roles: [ROLES.academic],
      isActive: false,
    });
  });

  it('fakülte yetkilerini backend bit maskesine dönüştürür', () => {
    expect(
      buildManagementPayload(
        'permissions',
        {
          facultyId: 'faculty-1',
          canView: true,
          canEdit: true,
          canReport: false,
          canChangeStatus: true,
        },
        true,
      ),
    ).toEqual({ facultyId: 'faculty-1', permissions: 1 | 2 | 8 });
  });
});
