import uuid

from sqlalchemy import DateTime, Integer, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BBoxSession(Base):
    __tablename__ = "bbox_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_uuid: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), default=uuid.uuid4)
    bbox: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=False), server_default=func.now())
