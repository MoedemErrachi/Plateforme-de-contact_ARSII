import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  class MockTransporter {
    verify = vi.fn(async () => true);
    sendMail = vi.fn(async (_mail: any) => ({ accepted: ['x@example.com'] }));
  }
  const transporter = new MockTransporter();
  return { transporter, createTransport: vi.fn(() => transporter) };
});

vi.mock('nodemailer', () => ({
  createTransport: mocks.createTransport,
  default: { createTransport: mocks.createTransport }
}));

import { sendPasswordResetEmail, sendUserCreatedEmail } from './emailService';

describe('emailService', () => {
  beforeEach(() => {
    mocks.transporter.verify.mockResolvedValue(true);
    mocks.transporter.sendMail.mockReset();
    mocks.transporter.sendMail.mockResolvedValue({ accepted: [] });
  });

  it('envoie un email de réinitialisation de mot de passe', async () => {
    const ok = await sendPasswordResetEmail('researcher@mail.africa', 'https://app/reset/abc');
    expect(ok).toBe(true);
    expect(mocks.transporter.sendMail).toHaveBeenCalledTimes(1);
    const call: any = mocks.transporter.sendMail.mock.calls[0][0];
    expect(call.to).toBe('researcher@mail.africa');
    expect(call.html).toContain('https://app/reset/abc');
  });

  it('renvoie false si l’envoi du reset échoue', async () => {
    mocks.transporter.sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    const ok = await sendPasswordResetEmail('a@b.c', 'https://x');
    expect(ok).toBe(false);
  });

  it('envoie un email de création de compte', async () => {
    const ok = await sendUserCreatedEmail('new@mail.africa', 'Awa Diop', 'Tempabc123!');
    expect(ok).toBe(true);
    const calls: any[] = mocks.transporter.sendMail.mock.calls;
    const call = calls.at(-1)![0];
    expect(call.to).toBe('new@mail.africa');
    expect(call.html).toContain('Tempabc123!');
  });

  it('renvoie false si l’envoi du compte échoue', async () => {
    mocks.transporter.sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    const ok = await sendUserCreatedEmail('new@mail.africa', 'Awa Diop', 'Tempabc123!');
    expect(ok).toBe(false);
  });

  it('journalise un échec de vérification SMTP au démarrage (non bloquant)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.transporter.verify.mockRejectedValueOnce(new Error('SMTP handshake failed'));
    vi.resetModules();
    await import('./emailService');
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.resetModules();
    expect(spy).toHaveBeenCalledWith(
      '[EmailService] Gmail SMTP transporter verification failed:',
      'SMTP handshake failed'
    );
    spy.mockRestore();
  });
});