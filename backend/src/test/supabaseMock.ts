import { vi } from 'vitest';

export function buildSupabaseMock(target: Record<string, any>) {
  target.storage = target.storage || {
    from: vi.fn(() => ({
      upload: vi.fn(async () => ({ data: { path: 'uploaded-file' }, error: null })),
      remove: vi.fn(async () => ({ data: {}, error: null })),
      createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'http://localhost/file' }, error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://localhost/file' } })),
    })),
  };
  target.auth = target.auth || {
    admin: {
      updateUserById: vi.fn(async () => ({ data: {}, error: null })),
    },
  };
  return target;
}