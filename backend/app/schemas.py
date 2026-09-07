from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TodoBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    completed: bool = False


class TodoCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    completed: bool | None = None


class TodoOut(TodoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class HealthOut(BaseModel):
    status: str
    database: str
