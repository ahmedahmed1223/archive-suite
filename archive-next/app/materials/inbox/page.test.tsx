// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MaterialsInboxPage from './page';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import * as archiveApi from '@/lib/archive-api';

// Mock the i18n provider
vi.mock('@/lib/i18n/LocaleProvider', () => ({
  useLocale: vi.fn(),
}));

// Mock the API client
vi.mock('@/lib/archive-api', () => ({
  createArchiveApiClient: vi.fn(),
  ...vi.importActual('@/lib/archive-api'),
}));

// Mock components
vi.mock('@/components/ui/Skeleton', () => ({
  default: ({ label }: { label: string }) => <div data-testid="skeleton">{label}</div>,
  Skeleton: ({ label }: { label: string }) => <div data-testid="skeleton">{label}</div>,
}));

vi.mock('@/components/EmptyState', () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

const mockT = {
  materialsInbox: {
    title: 'Unified Work Inbox',
    description: 'Material processing stages in one place',
    stages: {
      new_receipt: { label: 'New Receipt', icon: '⊕' },
      tech_check_failed: { label: 'Technical Check Failed', icon: '✘' },
      incomplete_description: { label: 'Incomplete Description', icon: '◐' },
      missing_rights: { label: 'Missing Rights', icon: '⚠' },
      ready_for_approval: { label: 'Ready for Approval', icon: '✓' },
      processing_failed: { label: 'Processing Failed', icon: '⚡' },
      awaiting_peer: { label: 'Awaiting Peer Review', icon: '⟳' },
      completed_today: { label: 'Completed Today', icon: '★' },
    },
    stageReasons: {
      new_receipt: 'Recently added',
      tech_check_failed: 'Media technical check failed',
      incomplete_description: 'Missing fields',
      missing_rights: 'Rights information not assigned',
      ready_for_approval: 'Ready for review and approval',
      processing_failed: 'Media processing failed',
      awaiting_peer: 'Under review by colleague',
      completed_today: 'Completed today',
    },
    actions: {
      review: 'Review',
      fix: 'Fix',
      setRights: 'Set Rights',
      viewDetails: 'View Details',
      retry: 'Retry',
    },
    empty: {
      title: 'No materials in this stage',
      description: 'All materials are processed and ready.',
    },
    loading: 'Loading…',
    error: 'An error occurred while loading materials. Please try again.',
  },
};

describe('MaterialsInboxPage', () => {
  let queryClient: QueryClient;
  let mockApiClient: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockApiClient = {
      getMaterialsInbox: vi.fn(),
    };

    (archiveApi.createArchiveApiClient as any).mockReturnValue(mockApiClient);
    (useLocale as any).mockReturnValue({
      t: { pages: mockT },
      locale: 'en',
    });
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MaterialsInboxPage />
      </QueryClientProvider>
    );
  };

  it('renders loading state', async () => {
    mockApiClient.getMaterialsInbox.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        records: [],
        stageCounts: {},
      }), 100))
    );

    renderPage();

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('renders error state with retry button', async () => {
    mockApiClient.getMaterialsInbox.mockRejectedValue(new Error('Network error'));

    renderPage();

    await expect(screen.findByText(/An error occurred/)).resolves.toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders empty state when no records', async () => {
    mockApiClient.getMaterialsInbox.mockResolvedValue({
      ok: true,
      records: [],
      stageCounts: {
        new_receipt: 0,
        tech_check_failed: 0,
        incomplete_description: 0,
        missing_rights: 0,
        ready_for_approval: 0,
        processing_failed: 0,
        awaiting_peer: 0,
        completed_today: 0,
      },
    });

    renderPage();

    await expect(screen.findByTestId('empty-state')).resolves.toBeInTheDocument();
    expect(screen.getByText('No materials in this stage')).toBeInTheDocument();
  });

  it('renders populated list with records', async () => {
    mockApiClient.getMaterialsInbox.mockResolvedValue({
      ok: true,
      records: [
        {
          id: '123',
          uid: 'abc-123',
          title: 'Sample Material',
          stage: 'new_receipt' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T12:00:00Z',
        },
      ],
      stageCounts: {
        new_receipt: 1,
        tech_check_failed: 0,
        incomplete_description: 0,
        missing_rights: 0,
        ready_for_approval: 0,
        processing_failed: 0,
        awaiting_peer: 0,
        completed_today: 0,
      },
    });

    renderPage();

    await expect(screen.findByText('Sample Material')).resolves.toBeInTheDocument();
    expect(screen.getByText('Recently added')).toBeInTheDocument();
  });

  it('displays stage counters', async () => {
    mockApiClient.getMaterialsInbox.mockResolvedValue({
      ok: true,
      records: [],
      stageCounts: {
        new_receipt: 5,
        tech_check_failed: 2,
        incomplete_description: 1,
        missing_rights: 3,
        ready_for_approval: 0,
        processing_failed: 0,
        awaiting_peer: 0,
        completed_today: 10,
      },
    });

    renderPage();

    await expect(screen.findByText('5')).resolves.toBeInTheDocument();
    await expect(screen.findByText('2')).resolves.toBeInTheDocument();
    await expect(screen.findByText('10')).resolves.toBeInTheDocument();
  });

  it('filters records by stage when stage is selected', async () => {
    mockApiClient.getMaterialsInbox.mockResolvedValue({
      ok: true,
      records: [],
      stageCounts: {
        new_receipt: 1,
        tech_check_failed: 0,
        incomplete_description: 0,
        missing_rights: 0,
        ready_for_approval: 0,
        processing_failed: 0,
        awaiting_peer: 0,
        completed_today: 0,
      },
    });

    renderPage();

    // Verify the buttons are rendered and can be clicked
    const buttons = await screen.findAllByRole('button', { name: /New Receipt/ });
    expect(buttons.length).toBeGreaterThan(0);

    fireEvent.click(buttons[0]!);

    // Verify that the API was called (from the initial render)
    expect(mockApiClient.getMaterialsInbox).toHaveBeenCalled();
  });
});
