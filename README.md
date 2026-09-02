# RIDEX

## Backend foundation

The backend uses FastAPI, async SQLAlchemy, PostgreSQL, and Alembic. Business
modules remain scaffolded until they are implemented.

1. Copy `.env.example` to `.env` and replace all placeholders. Do not commit it.
2. Install backend dependencies:

   ```powershell
   python -m pip install -r backend/requirements.txt