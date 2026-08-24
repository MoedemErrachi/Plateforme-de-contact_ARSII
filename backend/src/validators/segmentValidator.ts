import { z } from 'zod';

const idParam = z.object({
  id: z.string().min(1, 'ID requis')
});

// Segment.filters : objet JSON libre (FilterState côté client).
const filtersSchema = z.record(z.string(), z.unknown());

export const createSegmentSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Nom du segment requis').max(100),
    description: z.string().max(500).optional().nullable(),
    icon: z.string().max(50).optional(),
    filters: filtersSchema,
    userId: z.string().min(1).optional()
  })
});

export const updateSegmentSchema = z.object({
  params: idParam,
  body: z
    .object({
      name: z.string().trim().min(1, 'Nom du segment requis').max(100).optional(),
      description: z.string().max(500).optional().nullable(),
      icon: z.string().max(50).optional(),
      filters: filtersSchema.optional()
    })
    .refine(body => Object.keys(body).length > 0, {
      message: 'Aucune donnée à mettre à jour'
    })
});

export const deleteSegmentSchema = z.object({
  params: idParam
});

export const createTagSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Le nom du tag est requis').max(50),
    color: z.string().max(100).optional().nullable(),
    description: z.string().max(500).optional().nullable()
  })
});

export const updateTagSchema = z.object({
  params: idParam,
  body: z
    .object({
      name: z.string().trim().min(1, 'Le nom du tag est requis').max(50).optional(),
      color: z.string().max(100).optional().nullable(),
      description: z.string().max(500).optional().nullable()
    })
    .refine(body => Object.keys(body).length > 0, {
      message: 'Aucune donnée à mettre à jour'
    })
});

export const deleteTagSchema = z.object({
  params: idParam
});

export const setTagContactsSchema = z.object({
  params: idParam,
  body: z.object({
    contactIds: z
      .array(z.string().min(1, 'Identifiant contact requis'))
      .max(10000, 'Trop de contacts associés')
  })
});
