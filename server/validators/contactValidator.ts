import { z } from 'zod';

export const createContactSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'Le prénom est requis'),
    lastName: z.string().min(1, 'Le nom de famille est requis'),
    email: z.string().email('Adresse e-mail invalide'),
    organization: z.string().min(1, "L'organisation est requise"),
    country: z.string().min(1, 'Le pays est requis'),
    phone: z.string().optional().default(''),
    linkedinUrl: z.string().url('URL LinkedIn invalide').optional().or(z.literal('')),
    expertiseDomain: z.string().optional().default(''),
    typeActeurId: z.string().min(1, "Le type d'acteur est requis")
  })
});

export const updateContactSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID contact requis')
  }),
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email('Adresse e-mail invalide').optional(),
    organization: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    linkedinUrl: z.string().url().optional().or(z.literal('')),
    expertiseDomain: z.string().optional(),
    typeActeurId: z.string().optional()
  })
});

export const getContactByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID contact requis')
  })
});

export const queryContactSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 10)),
    search: z.string().optional(),
    country: z.string().optional(),
    typeActeurId: z.string().optional(),
    segmentId: z.string().optional()
  })
});

export const importContactsSchema = z.object({
  body: z.object({
    rows: z.array(
      z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email('Email invalide'),
        organization: z.string().optional(),
        country: z.string().optional(),
        phone: z.string().optional(),
        expertiseDomain: z.string().optional(),
        typeActeurId: z.string().optional()
      })
    ).min(1, 'Au moins une ligne est requise pour l\'importation')
  })
});
