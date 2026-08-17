# OCR Module — Vision-based Business Card Extraction

## Architecture Decisions

### Extraction Only, No Auto-Creation
The OCR endpoint (`POST /api/ocr/extract`) returns `ExtractedContactInfo` + `photoUrl` + `sourceProvider`. It **never** creates contacts. The frontend (`OcrImportTab`) displays extracted data in an editable form, and the user explicitly clicks "Enregistrer" which calls `POST /api/contacts` on the Express backend.

Rationale: consistent with the "never auto-write without explicit confirmation" principle, allows review/edit before saving, avoids half-created contacts on partial failures.

### Separate Provider System
`VisionProvider` is a new ABC, completely independent of `LLMProvider` (in `app/providers/base.py`). Different contract, different router (`VisionRouter` vs `LLMRouter`), different error hierarchy. No shared state, no inheritance, zero regression risk to chatbot.

### Provider Chain
Mistral (vision-1) → Gemini (vision-2) → Tesseract (local fallback)

### Groq Excluded
Groq's vision API is marked "Preview" — not production-ready for a reliability-critical extraction pipeline.

### Tesseract as Degraded Fallback
Tesseract extracts raw text only (regex for email/phone). No LLM structuring — name, affiliation, function remain `None`. Confidence always `"low"`. Explicitly a degraded path.

## Provider Details

### Mistral (`mistral_vision_provider.py`)
- Model: `mistral-small-latest` (Mistral Small 4, multimodal)
- SDK: `mistralai` — same client class as chatbot, different message format (base64 image_url parts)
- Two `Mistral` client instances coexist safely — no global state conflict

### Gemini (`gemini_vision_provider.py`)
- Model: `gemini-3.5-flash` (multimodal natively)
- SDK: `google-genai` — `Part.from_bytes()` for image data
- Same client class as chatbot, separate instance

### Tesseract (`tesseract_fallback.py`)
- Pure local, no API key needed
- Extracts text via `pytesseract`, then regex for email/phone
- All fields except email/phone set to `None`

## Model Fallback Logging
When a custom model override is detected via environment variable, `logger.info` is emitted. Silent fallback is forbidden for stability monitoring.

## Timeout Handling
Each provider wraps its API call in `asyncio.wait_for(timeout)`. Config errors (404, 400 = wrong model name) pivot immediately without waiting for the full timeout — same lesson as the chatbot module.

## Rate Limiting
OCR uses a separate `slowapi.Limiter` instance (`ocr_limiter`), independent from the chatbot's rate limit. Configurable via `OCR_RATE_LIMIT` env var (default: `"10/minute"`).

## Dependencies
```
python-multipart>=0.0.9   # FastAPI UploadFile
Pillow>=10.0              # Image preprocessing
pytesseract>=0.3.10       # Tesseract OCR bindings
mediapipe>=0.10.14        # Face detection (optional, non-blocking)
```

## Files
```
app/ocr/
  __init__.py
  models.py                  # Pydantic schemas (ExtractedField, ExtractedContactInfo, OcrExtractionResponse)
  extraction.py              # LLM response parsing, regex extraction, photo saving
  preprocessing.py           # Image preprocessing (auto-orient, resize, RGB)
  face_detection.py          # Mediapipe face detection (optional, non-blocking)
  vision_router.py           # VisionRouter with failover
  providers/
    __init__.py
    base.py                  # VisionProvider ABC + error hierarchy
    mistral_vision_provider.py
    gemini_vision_provider.py
    tesseract_fallback.py
  tests/
    __init__.py
    vision_router_test.py    # 7 tests: pivot, failover, no providers
    extraction_test.py       # 15 tests: parsing, regex, preprocessing

app/routes/
  ocr_routes.py              # POST /api/ocr/extract endpoint
```

## Frontend
- `src/components/OcrImportTab.tsx` — Image upload, OCR extraction, editable form with confidence indicators
- `src/components/ImportWizardView.tsx` — Tab bar: "Importer un fichier" | "Scanner une carte de visite"

## Running Tests
```bash
cd chatbot-service
python -m pytest app/ocr/tests/ -v
```
