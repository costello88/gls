import { listStores } from "../../lib/dashboard/stores";
import { PrismaStoreRepository } from "../../lib/repositories/storeRepository";
import { AppShell } from "../components/AppShell";
import { AutomationToggle } from "./AutomationToggle";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  const repository = new PrismaStoreRepository();
  const stores = await listStores(repository);

  return (
    <AppShell>
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Automatisering</h1>
      <p className="mb-6 text-sm text-slate-500">
        Als automatisering aan staat voor een winkel, worden geldige bestellingen automatisch
        geprint zodra ze binnenkomen — zonder dat iemand op een knop hoeft te klikken.
      </p>

      <ul className="space-y-2">
        {stores.map((store) => (
          <li
            key={store.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div>
              <span className="font-medium text-slate-900">{store.name}</span>
              <span className="ml-2 text-sm text-slate-500">({store.type})</span>
            </div>
            <AutomationToggle storeId={store.id} enabled={store.automationEnabled} />
          </li>
        ))}
        {stores.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-slate-400">
            Nog geen winkels toegevoegd.
          </li>
        )}
      </ul>
    </AppShell>
  );
}
