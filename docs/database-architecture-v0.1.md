# RIDEX Database Architecture v0.1

Status: ORM and Migration 001 corrected; pending PostgreSQL application and verification
Scope: users, profiles, vehicles

This document defines the first real database slice for RIDEX before SQLAlchemy
models and Alembic migration 001 are generated.

## Confirmed Database Standards

- Primary keys use UUID.
- Timestamps are timezone-aware and stored in UTC.
- Monetary values use `NUMERIC`, not floating point.
- Currency starts with INR.
- Minimum fare is INR 10.
- Soft deletion is used where records may need audit/history.
- Relationships are enforced with foreign keys.
- Business rules are backed by database constraints where practical.
- Indexes are intentional, not automatic everywhere.
- The backend remains a modular monolith.
- PostgreSQL-specific features are acceptable only when they do not block future portability without good reason.

## Naming Conventions

- Table names are plural snake_case.
- Column names are snake_case.
- Boolean columns use `is_`, `has_`, or lifecycle wording where clear.
- Timestamp columns use `_at`.
- Foreign keys use `<entity>_id`.
- Enum-like values are stored as strings initially for easier API compatibility.

## v0.1 Decisions Applied

- Phone number is optional until it is verified.
- A user has one initial role: `rider`, `driver`, or `admin`.
- Profile soft deletion is coordinated by service lifecycle logic rather than a
  database cascade.
- Vehicle capacity is constrained to 1–8, including bikes; a later ride rule
  will define passenger-seat semantics.
- Active vehicle registration numbers are globally unique for the initial
  India-only rollout.

## Shared Columns

Tables that represent lifecycle-managed domain records should include:

```sql
id UUID PRIMARY KEY
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
deleted_at TIMESTAMPTZ NULL
```

`deleted_at IS NULL` means the record is active. Soft-deleted records remain for
audit, support, fraud review, and historical ride/bookings references.

## users

Purpose: Stores account identity, authentication state, and security lifecycle.

This table should not become a profile table. Keep personal display data in
`profiles`.

### Columns

```sql
id UUID PRIMARY KEY
email VARCHAR(320) NOT NULL
phone_number VARCHAR(20) NULL
password_hash VARCHAR(255) NOT NULL
role VARCHAR(30) NOT NULL DEFAULT 'rider'
status VARCHAR(30) NOT NULL DEFAULT 'pending_verification'
email_verified_at TIMESTAMPTZ NULL
phone_verified_at TIMESTAMPTZ NULL
last_login_at TIMESTAMPTZ NULL
failed_login_attempts INTEGER NOT NULL DEFAULT 0
locked_until TIMESTAMPTZ NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
deleted_at TIMESTAMPTZ NULL
```

### Allowed Values

`role`:

- `rider`
- `driver`
- `admin`

`status`:

- `pending_verification`
- `active`
- `suspended`
- `deactivated`

### Constraints

- `email` is unique among active users.
- `phone_number` is unique among active users when present.
- `email` is normalized using trim + lowercase before persistence.
- PostgreSQL also enforces the normalized representation.
- `password_hash` must not be empty.
- `failed_login_attempts >= 0`.
- `role` must be one of the allowed role values.
- `status` must be one of the allowed status values.
- `deleted_at` must be null for users who are still active.

### Indexes

- Unique partial index on `email` where `deleted_at IS NULL`.
- Unique partial index on `phone_number` where `phone_number IS NOT NULL AND deleted_at IS NULL`.
- Index on `status`.
- Index on `role`.
- Index on `created_at`.

### Security Notes

- Store only password hashes, never raw passwords.
- Authentication tokens are not stored in this table in v0.1.
- Refresh token/session storage should be a later table if needed.
- Account lockout fields live here because they are account lifecycle data.

## profiles

Purpose: Stores public and semi-public user profile information.

Each user has one profile. This separation keeps authentication data away from
display and onboarding fields.

### Columns

```sql
id UUID PRIMARY KEY
user_id UUID NOT NULL
first_name VARCHAR(100) NOT NULL
last_name VARCHAR(100) NULL
display_name VARCHAR(160) NULL
avatar_url VARCHAR(500) NULL
bio VARCHAR(500) NULL
date_of_birth DATE NULL
gender VARCHAR(30) NULL
city VARCHAR(120) NULL
state VARCHAR(120) NULL
country VARCHAR(120) NOT NULL DEFAULT 'India'
profile_completed_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
deleted_at TIMESTAMPTZ NULL
```

### Allowed Values

`gender`:

- `male`
- `female`
- `non_binary`
- `prefer_not_to_say`

The field remains nullable because RIDEX should not require gender for account
creation.

### Relationships

- `profiles.user_id` references `users.id`.
- Relationship is one-to-one.
- Deleting a user should not physically delete a profile in normal application flow.
- Soft deletion should set `profiles.deleted_at` when a user account is deactivated or erased by policy.

### Constraints

- `user_id` is globally unique.
- Each user has exactly one profile record throughout its lifecycle.
- A soft-deleted profile remains associated with the same user and should be restored rather than replaced with a second profile record.
- `first_name` must not be empty.
- `display_name`, when present, must not be empty.
- `bio` length is capped to prevent oversized profile content.
- `date_of_birth` must not be in the future (validated in the application layer;
  PostgreSQL `CHECK` constraints cannot safely depend on the changing current date).

### Indexes

- Unique partial index on `user_id` where `deleted_at IS NULL`.
- Index on `city`.
- Index on `state`.
- Index on `created_at`.

### Lifecycle Notes

- A user can exist before profile completion.
- `profile_completed_at` becomes non-null after required onboarding fields are complete.
- Do not infer verification from profile completion.

## vehicles

Purpose: Stores driver-owned vehicle records used by the ride marketplace.

Vehicles belong to users. In v0.1, only users with driver capabilities should
create vehicles, but role enforcement belongs in service/business logic too.

### Columns

```sql
id UUID PRIMARY KEY
owner_id UUID NOT NULL
vehicle_type VARCHAR(30) NOT NULL
make VARCHAR(100) NOT NULL
model VARCHAR(100) NOT NULL
color VARCHAR(60) NULL
registration_number VARCHAR(30) NOT NULL
registration_state VARCHAR(120) NULL
manufacture_year INTEGER NULL
seat_capacity INTEGER NOT NULL
verification_status VARCHAR(30) NOT NULL DEFAULT 'pending'
verified_at TIMESTAMPTZ NULL
rejected_reason VARCHAR(500) NULL
is_active BOOLEAN NOT NULL DEFAULT true
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
deleted_at TIMESTAMPTZ NULL
```

### Allowed Values

`vehicle_type`:

- `car`
- `bike`
- `auto`
- `van`

`verification_status`:

- `pending`
- `verified`
- `rejected`
- `expired`

### Relationships

- `vehicles.owner_id` references `users.id`.
- A user can own many vehicles.
- Rides will later reference `vehicles.id`.
- Vehicle records should be soft-deleted, not physically deleted, once they may be referenced by rides.

### Constraints

- `registration_number` is unique among active vehicles.
- `registration_number` is normalized using trim + uppercase before persistence.
- PostgreSQL also enforces the normalized representation.
- `seat_capacity >= 1`.
- `seat_capacity <= 8` for v0.1 passenger marketplace scope.
- `manufacture_year >= 1990` when present.
- `verified_at` is required when `verification_status = 'verified'`.
- `rejected_reason` is required when `verification_status = 'rejected'`.
- `rejected_reason` should be null unless rejected.

### Indexes

- Index on `owner_id`.
- Unique partial index on `registration_number` where `deleted_at IS NULL`.
- Index on `verification_status`.
- Index on `is_active`.
- Index on `created_at`.

### Verification Notes

- Document uploads are not part of `vehicles` v0.1.
- A later `vehicle_documents` table should track RC, insurance, pollution certificate, and permit data if needed.
- Application logic should prevent unverified or inactive vehicles from being used for published rides.

## Relationship Summary

```text
users
  1 -> 1 profiles
  1 -> many vehicles
```

Future tables will extend this foundation:

```text
users
  1 -> many rides
  1 -> many bookings
  1 -> many reviews

vehicles
  1 -> many rides
```

## First Migration Candidate

Migration 001 should include:

- `users`
- `profiles`
- `vehicles`
- required constraints
- required indexes
- UUID generation approach
- timestamp defaults/update strategy

Do not include rides, bookings, payments, or reviews in migration 001 unless
their column-level design has also been reviewed.

## Open Review Decisions

Before translating this into SQLAlchemy models, confirm these decisions:

- Should phone number be required at signup, or optional until verification?
- Should a user have one role only, or can one account be both rider and driver?
- Should profile soft deletion happen automatically when a user is soft-deleted?
- Is `seat_capacity <= 8` correct for RIDEX v0.1?
- Should `vehicle_type = bike` allow `seat_capacity = 1`, or should published bike rides require a passenger seat count of 1?
- Should registration number uniqueness be global, or scoped by country/state?

## Implementation Sequence After Review

1. Create shared SQLAlchemy mixins for UUID and timestamps.
2. Create user, profile, and vehicle SQLAlchemy 2.x models.
3. Add relationships, constraints, and indexes.
4. Wire models into Alembic metadata.
5. Generate migration 001.
6. Review the generated migration manually.
7. Apply migration.
8. Verify schema against PostgreSQL.
9. Add focused model/session tests.

### Timestamp Integrity

`created_at` and `updated_at` are timezone-aware PostgreSQL timestamps.

`updated_at` is handled at two levels:

1. SQLAlchemy `onupdate` for normal ORM operations.
2. PostgreSQL trigger enforcement for direct SQL/database-level updates.

This prevents `updated_at` from becoming stale when records are modified outside the ORM.