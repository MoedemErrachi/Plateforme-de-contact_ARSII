import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../test/helpers';

const mock = vi.hoisted(() => {
  class MockContactService {
    static last: any = null;
    constructor() {
      MockContactService.last = this;
    }
    getAggregation = vi.fn(async () => ({}));
  }
  return { MockContactService };
});

vi.mock('../../src/services/contactService', () => ({ ContactService: mock.MockContactService }));

import { getStatsAggregation } from '../../src/controllers/statsController';

describe('statsController', () => {
  beforeEach(() => {
    mock.MockContactService.last.getAggregation.mockReset();
  });

  it('retourne l’agrégation avec les filtres de requête', async () => {
    mock.MockContactService.last.getAggregation.mockResolvedValueOnce({ PhD: 5, Master: 2 });
    const res = await request(
      buildTestApp((app) => app.get('/stats', getStatsAggregation))
    ).get('/stats?group_by=careerStage&researchCareerStage=PhD&countryOfOrigin=SN&gender=W');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ PhD: 5, Master: 2 });
    const [groupBy, filters] = mock.MockContactService.last.getAggregation.mock.calls[0];
    expect(groupBy).toBe('careerStage');
    expect(filters.careerStage).toEqual(['PhD']);
    expect(filters.countryOfOrigin).toEqual(['SN']);
  });

  it('délègue l’échec du service au handler d’erreurs', async () => {
    mock.MockContactService.last.getAggregation.mockRejectedValueOnce(new Error('db down'));
    const res = await request(
      buildTestApp((app) => app.get('/stats', getStatsAggregation))
    ).get('/stats');
    expect(res.status).toBe(500);
  });
});