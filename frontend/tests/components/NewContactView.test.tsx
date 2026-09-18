import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../../src/components/Toast';
import { NewContactView } from '../../src/components/NewContactView';
import { Contact, Tag } from '../../src/types';

vi.mock('../../src/services/api', () => ({
  isServiceUnreachable: vi.fn(() => false),
}));

vi.mock('../../src/utils/upload', () => ({
  validateImageFile: vi.fn(() => null),
  uploadImage: vi.fn().mockResolvedValue('https://img.test/avatar.png'),
  readFileAsDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,abc'),
}));

import { isServiceUnreachable } from '../../src/services/api';
import { validateImageFile, uploadImage, readFileAsDataUrl } from '../../src/utils/upload';

const existingContact: Contact = {
  id: 'c1',
  firstName: 'Amina',
  lastName: 'Benali',
  name: 'Amina Benali',
  initials: 'AB',
  email: 'amina@univ.ma',
  gender: 'FEMALE',
  countryOfOrigin: 'Maroc',
  city: 'Rabat',
  phone: '+212600000000',
  affiliation: 'UM5',
  function: 'Professeure',
  experience: '15 ans',
  facultyDepartment: 'Sciences',
  researchCareerStage: 'R3_ESTABLISHED',
  avatarUrl: null,
  tags: ['IA'],
};

const sampleTags: Tag[] = [
  { id: 't1', name: 'IA', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 't2', name: 'Santé', color: 'bg-green-100 text-green-700 border-green-200' },
];

function renderCreate(overrides: Partial<React.ComponentProps<typeof NewContactView>> = {}) {
  const onAddContact = vi.fn().mockResolvedValue(undefined);
  const result = render(
    <MemoryRouter initialEntries={['/contacts/new']}>
      <Routes>
        <Route
          path="/contacts/new"
          element={
            <ToastProvider>
              <NewContactView
                onAddContact={onAddContact}
                tags={overrides.tags ?? sampleTags}
                existingContacts={overrides.existingContacts ?? []}
              />
            </ToastProvider>
          }
        />
        <Route path="/contacts" element={<div>Contacts list</div>} />
        <Route path="/contacts/:id/edit" element={<div>Edit page</div>} />
      </Routes>
    </MemoryRouter>
  );
  return { ...result, onAddContact };
}

function renderEdit(contact: Contact = existingContact) {
  const onUpdateContact = vi.fn().mockResolvedValue(undefined);
  const result = render(
    <MemoryRouter initialEntries={[`/contacts/${contact.id}/edit`]}>
      <Routes>
        <Route
          path="/contacts/:id/edit"
          element={
            <ToastProvider>
              <NewContactView
                onAddContact={vi.fn()}
                onUpdateContact={onUpdateContact}
                existingContacts={[contact]}
                tags={sampleTags}
              />
            </ToastProvider>
          }
        />
        <Route path="/contacts" element={<div>Contacts list</div>} />
        <Route path="/contacts/new" element={<div>New page</div>} />
      </Routes>
    </MemoryRouter>
  );
  return { ...result, onUpdateContact };
}

describe('NewContactView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (validateImageFile as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (uploadImage as ReturnType<typeof vi.fn>).mockResolvedValue('https://img.test/avatar.png');
    (readFileAsDataUrl as ReturnType<typeof vi.fn>).mockResolvedValue('data:image/png;base64,abc');
    (isServiceUnreachable as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('displays create-mode heading and breadcrumb', () => {
    renderCreate();
    expect(screen.getByRole('heading', { name: 'Ajouter un expert au réseau' })).toBeInTheDocument();
    expect(screen.getAllByText('Nouveau Contact').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: 'Contacts' })).toHaveAttribute('href', '/contacts');
  });

  it('displays cancel link and save button in create mode', () => {
    renderCreate();
    expect(screen.getByRole('link', { name: 'Annuler' })).toHaveAttribute('href', '/contacts');
    expect(screen.getByRole('button', { name: 'Enregistrer le contact' })).toBeInTheDocument();
  });

  it('renders all form section headings', () => {
    renderCreate();
    expect(screen.getByText('Informations Personnelles')).toBeInTheDocument();
    expect(screen.getByText('Localisation')).toBeInTheDocument();
    expect(screen.getByText('Affiliation R&I')).toBeInTheDocument();
    expect(screen.getByText('Étiquettes / Tags')).toBeInTheDocument();
    expect(screen.getByText('Statut du Contact')).toBeInTheDocument();
  });

  it('shows inline validation errors when submitting empty required fields', async () => {
    const { onAddContact } = renderCreate();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));

    expect(await screen.findByText('Prénom requis')).toBeInTheDocument();
    expect(screen.getByText('Nom requis')).toBeInTheDocument();
    expect(screen.getByText('Adresse e-mail requise')).toBeInTheDocument();
    expect(onAddContact).not.toHaveBeenCalled();
  });

  it('shows invalid email error for malformed email', async () => {
    const { onAddContact } = renderCreate();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Prénom *'), 'Test');
    await user.type(screen.getByLabelText('Nom *'), 'User');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));

    expect(await screen.findByText('Adresse e-mail invalide')).toBeInTheDocument();
    expect(onAddContact).not.toHaveBeenCalled();
  });

  it('clears field error on typing into that field', async () => {
    renderCreate();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    expect(await screen.findByText('Prénom requis')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Prénom *'), 'A');
    expect(screen.queryByText('Prénom requis')).not.toBeInTheDocument();
  });

  it('calls onAddContact with correct payload after filling required fields and confirming', async () => {
    const { onAddContact } = renderCreate();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Prénom *'), 'Moussa');
    await user.type(screen.getByLabelText('Nom *'), 'Diop');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'moussa@uni.sn');
    await user.type(screen.getByLabelText('Téléphone'), '+221770000000');

    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));

    const confirmBtn = await screen.findByRole('button', { name: 'Créer le contact' });
    expect(screen.getByText('Confirmer la création')).toBeInTheDocument();

    await user.click(confirmBtn);

    await waitFor(() => {
      expect(onAddContact).toHaveBeenCalledTimes(1);
    });

    const payload = onAddContact.mock.calls[0][0];
    expect(payload.firstName).toBe('Moussa');
    expect(payload.lastName).toBe('Diop');
    expect(payload.email).toBe('moussa@uni.sn');
    expect(payload.phone).toBe('+221770000000');
    expect(payload.id).toBe('');
    expect(payload.name).toBe('Moussa Diop');
  });

  it('navigates to /contacts after successful save', async () => {
    const { onAddContact } = renderCreate();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Prénom *'), 'A');
    await user.type(screen.getByLabelText('Nom *'), 'B');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'a@b.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    await user.click(await screen.findByRole('button', { name: 'Créer le contact' }));

    await waitFor(() => {
      expect(screen.getByText('Contacts list')).toBeInTheDocument();
    });
  });

  it('shows confirmation modal title for create mode', async () => {
    renderCreate();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Prénom *'), 'X');
    await user.type(screen.getByLabelText('Nom *'), 'Y');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'x@y.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));

    expect(await screen.findByText('Confirmer la création')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer le contact' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  });

  it('closes confirmation modal when cancel is clicked', async () => {
    renderCreate();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Prénom *'), 'X');
    await user.type(screen.getByLabelText('Nom *'), 'Y');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'x@y.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    await screen.findByText('Confirmer la création');

    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByText('Confirmer la création')).not.toBeInTheDocument();
  });

  it('detects duplicate email from existingContacts and shows warning', async () => {
    renderCreate({ existingContacts: [{ ...existingContact }] });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email Professionnel *'), 'amina@univ.ma');

    expect(await screen.findByText('Un contact avec cet e-mail existe déjà !')).toBeInTheDocument();
  });

  it('does not show duplicate warning for own email in edit mode', () => {
    renderEdit();
    expect(screen.queryByText('Un contact avec cet e-mail existe déjà !')).not.toBeInTheDocument();
  });

  it('shows edit-mode heading with contact name', () => {
    renderEdit();
    expect(screen.getByRole('heading', { name: /Modifier la fiche de Amina Benali/ })).toBeInTheDocument();
    expect(screen.getByText('Modifier le Contact')).toBeInTheDocument();
  });

  it('pre-fills all fields from existing contact in edit mode', () => {
    renderEdit();
    expect(screen.getByLabelText('Prénom *')).toHaveValue('Amina');
    expect(screen.getByLabelText('Nom *')).toHaveValue('Benali');
    expect(screen.getByLabelText('Email Professionnel *')).toHaveValue('amina@univ.ma');
    expect(screen.getByLabelText('Téléphone')).toHaveValue('+212600000000');
    expect(screen.getByLabelText('Genre')).toHaveValue('FEMALE');
    expect(screen.getByLabelText('Stade de carrière')).toHaveValue('R3_ESTABLISHED');
    expect(screen.getByLabelText('Affiliation (Organisation)')).toHaveValue('UM5');
    expect(screen.getByLabelText('Fonction')).toHaveValue('Professeure');
    expect(screen.getByLabelText('Expérience')).toHaveValue('15 ans');
    expect(screen.getByLabelText('Faculté / Département')).toHaveValue('Sciences');
    expect(screen.getByLabelText('Ville')).toHaveValue('Rabat');
  });

  it('shows "Enregistrer les modifications" button in edit mode', () => {
    renderEdit();
    expect(screen.getByRole('button', { name: 'Enregistrer les modifications' })).toBeInTheDocument();
  });

  it('calls onUpdateContact with updated fields and preserves id in edit mode', async () => {
    const { onUpdateContact } = renderEdit();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText('Fonction'));
    await user.type(screen.getByLabelText('Fonction'), 'Directeur');

    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    const confirmBtn = await screen.findByRole('button', { name: 'Enregistrer' });
    expect(screen.getByText('Confirmer la modification')).toBeInTheDocument();

    await user.click(confirmBtn);

    await waitFor(() => {
      expect(onUpdateContact).toHaveBeenCalledTimes(1);
    });

    const payload = onUpdateContact.mock.calls[0][0];
    expect(payload.id).toBe('c1');
    expect(payload.function).toBe('Directeur');
    expect(payload.firstName).toBe('Amina');
    expect(payload.email).toBe('amina@univ.ma');
  });

  it('shows confirmation modal title for edit mode', async () => {
    renderEdit();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));

    expect(await screen.findByText('Confirmer la modification')).toBeInTheDocument();
    expect(screen.getByText(/Vous êtes sur le point de mettre à jour/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeInTheDocument();
  });

  it('allows changing gender via select', async () => {
    const { onAddContact } = renderCreate();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Genre'), 'MALE');
    expect(screen.getByLabelText('Genre')).toHaveValue('MALE');

    await user.type(screen.getByLabelText('Prénom *'), 'Ali');
    await user.type(screen.getByLabelText('Nom *'), 'Test');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'ali@test.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    await user.click(await screen.findByRole('button', { name: 'Créer le contact' }));

    await waitFor(() => {
      expect(onAddContact).toHaveBeenCalledTimes(1);
    });
    expect(onAddContact.mock.calls[0][0].gender).toBe('MALE');
  });

  it('allows changing career stage via select', async () => {
    const { onAddContact } = renderCreate();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Stade de carrière'), 'R4_LEADING');
    expect(screen.getByLabelText('Stade de carrière')).toHaveValue('R4_LEADING');

    await user.type(screen.getByLabelText('Prénom *'), 'Z');
    await user.type(screen.getByLabelText('Nom *'), 'Z');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'z@z.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    await user.click(await screen.findByRole('button', { name: 'Créer le contact' }));

    await waitFor(() => {
      expect(onAddContact).toHaveBeenCalledTimes(1);
    });
    expect(onAddContact.mock.calls[0][0].researchCareerStage).toBe('R4_LEADING');
  });

  it('toggles tags on and off in the tag multi-select', async () => {
    const { onAddContact } = renderCreate();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'IA' }));
    await user.click(screen.getByRole('button', { name: 'Santé' }));

    await user.type(screen.getByLabelText('Prénom *'), 'Tag');
    await user.type(screen.getByLabelText('Nom *'), 'Test');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'tag@test.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    await user.click(await screen.findByRole('button', { name: 'Créer le contact' }));

    await waitFor(() => {
      expect(onAddContact).toHaveBeenCalledTimes(1);
    });
    expect(onAddContact.mock.calls[0][0].tags).toEqual(['IA', 'Santé']);
  });

  it('removes a tag by clicking it again', async () => {
    const { onAddContact } = renderCreate();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'IA' }));
    await user.click(screen.getByRole('button', { name: 'Santé' }));
    await user.click(screen.getByRole('button', { name: 'IA' }));

    await user.type(screen.getByLabelText('Prénom *'), 'Tag');
    await user.type(screen.getByLabelText('Nom *'), 'Test');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'tag@test.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    await user.click(await screen.findByRole('button', { name: 'Créer le contact' }));

    await waitFor(() => {
      expect(onAddContact).toHaveBeenCalledTimes(1);
    });
    expect(onAddContact.mock.calls[0][0].tags).toEqual(['Santé']);
  });

  it('shows placeholder when no tags are available', () => {
    renderCreate({ tags: [] });
    expect(screen.getByText(/Aucun tag disponible/)).toBeInTheDocument();
  });

  it('disables city field when no country is selected', () => {
    renderCreate();
    expect(screen.getByLabelText('Ville')).toBeDisabled();
  });

  it('enables city field after selecting a country', async () => {
    renderCreate();
    const user = userEvent.setup();

    const countryInput = screen.getByLabelText("Pays d'origine");
    await user.click(countryInput);
    await user.type(countryInput, 'France');

    const franceOption = await screen.findByRole('button', { name: 'France' });
    await user.click(franceOption);

    expect(screen.getByLabelText('Ville')).not.toBeDisabled();
  });

  it('resets city when country changes', async () => {
    renderCreate();
    const user = userEvent.setup();

    const countryInput = screen.getByLabelText("Pays d'origine");
    await user.click(countryInput);
    await user.type(countryInput, 'France');
    await user.click(await screen.findByRole('button', { name: 'France' }));

    await user.type(screen.getByLabelText('Ville'), 'Paris');
    expect(screen.getByLabelText('Ville')).toHaveValue('Paris');

    await user.clear(countryInput);
    await user.type(countryInput, 'Sénégal');
    await user.click(await screen.findByRole('button', { name: 'Sénégal' }));

    expect(screen.getByLabelText('Ville')).toHaveValue('');
  });

  it('includes country in submitted payload', async () => {
    const { onAddContact } = renderCreate();
    const user = userEvent.setup();

    const countryInput = screen.getByLabelText("Pays d'origine");
    await user.click(countryInput);
    await user.type(countryInput, 'France');
    await user.click(await screen.findByRole('button', { name: 'France' }));

    await user.type(screen.getByLabelText('Prénom *'), 'C');
    await user.type(screen.getByLabelText('Nom *'), 'D');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'c@d.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    await user.click(await screen.findByRole('button', { name: 'Créer le contact' }));

    await waitFor(() => {
      expect(onAddContact).toHaveBeenCalledTimes(1);
    });
    expect(onAddContact.mock.calls[0][0].countryOfOrigin).toBe('France');
  });

  it('shows avatar placeholder initials when no avatarUrl and no name', () => {
    renderCreate();
    expect(screen.getAllByText('NC').length).toBeGreaterThanOrEqual(1);
  });

  it('shows first-letter initials when name is partially filled', async () => {
    renderCreate();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Prénom *'), 'Moussa');
    expect(screen.getAllByText('M').length).toBeGreaterThanOrEqual(1);
  });

  it('uploads a valid image and sets avatarUrl', async () => {
    renderCreate();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(validateImageFile).toHaveBeenCalledWith(file);
    });
    await waitFor(() => {
      expect(readFileAsDataUrl).toHaveBeenCalledWith(file);
    });
    await waitFor(() => {
      expect(uploadImage).toHaveBeenCalledWith('data:image/png;base64,abc');
    });
  });

  it('shows toast error for invalid image file type', async () => {
    (validateImageFile as ReturnType<typeof vi.fn>).mockReturnValue(
      'Format non autorisé. Formats acceptés : PNG, JPEG, WebP.'
    );

    renderCreate();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.gif', { type: 'image/gif' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Format non autorisé. Formats acceptés : PNG, JPEG, WebP.')).toBeInTheDocument();
    });
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('shows error toast when image upload fails with non-service error', async () => {
    (uploadImage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Upload failed'));

    renderCreate();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Erreur d'import de la photo : Upload failed")).toBeInTheDocument();
    });
  });

  it('suppresses toast when upload fails with a service-unreachable error', async () => {
    (isServiceUnreachable as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (uploadImage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network'));

    renderCreate();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(isServiceUnreachable).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Erreur d'import/)).not.toBeInTheDocument();
  });

  it('closes modal and stays on page when onAddContact rejects', async () => {
    const onAddContact = vi.fn().mockRejectedValue(new Error('Server error'));
    render(
      <MemoryRouter initialEntries={['/contacts/new']}>
        <Routes>
          <Route
            path="/contacts/new"
            element={
              <ToastProvider>
                <NewContactView onAddContact={onAddContact} tags={[]} existingContacts={[]} />
              </ToastProvider>
            }
          />
          <Route path="/contacts" element={<div>Contacts list</div>} />
        </Routes>
      </MemoryRouter>
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Prénom *'), 'X');
    await user.type(screen.getByLabelText('Nom *'), 'Y');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'x@y.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    await user.click(await screen.findByRole('button', { name: 'Créer le contact' }));

    await waitFor(() => {
      expect(onAddContact).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByText('Confirmer la création')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Contacts list')).not.toBeInTheDocument();
  });

  it('displays the score de complétude in the sidebar', () => {
    renderCreate();
    expect(screen.getByText('Score de Complétude')).toBeInTheDocument();
  });

  it('displays contact name in the edit form confirmation message', async () => {
    renderEdit();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    await screen.findByText('Confirmer la modification');

    expect(screen.getAllByText('Amina Benali').length).toBeGreaterThanOrEqual(1);
  });

  it('includes location in confirmation message when country is set', async () => {
    renderCreate();
    const user = userEvent.setup();

    const countryInput = screen.getByLabelText("Pays d'origine");
    await user.click(countryInput);
    await user.type(countryInput, 'France');
    await user.click(await screen.findByRole('button', { name: 'France' }));

    await user.type(screen.getByLabelText('Prénom *'), 'X');
    await user.type(screen.getByLabelText('Nom *'), 'Y');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'x@y.com');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));

    await screen.findByText('Confirmer la création');
    expect(screen.getByText(/Localisation : France/)).toBeInTheDocument();
  });

  it('fills optional fields and includes them in the submitted payload', async () => {
    const { onAddContact } = renderCreate();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Prénom *'), 'Full');
    await user.type(screen.getByLabelText('Nom *'), 'Form');
    await user.type(screen.getByLabelText('Email Professionnel *'), 'full@form.com');
    await user.type(screen.getByLabelText('Téléphone'), '+33123456789');
    await user.type(screen.getByLabelText('Affiliation (Organisation)'), 'CNRS');
    await user.type(screen.getByLabelText('Fonction'), 'Chercheur');
    await user.type(screen.getByLabelText('Expérience'), '10 ans');
    await user.type(screen.getByLabelText('Faculté / Département'), 'Informatique');

    await user.click(screen.getByRole('button', { name: 'Enregistrer le contact' }));
    await user.click(await screen.findByRole('button', { name: 'Créer le contact' }));

    await waitFor(() => {
      expect(onAddContact).toHaveBeenCalledTimes(1);
    });

    const payload = onAddContact.mock.calls[0][0];
    expect(payload.phone).toBe('+33123456789');
    expect(payload.affiliation).toBe('CNRS');
    expect(payload.function).toBe('Chercheur');
    expect(payload.experience).toBe('10 ans');
    expect(payload.facultyDepartment).toBe('Informatique');
  });

  it('sidebar shows the profile preview with formatted name', async () => {
    renderCreate();
    expect(screen.getAllByText('Nouveau Contact').length).toBeGreaterThanOrEqual(1);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Prénom *'), 'Preview');
    expect(screen.getAllByText('Preview').length).toBeGreaterThanOrEqual(1);
  });

  it('sidebar shows "Organisation non définie" when affiliation is empty', () => {
    renderCreate();
    expect(screen.getByText('Organisation non définie')).toBeInTheDocument();
  });

  it('sidebar shows affiliation when provided', async () => {
    renderCreate();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Affiliation (Organisation)'), 'MIT');
    expect(screen.getByText('MIT')).toBeInTheDocument();
  });
});
