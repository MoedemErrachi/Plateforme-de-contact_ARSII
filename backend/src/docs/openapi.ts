/**
 * Spécification OpenAPI de base de l'API ARSII.
 *
 * Les `paths` sont extraits automatiquement depuis les annotations
 * `@openapi` présentes dans `src/routes/*.ts` (voir `src/docs/setupSwagger.ts`).
 * Ce fichier ne contient que : infos, serveurs, tags, securitySchemes et
 * schémas partagés référencés via `$ref` dans les annotations.
 */
export const openapiDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ARSII CRM — API',
    description:
      "Documentation de l'API backend ARSII (gestion de contacts de chercheurs).\n\n" +
      "**Accessible uniquement en local** (NODE_ENV != production) — cette route n'est pas montée sur Render.\n\n" +
      "Pour tester les endpoints protégés :\n" +
      "1. Appelez `POST /api/auth/login` avec vos identifiants.\n" +
      "2. Copiez le jeton renvoyé dans `token` (ou `user`).\n" +
      "3. Cliquez sur **Authorize** et collez-le (le préfixe `Bearer ` est optionnel).",
    contact: {
      name: 'Équipe ARSII'
    },
    version: '1.0.0'
  },
  servers: [{ url: 'http://localhost:5000/api', description: 'Serveur de développement local' }],
  tags: [
    { name: 'Auth', description: 'Authentification, session et profil' },
    { name: 'Contacts', description: 'CRUD et filtrage des contacts' },
    { name: 'Segments & Tags', description: 'Segments de contacts et étiquettes' },
    { name: 'Recherches', description: 'Recherches sauvegardées par utilisateur' },
    { name: 'Export & Logs', description: "Export des contacts et journalisation des imports/exports" },
    { name: 'Stats & Dashboard', description: 'Indicateurs et agrégations' },
    { name: 'Admin', description: 'Gestion des comptes utilisateurs (admin uniquement)' },
    { name: 'Uploads', description: 'Téléversement d’images (avatars)' },
    { name: 'Système', description: 'Sonde de santé' }
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          "Jeton JWT renvoyé par `POST /api/auth/login` (champ `token`). " +
          "Peut être collé directement (le préfixe `Bearer ` est optionnel)."
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error', description: "Statut (: `fail` ou `error`)" },
          message: { type: 'string', example: "Erreur lors de la création du contact." },
          code: {
            type: 'string',
            description: 'Code applicatif optionnel (UNAUTHORIZED, INVALID_TOKEN, CSRF_VALIDATION_FAILED, …)',
            example: 'UNAUTHORIZED'
          }
        }
      },
      Gender: {
        type: 'string',
        enum: ['FEMALE', 'MALE', 'NOT_SPECIFIED']
      },
      CareerStage: {
        type: 'string',
        enum: ['R1_FIRST_STAGE', 'R2_RECOGNIZED', 'R3_ESTABLISHED', 'R4_LEADING']
      },
      ContactId: { type: 'string', format: 'uuid', description: 'Identifiant unique du contact' },
      Tag: {
        type: 'object',
        description: 'Étiquette attribuée à un ou plusieurs contacts.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Chercheur invité' },
          color: { type: 'string', example: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
          description: { type: 'string', nullable: true }
        }
      },
      Segment: {
        type: 'object',
        description: 'Segment (groupe de contacts partageant une étiquette commune).',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          tagId: { type: 'string', format: 'uuid', description: 'Étiquette associée au segment' },
          contactCount: { type: 'integer', description: "Nombre de contacts du segment (si `_count` inclus)" }
        }
      },
      SavedSearch: {
        type: 'object',
        description: 'Recherche filtrée sauvegardée par un utilisateur.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          filters: {
            type: 'object',
            additionalProperties: true,
            description: 'Filtres de recherche (mêmes critères que `GET /api/contacts`)'
          },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      User: {
        type: 'object',
        description: 'Compte utilisateur.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'user'] },
          privilege: { type: 'string', enum: ['READ', 'READ_WRITE', 'FULL_ACCESS'] },
          avatarUrl: { type: 'string', nullable: true },
          mustChangePassword: { type: 'boolean' },
          isFirstLogin: { type: 'boolean', description: 'Alias de `mustChangePassword` (réponse de login)' },
          lastLogin: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      ContactAvatar: {
        type: 'string',
        nullable: true,
        description: 'URL publique de l\'avatar (Supabase Storage) ou null'
      },
      Contact: {
        type: 'object',
        description: 'Contact (chercheur issu de la base EURAXESS).',
        properties: {
          id: { $ref: '#/components/schemas/ContactId' },
          firstName: { type: 'string', nullable: true, example: 'Awa' },
          lastName: { type: 'string', nullable: true, example: 'Diop' },
          email: { type: 'string', format: 'email' },
          gender: { $ref: '#/components/schemas/Gender' },
          countryOfOrigin: { type: 'string', nullable: true, example: 'Sénégal' },
          city: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          affiliation: { type: 'string', nullable: true, description: 'Institution de rattachement' },
          function: { type: 'string', nullable: true },
          experience: { type: 'string', nullable: true },
          facultyDepartment: { type: 'string', nullable: true },
          researchCareerStage: { $ref: '#/components/schemas/CareerStage' },
          avatarUrl: { $ref: '#/components/schemas/ContactAvatar' },
          tags: {
            type: 'array',
            description: 'Étiquettes associées au contact.',
            items: {
              type: 'object',
              properties: { tag: { $ref: '#/components/schemas/Tag' } }
            }
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'email']
      },
      ContactWrite: {
        type: 'object',
        description: 'Corps de création/mise à jour d\'un contact (tous les champs sont optionnels, `email` requis à la création).',
        properties: {
          firstName: { type: 'string', maxLength: 100 },
          lastName: { type: 'string', maxLength: 100 },
          email: { type: 'string', format: 'email' },
          gender: { $ref: '#/components/schemas/Gender' },
          countryOfOrigin: { type: 'string' },
          city: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          affiliation: { type: 'string' },
          function: { type: 'string', nullable: true },
          experience: { type: 'string', nullable: true },
          facultyDepartment: { type: 'string', nullable: true },
          researchCareerStage: { $ref: '#/components/schemas/CareerStage' },
          avatarUrl: { type: 'string', nullable: true },
          tagIds: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'Étiquettes à affecter au contact' }
        }
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 342 },
          totalPages: { type: 'integer', example: 18 },
          hasNextPage: { type: 'boolean', example: true },
          hasPrevPage: { type: 'boolean', example: false }
        }
      },
      ContactListResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['success'] },
          data: {
            type: 'object',
            properties: {
              contacts: { type: 'array', items: { $ref: '#/components/schemas/Contact' } }
            }
          },
          pagination: { $ref: '#/components/schemas/Pagination' }
        }
      },
      ContactSingleResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['success'] },
          data: {
            type: 'object',
            properties: { contact: { $ref: '#/components/schemas/Contact' } }
          }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@arsii.sn' },
          password: { type: 'string', format: 'password', example: 'MotDePasse2026!' },
          rememberMe: { type: 'boolean', description: 'Étend la session à 7 jours au lieu de 8 h' }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          user: { $ref: '#/components/schemas/User' },
          token: {
            type: 'string',
            description: 'Jeton JWT à utiliser dans la fenêtre « Authorize » (stocké aussi en cookie HttpOnly)'
          }
        }
      },
      DashboardStats: {
        type: 'object',
        description: 'Indicateurs agrégés pour le tableau de bord.',
        properties: {
          kpis: {
            type: 'object',
            properties: {
              totalContacts: { type: 'integer' },
              countriesCovered: { type: 'integer' },
              affiliationsCount: { type: 'integer' },
              seniorResearchers: {
                type: 'object',
                properties: {
                  count: { type: 'integer' },
                  percentage: { type: 'integer' }
                }
              }
            }
          },
          countryLabels: {
            type: 'array',
            description: 'Glossaire complet ISO 3166-1 alpha-2 → libellé français (labels de la carte, y compris pays sans contact).',
            items: {
              type: 'object',
              properties: {
                iso2: { type: 'string' },
                country: { type: 'string' }
              }
            }
          },
          distributionByCountry: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                country: { type: 'string' },
                iso2: { type: 'string', nullable: true },
                count: { type: 'integer' },
                percentage: { type: 'integer' }
              }
            }
          },
          distributionByGender: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                gender: { type: 'string' },
                count: { type: 'integer' },
                percentage: { type: 'integer' }
              }
            }
          },
          distributionByCountryGender: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                country: { type: 'string' },
                iso2: { type: 'string', nullable: true },
                gender: { type: 'string' },
                count: { type: 'integer' }
              }
            }
          },
          distributionByCareerStage: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                careerStage: { type: 'string' },
                count: { type: 'integer' },
                percentage: { type: 'integer' }
              }
            }
          },
          distributionByTag: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tagId: { type: 'string' },
                name: { type: 'string' },
                color: { type: 'string' },
                count: { type: 'integer' }
              }
            }
          }
        }
      },
      AggregationResponse: {
        type: 'object',
        description: 'Résultat d’une agrégation (fréquence par groupe).',
        additionalProperties: {
          type: 'integer',
          description: 'Nombre de contacts pour la valeur du groupe.'
        }
      }
    }
  }
};