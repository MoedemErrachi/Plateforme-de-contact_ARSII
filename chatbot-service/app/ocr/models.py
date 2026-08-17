from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class FieldConfidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ExtractedField(BaseModel):
    value: str | None = None
    confidence: FieldConfidence = FieldConfidence.LOW


class ExtractedContactInfo(BaseModel):
    firstName: ExtractedField | None = None
    lastName: ExtractedField | None = None
    email: ExtractedField | None = None
    phone: ExtractedField | None = None
    affiliation: ExtractedField | None = None
    function: ExtractedField | None = None
    city: ExtractedField | None = None
    countryOfOrigin: ExtractedField | None = None


class OcrExtractionResponse(BaseModel):
    extracted: ExtractedContactInfo
    photoUrl: str | None = None
    sourceProvider: str
