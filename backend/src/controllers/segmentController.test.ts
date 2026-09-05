import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../test/helpers';

const mock = vi.hoisted(() => {
  class MockSegmentService {
    static last: any = null;
    constructor() {
      MockSegmentService.last = this;
    }
    getSegments = vi.fn(async () => []);
    createSegment = vi.fn(async () => ({}));
    updateSegment = vi.fn(async () => ({}));
    deleteSegment = vi.fn(async () => ({}));
    setTagContacts = vi.fn(async () => ({}));
  }
  return { MockSegmentService };
});

vi.mock('../services/segmentService', () => ({ SegmentService: mock.MockSegmentService }));

import {
  getSegments,
  createSegment,
  updateSegment,
  deleteSegment,
  setTagContacts
} from './segmentController';

function mount(handler: any, method: 'get' | 'post' | 'put' | 'delete', path: string) {
  return buildTestApp((app) => app[method](path, handler));
}

const HAPPY = [
  ['getSegments', getSegments, 'get', '/seg'],
  ['createSegment', createSegment, 'post', '/seg'],
  ['updateSegment', updateSegment, 'put', '/seg'],
  ['deleteSegment', deleteSegment, 'delete', '/seg']
] as const;

describe('segmentController', () => {
  it.each(HAPPY)('%s réussit (status attendu)', async (_name, handler, method, path) => {
    const res = await request(mount(handler, method, path))[method](path);
    expect([200, 201]).toContain(res.status);
  });

  it.each(HAPPY)('%s délègue la panne du service à next', async (name, handler, method, path) => {
    mock.MockSegmentService.last[name].mockRejectedValueOnce(new Error('db down'));
    const res = await request(mount(handler, method, path))[method](path);
    expect(res.status).toBe(500);
  });

  it('setTagContacts réussit avec un tableau valide', async () => {
    const res = await request(mount(setTagContacts, 'post', '/tags')).post('/tags').send({ contactIds: ['c1', 'c2'] });
    expect(res.status).toBe(200);
  });

  it('setTagContacts délègue la panne du service à next', async () => {
    mock.MockSegmentService.last.setTagContacts.mockRejectedValueOnce(new Error('db down'));
    const res = await request(mount(setTagContacts, 'post', '/tags')).post('/tags').send({ contactIds: ['c1'] });
    expect(res.status).toBe(500);
  });

  it('renvoie 400 si contactIds n’est pas un tableau', async () => {
    const res = await request(mount(setTagContacts, 'post', '/tags')).post('/tags').send({ contactIds: 'c1' });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
  });
});