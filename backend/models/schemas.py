from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

class UploadResponse(BaseModel):
    id: int
    file_name: str
    reference_date: date
    total_pats: int
    total_mxm: int
    created_at: datetime

    class Config:
        from_attributes = True
