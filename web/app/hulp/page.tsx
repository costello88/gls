import { AppShell } from "../components/AppShell";

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-black">
        {number}
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-600">{children}</p>
      </div>
    </div>
  );
}

export default function HulpPage() {
  return (
    <AppShell>
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Hulp &amp; instructies</h1>
      <p className="mb-8 text-sm text-slate-500">
        Korte uitleg voor wie hier voor het eerst mee werkt. Volg de stappen hieronder in volgorde.
      </p>

      <div className="space-y-8 rounded-lg border border-slate-200 bg-white p-6">
        <Step number={1} title="Bestellingen ophalen">
          Klik bovenaan op <strong>&quot;Synchroniseren&quot;</strong>. Dit haalt nieuwe bestellingen op
          uit de webshop. Nieuwe bestellingen komen in het tabblad{" "}
          <strong>&quot;Klaar om te printen&quot;</strong> terecht.
        </Step>

        <Step number={2} title="Foutieve bestellingen controleren">
          Staat er een rood getal naast <strong>&quot;Moet gecontroleerd worden&quot;</strong>? Klik op
          dat tabblad en dan op &quot;Bekijken&quot; bij een bestelling. Er staat in het rood wat er
          ontbreekt of fout is (bijvoorbeeld een ongeldig e-mailadres). Verbeter het veld en klik op
          &quot;Opslaan&quot;. De bestelling gaat dan automatisch terug naar &quot;Klaar om te printen&quot;.
        </Step>

        <Step number={3} title="CSV-bestand downloaden">
          Ga naar het tabblad <strong>&quot;Klaar om te printen&quot;</strong>. Klik bij een losse
          bestelling op <strong>&quot;Download CSV&quot;</strong>, of gebruik bovenaan{" "}
          <strong>&quot;Download CSV (N)&quot;</strong> om alle bestellingen in één keer te downloaden.
          Er wordt een bestand gedownload naar je computer (meestal in de map &quot;Downloads&quot;). De
          bestelling verschijnt daarna in het tabblad <strong>&quot;Geprint&quot;</strong> -- dit betekent
          alleen dat het bestand is gemaakt, nog niet dat het pakket klaar is om te versturen.
        </Step>

        <Step number={4} title="Importeren in GLS Print&Ship">
          Ga naar de website van GLS Print&amp;Ship en log in. Kies in het menu links{" "}
          <strong>Zendingen &rarr; Importeren</strong>. Upload het bestand dat je in stap 3 hebt
          gedownload. GLS vraagt de eerste keer om de kolommen te koppelen -- dat hoef je maar één keer
          te doen, daarna onthoudt GLS dit als &quot;sjabloon&quot;.
        </Step>

        <Step number={5} title="Bevestigen en dagrapport downloaden">
          Dit is de belangrijkste stap: ga naar <strong>Zendingen &rarr; Bevestigen</strong> in GLS
          Print&amp;Ship. Klik op <strong>&quot;Bevestig zendingen&quot;</strong> en daarna op{" "}
          <strong>&quot;Download dagrapport&quot;</strong>. Zonder deze stap mogen de pakketten niet mee
          met de chauffeur, ook al heb je al een label/CSV gemaakt.
        </Step>
      </div>

      <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-900">Veelgestelde vragen</h2>
        <dl className="mt-3 space-y-4 text-sm text-amber-900">
          <div>
            <dt className="font-medium">Wat betekent elk tabblad?</dt>
            <dd className="mt-1 text-amber-800">
              <strong>Klaar om te printen</strong>: nog te exporteren. <strong>Moet gecontroleerd
              worden</strong>: er ontbreekt iets, eerst verbeteren. <strong>Geprint</strong>: CSV is
              gedownload (zie stap 4 en 5 hierboven om het echt te versturen). <strong>Fout</strong>:
              er ging iets mis, probeer het opnieuw of vraag hulp.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Ik zie geen nieuwe bestellingen na synchroniseren</dt>
            <dd className="mt-1 text-amber-800">
              Dat betekent meestal dat alles al is opgehaald. Controleer of de bestelling niet al in een
              ander tabblad staat.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Een bestelling staat er dubbel in / ik heb per ongeluk twee keer geëxporteerd</dt>
            <dd className="mt-1 text-amber-800">
              Ga naar <strong>&quot;Opruimen&quot;</strong> in het menu. Daar kun je per ongeluk
              aangemaakte GLS-labels verwijderen aan de hand van het pakketnummer. Vraag bij twijfel eerst
              hulp voordat je iets verwijdert.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Wat als ik een dag oversla?</dt>
            <dd className="mt-1 text-amber-800">
              Geen probleem. Geëxporteerde (&quot;Geprint&quot;) bestellingen worden na 1 dag automatisch
              opgeruimd uit dit systeem, zodat de lijst niet blijft aangroeien. Zorg wel dat je ze op tijd
              hebt geïmporteerd en bevestigd in GLS Print&amp;Ship.
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">Als app op je telefoon of computer zetten</h2>
        <p className="mt-1 text-sm text-slate-600">
          Dan hoef je niet steeds de website op te zoeken -- je klikt gewoon op het icoontje, net als bij
          een gewone app.
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="font-semibold text-slate-900">Op een iPhone of iPad (Safari)</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Open deze website in Safari (niet Chrome).</li>
              <li>
                Tik onderin op het deel-icoontje: een vierkantje met een pijltje naar boven (
                <span aria-hidden="true">⬆️</span>).
              </li>
              <li>Scrol in het menu dat verschijnt naar beneden en tik op &quot;Zet op beginscherm&quot;.</li>
              <li>Tik rechtsboven op &quot;Voeg toe&quot;.</li>
            </ol>
            <p className="mt-2 text-sm text-slate-500">
              Er verschijnt nu een geel &quot;GLS&quot;-icoontje op je beginscherm.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">Op een Android-telefoon (Chrome)</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Open deze website in Chrome.</li>
              <li>Tik rechtsboven op de drie puntjes (⋮).</li>
              <li>Tik op &quot;App installeren&quot; of &quot;Toevoegen aan startscherm&quot;.</li>
              <li>Bevestig door op &quot;Installeren&quot; te tikken.</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900">Op een computer (Chrome of Edge)</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Open deze website.</li>
              <li>
                Kijk helemaal rechts in de adresbalk (waar de website-naam staat) naar een klein
                icoontje met een scherm en een pijltje naar beneden.
              </li>
              <li>Klik erop en kies &quot;Installeren&quot;.</li>
            </ol>
            <p className="mt-2 text-sm text-slate-500">
              Zie je dat icoontje niet? Klik dan rechtsboven op de drie puntjes (⋮) en kies &quot;GLS
              Sync installeren...&quot;.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
