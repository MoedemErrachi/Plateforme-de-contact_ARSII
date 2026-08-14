from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.filters import ContactFilters


class ChatRequest(BaseModel):
    session_id: UUID
    message: str = Field(..., min_length=1, max_length=4000)


class ChatAction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: Literal["view_filtered_list", "export_csv", "view_contact_profile"]
    filters: Optional[ContactFilters] = None
    contact_id: Optional[str] = None


class ChatResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message: str
    actions: list[ChatAction] = Field(default_factory=list)
