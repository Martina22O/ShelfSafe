# Supabase Database & Migrations

This directory contains the database schema, functions, and migration scripts for ShelfSafe.

## Directory Structure

```
supabase/
├── migrations/       # SQL migration scripts (ordered by timestamp)
├── seed.sql          # Seed data for local testing (categories, demo products/batches)
└── README.md         # Migration and database instructions
```


## How to Run Migrations

ShelfSafe uses the official [Supabase CLI](https://supabase.com/docs/guides/cli) to manage database migrations.

### 1. Prerequisites

Make sure you have Node.js installed. You can run the Supabase CLI directly using `npx supabase`.

### 2. Local Development

To start a local Supabase instance (requires Docker):

```bash
npx supabase start
```

### 3. Creating a New Migration

Generate a new timestamped migration file in `supabase/migrations/`:

```bash
npx supabase migration new <migration_name>
```

### 4. Applying Migrations Locally

Apply pending migrations to your local Supabase database:

```bash
npx supabase db reset
```

Or run pending migrations without resetting data:

```bash
npx supabase migration up
```

### 5. Applying Migrations to Remote Supabase

1. Link your local project to your remote Supabase project:

```bash
npx supabase link --project-ref <your-project-ref>
```

2. Push all pending migrations to the linked remote database:

```bash
npx supabase db push
```

Alternatively, you can copy the contents of any `.sql` file in `supabase/migrations/` and execute it directly in the **SQL Editor** of the [Supabase Dashboard](https://supabase.com/dashboard).
