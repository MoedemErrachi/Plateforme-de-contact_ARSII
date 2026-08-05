import { z } from 'zod';

export const createContactSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email('Adresse e-mail invalide'),
    organization: z.string().optional().default(''),
    country: z.string().optional().default(''),
    phone: z.string().optional().default(''),
    title: z.string().optional().default(''),
    linkedinUrl: z.string().optional().or(z.literal('')),
    linkedin: z.string().optional().or(z.literal('')),
    expertiseDomain: z.string().optional().default(''),
    expertise: z.array(z.string()).optional(),
    interventionZones: z.array(z.string()).optional(),
    actorType: z.string().optional(),
    typeActeurId: z.string().optional()
  }).refine(data => data.name || data.firstName || data.lastName || data.email, {
    message: 'Nom ou email requis'
  })
});

export const updateContactSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID contact requis')
  }),
  body: z.object({
    name: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email('Adresse e-mail invalide').optional(),
    organization: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    title: z.string().optional(),
    linkedinUrl: z.string().optional().or(z.literal('')),
    linkedin: z.string().optional().or(z.literal('')),
    expertiseDomain: z.string().optional(),
    expertise: z.array(z.string()).optional(),
    interventionZones: z.array(z.string()).optional(),
    actorType: z.string().optional(),
    typeActeurId: z.string().optional()
  })
});

export const deleteContactSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID contact requis')
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
    limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 50)),
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
        name: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email('Email invalide'),
        organization: z.string().optional(),
        country: z.string().optional(),
        phone: z.string().optional(),
        expertiseDomain: z.string().optional(),
        typeActeurId: z.string().optional()
      })
    ).min(1, "Au moins une ligne est requise pour l'importation")
  })
});

export const createNoteSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID contact requis')
  }),
  body: z.object({
    title: z.string().min(1, 'Titre requis'),
    content: z.string().min(1, 'Contenu requis'),
    type: z.enum(['MEETING', 'EMAIL', 'CALL', 'NOTE']).optional().default('NOTE'),
    date: z.string().optional(),
    relativeTime: z.string().optional(),
    author: z.string().optional(),
    authorInitials: z.string().optional(),
    projectName: z.string().optional()
  })
});
