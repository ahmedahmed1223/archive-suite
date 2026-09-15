// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MaterialsInboxPage from './page';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';

const getMaterialsInbox = vi.hoisted(() => vi.fn());

// Only the shells and the client are faked. The locale provider is real, so
// these assertions read the shipped dictionary instead of a fixture that can
// drift away from it.
vi.mock('@/components/AppShell', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/components/PageToolbar', () => ({
  default: ({ children, title, actions }: { children: ReactNode; title: string; actions: ReactNode }) => (
    <section aria-label={title}>{actions}{children}</section>
  ),
}));
vi.mock('@/lib/archive-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/archive-api')>()),
  createArchiveApiClient: () => ({ getMaterialsInbox }),
}));

const EMPTY_COUNTS = {
  new_receipt: 0,
  tech_check_failed: 0,
  incomplete_description: 0,
  missing_rights: 0,
  ready_for_approval: 0,
  processing_failed: 0,
  awaiting_peer: 0,
  completed_today: 0,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale="en" hasLocaleCookie>
        <MaterialsInboxPage />
      </LocaleProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  getMaterialsInbox.mockReset();
});
afterEach(cleanup);

describe('MaterialsInboxPage', () => {
  it('keeps the page inside the app shell instead of drawing its own bare page', async () => {
    getMaterialsInbox.mockResolvedValue({ ok: true, records: [], stageCounts: EMPTY_COUNTS });

    renderPage();

    // The toolbar carries the page title and the links onward, so the stage
    // view is part of the daily journey rather than a dead end.
    expect(await screen.findByRole('region', { name: 'Material stages' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My work inbox' })).toHaveAttribute('href', '/work-inbox');
    expect(screen.getByRole('link', { name: 'Upload material' })).toHaveAttribute('href', '/uploads');
  });

  it('shows the loading state while the stages are being fetched', async () => {
    // Held open deliberately, then released: a promise that never settles
    // leaves the query in flight and hangs the cleanup hook.
    let release: (value: unknown) => void = () => {};
    getMaterialsInbox.mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    renderPage();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    release({ ok: true, records: [], stageCounts: EMPTY_COUNTS });
    await screen.findByText('No materials in this stage');
  });

  it('reports a failure with a retry rather than an empty list', async () => {
    getMaterialsInbox.mockRejectedValue(new Error('Network error'));

    renderPage();

    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(/An error occurred/);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows the empty state when the selected stage holds nothing', async () => {
    getMaterialsInbox.mockResolvedValue({ ok: true, records: [], stageCounts: EMPTY_COUNTS });

    renderPage();

    expect(await screen.findByText('No materials in this stage')).toBeInTheDocument();
  });

  it('lists a material with the reason it sits in its stage', async () => {
    getMaterialsInbox.mockResolvedValue({
      ok: true,
      records: [{ id: '123', uid: 'abc-123', title: 'Sample Material', stage: 'new_receipt', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T12:00:00Z' }],
      stageCounts: { ...EMPTY_COUNTS, new_receipt: 1 },
    });

    renderPage();

    expect(await screen.findByRole('link', { name: 'Sample Material' })).toHaveAttribute('href', '/archive/123');
    expect(screen.getByText('Recently added')).toBeInTheDocument();
  });

  it('counts each stage and refetches when one is selected', async () => {
    getMaterialsInbox.mockResolvedValue({
      ok: true,
      records: [],
      stageCounts: { ...EMPTY_COUNTS, new_receipt: 5, completed_today: 10 },
    });

    renderPage();

    const stageButton = await screen.findByRole('button', { name: /New Receipt/ });
    await vi.waitFor(() => expect(stageButton).toHaveTextContent('5'));
    expect(screen.getByRole('button', { name: /Completed Today/ })).toHaveTextContent('10');

    fireEvent.click(stageButton);

    expect(stageButton).toHaveAttribute('aria-pressed', 'true');
    await vi.waitFor(() =>
      expect(getMaterialsInbox).toHaveBeenLastCalledWith({ query: { store: 'archive-items', stage: 'new_receipt' } })
    );
  });
});
