# @workspace/ui

Shared UI package for the LMS monorepo (shadcn on Base UI, Tailwind v4).

## The one rule

**`src/components/` is shadcn-owned. NEVER add or edit files in it.**

That directory is registry output, managed exclusively by
`pnpm dlx shadcn@latest add <name>` (and regenerated wholesale by
`shadcn add --overwrite`). Hand edits are guaranteed to be destroyed on
the next add, and lint/typecheck noise in registry code is not ours to
fix — `src/components` is excluded from this package's ESLint config and
tsconfig, and CI agrees.

If you need shared UI that a shadcn primitive doesn't cover:

- **Put it in `src/composed/`** (import as
  `@workspace/ui/composed/<name>`). That directory is authored code —
  linted, typechecked, and safe to edit. Wrappers around a primitive
  (e.g. `sonner-toaster.tsx`), small shared atoms, and multi-primitive
  compositions all live there.
- If a primitive needs *different behavior*, wrap it in `composed/` —
  do not modify the primitive.

App-specific composed blocks do NOT go here — those live under each
app's `components/composed/<domain>/` (see the root AGENTS.md).

## Layout

| Path             | Owner    | Lint/typecheck | What                                    |
| ---------------- | -------- | -------------- | --------------------------------------- |
| `src/components` | shadcn   | excluded       | Registry primitives only                |
| `src/composed`   | us       | yes            | Shared composed UI + primitive wrappers |
| `src/hooks`      | us       | yes            | Shared hooks                            |
| `src/lib`        | us       | yes            | `cn` and friends                        |
| `src/styles`     | us       | —              | `globals.css`, theme tokens             |

## Adding a primitive

From this package's directory (or the repo root with `-F @workspace/ui`):

```
pnpm dlx shadcn@latest add <component-name>
```

Never move the output out of `src/components/`, and never edit it after
it lands.
