import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Switch } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import {
  isLaboratoryCapacityInsufficient,
  RequestWizardPage,
  requestWizardSchema,
} from '../pages/RequestWizardPage';
import { ROLES } from '../types';
import { jsonResponse } from './test-utils';

describe('Talep wizard', () => {
  it('geçersiz saat aralığını reddeder', () => {
    const result = requestWizardSchema.safeParse({
      academicTermId: 'term-1',
      courseCode: 'YZM301',
      courseName: 'Yazılım',
      instructorEmail: 'akademisyen@fbu.edu.tr',
      description: '',
      studentCount: 20,
      items: [],
      schedules: [{ dayOfWeek: 'Monday', startTime: '12:00', endTime: '10:00' }],
      laboratoryIds: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('endTime'))).toBe(true);
    }
  });

  it('kapasiteyi hem fiziksel kapasite hem bilgisayar sayısının düşüğüyle sınırlar', () => {
    expect(isLaboratoryCapacityInsufficient({ capacity: 50, computerCount: 20 }, 21)).toBe(true);
    expect(isLaboratoryCapacityInsufficient({ capacity: 20, computerCount: 50 }, 21)).toBe(true);
    expect(isLaboratoryCapacityInsufficient({ capacity: 50, computerCount: 50 }, 21)).toBe(false);
  });

  it('ders bilgileri tamamlandığında program adımına ilerler', async () => {
    const user = userEvent.setup();
    localStorage.setItem('fbu-access-token', 'test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url =
          input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
        if (url.endsWith('/auth/me')) {
          return Promise.resolve(
            jsonResponse({
              id: 'academic-1',
              fullName: 'Test Akademisyen',
              email: 'akademisyen@fbu.edu.tr',
              roles: [ROLES.academic],
              facultyId: 'faculty-1',
              facultyName: 'Mühendislik ve Mimarlık Fakültesi',
            }),
          );
        }
        if (url.includes('/academic-terms')) {
          return Promise.resolve(
            jsonResponse([
              {
                id: 'term-1',
                academicYear: '2026-2027',
                termName: 'Güz',
                isCurrent: true,
              },
            ]),
          );
        }
        if (url.includes('/laboratories')) return Promise.resolve(jsonResponse([]));
        if (url.includes('/system-settings/request-collection-status'))
          return Promise.resolve(
            jsonResponse({ isOpen: true, enabled: true, startDate: null, endDate: null }),
          );
        return Promise.resolve(jsonResponse({}));
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <ThemeProvider>
        <QueryClientProvider client={client}>
          <ToastProvider>
            <MemoryRouter initialEntries={['/talep/yeni']}>
              <AuthProvider>
                <Switch>
                  <Route path="/talep/yeni">
                    <ProtectedRoute>
                      <RequestWizardPage />
                    </ProtectedRoute>
                  </Route>
                  <Route path="/giris">
                    <div>Giriş</div>
                  </Route>
                </Switch>
              </AuthProvider>
            </MemoryRouter>
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Ders Bilgileri' })).toBeInTheDocument();
    await screen.findByRole('option', { name: /2026-2027 Güz/i });
    await user.selectOptions(screen.getByLabelText('Akademik dönem *'), 'term-1');
    await user.type(screen.getByLabelText('Ders kodu *'), 'yzm301');
    await user.type(screen.getByLabelText('Ders adı *'), 'Yazılım Mühendisliği');
    await user.selectOptions(screen.getByLabelText("Bu dersin kaç section'ı var? *"), '1');
    await user.clear(screen.getByLabelText('Beklenen öğrenci sayısı *'));
    await user.type(screen.getByLabelText('Beklenen öğrenci sayısı *'), '24');
    await user.click(screen.getByRole('button', { name: /Kaydet ve devam et/i }));
    expect(await screen.findByRole('heading', { name: 'Program Bilgileri' })).toBeInTheDocument();
  });
});
