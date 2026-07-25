# Automation Tab and Store Deletion — Design

## Context

Follow-up to the automation engine sub-project. Two gaps identified while using the deployed dashboard: there is no UI to actually turn a store's `automationEnabled` toggle on (the settings form only sets it at store creation), and there is no way to remove a store once added.

## Automation tab

A new page, `web/app/automatisering/page.tsx`, added as a top-level nav destination alongside Bestellingen and Instellingen (`web/app/components/AppShell.tsx` gains the link). It lists every store with a toggle switch next to it. Flipping the switch calls the existing `PATCH /api/stores/:id` route with `{ automationEnabled: true | false }` — this route and its underlying `updateStore` core function already exist and already validate correctly; this page is purely a UI control that was missing. New client component: `web/app/automatisering/AutomationToggle.tsx`.

## Store deletion

- `web/prisma/schema.prisma`: the `Order.store` relation gains `onDelete: Cascade`, so deleting a store also deletes its orders rather than leaving them orphaned or blocking the delete with a foreign-key error. This is applied automatically by the `prisma db push` step already wired into the Vercel build (`package.json`'s `build` script) — no manual migration step.
- `StoreRepository` (in `web/lib/dashboard/types.ts`) gains `delete(id: string): Promise<void>`, implemented on `PrismaStoreRepository` via `prisma.store.delete({ where: { id } })`.
- New core function `deleteStore(repo: StoreRepository, id: string): Promise<void>` in `web/lib/dashboard/stores.ts`, tested via a fake repository, matching every other function in that file.
- `web/app/api/stores/shared.ts` gains `handleDeleteStore(repo: StoreRepository, id: string): Promise<Response>`; `web/app/api/stores/[id]/route.ts` gains a `DELETE` export alongside its existing `PATCH`.
- A delete button next to each store on the existing Instellingen store list (`web/app/instellingen/page.tsx`), behind a `window.confirm(...)` warning that states orders for that store will also be deleted. New client component: `web/app/instellingen/DeleteStoreButton.tsx`.

## Out of scope

- No undo/soft-delete — this is a hard delete, consistent with the existing clear-all-orders button's irreversibility.
- No changes to the automation engine's scheduling or print logic — this only adds UI controls for functionality that already exists (`updateStore`) and one new deletion capability.

## Testing

- `deleteStore` gets a unit test via a fake `StoreRepository`.
- `handleDeleteStore` gets a route-handler-level test, matching the pattern used for `handleCreateStore`/`handleUpdateStore`.
- No component tests for `AutomationToggle` or `DeleteStoreButton`, consistent with the rest of the dashboard (pages/components are build-verified only).
- Full `npm test` and `npx next build` must pass before this is pushed.
