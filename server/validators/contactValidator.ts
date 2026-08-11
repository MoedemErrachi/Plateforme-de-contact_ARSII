import { z } from 'zod';

export const genderEnum = z.enum(['FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY']);

export const careerStageEnum = z.enum([
  'R1_FIRST_STAGE',
  'R2_RECOGNIZED',
  'R3_ESTABLISHED',
  'R4_LEADING'
]);

const contactBodyFields = {
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email('Adresse e-mail invalide'),
  gender: genderEnum.optional(),
  countryOfOrigin: z.string().optional().default(''),
  city: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  affiliation: z.string().optional().default(''),
  function: z.string().optional(),
  experience: z.string().optional(),
  facultyDepartment: z.string().optional(),
  researchCareerStage: careerStageEnum.optional(),
  avatarUrl: z.string().optional().or(z.literal('')),
  tagIds: z.array(z.string()).optional()
} as const;

export const createContactSchema = z.object({
  body: z.object(contactBodyFields).refine(
    data => data.firstName || data.lastName || data.email,
    { message: 'Nom ou email requis' }
  )
});

export const updateContactSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID contact requis')
  }),
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email('Adresse e-mail invalide').optional(),
    gender: genderEnum.optional(),
    countryOfOrigin: z.string().optional(),
    city: z.string().optional(),
    phone: z.string().optional(),
    affiliation: z.string().optional(),
    function: z.string().optional(),
    experience: z.string().optional(),
    facultyDepartment: z.string().optional(),
    researchCareerStage: careerStageEnum.optional(),
    avatarUrl: z.string().optional().or(z.literal('')),
    tagIds: z.array(z.string()).optional()
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
    countryOfOrigin: z.string().optional(),
    gender: genderEnum.optional(),
    careerStage: careerStageEnum.optional(),
    affiliation: z.string().optional(),
    tagId: z.string().optional(),
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
        gender: genderEnum.optional(),
        countryOfOrigin: z.string().optional(),
        city: z.string().optional(),
        phone: z.string().optional(),
        affiliation: z.string().optional(),
        function: z.string().optional(),
        experience: z.string().optional(),
        facultyDepartment: z.string().optional(),
        researchCareerStage: careerStageEnum.optional(),
        tagIds: z.array(z.string()).optional()
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
