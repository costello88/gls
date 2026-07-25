import { listStores } from "../../lib/dashboard/stores";
import { PrismaStoreRepository } from "../../lib/repositories/storeRepository";
import { StoreForm } from "./StoreForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const repository = new PrismaStoreRepository();
  const stores = await listStores(repository);

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Instellingen</h1>
      <h2>Winkels</h2>
      <ul>
        {stores.map((store) => (
          <li key={store.id}>
            {store.name} ({store.type}) — automatisch: {store.automationEnabled ? "aan" : "uit"}
          </li>
        ))}
      </ul>
      <h2>Winkel toevoegen</h2>
      <StoreForm />
    </main>
  );
}
