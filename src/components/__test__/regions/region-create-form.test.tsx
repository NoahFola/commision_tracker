// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import { ToastProvider } from '../../ui-states/toast-provider';
import { RegionCreateForm } from '../../regions/region-create-form';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RegionCreateForm', () => {
  it('renders both fields and the create button', () => {
    render(
      <ToastProvider>
        <RegionCreateForm />
      </ToastProvider>,
    );
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Code (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create region' })).toBeInTheDocument();
  });

  it('rejects an empty name on submit', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <ToastProvider>
        <RegionCreateForm />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create region' }));
    await waitFor(() => {
      expect(screen.getByText(/fields? need(s)? fixing/)).toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts the region and clears the form on success', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, data: { id: 'r1' } })) as unknown as Response,
      );
    render(
      <ToastProvider>
        <RegionCreateForm />
      </ToastProvider>,
    );
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Douala' } });
    fireEvent.change(screen.getByLabelText('Code (optional)'), { target: { value: 'dla' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create region' }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/regions');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.name).toBe('Douala');
    expect(body.code).toBe('DLA');
    await waitFor(() => {
      expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('');
    });
  });

  it('shows the server error banner on 409', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'CONFLICT', message: 'A region with this name already exists' },
        }),
        { status: 409 },
      ) as unknown as Response,
    );
    render(
      <ToastProvider>
        <RegionCreateForm />
      </ToastProvider>,
    );
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Douala' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create region' }));
    await waitFor(() => {
      expect(screen.getByText(/A region with this name already exists/)).toBeInTheDocument();
    });
  });
});
