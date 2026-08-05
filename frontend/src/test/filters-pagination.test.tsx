import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Pagination } from '../components/ui';
import { RequestFilterBar, type RequestFilters } from '../pages/RequestsPage';
import { jsonResponse, renderWithProviders } from './test-utils';

const empty: RequestFilters = {
  search: '',
  status: '',
  academicTermId: '',
  facultyId: '',
  laboratoryId: '',
  dayOfWeek: '',
  from: '',
  to: '',
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse([]))),
  );
});

describe('Filtreleme ve sayfalama', () => {
  it('arama filtresini uygular', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderWithProviders(<RequestFilterBar value={empty} onApply={onApply} />);
    await user.type(screen.getByPlaceholderText(/Ders kodu/i), 'YZM301');
    await user.click(screen.getByRole('button', { name: 'Ara' }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ search: 'YZM301' }));
  });

  it('aktif filtreyi tek tek kaldırır', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    renderWithProviders(
      <RequestFilterBar value={{ ...empty, status: 'Draft' }} onApply={onApply} />,
    );
    await user.click(screen.getByRole('button', { name: 'Durum filtresini kaldır' }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ status: '' }));
  });

  it('önceki ve sonraki sayfa sınırlarını uygular', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Pagination page={2} totalPages={4} totalCount={37} onPageChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Önceki sayfa' }));
    await user.click(screen.getByRole('button', { name: 'Sonraki sayfa' }));
    expect(onChange).toHaveBeenNthCalledWith(1, 1);
    expect(onChange).toHaveBeenNthCalledWith(2, 3);
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
  });
});
