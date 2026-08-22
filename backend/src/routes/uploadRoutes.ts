import { Router } from 'express';
import crypto from 'crypto';
import { authenticateJWT } from '../middleware/authenticateJWT';
import { supabase } from '../config/supabase';

const router = Router();

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp'
};

/**
 * Detects real image format from magic bytes to prevent MIME spoofing.
 */
function detectImageExt(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

// POST /api/uploads/avatar (Store avatar image in Supabase Storage, return public URL)
router.post('/avatar', authenticateJWT, async (req, res) => {
  const { dataUrl } = req.body || {};

  if (!dataUrl || typeof dataUrl !== 'string') {
    return res.status(400).json({ error: 'Aucune image fournie.', code: 'MISSING_IMAGE' });
  }

  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Format de données image invalide.', code: 'INVALID_IMAGE' });
  }

  const declaredMime = `image/${match[1].toLowerCase()}`;
  const expectedExt = MIME_TO_EXT[declaredMime];
  if (!expectedExt) {
    return res.status(400).json({
      error: 'Format non autorisé. Formats acceptés : PNG, JPEG, WebP.',
      code: 'INVALID_MIME_TYPE'
    });
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) {
    return res.status(400).json({ error: 'Image vide.', code: 'EMPTY_IMAGE' });
  }
  if (buffer.length > MAX_IMAGE_SIZE) {
    return res.status(400).json({
      error: 'Image trop volumineuse. Taille maximale autorisée : 5 Mo.',
      code: 'IMAGE_TOO_LARGE'
    });
  }

  const detectedExt = detectImageExt(buffer);
  if (!detectedExt || detectedExt !== expectedExt) {
    return res.status(400).json({
      error: 'Contenu de l\'image invalide ou corrompu.',
      code: 'INVALID_IMAGE_CONTENT'
    });
  }

  try {
    const fileName = `${crypto.randomUUID()}.${detectedExt}`;
    const { error } = await supabase.storage
      .from('avatars')
      .upload(fileName, buffer, { contentType: declaredMime, upsert: false });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement de l\'image.' });
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);

    return res.status(201).json({
      status: 'success',
      url: urlData.publicUrl
    });
  } catch (err) {
    console.error('Error saving avatar:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'enregistrement de l\'image.' });
  }
});

export default router;
