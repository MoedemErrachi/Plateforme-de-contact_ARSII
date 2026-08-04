import { PrismaClient, Role, LogType, LogFormat, NoteType, ProjectStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('Seeding comprehensive database...');

  // 1. Seed Users
  const adminPassword = await bcrypt.hash('arsii2026', 10);
  const demoPassword = await bcrypt.hash('demo1234', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@arsii.org' },
    update: {},
    create: {
      email: 'admin@arsii.org',
      name: 'Dr. Chokri Ben Amar',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      twoFactorEnabled: false
    }
  });

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@arsii.org' },
    update: {},
    create: {
      email: 'demo@arsii.org',
      name: 'Membre ARSII',
      passwordHash: demoPassword,
      role: Role.USER,
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXP'
    }
  });

  // 2. Seed Actor Types
  const actorTypesData = [
    { name: 'Labo de recherche', code: 'LABO', description: 'Laboratoire et centre de recherche académique ou privé' },
    { name: 'PME', code: 'PME', description: 'Petite et Moyenne Entreprise du secteur d’innovation' },
    { name: 'ONG', code: 'ONG', description: 'Organisation Non Gouvernementale' },
    { name: 'Université', code: 'UNIV', description: 'Établissement d’enseignement supérieur' },
    { name: 'Institutionnel', code: 'INST', description: 'Organisme public ou gouvernemental' }
  ];

  const createdActorTypes = [];
  for (const at of actorTypesData) {
    const created = await prisma.typeActeur.upsert({
      where: { name: at.name },
      update: {},
      create: at
    });
    createdActorTypes.push(created);
  }

  // 3. Seed Tags / Segments
  const tagsData = [
    { name: 'Partenaire Stratégique', color: '#10B981', category: 'Priorité', description: 'Partenaire clé pour les appels à projets' },
    { name: 'Projet Horizon Europe', color: '#3B82F6', category: 'Financement', description: 'Inscrit dans les programmes européens' },
    { name: 'Membre Réseau ARSII', color: '#35B8B2', category: 'Statut', description: 'Membre actif du réseau ARSII' },
    { name: 'Expert IA', color: '#8B5CF6', category: 'Compétence', description: 'Expertise avancée en Intelligence Artificielle' },
    { name: 'Secteur Santé', color: '#EC4899', category: 'Domaine', description: 'Spécialisation dans les technologies de santé' }
  ];

  const createdTags = [];
  for (const tag of tagsData) {
    const created = await prisma.tag.upsert({
      where: { name: tag.name },
      update: {},
      create: tag
    });
    createdTags.push(created);
  }

  // 4. Seed Projects
  const projectsData = [
    {
      title: 'Euro-African Tech Exchange (EATE)',
      code: 'EATE-2026',
      description: 'Plateforme de coopération technologique entre l’Europe et l’Afrique.',
      period: '2025 - 2028',
      sector: 'R&I / Numérique',
      status: ProjectStatus.EN_COURS
    },
    {
      title: 'Green Horizons Horizon Europe',
      code: 'GH-HE-04',
      description: 'Programme de transition verte et hydrogène décarboné.',
      period: '2026 - 2029',
      sector: 'Environnement / Énergie',
      status: ProjectStatus.PLANIFIE
    },
    {
      title: 'Digital Health Sahel',
      code: 'DHS-SAF-12',
      description: 'Déploiement de solutions e-santé et télémédecine.',
      period: '2024 - 2026',
      sector: 'Santé Publique',
      status: ProjectStatus.TERMINE
    }
  ];

  const createdProjects = [];
  for (const proj of projectsData) {
    const created = await prisma.project.upsert({
      where: { code: proj.code },
      update: {},
      create: proj
    });
    createdProjects.push(created);
  }

  // 5. Seed Contacts with relations
  const contactsData = [
    {
      name: 'Amadou Diallo',
      initials: 'AD',
      title: 'Directeur de Recherche',
      organization: 'Center for Energy Research',
      email: 'a.diallo@research-network.org',
      phone: '+221 33 800 00 00',
      linkedin: 'https://linkedin.com/in/amadou-diallo-ri',
      country: 'Sénégal',
      flagEmoji: '🇸🇳',
      interventionZones: ['Sénégal', 'Afrique de l’Ouest', 'Union Européenne'],
      actorType: 'Labo de recherche',
      actorTypeId: createdActorTypes[0]?.id,
      expertise: ['Transition Énergétique', 'Hydrogène Vert', 'R&I'],
      isVerified: true
    },
    {
      name: 'Eva Schneider',
      initials: 'ES',
      title: 'Head of International Partnerships',
      organization: 'EU AgriTech Platform',
      email: 'e.schneider@eu-agri.tech',
      phone: '+49 30 555 0123',
      linkedin: 'https://linkedin.com/in/eva-schneider-agri',
      country: 'Allemagne',
      flagEmoji: '🇩🇪',
      interventionZones: ['Allemagne', 'Union Européenne', 'Afrique du Nord'],
      actorType: 'Réseau / Association',
      actorTypeId: createdActorTypes[3]?.id,
      expertise: ['AgriTech', 'Sécurité Alimentaire', 'Horizon Europe'],
      isVerified: true
    },
    {
      name: 'Fatou Diallo',
      initials: 'FD',
      title: 'Fondatrice & CTO',
      organization: 'Dakar Tech Incubator',
      email: 'fatou.diallo@dakar-tech.sn',
      phone: '+221 77 123 45 67',
      linkedin: 'https://linkedin.com/in/fatou-diallo-tech',
      country: 'Sénégal',
      flagEmoji: '🇸🇳',
      interventionZones: ['Sénégal', 'Mali', 'Côte d’Ivoire'],
      actorType: 'PME / Startup',
      actorTypeId: createdActorTypes[1]?.id,
      expertise: ['Intelligence Artificielle', 'Startups', 'Fintech'],
      isVerified: true
    },
    {
      name: 'Stefan Kovacs',
      initials: 'SK',
      title: 'Responsable Laboratoire',
      organization: 'Budapest BioLab',
      email: 's.kovacs@budapest-bio.hu',
      phone: '+36 1 456 7890',
      linkedin: 'https://linkedin.com/in/stefan-kovacs-bio',
      country: 'Hongrie',
      flagEmoji: '🇭🇺',
      interventionZones: ['Hongrie', 'Europe Centrale'],
      actorType: 'Labo de recherche',
      actorTypeId: createdActorTypes[0]?.id,
      expertise: ['Biotechnologies', 'Génomique', 'Diagnostic'],
      isVerified: true
    },
    {
      name: 'Sami Ben Ali',
      initials: 'SB',
      title: 'Professeur & Chercheur',
      organization: 'Institut Pasteur de Tunis',
      email: 'sami.benali@tunis-innovation.tn',
      phone: '+216 71 888 999',
      linkedin: 'https://linkedin.com/in/sami-benali-health',
      country: 'Tunisie',
      flagEmoji: '🇹🇳',
      interventionZones: ['Tunisie', 'Maghreb', 'France'],
      actorType: 'Labo de recherche',
      actorTypeId: createdActorTypes[0]?.id,
      expertise: ['Santé Globale', 'Immunologie', 'Santé Numérique'],
      isVerified: true
    }
  ];

  for (const c of contactsData) {
    const contact = await prisma.contact.upsert({
      where: { email: c.email },
      update: {},
      create: c
    });

    // Link Tags to Contact
    if (createdTags.length > 0) {
      await prisma.tagOnContact.createMany({
        data: [
          { contactId: contact.id, tagId: createdTags[0].id },
          { contactId: contact.id, tagId: createdTags[1].id }
        ],
        skipDuplicates: true
      });
    }

    // Link Projects to Contact
    if (createdProjects.length > 0) {
      await prisma.projectOnContact.createMany({
        data: [
          { contactId: contact.id, projectId: createdProjects[0].id }
        ],
        skipDuplicates: true
      });
    }

    // Add Exchange Note
    await prisma.exchangeNote.create({
      data: {
        contactId: contact.id,
        date: '2026-07-20',
        relativeTime: 'Il y a 2 semaines',
        title: 'Meeting de cadrage R&I',
        content: `Échange initial avec ${contact.name} concernant les opportunités de partenariat et projets européens.`,
        author: 'Dr. Chokri Ben Amar',
        authorInitials: 'CB',
        projectName: 'Euro-African Tech Exchange (EATE)',
        type: NoteType.MEETING
      }
    });
  }

  // 6. Seed Saved Segments
  await prisma.savedSegment.createMany({
    data: [
      {
        name: 'Partenaires Horizon Europe',
        description: 'Laboratoires et PME impliqués dans les projets UE',
        icon: 'Euro',
        filters: { actorTypes: ['Labo de recherche', 'PME'], tags: ['Projet Horizon Europe'] },
        userId: admin.id
      },
      {
        name: 'Experts IA & Santé',
        description: 'Acteurs spécialisés en intelligence artificielle et santé globale',
        icon: 'Activity',
        filters: { expertises: ['Intelligence Artificielle', 'Santé Globale'] },
        userId: demoUser.id
      }
    ],
    skipDuplicates: true
  });

  // 7. Seed Import / Export Logs
  await prisma.importExportLog.createMany({
    data: [
      {
        type: LogType.IMPORT,
        format: LogFormat.CSV,
        fileName: 'contacts_import_mars_2026.csv',
        recordCount: 24,
        status: 'SUCCESS',
        performedBy: admin.name,
        userId: admin.id
      },
      {
        type: LogType.EXPORT,
        format: LogFormat.XLSX,
        fileName: 'export_annuaire_arsii.xlsx',
        recordCount: 48,
        status: 'SUCCESS',
        performedBy: demoUser.name,
        userId: demoUser.id
      }
    ]
  });

  console.log('Comprehensive database seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
