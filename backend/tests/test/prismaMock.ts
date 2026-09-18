import { vi } from 'vitest';

export function buildPrismaMock(target: Record<string, any>, force = false) {
  target.$queryRaw = force || !target.$queryRaw ? vi.fn(async () => []) : target.$queryRaw;
  target.$queryRawUnsafe = force || !target.$queryRawUnsafe ? vi.fn(async () => []) : target.$queryRawUnsafe;
  target.$transaction = force || !target.$transaction ? vi.fn(async (arg: any) => {
    if (typeof arg === 'function') {
      return arg(target);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg.map((op) => (typeof op === 'function' ? op(target) : Promise.resolve(op))));
    }
    return arg;
  }) : target.$transaction;

  const model = () => ({
    findMany: vi.fn(async () => []),
    findUnique: vi.fn(async () => null),
    findUniqueOrThrow: vi.fn(async () => {
      throw new Error('Not found');
    }),
    findFirst: vi.fn(async () => null),
    create: vi.fn(async (args: any) => args?.data ?? {}),
    createMany: vi.fn(async () => ({ count: 0 })),
    update: vi.fn(async (args: any) => args?.data ?? {}),
    updateMany: vi.fn(async () => ({ count: 0 })),
    upsert: vi.fn(async (args: any) => args?.create ?? {}),
    delete: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    count: vi.fn(async () => 0),
    groupBy: vi.fn(async () => []),
    aggregate: vi.fn(async () => ({})),
  });

  const names = [
    'contact',
    'user',
    'tag',
    'tagOnContact',
    'segment',
    'savedSearch',
    'importExportLog',
    'passwordResetToken',
  ];
  for (const name of names) {
    target[name] = force || !target[name] ? model() : target[name];
  }

  return target;
}