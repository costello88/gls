import { listStores } from "../../lib/dashboard/stores";
import { PrismaStoreRepository } from "../../lib/repositories/storeRepository";
import { AppShell } from "../components/AppShell";
import { DeleteStoreButton } from "./DeleteStoreButton";
import { StoreForm } from "./StoreForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const repository = new PrismaStoreRepository();
  const stores = await listStores(repository);

  return (
    <AppShell>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Instellingen</h1>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Winkels</h2>
      <ul className="mb-8 space-y-2">
        {stores.map((store) => (
          <li
            key={store.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div>
              <span className="font-medium text-slate-900">{store.name}</span>
              <span className="ml-2 text-sm text-slate-500">({store.type})</span>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  store.automationEnabled ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                automatisch: {store.automationEnabled ? "aan" : "uit"}
              </span>
              <DeleteStoreButton storeId={store.id} storeName={store.name} />
            </div>
          </li>
        ))}
        {stores.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-slate-400">
            Nog geen winkels toegevoegd.
          </li>
        )}
      </ul>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Winkel toevoegen</h2>
      <div className="max-w-lg rounded-lg bg-white p-6 shadow-sm">
        <StoreForm />
      </div>
    </AppShell>
  );
}
