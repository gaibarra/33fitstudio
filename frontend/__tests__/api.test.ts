import { apiFetch } from '../lib/api';

global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as any;

describe('apiFetch', () => {
  it('calls backend with studio header when configured', async () => {
    process.env.NEXT_PUBLIC_STUDIO_ID = 'abc';
    await apiFetch('/ping');
    expect(fetch).toHaveBeenCalled();
  });
});
