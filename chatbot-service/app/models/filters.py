from typing import Optional, Literal
from pydantic import BaseModel, Field

class ContactFilters(BaseModel):
    countryOfOrigin: Optional[str] = Field(None, description="Country of origin/location (e.g., Senegal, France)")
    affiliation: Optional[str] = Field(None, description="University or research institution name")
    facultyDepartment: Optional[str] = Field(None, description="Department, faculty or domain of expertise")
    researchCareerStage: Optional[Literal["R1_FIRST_STAGE", "R2_RECOGNIZED", "R3_ESTABLISHED", "R4_LEADING"]] = Field(None, description="Research stage level")
    gender: Optional[Literal["MALE", "FEMALE", "NOT_SPECIFIED"]] = Field(None, description="Gender category")
