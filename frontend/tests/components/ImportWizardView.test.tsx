import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ImportWizardView } from '../../src/components/ImportWizardView';
import { Contact, CAREER_STAGE_LABELS } from '../../src/types';

vi.mock('../../src/services/api', () => ({
  apiFetch: vi.fn().mockResolvedValue({ data: { preview: [] } }),
}));

import { apiFetch } from '../../src/services/api';
const mockedApiFetch = vi.mocked(apiFetch);

const csvFile = (name: string, content: string) =>
  new File([content], name, { type: 'text/csv' });

const EXISTING: Contact[] = [
  {
    id: 'c1',
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean@existing.com',
    gender: 'MALE',
    countryOfOrigin: 'France',
    affiliation: 'CNRS',
    researchCareerStage: 'R3_ESTABLISHED',
    tags: [],
  },
];

const makeOnImport = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    httpStatus: 200,
    status: 'SUCCESS',
    errorMessage: '',
    data: { createdCount: 1, updatedCount: 0, errors: [] },
  });

function renderWizard(
  onImport = makeOnImport(),
  existingContacts = EXISTING,
) {
  return render(
    <MemoryRouter>
      <ImportWizardView
        onImportContacts={onImport}
        existingContacts={existingContacts}
      />
    </MemoryRouter>,
  );
}

function uploadFile(container: HTMLElement, file: File) {
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  Object.defineProperty(input, 'files', {
    value: Object.assign([file], { length: 1 }),
    configurable: true,
  });
  fireEvent.change(input);
}

async function analyzeCsv(container: HTMLElement, content: string) {
  uploadFile(container, csvFile('contacts.csv', content));
  await waitFor(() => {
    expect(screen.getByText('contacts.csv')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText(/Continuer vers Mappage/));
  await waitFor(() => {
    expect(
      screen.getByText(/Associer les colonnes du fichier/),
    ).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText(/Lancer l'Analyse des Lignes/));
  await waitFor(() => {
    expect(
      screen.getByText(/Confirmer et Exécuter l'Importation/),
    ).toBeInTheDocument();
  });
}

const VALID_CSV = 'Nom,Prénom,Email\nDupont,Jean,jean@x.fr';
const TWO_ROW_CSV =
  'Nom,Prénom,Email\nDupont,Jean,jean@x.fr\nMartin,Paul,paul@x.fr';
const DUPLICATE_CSV =
  'Nom,Prénom,Email\nDupont,Jean,jean@existing.com';
const NO_EMAIL_CSV = 'Nom,Prénom\nDupont,Jean';

describe('ImportWizardView', () => {
  let onImport: ReturnType<typeof makeOnImport>;

  beforeEach(() => {
    vi.clearAllMocks();
    onImport = makeOnImport();
    mockedApiFetch.mockResolvedValue({ data: { preview: [] } });
  });

  it('renders step 1 with wizard title, stepper, and file drop zone', () => {
    renderWizard();
    expect(
      screen.getByText(/Assistant d'Importation Pro/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Étape 1 : Sélectionner le fichier/),
    ).toBeInTheDocument();
    expect(screen.getByText('1. Chargement')).toBeInTheDocument();
    expect(screen.getByText('2. Mappage')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Choisir un fichier de contacts/i }),
    ).toBeInTheDocument();
  });

  it('shows file and OCR tab buttons', () => {
    renderWizard();
    expect(screen.getByText(/Importer un fichier/)).toBeInTheDocument();
    expect(screen.getByText(/Scanner une carte/)).toBeInTheDocument();
  });

  it('switches to OCR tab and back to file tab', () => {
    renderWizard();
    fireEvent.click(screen.getByText(/Scanner une carte/));
    expect(
      screen.getByText(/Uploadez une photo d'une carte de visite/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Importer un fichier/));
    expect(
      screen.getByText(/Étape 1 : Sélectionner le fichier/),
    ).toBeInTheDocument();
  });

  it('loads a CSV file and shows file info card with correct stats', async () => {
    const { container } = renderWizard();
    uploadFile(container, csvFile('contacts.csv', TWO_ROW_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    expect(screen.getByText(/2 lignes valides/)).toBeInTheDocument();
    expect(screen.getByText(/3 colonnes/)).toBeInTheDocument();
  });

  it('shows error banner for a file with insufficient data', async () => {
    const { container } = renderWizard();
    uploadFile(container, csvFile('tiny.csv', 'JustOneColumn'));

    await waitFor(() => {
      expect(screen.getByText(/Fichier invalide/)).toBeInTheDocument();
    });
  });

  it('navigates to step 2 via "Continuer vers Mappage" button', async () => {
    const { container } = renderWizard();
    uploadFile(container, csvFile('contacts.csv', VALID_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Continuer vers Mappage/));
    expect(
      screen.getByText(/Associer les colonnes du fichier/),
    ).toBeInTheDocument();
    expect(screen.getByText('Nom')).toBeInTheDocument();
    expect(screen.getByText('Prénom')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('step 2 shows select dropdowns for column mapping', async () => {
    const { container } = renderWizard();
    uploadFile(container, csvFile('contacts.csv', VALID_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));

    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(3);
  });

  it('shows email warning when email column is not mapped', async () => {
    const { container } = renderWizard();
    uploadFile(container, csvFile('contacts.csv', NO_EMAIL_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));

    fireEvent.click(
      screen.getByText(/Lancer l'Analyse des Lignes/),
    );

    expect(screen.getByText(/Aucune colonne e-mail/)).toBeInTheDocument();
    expect(
      screen.getByText(/Générer automatiquement/),
    ).toBeInTheDocument();
  });

  it('auto-generate emails option proceeds to step 3', async () => {
    const { container } = renderWizard();
    uploadFile(container, csvFile('contacts.csv', NO_EMAIL_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));
    fireEvent.click(
      screen.getByText(/Lancer l'Analyse des Lignes/),
    );

    fireEvent.click(screen.getByText(/Générer automatiquement/));

    await waitFor(() => {
      expect(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      ).toBeInTheDocument();
    });
  });

  it('proceeds to step 3 with analyzed candidates', async () => {
    const { container } = renderWizard();
    uploadFile(container, csvFile('contacts.csv', TWO_ROW_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));
    fireEvent.click(
      screen.getByText(/Lancer l'Analyse des Lignes/),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      ).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Paul Martin')).toBeInTheDocument();
  });

  it('marks candidates as duplicate when apiFetch returns DUPLICATE status', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      data: {
        preview: [
          {
            status: 'DUPLICATE',
            existingContactId: 'c1',
            inputData: { email: 'jean@existing.com' },
          },
        ],
      },
    });

    const { container } = renderWizard();
    uploadFile(container, csvFile('contacts.csv', DUPLICATE_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));
    fireEvent.click(
      screen.getByText(/Lancer l'Analyse des Lignes/),
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Doublon/).length).toBeGreaterThan(0);
    });
    expect(
      screen.getByText(/Tout Mettre à jour/),
    ).toBeInTheDocument();
  });

  it('filters candidates by status using filter buttons', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      data: {
        preview: [
          {
            status: 'DUPLICATE',
            existingContactId: 'c1',
            inputData: { email: 'jean@existing.com' },
          },
        ],
      },
    });

    const { container } = renderWizard();
    uploadFile(
      container,
      csvFile(
        'contacts.csv',
        'Nom,Prénom,Email\nDupont,Jean,jean@existing.com\nMartin,Paul,paul@x.fr',
      ),
    );

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));
    fireEvent.click(
      screen.getByText(/Lancer l'Analyse des Lignes/),
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Jean Dupont')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Doublons/ }));
    expect(screen.getByDisplayValue('Jean Dupont')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Paul Martin')).not.toBeInTheDocument();
  });

  it('executes import and advances to step 4 with summary', async () => {
    const { container } = renderWizard(onImport);
    uploadFile(container, csvFile('contacts.csv', TWO_ROW_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));
    fireEvent.click(
      screen.getByText(/Lancer l'Analyse des Lignes/),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByText(/Confirmer et Exécuter l'Importation/),
    );

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Importation Terminée avec Succès/),
      ).toBeInTheDocument();
    });

    const [newContacts, updatedContacts] = onImport.mock.calls[0];
    expect(newContacts).toHaveLength(2);
    expect(updatedContacts).toHaveLength(0);
  });

  it('displays import error when onImportContacts fails', async () => {
    onImport.mockResolvedValue({
      ok: false,
      httpStatus: 500,
      status: 'ERROR',
      errorMessage: 'Erreur serveur interne',
      data: null,
    });

    const { container } = renderWizard(onImport);
    uploadFile(container, csvFile('contacts.csv', VALID_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));
    fireEvent.click(
      screen.getByText(/Lancer l'Analyse des Lignes/),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByText(/Confirmer et Exécuter l'Importation/),
    );

    await waitFor(() => {
      expect(screen.getByText(/Échec de l'importation/)).toBeInTheDocument();
    });
    expect(screen.getByText('Erreur serveur interne')).toBeInTheDocument();
  });

  it('resets wizard to step 1 from step 4 via "Importer un nouveau fichier"', async () => {
    const { container } = renderWizard();
    uploadFile(container, csvFile('contacts.csv', VALID_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));
    fireEvent.click(
      screen.getByText(/Lancer l'Analyse des Lignes/),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByText(/Confirmer et Exécuter l'Importation/),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Importation Terminée avec Succès/),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Importer un nouveau fichier/));

    await waitFor(() => {
      expect(
        screen.getByText(/Étape 1 : Sélectionner le fichier/),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Importation Terminée/)).not.toBeInTheDocument();
  });

  it('navigates back from step 2 to step 1 via "Changer de fichier"', async () => {
    const { container } = renderWizard();
    uploadFile(container, csvFile('contacts.csv', VALID_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));
    expect(
      screen.getByText(/Associer les colonnes du fichier/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Changer de fichier/));
    expect(
      screen.getByText(/Étape 1 : Sélectionner le fichier/),
    ).toBeInTheDocument();
  });

  it('navigates back from step 3 to step 2', async () => {
    const { container } = renderWizard();
    uploadFile(container, csvFile('contacts.csv', VALID_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));
    fireEvent.click(
      screen.getByText(/Lancer l'Analyse des Lignes/),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Modifier le mappage des colonnes/));
    expect(
      screen.getByText(/Associer les colonnes du fichier/),
    ).toBeInTheDocument();
  });

  it('replaces file via "Remplacer" button on file info card', async () => {
    const { container } = renderWizard();
    uploadFile(container, csvFile('contacts.csv', VALID_CSV));

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Remplacer/));

    await waitFor(() => {
      expect(
        screen.getByText(/Étape 1 : Sélectionner le fichier/),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText('contacts.csv')).not.toBeInTheDocument();
  });

  it('skips invalid candidates during import', async () => {
    const { container } = renderWizard(onImport);
    uploadFile(
      container,
      csvFile(
        'contacts.csv',
        'Nom,Prénom,Email\nDupont,Jean,jean@x.fr\n,Bad,not-an-email',
      ),
    );

    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Continuer vers Mappage/));
    fireEvent.click(
      screen.getByText(/Lancer l'Analyse des Lignes/),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByText(/Confirmer et Exécuter l'Importation/),
    );

    await waitFor(() => {
      expect(onImport).toHaveBeenCalled();
    });
    const [newContacts] = onImport.mock.calls[0];
    expect(newContacts).toHaveLength(1);
    expect(newContacts[0].email).toBe('jean@x.fr');
  });

  describe('Analysis edge cases', () => {
    it('falls back to local contacts when the bulk preview request fails', async () => {
      mockedApiFetch.mockRejectedValueOnce(new Error('réseau indisponible'));
      const { container } = renderWizard();
      await analyzeCsv(container, DUPLICATE_CSV);

      expect(screen.getAllByText(/Doublon/).length).toBeGreaterThan(0);
    });

    it('splits a full-name-only column into first and last name at import', async () => {
      const { container } = renderWizard(onImport);
      await analyzeCsv(container, 'Nom complet,Email\nJean Dupont,jean@x.fr');

      fireEvent.click(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      );
      await waitFor(() => expect(onImport).toHaveBeenCalled());

      const [newContacts] = onImport.mock.calls[0];
      expect(newContacts[0].firstName).toBe('Jean');
      expect(newContacts[0].lastName).toBe('Dupont');
      expect(newContacts[0].name).toBe('Jean Dupont');
    });

    it('derives a display name from the email when no name column exists', async () => {
      const { container } = renderWizard();
      await analyzeCsv(container, 'Email\njean@x.fr');

      expect(screen.getByDisplayValue('jean')).toBeInTheDocument();
    });

    it('flags rows without identifiers as invalid and builds a placeholder name', async () => {
      const { container } = renderWizard();
      await analyzeCsv(container, 'Email,Téléphone\n,0612345678');

      expect(screen.getByDisplayValue(/Contact #2/)).toBeInTheDocument();
      expect(
        screen.getByText('Identifiant manquant (E-mail ou Nom absent)'),
      ).toBeInTheDocument();
    });

    it('normalizes gender, country codes and career stages', async () => {
      const { container } = renderWizard();
      await analyzeCsv(
        container,
        'Nom,Prénom,Email,Genre,Pays,Stade\nDupont,Jean,j@x.fr,F,MA,R2\nMartin,Julie,julie@x.fr,Homme,US,R3\nBernard,Paul,paul@x.fr,Autre,,R4',
      );

      expect(
        screen.getByText(`${CAREER_STAGE_LABELS.R2_RECOGNIZED} • Maroc`),
      ).toBeInTheDocument();
      expect(
        screen.getByText(`${CAREER_STAGE_LABELS.R3_ESTABLISHED} • États-Unis`),
      ).toBeInTheDocument();
      expect(
        screen.getByText(`${CAREER_STAGE_LABELS.R4_LEADING} •`),
      ).toBeInTheDocument();
    });
  });

  describe('File drop and keyboard access', () => {
    it('loads a file dragged onto the drop zone', async () => {
      const { container } = renderWizard();
      await waitFor(() => {
        expect(
          screen.getByText(/Étape 1 : Sélectionner le fichier/),
        ).toBeInTheDocument();
      });

      const zone = screen.getByRole('button', {
        name: 'Choisir un fichier de contacts',
      });
      fireEvent.drop(zone, {
        dataTransfer: { files: [csvFile('contacts.csv', TWO_ROW_CSV)] },
      });

      await waitFor(() => {
        expect(screen.getByText('contacts.csv')).toBeInTheDocument();
      });
      expect(screen.getByText(/2 lignes valides/)).toBeInTheDocument();
    });

    it('opens the file picker via Enter and Space on the drop zone', () => {
      renderWizard();
      const zone = screen.getByRole('button', {
        name: 'Choisir un fichier de contacts',
      });

      fireEvent.keyDown(zone, { key: 'Enter' });
      fireEvent.keyDown(zone, { key: ' ' });

      expect(
        screen.getByText(/Étape 1 : Sélectionner le fichier/),
      ).toBeInTheDocument();
    });

    it('does nothing when a drop carries no file', () => {
      renderWizard();
      const zone = screen.getByRole('button', {
        name: 'Choisir un fichier de contacts',
      });

      fireEvent.drop(zone, { dataTransfer: { files: [] } });

      expect(
        screen.getByText(/Étape 1 : Sélectionner le fichier/),
      ).toBeInTheDocument();
    });
  });

  describe('Stepper navigation', () => {
    it('navigates between steps via the stepper circles', async () => {
      const { container } = renderWizard(onImport);
      uploadFile(container, csvFile('contacts.csv', VALID_CSV));
      await waitFor(() => {
        expect(screen.getByText('contacts.csv')).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByTitle("Aller à l'étape 2 (Mappage des colonnes)"),
      );
      expect(
        screen.getByText(/Associer les colonnes du fichier/),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByTitle(
          "Aller à l'étape 3 (Analyse et résolution des conflits)",
        ),
      );
      await waitFor(() => {
        expect(
          screen.getByText(/Confirmer et Exécuter l'Importation/),
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByTitle(
          "Aller à l'étape 3 (Analyse et résolution des conflits)",
        ),
      );
      expect(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      );
      await waitFor(() => {
        expect(
          screen.getByText(/Importation Terminée avec Succès/),
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByTitle("Aller à l'étape 1 (Chargement du fichier)"),
      );
      expect(
        screen.getByText(/Étape 1 : Sélectionner le fichier/),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByTitle("Rapport d'importation final"));
      expect(
        screen.getByText(/Importation Terminée avec Succès/),
      ).toBeInTheDocument();
    });

    it('warns via the stepper when the email column is not mapped', async () => {
      const { container } = renderWizard();
      uploadFile(container, csvFile('n.csv', NO_EMAIL_CSV));

      await waitFor(() => {
        expect(screen.getByText('n.csv')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Continuer vers Mappage/));
      fireEvent.click(
        screen.getByTitle(
          "Aller à l'étape 3 (Analyse et résolution des conflits)",
        ),
      );

      expect(
        screen.getByText(/Aucune colonne e-mail détectée/),
      ).toBeInTheDocument();
    });
  });

  describe('Column mapping edits', () => {
    it('enforces mutual exclusion when remapping columns', async () => {
      const { container } = renderWizard();
      uploadFile(container, csvFile('contacts.csv', 'Email,Prénom,Nom\njean@x.fr,Jean,Dupont'));

      await waitFor(() => {
        expect(screen.getByText('contacts.csv')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText(/Continuer vers Mappage/));
      await waitFor(() => {
        expect(
          screen.getByText(/Associer les colonnes du fichier/),
        ).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      const emailBox = selects[0];
      const prenomBox = selects[1];
      const nomBox = selects[2];
      expect(emailBox).toHaveValue('email');
      expect(prenomBox).toHaveValue('firstName');
      expect(nomBox).toHaveValue('lastName');

      fireEvent.change(emailBox, { target: { value: 'fullName' } });
      expect(prenomBox).toHaveValue('__ignore__');
      expect(nomBox).toHaveValue('__ignore__');

      fireEvent.change(prenomBox, { target: { value: 'firstName' } });
      expect(emailBox).toHaveValue('__ignore__');

      fireEvent.change(nomBox, { target: { value: 'firstName' } });
      expect(prenomBox).toHaveValue('__ignore__');
      expect(nomBox).toHaveValue('firstName');
    });

    it('clears analyzed candidates when the mapping is changed', async () => {
      const { container } = renderWizard();
      await analyzeCsv(container, VALID_CSV);

      fireEvent.click(screen.getByText(/Modifier le mappage des colonnes/));
      await waitFor(() => {
        expect(
          screen.getByText(/Associer les colonnes du fichier/),
        ).toBeInTheDocument();
      });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[2], { target: { value: '__ignore__' } });
      fireEvent.change(selects[2], { target: { value: 'email' } });

      fireEvent.click(screen.getByText(/Lancer l'Analyse des Lignes/));
      await waitFor(() => {
        expect(
          screen.getByText(/Confirmer et Exécuter l'Importation/),
        ).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue('Jean Dupont')).toBeInTheDocument();
    });
  });

  describe('Candidate resolution and inline edits', () => {
    it('re-evaluates validity and identity when fields are edited inline', async () => {
      const { container } = renderWizard(onImport);
      await analyzeCsv(container, TWO_ROW_CSV);

      const jeanName = screen.getByDisplayValue('Jean Dupont') as HTMLInputElement;
      const jeanEmail = screen.getByDisplayValue('jean@x.fr') as HTMLInputElement;

      fireEvent.change(jeanEmail, { target: { value: 'jean@invalide' } });
      expect(screen.getByText('Format e-mail invalide')).toBeInTheDocument();

      fireEvent.change(jeanEmail, { target: { value: '' } });
      fireEvent.change(jeanName, { target: { value: '' } });
      expect(screen.getByText('Identifiant manquant')).toBeInTheDocument();

      fireEvent.change(jeanName, { target: { value: 'Marie Curie' } });
      fireEvent.change(jeanEmail, { target: { value: 'marie@x.fr' } });

      fireEvent.click(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      );
      await waitFor(() => expect(onImport).toHaveBeenCalled());

      const [newContacts] = onImport.mock.calls[0];
      const marie = newContacts.find((c: Contact) => c.email === 'marie@x.fr');
      expect(marie).toBeDefined();
      expect(marie!.firstName).toBe('Marie');
      expect(marie!.lastName).toBe('Curie');
    });

    it('marks an edited candidate as a server duplicate and upgrades skip to overwrite', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        data: {
          preview: [
            {
              status: 'DUPLICATE',
              existingContactId: 'c1',
              inputData: { email: 'jean@existing.com' },
            },
          ],
        },
      });

      const { container } = renderWizard();
      await analyzeCsv(
        container,
        'Nom,Prénom,Email\nDupont,Jean,jean@existing.com\nMartin,Paul,paul@x.fr',
      );

      const rows = Array.from(
        container.querySelectorAll('tbody tr'),
      ) as HTMLElement[];
      const jeanRow = rows[0];
      const paulRow = rows[1];

      const paulEmail = paulRow.querySelector<HTMLInputElement>(
        'input[placeholder="email@domaine.org"]',
      );
      const paulSelect = paulRow.querySelector<HTMLSelectElement>('select');

      fireEvent.change(paulSelect!, { target: { value: 'skip' } });
      fireEvent.change(paulEmail!, { target: { value: 'jean@existing.com' } });

      expect(paulSelect!.value).toBe('overwrite');
      expect(within(jeanRow).getByText('Doublon')).toBeInTheDocument();
      expect(within(paulRow).getByText('Doublon')).toBeInTheDocument();
      expect(within(jeanRow).getByText(/→/)).toBeInTheDocument();
    });

    it('applies bulk duplicate actions and imports duplicates as merged updates', async () => {
      mockedApiFetch.mockResolvedValueOnce({
        data: {
          preview: [
            {
              status: 'DUPLICATE',
              existingContactId: 'c1',
              inputData: { email: 'jean@existing.com' },
            },
          ],
        },
      });
      onImport.mockResolvedValue({
        ok: true,
        httpStatus: 200,
        status: 'SUCCESS',
        errorMessage: '',
        data: { createdCount: 0, updatedCount: 1, errors: [] },
      });

      const { container } = renderWizard(onImport);
      await analyzeCsv(container, DUPLICATE_CSV);

      fireEvent.click(screen.getByText(/Tout Ignorer/));
      expect(
        screen.getByRole('button', { name: /Confirmer et Exécuter/ }),
      ).toBeDisabled();

      fireEvent.click(screen.getByText(/Tout Mettre à jour/));
      expect(
        screen.getByRole('button', { name: /Confirmer et Exécuter/ }),
      ).not.toBeDisabled();

      fireEvent.click(screen.getByText(/Tout Mettre à jour/));
      fireEvent.click(
        screen.getByRole('button', { name: /Confirmer et Exécuter/ }),
      );

      await waitFor(() => expect(onImport).toHaveBeenCalled());
      const [newContacts, updatedContacts] = onImport.mock.calls[0];
      expect(newContacts).toHaveLength(0);
      expect(updatedContacts).toHaveLength(1);
      expect(updatedContacts[0].email).toBe('jean@existing.com');
      expect(updatedContacts[0].tags).toContain('Mis à jour');
      expect(updatedContacts[0].tags).toContain('Importé');

      await waitFor(() => {
        expect(
          screen.getByText(/Importation Terminée avec Succès/),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Error report', () => {
    it('shows server errors in the report and downloads the error log', async () => {
      const originalCreateObjectURL = (URL as any).createObjectURL;
      (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:fake');
      try {

      onImport.mockResolvedValue({
        ok: true,
        httpStatus: 200,
        status: 'SUCCESS',
        errorMessage: '',
        data: {
          createdCount: 1,
          updatedCount: 0,
          errors: [{ row: 2, message: 'Doublon signalé par le serveur' }],
        },
      });

      const { container } = renderWizard(onImport);
      await analyzeCsv(container, TWO_ROW_CSV);

      fireEvent.click(
        screen.getByText(/Confirmer et Exécuter l'Importation/),
      );
      await waitFor(() => {
        expect(
          screen.getByText(/Importation Terminée avec Succès/),
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByText(/Télécharger le rapport des erreurs/),
      );
      await waitFor(() => {
        expect((URL as any).createObjectURL).toHaveBeenCalled();
      });
      } finally {
        (URL as any).createObjectURL = originalCreateObjectURL;
      }
    });
  });
});
