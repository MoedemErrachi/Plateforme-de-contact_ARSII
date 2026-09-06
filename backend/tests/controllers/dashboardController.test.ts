import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../test/helpers';

const mock = vi.hoisted(() => {
  class MockDashboardService {
    static last: any = null;
    constructor() {
      MockDashboardService.last = this;
    }
    getDashboardStats = vi.fn(async () => ({}));
  }
  return { MockDashboardService };
});

vi.mock('../../src/services/dashboardService', () => ({ DashboardService: mock.MockDashboardService }));

import { getDashboardStats } from '../../src/controllers/dashboardController';

describe('dashboardController', () => {
  it('renvoie les statistiques du tableau de bord (200)', async () => {
    mock.MockDashboardService.last.getDashboardStats.mockResolvedValueOnce({ totalContacts: 42 });
    const res = await request(buildTestApp((app) => app.get('/dash', getDashboardStats))).get('/dash');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual({ totalContacts: 42 });
  });

  it('délègue l’échec du service au handler d’erreurs', async () => {
    mock.MockDashboardService.last.getDashboardStats.mockRejectedValueOnce(new Error('db down'));
    const res = await request(buildTestApp((app) => app.get('/dash', getDashboardStats))).get('/dash');
    expect(res.status).toBe(500);
  });
});