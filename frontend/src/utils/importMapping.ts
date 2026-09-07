/**
 * Centralized column-mapping engine for the contact import wizard.
 *
 * Provides:
 *   - Header normalization (lowercase, accent→ASCII, separator collapse)
 *   - Alias dictionary for all 14 canonical fields (EN / FR / AR)
 *   - Fuzzy matching with conservative Levenshtein thresholds
 *
 * Returns the mapped field name (or '__ignore__') — no scoring/confidence.
 */

// ── Accent / Unicode normalization ────────────────────────────────────

const ACCENT_MAP: Record<string, string> = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
  'ç': 'c',
  'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
  'ñ': 'n',
  'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
  'ý': 'y', 'ÿ': 'y',
  'œ': 'oe', 'æ': 'ae',
};

function stripAccents(str: string): string {
  return str.replace(/[àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ]/gi, (ch) => ACCENT_MAP[ch.toLowerCase()] || ch);
}

/** Normalize a raw header string for alias comparison. */
export function normalizeHeader(header: string): string {
  return stripAccents(header)
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/['\u2019]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s/]/g, '')
    .replaceAll('/', ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Alias dictionary ─────────────────────────────────────────────────
// Sorted longest-first inside each field so longer aliases are tried first.

const FIELD_ALIASES: Record<string, string[]> = {
  email: [
    'adresse electronique', 'adresse e mail', 'adresse email',
    'email address', 'mail address', 'email adresse',
    'correo electronico', 'email adres',
    'e-mail', 'email', 'mail', 'courriel', 'correo',
    'البريد الإلكتروني',
  ],

  firstName: [
    'nom de bapteme', 'prenom', 'first name', 'given name',
    'forename', 'nombre', 'nom d usage',
    'الاسم الأول',
  ],

  lastName: [
    'nom de famille', 'last name', 'family name',
    'nom', 'surname', 'apellido',
    'اللقب', 'اسم العائلة',
  ],

  fullName: [
    'nom et prenom', 'nom d utilisateur',
    'nom complet', 'full name', 'fullname',
    'nombre completo',
  ],

  gender: [
    'genre', 'gender', 'sexe', 'sex', 'sexualite',
    'الجنس',
  ],

  countryOfOrigin: [
    'nom de pays / region', 'pays / region',
    'pays d origine', 'country of origin', 'origin country',
    'pays de provenance', 'country origin',
    'nom de pays', 'pays region',
    'nationalite', 'pays', 'country', 'origine',
    'البلد', 'بلد الأصل',
  ],

  city: [
    'lieu de residence', 'ville de residence',
    'current location',
    'ville', 'city', 'town', 'location', 'residence',
    'localisation', 'lieu',
    'المدينة', 'مكان الإقامة',
  ],

  phone: [
    'numero de telephone', 'telephone number',
    'numero de portable', 'cell phone', 'mobile number',
    'telephone', 'tel', 'phone', 'mobile',
    'gsm', 'portable', 'cel',
    'الهاتف', 'رقم الهاتف',
  ],

  affiliation: [
    'institution d affiliation', 'company name',
    'etablissement', 'universite', 'université',
    'affiliation', 'organisation', 'organisme',
    'societe', 'société', 'entreprise',
    'institution', 'company', 'employer', 'workplace',
    'المؤسسة', 'الجامعة', 'جهة العمل',
  ],

  function: [
    'intitule du poste', 'intitulé du poste',
    'role professionnel', 'poste',
    'fonction', 'position', 'titre', 'job', 'job title',
    'role', 'rôle', 'occupation', 'profession',
    'المهنة', 'الوظيفة', 'المنصب',
  ],

  experience: [
    "annees d'experience", "ans d'experience", "années d'expérience",
    "ans d'expérience", 'experience professionnelle',
    'work experience', 'professional experience',
    'experience level', 'experience',
    'الخبرة', 'سنوات الخبرة',
  ],

  facultyDepartment: [
    'faculte / departement', 'faculté / département',
    'faculty department', 'research department',
    'faculte', 'faculté', 'departement', 'département',
    'faculty', 'department', 'school', 'division', 'unit',
    'كلية', 'قسم',
  ],

  researchCareerStage: [
    'stade de carriere', 'stade de carrière',
    'niveau de carriere', 'niveau de carrière',
    'etape de carriere', 'etape de carrière',
    'research career stage', 'career stage',
    'academic level', 'research stage', 'career level',
    'researcher stage', 'research career',
    'carriere', 'carrière',
    'مرحلة المسار البحثي', 'المستوى الأكاديمي',
  ],

  tags: [
    'mots cles', 'mots clés',
    'research interests', 'centres d interet',
    'competences', 'compétences',
    'etiquettes', 'labels', 'categories', 'catégories',
    'themes', 'thèmes',
    'tags', 'tag', 'keywords', 'skills',
    'areas', 'interests', 'topics', 'domains',
    'الكلمات المفتاحية', 'المهارات',
  ],
};

// ── Levenshtein distance ─────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const matrix: number[][] = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) matrix[i][0] = i;
  for (let j = 0; j <= lb; j++) matrix[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[la][lb];
}

function fuzzyMatch(normalized: string, alias: string): boolean {
  const dist = levenshtein(normalized, alias);
  const threshold = alias.length >= 5 ? 2 : 1;
  return dist > 0 && dist <= threshold;
}

// ── Main mapping function ────────────────────────────────────────────

export interface MappingResult {
  field: string;
  priority: number;
  aliasLength: number;
}

/** Collapse spaces for comparison — handles broken encodings with unexpected spaces. */
function collapse(s: string): string {
  return s.replace(/\s/g, '');
}

/** Find the first alias matching `predicate`, returning its field and length. */
function findAlias(predicate: (alias: string) => boolean): { field: string; aliasLength: number } | null {
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (predicate(alias)) return { field, aliasLength: alias.length };
    }
  }
  return null;
}

/**
 * Predict the system field name for a single header column.
 *
 * Matching phases (highest priority first):
 *   1. Exact match on normalized form  → priority 4
 *   2. Exact match on collapsed form   → priority 3
 *   3. Fuzzy match on collapsed form   → priority 2
 *   4. Substring match (alias ≥5 chars)→ priority 1
 *   5. No match → '__ignore__'
 */
export function predictMapping(header: string): MappingResult {
  const normalized = normalizeHeader(header);
  const collapsedNormalized = collapse(normalized);

  // Phase 1: Exact match on normalized form
  const exact = findAlias((alias) => alias === normalized);
  if (exact) return { priority: 4, ...exact };

  // Phase 2: Exact match on collapsed form (handles broken encodings with extra spaces)
  const collapsed = findAlias((alias) => collapse(alias) === collapsedNormalized);
  if (collapsed) return { priority: 3, ...collapsed };

  // Phase 3: Fuzzy match on collapsed form
  const fuzzy = findAlias((alias) => fuzzyMatch(collapsedNormalized, collapse(alias)));
  if (fuzzy) return { priority: 2, ...fuzzy };

  // Phase 4: Substring match (aliases ≥5 chars only — short aliases like "nom" are too ambiguous)
  const substring = findAlias(
    (alias) => alias.length >= 5 && (normalized.includes(alias) || alias.includes(normalized)),
  );
  if (substring) return { priority: 1, ...substring };

  return { field: '__ignore__', priority: 0, aliasLength: 0 };
}

/**
 * Assign a mapping to `header`, resolving conflicts with higher-priority
 * mappings already taken from other columns.
 */
function resolveFieldConflict(
  header: string,
  result: MappingResult,
  takenFields: Record<string, { header: string; priority: number; aliasLength: number }>,
  finalMappings: Record<string, string>,
): void {
  const existing = takenFields[result.field];
  if (!existing) {
    finalMappings[header] = result.field;
    takenFields[result.field] = { header, priority: result.priority, aliasLength: result.aliasLength };
    return;
  }

  const winsByPriority = result.priority > existing.priority;
  const winsByAliasLength = result.priority === existing.priority && result.aliasLength > existing.aliasLength;

  if (winsByPriority || winsByAliasLength) {
    finalMappings[existing.header] = '__ignore__';
    finalMappings[header] = result.field;
    takenFields[result.field] = { header, priority: result.priority, aliasLength: result.aliasLength };
  } else {
    finalMappings[header] = '__ignore__';
  }
}

/** If a fullName column is mapped, drop any separate firstName/lastName columns. */
function applyFullNameExclusion(finalMappings: Record<string, string>): void {
  const hasFullName = Object.values(finalMappings).includes('fullName');
  if (!hasFullName) return;

  const nameFields = new Set(['firstName', 'lastName']);
  for (const [header, field] of Object.entries(finalMappings)) {
    if (nameFields.has(field)) {
      finalMappings[header] = '__ignore__';
    }
  }
}

/**
 * Predict mappings for all headers with priority-based dedup.
 *
 * Conflict resolution:
 *   - Higher priority wins (exact > collapsed-exact > fuzzy > substring)
 *   - Same priority → longer alias wins (more specific match)
 *   - Still tied → first column in order wins
 */
export function predictAllMappings(headers: string[]): Record<string, string> {
  const results = headers.map(header => ({ header, result: predictMapping(header) }));

  const takenFields: Record<string, { header: string; priority: number; aliasLength: number }> = {};
  const finalMappings: Record<string, string> = {};

  for (const { header, result } of results) {
    if (result.field === '__ignore__') {
      finalMappings[header] = '__ignore__';
      continue;
    }
    resolveFieldConflict(header, result, takenFields, finalMappings);
  }

  applyFullNameExclusion(finalMappings);

  return finalMappings;
}
