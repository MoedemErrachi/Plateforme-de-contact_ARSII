import { vi } from 'vitest';

export function buildEmailMock(target: Record<string, any>) {
  target.sendPasswordResetEmail = target.sendPasswordResetEmail || vi.fn(async () => true);
  target.sendUserCreatedEmail = target.sendUserCreatedEmail || vi.fn(async () => true);
  return target;
}