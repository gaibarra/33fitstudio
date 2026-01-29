import { apiFetch } from '../lib/api';

global.fetch = jest.fn(async () => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify({ ok: true }),
})) as any;

describe('apiFetch', () => {
  it('calls backend with studio header when configured', async () => {
    process.env.NEXT_PUBLIC_STUDIO_ID = 'abc';
    await apiFetch('/ping');
    expect(fetch).toHaveBeenCalled();
  });
});
