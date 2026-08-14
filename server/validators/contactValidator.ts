import { z } from 'zod';

export const genderEnum = z.enum(['FEMALE', 'MALE', 'NOT_SPECIFIED']);

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
  countryOfOrigin: z.string().optional(),
  city: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  affiliation: z.string().optional(),
  function: z.string().nullable().optional(),
  experience: z.string().nullable().optional(),
  facultyDepartment: z.string().nullable().optional(),
  researchCareerStage: careerStageEnum.optional(),
  avatarUrl: z.string().nullable().optional(),
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
    city: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    affiliation: z.string().optional(),
    function: z.string().nullable().optional(),
    experience: z.string().nullable().optional(),
    facultyDepartment: z.string().nullable().optional(),
    researchCareerStage: careerStageEnum.optional(),
    avatarUrl: z.string().nullable().optional(),
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
        email: z.string().email('Email invalide').optional(),
        gender: genderEnum.optional(),
        countryOfOrigin: z.string().optional(),
        city: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        affiliation: z.string().optional(),
        function: z.string().nullable().optional(),
        experience: z.string().nullable().optional(),
        facultyDepartment: z.string().nullable().optional(),
        researchCareerStage: careerStageEnum.optional(),
        tagIds: z.array(z.string()).optional()
      })
    ).min(1, "Au moins une ligne est requise pour l'importation")
  })
});
