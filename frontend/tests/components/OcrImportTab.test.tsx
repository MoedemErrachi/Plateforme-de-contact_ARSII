import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ToastProvider } from '../../src/components/Toast';
import { OcrImportTab } from '../../src/components/OcrImportTab';

vi.mock('../../src/services/api', () => ({
  apiFetch: vi.fn(),
  OCR_TIMEOUT_MS: 90000,
  isServiceUnreachable: (err: any) =>
    err?.kind === 'network' || err?.kind === 'timeout' || err?.kind === 'server',
}));

vi.mock('../../src/utils/upload', () => ({
  uploadImage: vi.fn().mockResolvedValue('/api/uploads/avatar/test.jpg'),
}));

import { apiFetch } from '../../src/services/api';
import { uploadImage } from '../../src/utils/upload';
const mockedApiFetch = vi.mocked(apiFetch);
const mockedUploadImage = vi.mocked(uploadImage);

const OCR_SUCCESS = {
  extracted: {
    firstName: { value: 'Marie', confidence: 'high' as const },
    lastName: { value: 'Curie', confidence: 'high' as const },
    email: { value: 'marie@lab.fr', confidence: 'medium' as const },
    phone: { value: '+3312345678', confidence: 'medium' as const },
    affiliation: { value: 'CNRS', confidence: 'high' as const },
    function: { value: 'Directrice', confidence: 'medium' as const },
    city: { value: 'Paris', confidence: 'high' as const },
    countryOfOrigin: { value: 'France', confidence: 'low' as const },
  },
  photoUrl: null,
  sourceProvider: 'Tesseract OCR',
};

const makeSave = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    httpStatus: 200,
    status: 'SUCCESS',
    errorMessage: '',
    data: { createdCount: 1, updatedCount: 0 },
  });

function renderOcr(onSaveContact = makeSave()) {
  const result = render(
    <ToastProvider>
      <OcrImportTab onSaveContact={onSaveContact} />
    </ToastProvider>,
  );
  return { ...result, onSaveContact };
}

function uploadImageFile(container: HTMLElement, file: File) {
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  Object.defineProperty(input, 'files', {
    value: [file],
    configurable: true,
  });
  fireEvent.change(input);
}

const IMAGE_FILE = new File(['fake-image-data'], 'card.jpg', {
  type: 'image/jpeg',
});

const LARGE_FILE = new File(
  [new ArrayBuffer(11 * 1024 * 1024)],
  'huge.jpg',
  { type: 'image/jpeg' },
);

describe('OcrImportTab', () => {
  beforeAll(() => {
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn().mockReturnValue('blob:test-image'),
        configurable: true,
        writable: true,
      });
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: vi.fn(),
        configurable: true,
        writable: true,
      });
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiFetch.mockResolvedValue(OCR_SUCCESS);
    mockedUploadImage.mockResolvedValue('/api/uploads/avatar/test.jpg');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders file drop zone with camera icon and instructions', () => {
    renderOcr();
    expect(
      screen.getByRole('button', { name: /Importer une photo de carte de visite/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Glissez-déposez une photo/),
    ).toBeInTheDocument();
    expect(screen.getByText(/JPEG, PNG ou WebP/)).toBeInTheDocument();
  });

  it('shows image preview and extract button after file selection', () => {
    const { container } = renderOcr();
    uploadImageFile(container, IMAGE_FILE);

    expect(screen.getByText('card.jpg')).toBeInTheDocument();
    expect(screen.getByText(/Extraire les données/)).toBeInTheDocument();
    expect(screen.getByAltText('Carte de visite')).toBeInTheDocument();
  });

  it('calls OCR API on extract and displays editable fields', async () => {
    const { container } = renderOcr();
    uploadImageFile(container, IMAGE_FILE);

    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        '/chatbot-api/api/ocr/extract',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marie')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('Curie')).toBeInTheDocument();
    expect(screen.getByDisplayValue('marie@lab.fr')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CNRS')).toBeInTheDocument();
    expect(screen.getByText('Tesseract OCR')).toBeInTheDocument();
  });

  it('shows confidence labels on extracted fields', async () => {
    const { container } = renderOcr();
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getAllByText('Fiable').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Incertain').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Peu fiable').length).toBeGreaterThan(0);
  });

  it('allows editing extracted fields', async () => {
    const { container } = renderOcr();
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marie')).toBeInTheDocument();
    });

    const firstNameInput = screen.getByDisplayValue('Marie');
    fireEvent.change(firstNameInput, { target: { value: 'Marie-Claire' } });
    expect(firstNameInput).toHaveValue('Marie-Claire');
  });

  it('calls onSaveContact with constructed contact on save', async () => {
    const onSave = makeSave();
    const { container } = renderOcr(onSave);
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marie')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Enregistrer le contact/));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    const contact = onSave.mock.calls[0][0][0];
    expect(contact.firstName).toBe('Marie');
    expect(contact.lastName).toBe('Curie');
    expect(contact.email).toBe('marie@lab.fr');
    expect(contact.affiliation).toBe('CNRS');
  });

  it('shows success state on save button after successful save', async () => {
    const { container } = renderOcr();
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marie')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Enregistrer le contact/));

    await waitFor(() => {
      expect(screen.getByText(/Enregistré/)).toBeInTheDocument();
    });
  });

  it('resets form via "Scanner une autre carte"', async () => {
    const { container } = renderOcr();
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marie')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Scanner une autre carte/));

    expect(
      screen.getByRole('button', { name: /Importer une photo de carte de visite/ }),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Marie')).not.toBeInTheDocument();
  });

  it('shows toast error for oversized file', async () => {
    const { container } = renderOcr();
    uploadImageFile(container, LARGE_FILE);

    await waitFor(() => {
      expect(
        screen.getByText(/Fichier trop volumineux/),
      ).toBeInTheDocument();
    });
  });

  it('hides save button and shows drop zone after reset from preview', () => {
    const { container } = renderOcr();
    uploadImageFile(container, IMAGE_FILE);

    expect(screen.getByText(/Extraire les données/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Annuler/));

    expect(
      screen.getByRole('button', { name: /Importer une photo de carte de visite/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Extraire les données/),
    ).not.toBeInTheDocument();
  });

  it('accepts a dropped image file', () => {
    renderOcr();
    const dropzone = screen.getByRole('button', {
      name: /Importer une photo de carte de visite/,
    });
    fireEvent.drop(dropzone, { dataTransfer: { files: [IMAGE_FILE] } });

    expect(screen.getByText('card.jpg')).toBeInTheDocument();
    expect(screen.getByText(/Extraire les données/)).toBeInTheDocument();
  });

  it('handles dragover of the drop zone without crashing', () => {
    renderOcr();
    const dropzone = screen.getByRole('button', {
      name: /Importer une photo de carte de visite/,
    });
    expect(() =>
      fireEvent.dragOver(dropzone),
    ).not.toThrow();
  });

  it('opens the file picker when the drop zone is clicked or activated by keyboard', () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {});
    renderOcr();
    const dropzone = screen.getByRole('button', {
      name: /Importer une photo de carte de visite/,
    });

    fireEvent.click(dropzone);
    fireEvent.keyDown(dropzone, { key: 'Enter' });
    fireEvent.keyDown(dropzone, { key: ' ' });

    expect(clickSpy).toHaveBeenCalledTimes(3);
    clickSpy.mockRestore();
  });

  it('shows an error toast when extraction fails with a business error', async () => {
    mockedApiFetch.mockRejectedValueOnce(new Error('Extraction impossible'));
    const { container } = renderOcr();
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getByText(/Extraction impossible/)).toBeInTheDocument();
    });
    // Still waiting to retry, drop zone not shown
    expect(screen.getByText(/Extraire les données/)).toBeInTheDocument();
  });

  it('does not show a toast when the OCR service is unreachable', async () => {
    mockedApiFetch.mockRejectedValueOnce({
      kind: 'network',
      message: 'net',
    });
    const { container } = renderOcr();
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(
        screen.getByText(/Extraire les données/),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/net/)).not.toBeInTheDocument();
  });

  it('does not call onSaveContact when no identifiable fields remain', async () => {
    const onSave = makeSave();
    const { container } = renderOcr(onSave);
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marie')).toBeInTheDocument();
    });

    ['Marie', 'Curie', 'marie@lab.fr'].forEach((val) => {
      fireEvent.change(screen.getByDisplayValue(val), { target: { value: '' } });
    });

    fireEvent.click(screen.getByText(/Enregistrer le contact/));

    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('keeps the button disabled and showing "Enregistrement..." while saving', async () => {
    let resolveSave: (v: unknown) => void;
    const onSave = vi.fn().mockReturnValue(
      new Promise((res) => {
        resolveSave = res;
      }),
    ) as ReturnType<typeof makeSave>;
    const { container } = renderOcr(onSave);
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marie')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Enregistrer le contact/));

    await waitFor(() => {
      expect(screen.getByText(/Enregistrement\.\.\./)).toBeInTheDocument();
    });
    const saveBtn = screen.getByText(/Enregistrement\.\.\./);
    expect(saveBtn).toBeDisabled();

    await act(async () => {
      resolveSave!({
        ok: true,
        httpStatus: 200,
        status: 'SUCCESS',
        errorMessage: '',
        data: { createdCount: 1, updatedCount: 0 },
      });
    });
  });

  it('displays the detected photo when photoUrl is returned by the service', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      extracted: OCR_SUCCESS.extracted,
      photoUrl: '/uploads/photo.jpg',
      sourceProvider: 'Tesseract OCR',
    });
    const { container } = renderOcr();
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(
        screen.getByText(/Photo de profil détectée automatiquement/),
      ).toBeInTheDocument();
    });
    expect(screen.getByAltText('Visage détecté')).toBeInTheDocument();
  });

  it('passes the prefixed photo avatar when saving with a detected photoUrl', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      extracted: OCR_SUCCESS.extracted,
      photoUrl: '/uploads/photo.jpg',
      sourceProvider: 'Tesseract OCR',
    });
    const onSave = makeSave();
    const { container } = renderOcr(onSave);
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marie')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Enregistrer le contact/));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave.mock.calls[0][0][0].avatarUrl).toBe(
      '/chatbot-api/uploads/photo.jpg',
    );
  });

  it('allows manual cropping: opens crop mode, moves frame, applies and undoes the crop', async () => {
    class FakeImage {
      naturalWidth = 100;
      naturalHeight = 100;
      onload: (() => void) | null = null;
      set src(_v: string) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    }
    const previousImage = (globalThis as any).Image;
    vi.stubGlobal('Image', FakeImage);
    const ctx = { drawImage: vi.fn() };
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const toDataURLSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,cropped');

    const onSave = makeSave();
    const { container } = renderOcr(onSave);
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marie')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Recadrer manuellement/));
    expect(
      screen.getByText(/Déplacez et redimensionnez/),
    ).toBeInTheDocument();

    const frame = screen.getByRole('button', {
      name: /Cadre de recadrage/,
    });
    fireEvent.keyDown(frame, { key: 'ArrowRight' });
    fireEvent.keyDown(frame, { key: 'ArrowUp', shiftKey: true });
    // A non-arrow key is ignored by the crop frame handler
    fireEvent.keyDown(frame, { key: 'a' });

    const resizeHandle = screen.getByRole('button', {
      name: /Redimensionner le cadre/,
    });
    fireEvent.keyDown(resizeHandle, { key: 'ArrowDown' });

    fireEvent.mouseDown(frame, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 10, clientY: 5 });
    fireEvent.mouseUp(document);

    fireEvent.mouseDown(resizeHandle, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 20, clientY: 10 });
    fireEvent.mouseUp(document);

    fireEvent.click(screen.getByText(/Appliquer le recadrage/));

    await waitFor(() => {
      expect(
        screen.getByText(/Photo recadrée manuellement/),
      ).toBeInTheDocument();
    });
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(toDataURLSpy).toHaveBeenCalled();

    // Saving with a manual crop uploads the cropped preview
    fireEvent.click(screen.getByText(/Enregistrer le contact/));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave.mock.calls[0][0][0].avatarUrl).toBe(
      '/api/uploads/avatar/test.jpg',
    );
    expect(mockedUploadImage).toHaveBeenCalledWith(
      'data:image/jpeg;base64,cropped',
    );

    // Undo the manual crop
    fireEvent.click(screen.getByText(/Annuler le recadrage/));
    await waitFor(() => {
      expect(screen.getByText(/Aucune photo détectée/)).toBeInTheDocument();
    });

    // Exit crop mode entirely via the in-crop "Annuler" button
    fireEvent.click(screen.getByText(/Recadrer manuellement/));
    const cancelButtons = screen
      .getAllByText(/Annuler/)
      .filter((el) => el.tagName === 'BUTTON');
    fireEvent.click(cancelButtons[0]);
    expect(
      screen.queryByText(/Déplacez et redimensionnez/),
    ).not.toBeInTheDocument();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    (globalThis as any).Image = previousImage;
  });

  it('saves with a null avatar when the cropped photo upload fails', async () => {
    class ReadyImage {
      naturalWidth = 100;
      naturalHeight = 100;
      onload: (() => void) | null = null;
      set src(_v: string) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    }
    const previousImage = (globalThis as any).Image;
    vi.stubGlobal('Image', ReadyImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,cropped',
    );
    mockedUploadImage.mockRejectedValueOnce(new Error('upload failed'));

    const onSave = makeSave();
    const { container } = renderOcr(onSave);
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marie')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Recadrer manuellement/));
    fireEvent.click(screen.getByText(/Appliquer le recadrage/));

    await waitFor(() => {
      expect(
        screen.getByText(/Photo recadrée manuellement/),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Enregistrer le contact/));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(mockedUploadImage).toHaveBeenCalledWith(
      'data:image/jpeg;base64,cropped',
    );
    expect(onSave.mock.calls[0][0][0].avatarUrl).toBeNull();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    (globalThis as any).Image = previousImage;
  });

  it('shows an error toast when applying a crop fails to load the image', async () => {
    class FailingImage {
      onerror: (() => void) | null = null;
      set src(_v: string) {
        setTimeout(() => this.onerror && this.onerror(), 0);
      }
    }
    vi.stubGlobal('Image', FailingImage);

    const { container } = renderOcr();
    uploadImageFile(container, IMAGE_FILE);
    fireEvent.click(screen.getByText(/Extraire les données/));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marie')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Recadrer manuellement/));
    fireEvent.click(screen.getByText(/Appliquer le recadrage/));

    await waitFor(() => {
      expect(screen.getByText(/Échec du recadrage\./)).toBeInTheDocument();
    });
    // Crop mode is still active after failure
    expect(
      screen.getByText(/Déplacez et redimensionnez/),
    ).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
