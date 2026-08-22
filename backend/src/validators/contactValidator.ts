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

export const bulkDeleteContactsSchema = z.object({
  body: z.object({
    ids: z.array(z.string().min(1)).min(1, 'Au moins un identifiant requis').max(500)
  })
});

export const getContactByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID contact requis')
  })
});

export const queryContactSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().optional(),
    countryOfOrigin: z.union([z.string(), z.array(z.string())]).optional(),
    gender: z.union([genderEnum, z.array(genderEnum)]).optional(),
    careerStage: z.union([careerStageEnum, z.array(careerStageEnum)]).optional(),
    researchCareerStage: z.union([careerStageEnum, z.array(careerStageEnum)]).optional(),
    affiliation: z.string().optional(),
    facultyDepartment: z.string().optional(),
    tagId: z.union([z.string(), z.array(z.string())]).optional(),
    segmentId: z.string().optional()
  })
});

export const exportFieldEnum = z.enum([
  'email',
  'firstName',
  'lastName',
  'gender',
  'countryOfOrigin',
  'city',
  'phone',
  'affiliation',
  'function',
  'experience',
  'facultyDepartment',
  'researchCareerStage'
]);

export const exportQuerySchema = z.object({
  query: z.object({
    ids: z.union([z.string(), z.array(z.string())]).optional(),
    format: z.enum(['csv', 'json', 'xlsx']).optional(),
    fields: z.union([exportFieldEnum, z.array(exportFieldEnum)]).optional(),
    includeTags: z.enum(['true', 'false', '1', '0']).optional(),
    search: z.string().optional(),
    countryOfOrigin: z.union([z.string(), z.array(z.string())]).optional(),
    gender: z.union([genderEnum, z.array(genderEnum)]).optional(),
    careerStage: z.union([careerStageEnum, z.array(careerStageEnum)]).optional(),
    researchCareerStage: z.union([careerStageEnum, z.array(careerStageEnum)]).optional(),
    affiliation: z.string().optional(),
    facultyDepartment: z.string().optional(),
    tagId: z.union([z.string(), z.array(z.string())]).optional(),
    segmentId: z.string().optional()
  })
});

export const aggregationQuerySchema = z.object({
  query: z.object({
    group_by: z.enum(['gender', 'countryOfOrigin', 'facultyDepartment', 'researchCareerStage']),
    search: z.string().optional(),
    countryOfOrigin: z.union([z.string(), z.array(z.string())]).optional(),
    gender: z.union([genderEnum, z.array(genderEnum)]).optional(),
    careerStage: z.union([careerStageEnum, z.array(careerStageEnum)]).optional(),
    researchCareerStage: z.union([careerStageEnum, z.array(careerStageEnum)]).optional(),
    affiliation: z.string().optional(),
    facultyDepartment: z.string().optional(),
    tagId: z.union([z.string(), z.array(z.string())]).optional(),
    segmentId: z.string().optional()
  })
});

export const bulkSaveContactsSchema = z.object({
  body: z.object({
    newContacts: z.array(z.object({
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
    })).optional(),
    updatedContacts: z.array(z.object({
      id: z.string().min(1, 'ID contact requis'),
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
    })).optional()
  }).refine(
    data => (data.newContacts && data.newContacts.length > 0) || (data.updatedContacts && data.updatedContacts.length > 0),
    { message: 'Au moins un contact à créer ou mettre à jour est requis' }
  )
});

export const countContactsQuerySchema = z.object({
  query: z.object({
    email_pattern: z.string().optional()
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
