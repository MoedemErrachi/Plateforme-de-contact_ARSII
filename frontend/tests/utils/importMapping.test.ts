import { describe, it, expect } from 'vitest';
import { normalizeHeader, predictMapping, predictAllMappings } from '../../src/utils/importMapping';

describe('normalizeHeader', () => {
  it('lowercases, strips accents and collapses separators', () => {
    expect(normalizeHeader('Prénom')).toBe('prenom');
    expect(normalizeHeader('Faculté')).toBe('faculte');
    expect(normalizeHeader('Nom d\'expérience')).toBe('nom d experience');
  });

  it('normalises e-mail style hyphens into spaces', () => {
    expect(normalizeHeader('E-mail')).toBe('e mail');
    expect(normalizeHeader('Email')).toBe('email');
  });

  it('collapses multiple spaces and trims', () => {
    expect(normalizeHeader('  email   ')).toBe('email');
    expect(normalizeHeader('Email   Adresse')).toBe('email adresse');
  });

  it('removes special characters except word chars, spaces and slashes', () => {
    expect(normalizeHeader('Faculté (Sciences)')).toBe('faculte sciences');
  });

  it('normalises slashes with surrounding spaces', () => {
    expect(normalizeHeader('Faculté/Département')).toBe('faculte / departement');
  });

  it('strips non-word characters entirely (e.g. decorative symbols)', () => {
    expect(normalizeHeader('Email *')).toBe('email');
  });
});

describe('predictMapping', () => {
  it('maps email aliases via exact normalised match (priority 4)', () => {
    expect(predictMapping('Email')).toEqual({ field: 'email', priority: 4, aliasLength: 5 });
    expect(predictMapping('Adresse Email')).toEqual({ field: 'email', priority: 4, aliasLength: 13 });
    expect(predictMapping('Courriel')).toEqual({ field: 'email', priority: 4, aliasLength: 8 });
    expect(predictMapping('email adres')).toEqual({ field: 'email', priority: 4, aliasLength: 11 });
  });

  it('maps firstName aliases (priority 4)', () => {
    expect(predictMapping('Prénom')).toEqual(expect.objectContaining({ field: 'firstName', priority: 4 }));
    expect(predictMapping('First Name')).toEqual(expect.objectContaining({ field: 'firstName', priority: 4 }));
    expect(predictMapping('Given Name')).toEqual(expect.objectContaining({ field: 'firstName', priority: 4 }));
  });

  it('maps lastName aliases (priority 4)', () => {
    expect(predictMapping('Nom')).toEqual(expect.objectContaining({ field: 'lastName', priority: 4 }));
    expect(predictMapping('Nom de famille')).toEqual(expect.objectContaining({ field: 'lastName', priority: 4 }));
    expect(predictMapping('Surname')).toEqual(expect.objectContaining({ field: 'lastName', priority: 4 }));
  });

  it('maps gender/sex aliases (priority 4)', () => {
    expect(predictMapping('Genre')).toEqual(expect.objectContaining({ field: 'gender', priority: 4 }));
    expect(predictMapping('Sexe')).toEqual(expect.objectContaining({ field: 'gender', priority: 4 }));
  });

  it('maps country aliases (priority 4)', () => {
    expect(predictMapping('Pays')).toEqual(expect.objectContaining({ field: 'countryOfOrigin', priority: 4 }));
    expect(predictMapping('Pays d\'origine')).toEqual(expect.objectContaining({ field: 'countryOfOrigin', priority: 4 }));
    expect(predictMapping('Country')).toEqual(expect.objectContaining({ field: 'countryOfOrigin', priority: 4 }));
    expect(predictMapping('Nationalité')).toEqual(expect.objectContaining({ field: 'countryOfOrigin', priority: 4 }));
  });

  it('maps city aliases (priority 4)', () => {
    expect(predictMapping('Ville')).toEqual(expect.objectContaining({ field: 'city', priority: 4 }));
    expect(predictMapping('City')).toEqual(expect.objectContaining({ field: 'city', priority: 4 }));
  });

  it('maps phone aliases (priority 4)', () => {
    expect(predictMapping('Téléphone')).toEqual(expect.objectContaining({ field: 'phone', priority: 4 }));
    expect(predictMapping('Phone')).toEqual(expect.objectContaining({ field: 'phone', priority: 4 }));
  });

  it('maps affiliation aliases (priority 4)', () => {
    expect(predictMapping('Affiliation')).toEqual(expect.objectContaining({ field: 'affiliation', priority: 4 }));
    expect(predictMapping('Institution')).toEqual(expect.objectContaining({ field: 'affiliation', priority: 4 }));
    expect(predictMapping('Université')).toEqual(expect.objectContaining({ field: 'affiliation', priority: 4 }));
  });

  it('maps function/role aliases (priority 4)', () => {
    expect(predictMapping('Fonction')).toEqual(expect.objectContaining({ field: 'function', priority: 4 }));
    expect(predictMapping('Position')).toEqual(expect.objectContaining({ field: 'function', priority: 4 }));
  });

  it('maps experience aliases (priority 4)', () => {
    expect(predictMapping('Expérience')).toEqual(expect.objectContaining({ field: 'experience', priority: 4 }));
  });

  it('maps faculty/department aliases (priority 4)', () => {
    expect(predictMapping('Faculté')).toEqual(expect.objectContaining({ field: 'facultyDepartment', priority: 4 }));
    expect(predictMapping('Département')).toEqual(expect.objectContaining({ field: 'facultyDepartment', priority: 4 }));
  });

  it('maps career stage aliases (priority 4)', () => {
    expect(predictMapping('Stade de carrière')).toEqual(expect.objectContaining({ field: 'researchCareerStage', priority: 4 }));
    expect(predictMapping('Career Stage')).toEqual(expect.objectContaining({ field: 'researchCareerStage', priority: 4 }));
  });

  it('maps tags/keywords aliases (priority 4)', () => {
    expect(predictMapping('Tags')).toEqual(expect.objectContaining({ field: 'tags', priority: 4 }));
    expect(predictMapping('Keywords')).toEqual(expect.objectContaining({ field: 'tags', priority: 4 }));
  });

  it('maps fullName aliases (priority 4)', () => {
    expect(predictMapping('Full Name')).toEqual(expect.objectContaining({ field: 'fullName', priority: 4 }));
    expect(predictMapping('Nom complet')).toEqual(expect.objectContaining({ field: 'fullName', priority: 4 }));
  });

  it('uses priority 3 (collapsed-exact) when hyphens separate a compound alias', () => {
    expect(predictMapping('E-mail')).toEqual({ field: 'email', priority: 3, aliasLength: 5 });
  });

  it('uses priority 2 (fuzzy match) for a single-char typo', () => {
    expect(predictMapping('emai')).toEqual(expect.objectContaining({ field: 'email', priority: 2 }));
    expect(predictMapping('mailx')).toEqual(expect.objectContaining({ field: 'email', priority: 2 }));
    expect(predictMapping('Faculty / Department')).toEqual(expect.objectContaining({ field: 'facultyDepartment', priority: 2 }));
    expect(predictMapping('Années d\'expérience')).toEqual(expect.objectContaining({ field: 'experience', priority: 2 }));
  });

  it('uses priority 1 (substring match) for long aliases ≥5 chars', () => {
    expect(predictMapping('Name')).toEqual(expect.objectContaining({ field: 'firstName', priority: 1 }));
  });

  it('returns __ignore__ for unknown headers', () => {
    expect(predictMapping('RandomColumn')).toEqual({ field: '__ignore__', priority: 0, aliasLength: 0 });
    expect(predictMapping('electronic mail')).toEqual({ field: '__ignore__', priority: 0, aliasLength: 0 });
  });
});

describe('predictAllMappings', () => {
  it('maps a standard FR header row correctly', () => {
    const result = predictAllMappings(['Nom', 'Prénom', 'Email', 'Ville', 'Pays']);
    expect(result).toEqual({
      Nom: 'lastName',
      Prénom: 'firstName',
      Email: 'email',
      Ville: 'city',
      Pays: 'countryOfOrigin'
    });
  });

  it('resolves duplicate email columns in favour of the longest alias', () => {
    const result = predictAllMappings(['Email', 'Adresse Email', 'mail']);
    expect(result).toEqual({
      Email: '__ignore__',
      'Adresse Email': 'email',
      mail: '__ignore__'
    });
  });

  it('deduplicates identical duplicate headers (last one is ignored)', () => {
    const result = predictAllMappings(['Ville', 'Email', 'Ville']);
    expect(result).toEqual({ Ville: '__ignore__', Email: 'email' });
  });

  it('keeps distinct headers in the order they appear', () => {
    const result = predictAllMappings(['Ville', 'Email', 'Nom']);
    expect(Object.keys(result)).toEqual(['Ville', 'Email', 'Nom']);
    expect(result).toEqual({ Ville: 'city', Email: 'email', Nom: 'lastName' });
  });

  it('drops firstName/lastName when fullName is present', () => {
    const result = predictAllMappings(['Nom', 'Prénom', 'Nom complet']);
    expect(result).toEqual({
      Nom: '__ignore__',
      Prénom: '__ignore__',
      'Nom complet': 'fullName'
    });
  });

  it('returns __ignore__ for unknown columns alongside mapped columns', () => {
    const result = predictAllMappings(['Email', 'Colonne Inconnue', 'Ville']);
    expect(result).toEqual({
      Email: 'email',
      'Colonne Inconnue': '__ignore__',
      Ville: 'city'
    });
  });
});