# Agent Rules & Instructions

## SCOPE RULES
- Every task I give has a scope: FRONTEND, BACKEND, DATABASE, MOBILE, or a combination (for example "FRONTEND + BACKEND").
- If I name a scope, change ONLY files in that scope. Nothing else.
    - FRONTEND = `apps/web` (UI, pages, components, styles)
    - MOBILE = `apps/mobile`
    - BACKEND = API routes, server logic, and the FEFO function code
    - DATABASE = `supabase/` (tables, migrations)
- If I don't name a scope, ask me which one before changing anything.
- If a task seems to need a change outside the scope, STOP and tell me what and why. Do not make the change until I say yes.
- Do not refactor, rename, reformat, or "clean up" files I did not ask about.
- Do not install, remove, or upgrade packages unless I ask.
- Do not touch .env files, secrets, or GitHub settings.
- Before editing, show a short plan: which files you will change. After editing, list the files you changed.
- Keep changes small: one task = one change.
- Follow the Figma screenshots in `docs/design/` exactly for UI. If a screenshot is unclear, ask me.
- Product rules to always respect:
    - FEFO deducts from the batch that expires first.
    - No payment processing.
    - No photo recognition.
    - Undo puts units back into the same batches.
