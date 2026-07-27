import { AppShell } from "../components/AppShell";
import { BulkDeleteForm } from "./BulkDeleteForm";

export default function CleanupPage() {
  return (
    <AppShell>
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Labels opruimen</h1>
      <p className="mb-6 text-sm text-slate-500">
        Verwijdert GLS-labels op basis van pakketnummer. Gebruik dit alleen voor labels die nog niet
        zijn opgehaald door GLS (status &quot;Aangekondigd bij GLS&quot; of &quot;Pakket gereed voor
        overdracht aan GLS&quot;) &mdash; nooit voor pakketten die al onderweg, afgeleverd of
        opgeslagen zijn.
      </p>
      <BulkDeleteForm />
    </AppShell>
  );
}
