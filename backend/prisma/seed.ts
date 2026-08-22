import { PrismaClient, Role, Gender, ResearchCareerStage } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Sanitize text values so corrupted/mis-encoded characters (e.g. U+FFFD from
// pasted or wrongly-decoded strings) never reach the database as-is.
function sanitizeText(value: string): string {
  return value
    .replace(/\uFFFD/g, '')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u00A0/g, ' ')
    .trim();
}

async function main() {
  console.log('Seeding EURAXESS Africa database...');

  // ── Users ──────────────────────────────────────────────
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const demoPassword = process.env.SEED_DEMO_PASSWORD || 'demo1234';
  const passwordHash = bcrypt.hashSync(adminPassword, 10);
  const demoHash = bcrypt.hashSync(demoPassword, 10);

  const [supervisor] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'maalel.ahmed@gmail.com' },
      update: {},
      create: {
        email: 'maalel.ahmed@gmail.com',
        name: 'MAALEL.AHMED',
        passwordHash,
        role: Role.ADMIN
      }
    }),
    prisma.user.upsert({
      where: { email: 'admin@arsii.org' },
      update: {},
      create: {
        email: 'admin@arsii.org',
        name: 'Admin EURAXESS Africa',
        passwordHash,
        role: Role.ADMIN
      }
    }),
    prisma.user.upsert({
      where: { email: 'demo@arsii.org' },
      update: {},
      create: {
        email: 'demo@arsii.org',
        name: 'Utilisateur Démo',
        passwordHash: demoHash,
        role: Role.USER
      }
    })
  ]);
  console.log(`Users ready: ${supervisor.email} (ADMIN), admin@arsii.org, demo@arsii.org`);

  // ── Tags ───────────────────────────────────────────────
  const tagData = [
    { name: 'Membre EURAXESS Africa', color: '#005596', description: 'Membre du réseau EURAXESS Africa' },
    { name: 'Chercheur Senior', color: '#B8167C', description: 'Chercheur expérimenté (R3+)' },
    { name: 'Doctorant', color: '#35B8B2', description: 'Chercheur en début de carrière (R1)' },
    { name: 'Expert IA & Data', color: '#FFC20C', description: 'Intelligence artificielle et science des données' },
    { name: 'Climat & Énergie', color: '#35B8B2', description: 'Changement climatique et énergies durables' },
    { name: 'Santé & Biotech', color: '#B8167C', description: 'Sciences de la santé et biotechnologies' },
    { name: 'PME Innovante', color: '#8A98A1', description: 'Entreprise innovante' },
    { name: 'Université', color: '#005596', description: 'Institution académique' },
    { name: 'VIP / Prioritaire', color: '#FFC20C', description: 'Contact à suivre en priorité' }
  ];

  const tags: Record<string, string> = {};
  for (const t of tagData) {
    const saved = await prisma.tag.upsert({
      where: { name: t.name },
      update: {},
      create: t
    });
    tags[t.name] = saved.id;
  }
  console.log(`Tags ready: ${Object.keys(tags).length}`);

  // ── Contacts ───────────────────────────────────────────
  const contactData = [
    {
      firstName: 'Amina', lastName: 'Diallo',
      email: 'amina.diallo@ucad.sn', gender: Gender.FEMALE,
      countryOfOrigin: 'Sénégal', city: 'Dakar',
      phone: '+221 77 123 45 67', affiliation: 'Université Cheikh Anta Diop',
      function: 'Maître de conférences', experience: '12 ans en biologie marine',
      facultyDepartment: 'Faculté des Sciences et Techniques', researchCareerStage: ResearchCareerStage.R3_ESTABLISHED,
      tags: ['Membre EURAXESS Africa', 'Santé & Biotech']
    },
    {
      firstName: 'Karim', lastName: 'Ben Salah',
      email: 'karim.bensalah@euraxess-africa.org', gender: Gender.MALE,
      countryOfOrigin: 'Tunisie', city: 'Tunis',
      phone: '+216 22 987 65 43', affiliation: 'EURAXESS Africa Hub',
      function: 'Coordinateur de projets R&I', experience: '8 ans de gestion de projets internationaux',
      facultyDepartment: 'Direction de la Recherche', researchCareerStage: ResearchCareerStage.R3_ESTABLISHED,
      tags: ['Membre EURAXESS Africa', 'Université']
    },
    {
      firstName: 'Fatou', lastName: 'Ndiaye',
      email: 'fatou.ndiaye@isep-dakar.sn', gender: Gender.FEMALE,
      countryOfOrigin: 'Sénégal', city: 'Saint-Louis',
      phone: '+221 76 555 44 33', affiliation: 'ISEP-Dakar',
      function: 'Doctorante', experience: '3 ans en intelligence artificielle',
      facultyDepartment: 'Département Informatique', researchCareerStage: ResearchCareerStage.R1_FIRST_STAGE,
      tags: ['Doctorant', 'Expert IA & Data']
    },
    {
      firstName: 'Yann', lastName: 'Kouassi',
      email: 'yann.kouassi@csrs.ci', gender: Gender.MALE,
      countryOfOrigin: "Côte d'Ivoire", city: 'Abidjan',
      phone: '+225 07 77 88 99 00', affiliation: 'Centre Suisse de Recherches Scientifiques',
      function: 'Chercheur postdoctoral', experience: '6 ans en énergie renouvelable',
      facultyDepartment: 'Laboratoire Énergie', researchCareerStage: ResearchCareerStage.R2_RECOGNIZED,
      tags: ['Climat & Énergie']
    },
    {
      firstName: 'Mariam', lastName: 'Traoré',
      email: 'mariam.traore@ub.ml', gender: Gender.FEMALE,
      countryOfOrigin: 'Mali', city: 'Bamako',
      phone: '+223 76 11 22 33', affiliation: 'Université de Bamako',
      function: 'Professeure titulaire', experience: '20 ans en chimie',
      facultyDepartment: 'Faculté des Sciences', researchCareerStage: ResearchCareerStage.R4_LEADING,
      tags: ['Membre EURAXESS Africa', 'VIP / Prioritaire']
    },
    {
      firstName: 'Jean-Luc', lastName: 'Mbarga',
      email: 'jl.mbarga@greentech.cm', gender: Gender.MALE,
      countryOfOrigin: 'Cameroun', city: 'Yaoundé',
      phone: '+237 6 99 00 11 22', affiliation: 'GreenTech Afrique SARL',
      function: 'CEO / Fondateur', experience: '15 ans en entrepreneuriat tech',
      facultyDepartment: '', researchCareerStage: ResearchCareerStage.R3_ESTABLISHED,
      tags: ['PME Innovante', 'Expert IA & Data']
    },
    {
      firstName: 'Sophie', lastName: 'Mensah',
      email: 'sophie.mensah@ug.edu.gh', gender: Gender.FEMALE,
      countryOfOrigin: 'Ghana', city: 'Accra',
      phone: '+233 24 555 67 78', affiliation: 'University of Ghana',
      function: 'Senior Lecturer', experience: '11 ans en santé publique',
      facultyDepartment: 'School of Public Health', researchCareerStage: ResearchCareerStage.R3_ESTABLISHED,
      tags: ['Santé & Biotech', 'Chercheur Senior']
    },
    {
      firstName: 'Ibrahim', lastName: 'Sow',
      email: 'ibrahim.sow@irag-guinee.org', gender: Gender.MALE,
      countryOfOrigin: 'Guinée', city: 'Conakry',
      phone: '+224 62 345 67 89', affiliation: 'Institut de Recherche Agronomique',
      function: 'Ingénieur agronome', experience: '7 ans en agriculture durable',
      facultyDepartment: 'Département Agriculture', researchCareerStage: ResearchCareerStage.R2_RECOGNIZED,
      tags: ['Climat & Énergie']
    },
    {
      firstName: 'Nia', lastName: 'Kamara',
      email: 'nia.kamara@njala.edu.sl', gender: Gender.FEMALE,
      countryOfOrigin: 'Sierra Leone', city: 'Freetown',
      phone: '+232 76 543 210', affiliation: 'Njala University',
      function: 'Lecturer', experience: '9 ans en biotechnologie',
      facultyDepartment: 'Faculty of Agriculture', researchCareerStage: ResearchCareerStage.R2_RECOGNIZED,
      tags: ['Santé & Biotech']
    },
    {
      firstName: 'Ahmed', lastName: 'Haddad',
      email: 'ahmed.haddad@uss.tn', gender: Gender.MALE,
      countryOfOrigin: 'Tunisie', city: 'Sfax',
      phone: '+216 98 765 43 21', affiliation: 'Université de Sfax',
      function: 'Professeur', experience: '18 ans en électronique',
      facultyDepartment: "École Nationale d'Électronique", researchCareerStage: ResearchCareerStage.R4_LEADING,
      tags: ['Membre EURAXESS Africa', 'Chercheur Senior']
    },
    {
      firstName: 'Grace', lastName: 'Okafor',
      email: 'grace.okafor@lagosinnovates.ng', gender: Gender.FEMALE,
      countryOfOrigin: 'Nigeria', city: 'Lagos',
      phone: '+234 803 555 44 22', affiliation: 'Lagos Innovates',
      function: "Directrice de l'innovation", experience: '10 ans en innovation',
      facultyDepartment: 'Pôle Innovation', researchCareerStage: ResearchCareerStage.R3_ESTABLISHED,
      tags: ['PME Innovante']
    },
    {
      firstName: 'Lucas', lastName: 'Moreau',
      email: 'lucas.moreau@cnrs.fr', gender: Gender.MALE,
      countryOfOrigin: 'France', city: 'Paris',
      phone: '+33 6 12 34 56 78', affiliation: 'CNRS',
      function: 'Chargé de recherche', experience: '14 ans en physique',
      facultyDepartment: 'Institut de Physique', researchCareerStage: ResearchCareerStage.R3_ESTABLISHED,
      tags: ['Université', 'Chercheur Senior']
    },
    {
      firstName: 'Elena', lastName: 'Petrov',
      email: 'elena.petrov@ens-lyon.fr', gender: Gender.FEMALE,
      countryOfOrigin: 'France', city: 'Lyon',
      phone: '+33 6 98 76 54 32', affiliation: 'ENS Lyon',
      function: 'Doctorante', experience: '2 ans en neurosciences',
      facultyDepartment: 'Département de Biologie', researchCareerStage: ResearchCareerStage.R1_FIRST_STAGE,
      tags: ['Doctorant']
    },
    {
      firstName: 'Kwame', lastName: 'Asante',
      email: 'kwame.asante@knust.edu.gh', gender: Gender.MALE,
      countryOfOrigin: 'Ghana', city: 'Kumasi',
      phone: '+233 20 111 22 33', affiliation: 'KNUST',
      function: 'Assistant Lecturer', experience: '4 ans en ingénierie',
      facultyDepartment: 'College of Engineering', researchCareerStage: ResearchCareerStage.R1_FIRST_STAGE,
      tags: ['Expert IA & Data']
    },
    {
      firstName: 'Sofia', lastName: 'Ferreira',
      email: 'sofia.ferreira@inrae.fr', gender: Gender.FEMALE,
      countryOfOrigin: 'France', city: 'Bordeaux',
      phone: '+33 7 55 44 33 22', affiliation: 'INRAE',
      function: 'Directrice de recherche', experience: '22 ans en agroécologie',
      facultyDepartment: 'UR Sols', researchCareerStage: ResearchCareerStage.R4_LEADING,
      tags: ['Climat & Énergie', 'Chercheur Senior']
    }
  ];

  // ── Contacts synthétiques supplémentaires (déterministes, ~113) ──────────
  // Enrichit la base pour un volume réaliste (~120 contacts au total) et fournit
  // des emails temporaires `import_null_...` (audit / outil count_temp_emails).
  const SYNTHETIC_COUNT = 105;

  const firstNamesFemale = ['Aminata', 'Fatoumata', 'Awa', 'Mariam', 'Khady', 'Binta', 'Aïcha', 'Ndeye', 'Rokhaya', 'Bineta', 'Adama', 'Fatou', 'Nana', 'Sarah', 'Sofia', 'Claire', 'Giulia', 'Efua', 'Ngozi', 'Yaa'];
  const firstNamesMale = ['Moussa', 'Abdoulaye', 'Seydou', 'Ibrahima', 'Ousmane', 'Modou', 'Cheikh', 'Papa', 'Idrissa', 'Mamadou', 'Karim', 'Ahmed', 'Yassine', 'Kofi', 'Kwame', 'Emeka', 'Chidi', 'Pierre', 'Thomas', 'Julien'];
  const lastNamesByCountry: Record<string, string[]> = {
    'Sénégal': ['Diallo', 'Ndiaye', 'Diop', 'Sarr', 'Fall', 'Ba', 'Diagne', 'Gueye', 'Cissé', 'Faye', 'Sy', 'Mbaye', 'Niang', 'Kane', 'Sow'],
    'Tunisie': ['Ben Salah', 'Ben Ali', 'Haddad', 'Bouazizi', 'Trabelsi', 'Gharbi', 'Jaziri', 'Mansouri', 'Kallel', 'Ayari'],
    'Côte d\'Ivoire': ['Kouassi', 'Koné', 'Ouattara', 'N\'Guessan', 'Kouamé', 'Bamba', 'Yao', 'Boni', 'Soro', 'Traoré'],
    'Mali': ['Traoré', 'Keïta', 'Touré', 'Coulibaly', 'Sidibé', 'Diabaté', 'Konaté', 'Diarra', 'Sangaré', 'Maïga'],
    'Cameroun': ['Mbarga', 'Nguema', 'Tchoumi', 'Njiki', 'Fotso', 'Kamga', 'Atangana', 'Ngo', 'Belobo', 'Essomba'],
    'Ghana': ['Mensah', 'Boateng', 'Owusu', 'Asante', 'Osei', 'Agyemang', 'Addo', 'Ampofo', 'Darko', 'Bonsu'],
    'Nigeria': ['Okafor', 'Eze', 'Okoro', 'Adeyemi', 'Ogunleye', 'Bello', 'Chukwu', 'Nwosu', 'Adeleke', 'Balogun'],
    'Guinée': ['Camara', 'Sow', 'Bah', 'Diallo', 'Sylla', 'Keita', 'Condé', 'Barry', 'Touré', 'Doumbouya'],
    'Sierra Leone': ['Kamara', 'Sesay', 'Koroma', 'Turay', 'Sankoh', 'Bangura', 'Fofanah', 'Johnson', 'Cole', 'Williams'],
    'Maroc': ['El Amrani', 'Bennani', 'El Fassi', 'Idrissi', 'Berrada', 'Amrani', 'Tazi', 'Ziani', 'Bouazza', 'Chraibi'],
    'Kenya': ['Muthoni', 'Ochieng', 'Njoroge', 'Wanjiru', 'Otieno', 'Mwangi', 'Chebet', 'Kipchoge', 'Achieng', 'Odhiambo'],
    'Égypte': ['Hassan', 'Ahmed', 'Mahmoud', 'Ibrahim', 'Mostafa', 'Fathy', 'Ezzat', 'Tarek', 'Adel', 'Sherif'],
    'France': ['Moreau', 'Lefèvre', 'Dubois', 'Bernard', 'Petit', 'Rousseau', 'Mercier', 'Girard', 'Lambert', 'Fontaine'],
    'Allemagne': ['Schmidt', 'Müller', 'Weber', 'Schneider', 'Fischer', 'Wagner', 'Becker', 'Hoffmann', 'Koch', 'Richter'],
    'Belgique': ['Peeters', 'Lambert', 'De Smet', 'Maes', 'Willems', 'Claes', 'Vandenberg', 'Jacobs', 'Mertens'],
    'Royaume-Uni': ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Taylor', 'Davies', 'Wilson', 'Evans', 'Thomas']
  };
  const countryInfo: Array<{ country: string; cities: string[]; phone: string }> = [
    { country: 'Sénégal', cities: ['Dakar', 'Saint-Louis', 'Thiès', 'Ziguinchor'], phone: '+221 7' },
    { country: 'Tunisie', cities: ['Tunis', 'Sfax', 'Sousse', 'Monastir'], phone: '+216 2' },
    { country: 'Côte d\'Ivoire', cities: ['Abidjan', 'Bouaké', 'Yamoussoukro'], phone: '+225 0' },
    { country: 'Mali', cities: ['Bamako', 'Ségou', 'Sikasso'], phone: '+223 7' },
    { country: 'Cameroun', cities: ['Yaoundé', 'Douala', 'Bafoussam'], phone: '+237 6' },
    { country: 'Ghana', cities: ['Accra', 'Kumasi', 'Takoradi'], phone: '+233 2' },
    { country: 'Nigeria', cities: ['Lagos', 'Abuja', 'Ibadan'], phone: '+234 8' },
    { country: 'Guinée', cities: ['Conakry', 'Kankan', 'Labé'], phone: '+224 6' },
    { country: 'Sierra Leone', cities: ['Freetown', 'Bo', 'Kenema'], phone: '+232 7' },
    { country: 'Maroc', cities: ['Rabat', 'Casablanca', 'Marrakech'], phone: '+212 6' },
    { country: 'Kenya', cities: ['Nairobi', 'Mombasa', 'Kisumu'], phone: '+254 7' },
    { country: 'Égypte', cities: ['Le Caire', 'Alexandrie', 'Gizeh'], phone: '+20 1' },
    { country: 'France', cities: ['Paris', 'Lyon', 'Bordeaux', 'Toulouse'], phone: '+33 6' },
    { country: 'Allemagne', cities: ['Berlin', 'Munich', 'Hambourg'], phone: '+49 1' },
    { country: 'Belgique', cities: ['Bruxelles', 'Liège', 'Gand'], phone: '+32 4' },
    { country: 'Royaume-Uni', cities: ['Londres', 'Édimbourg', 'Manchester'], phone: '+44 7' }
  ];
  const affiliationsByCountry: Record<string, string[]> = {
    'Sénégal': ['Université Cheikh Anta Diop', 'ISEP-Dakar', 'Université Gaston Berger', 'CESTI', 'Institut Panafricain de Développement'],
    'Tunisie': ['Université de Tunis El Manar', 'Université de Sfax', 'INSAT', 'Université de Sousse'],
    'Côte d\'Ivoire': ['Université Félix Houphouët-Boigny', 'Centre Suisse de Recherches Scientifiques', 'INP-HB'],
    'Mali': ['Université de Bamako', 'INRSP', 'Institut Polytechnique Rural'],
    'Cameroun': ['Université de Yaoundé I', 'GreenTech Afrique SARL', 'Université de Douala'],
    'Ghana': ['University of Ghana', 'KNUST', 'University of Cape Coast'],
    'Nigeria': ['University of Lagos', 'Lagos Innovates', 'Federal University of Technology Akure'],
    'Guinée': ['Institut de Recherche Agronomique', 'Université de Conakry', 'Université de Labé'],
    'Sierra Leone': ['Njala University', 'University of Sierra Leone', 'Fourah Bay College'],
    'Maroc': ['Université Mohammed V', 'Université Internationale de Rabat', 'Université Hassan II'],
    'Kenya': ['University of Nairobi', 'Strathmore University', 'Kenyatta University'],
    'Égypte': ['Université du Caire', 'Université Américaine du Caire', 'Université d\'Alexandrie'],
    'France': ['CNRS', 'INRAE', 'ENS Lyon', 'Université de Bordeaux', 'IRD'],
    'Allemagne': ['TU Berlin', 'LMU Munich', 'Max Planck Institute'],
    'Belgique': ['ULB', 'KU Leuven', 'Université de Liège'],
    'Royaume-Uni': ['UCL', 'University of Edinburgh', 'University of Manchester']
  };
  const facultyDepartments = [
    'Faculté des Sciences et Techniques', 'Département Informatique', 'Département de Biologie',
    'Faculté des Sciences', 'School of Public Health', 'Laboratoire Énergie', 'Département Agriculture',
    'Faculté de Médecine', 'École Polytechnique', 'Institut de Physique', 'Département de Chimie',
    'Faculty of Engineering', 'Département de Mathématiques', 'Département des Sciences Sociales'
  ];
  const functionsList = [
    'Professeur', 'Maître de conférences', 'Doctorant(e)', 'Chercheur postdoctoral', 'Lecturer',
    'Senior Lecturer', 'Ingénieur de recherche', 'Chargé de recherche', 'Directeur de recherche', 'Assistant Lecturer'
  ];
  const allStages = [ResearchCareerStage.R1_FIRST_STAGE, ResearchCareerStage.R2_RECOGNIZED, ResearchCareerStage.R3_ESTABLISHED, ResearchCareerStage.R4_LEADING];

  function slugify(value: string): string {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '.');
  }

  interface SeedContact {
    firstName: string;
    lastName: string;
    email: string;
    gender: Gender;
    countryOfOrigin: string;
    city: string;
    phone: string;
    affiliation: string;
    function: string;
    experience: string;
    facultyDepartment: string;
    researchCareerStage: ResearchCareerStage;
    tags: string[];
  }

  const syntheticData: SeedContact[] = [];
  for (let i = 0; i < SYNTHETIC_COUNT; i++) {
    const info = countryInfo[i % countryInfo.length];
    const surnames = lastNamesByCountry[info.country];
    const lastName = surnames[Math.floor(i / countryInfo.length) % surnames.length];
    const male = i % 2 === 0;
    const firstName = male ? firstNamesMale[i % firstNamesMale.length] : firstNamesFemale[i % firstNamesFemale.length];
    const stage = allStages[i % allStages.length];
    const baseTags = stage === ResearchCareerStage.R1_FIRST_STAGE
      ? ['Doctorant', 'Membre EURAXESS Africa']
      : stage === ResearchCareerStage.R3_ESTABLISHED
        ? ['Membre EURAXESS Africa', 'Chercheur Senior']
        : stage === ResearchCareerStage.R4_LEADING
          ? ['Chercheur Senior', 'VIP / Prioritaire', 'Université']
          : ['Membre EURAXESS Africa'];
    const tags = i % 3 === 0 && stage !== ResearchCareerStage.R4_LEADING
      ? [...baseTags, 'Expert IA & Data']
      : baseTags;

    syntheticData.push({
      firstName,
      lastName,
      email: `${slugify(firstName)}.${slugify(lastName)}.${1000 + i}@mail.euraxess-africa.org`,
      gender: male ? Gender.MALE : Gender.FEMALE,
      countryOfOrigin: info.country,
      city: info.cities[i % info.cities.length],
      phone: `${info.phone}${String(1000000 + i).slice(-7)}`,
      affiliation: affiliationsByCountry[info.country][i % affiliationsByCountry[info.country].length],
      function: functionsList[i % functionsList.length],
      experience: `${2 + (i % 20)} ans d'expérience en recherche`,
      facultyDepartment: facultyDepartments[i % facultyDepartments.length],
      researchCareerStage: stage,
      tags
    });
  }

  // Emails temporaires issus d'imports (audit / outil count_temp_emails)
  for (let i = 0; i < 8; i++) {
    const info = countryInfo[i % countryInfo.length];
    syntheticData.push({
      firstName: 'Import', lastName: `Temp_${i}`,
      email: `import_null_2026-08-13_${i}@temp.local`, gender: Gender.NOT_SPECIFIED,
      countryOfOrigin: info.country, city: info.cities[0],
      phone: '', affiliation: "Données d'import (temporaire)",
      function: '', experience: '',
      facultyDepartment: '', researchCareerStage: ResearchCareerStage.R1_FIRST_STAGE,
      tags: []
    });
  }

  for (const data of [...contactData, ...syntheticData]) {
    const existing = await prisma.contact.findUnique({ where: { email: data.email } });
    if (existing) continue;

    await prisma.contact.create({
      data: {
        firstName: sanitizeText(data.firstName),
        lastName: sanitizeText(data.lastName),
        email: sanitizeText(data.email),
        gender: data.gender,
        countryOfOrigin: sanitizeText(data.countryOfOrigin),
        city: sanitizeText(data.city),
        phone: sanitizeText(data.phone),
        affiliation: sanitizeText(data.affiliation),
        function: sanitizeText(data.function),
        experience: sanitizeText(data.experience),
        facultyDepartment: data.facultyDepartment ? sanitizeText(data.facultyDepartment) : null,
        researchCareerStage: data.researchCareerStage,
        tags: {
          create: data.tags
            .map(name => tags[name])
            .filter(Boolean)
            .map(tagId => ({ tagId }))
        }
      }
    });
  }
  console.log(`Contacts ready: ${contactData.length + syntheticData.length}`);

  // ── Segments ───────────────────────────────────────────
  const segmentData = [
    {
      name: 'Chercheurs établis & leaders (R3+)',
      description: 'Contacts aux stades R3 (établi) et R4 (leader)',
      filters: { search: '', countries: [], genders: [], careerStages: ['R3_ESTABLISHED', 'R4_LEADING'], affiliations: '', tags: [] }
    },
    {
      name: 'Chercheuses',
      description: 'Contacts féminins du réseau',
      filters: { search: '', countries: [], genders: ['FEMALE'], careerStages: [], affiliations: '', tags: [] }
    },
    {
      name: 'Afrique de l\'Ouest',
      description: 'Contacts basés en Afrique de l\'Ouest',
      filters: { search: '', countries: ['Sénégal', 'Mali', "Côte d'Ivoire", 'Guinée', 'Sierra Leone', 'Nigeria', 'Ghana'], genders: [], careerStages: [], affiliations: '', tags: [] }
    }
  ];

  for (const s of segmentData) {
    const existing = await prisma.segment.findFirst({ where: { name: s.name } });
    if (existing) continue;
    await prisma.segment.create({
      data: {
        name: s.name,
        description: s.description,
        icon: 'Filter',
        filters: {
          ...s.filters,
          countries: (s.filters.countries || []).map(c => sanitizeText(c))
        } as any,
        userId: supervisor.id
      }
    });
  }
  console.log(`Segments ready: ${segmentData.length}`);

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
