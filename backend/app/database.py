import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# SQLAlchemy 2 + psycopg (v3) driver. Accepts either postgresql:// or postgresql+psycopg://
_raw_url = os.getenv(
    "DATABASE_URL",
    "postgresql://todos:todos@localhost:5432/todos",
)
if _raw_url.startswith("postgresql://") and "+psycopg" not in _raw_url:
    DATABASE_URL = _raw_url.replace("postgresql://", "postgresql+psycopg://", 1)
elif _raw_url.startswith("postgres://"):
    DATABASE_URL = _raw_url.replace("postgres://", "postgresql+psycopg://", 1)
else:
    DATABASE_URL = _raw_url


engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
