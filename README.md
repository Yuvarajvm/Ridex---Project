# RIDEX

## Backend foundation

The backend uses FastAPI, async SQLAlchemy, PostgreSQL, and Alembic. Business
modules remain scaffolded until they are implemented.

1. Copy `.env.example` to `.env` and replace all placeholders. Do not commit it.
2. Install backend dependencies:

   ```powershell
   python -m pip install -r backend/requirements.txt
   ```

3. Start PostgreSQL:

   ```powershell
   docker compose --env-file .env up -d postgres
   ```

4. Run the API from `backend/`:

   ```powershell
   cd backend
   uvicorn app.main:app --reload
   ```

`GET /health` reports database connectivity.

## Database migrations

Run from `backend/` after setting `DATABASE_URL`:

```powershell
alembic revision --autogenerate -m "describe change"
alembic upgrade head
alembic downgrade -1
```
