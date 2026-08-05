import { requestPayload } from '../pages/RequestWizardPage';

describe('Talep sihirbazı API payload', () => {
  it('yerel taslaktaki lisans etiketini API enum değerine dönüştürür', () => {
    const payload = requestPayload({
      academicTermId: '5ac9de15-30e1-46c9-8603-4f704b1585c0',
      facultyId: '',
      courseCode: 'YZM301',
      courseName: 'Yazılım Mühendisliği',
      sectionCount: 1,
      hasOtherSectionInstructor: false,
      ownedSections: [],
      instructorEmail: 'akademisyen@fbu.edu.tr',
      description: '',
      studentCount: 24,
      items: [
        {
          softwareApplicationId: '56533ef6-2fc3-4328-bfee-244e13dd8034',
          otherSoftwareName: '',
          softwareName: 'Android Studio',
          requestedVersion: '19.0',
          licenseType: 'Ücretsiz',
          originalLicenseType: 'Ücretsiz',
          licenseOverrideReason: '',
          downloadUrl: 'https://fbu.edu.tr',
          language: 'Türkçe',
          otherLanguage: '',
          noPluginRequired: true,
          plugins: [],
        },
      ],
      schedules: [{ dayOfWeek: 'Monday', startTime: '09:00', endTime: '10:00' }],
      laboratoryIds: ['38951f9c-a4ad-4631-8db0-f4a7c85af084'],
      hasOtherLaboratory: false,
      otherLaboratoryName: '',
      assistants: [],
    });

    expect(payload.items.at(0)?.licenseType).toBe('Free');
  });
});
