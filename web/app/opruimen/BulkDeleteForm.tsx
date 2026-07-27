"use client";

import { useState } from "react";

interface BulkDeleteResult {
  unitNo: string;
  success: boolean;
  error?: string;
}

export function BulkDeleteForm() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkDeleteResult[] | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const unitNos = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (unitNos.length === 0) {
      return;
    }
    const confirmed = window.confirm(
      `Weet je zeker dat je ${unitNos.length} label(s) bij GLS wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`,
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setResults(null);
    const response = await fetch("/api/gls/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ unitNos }),
    });
    const body = (await response.json()) as { results: BulkDeleteResult[] };
    setLoading(false);
    setResults(body.results);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Pakketnummers (unit-nummers), één per regel
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            placeholder={"11850080203176\n11850080203169\n..."}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Bezig..." : "Verwijder alle labels"}
        </button>
      </form>

      {results && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            {results.filter((r) => r.success).length} verwijderd, {results.filter((r) => !r.success).length} mislukt
          </div>
          <div className="divide-y divide-slate-100">
            {results.map((result) => (
              <div key={result.unitNo} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="font-mono">{result.unitNo}</span>
                {result.success ? (
                  <span className="text-green-700">Verwijderd</span>
                ) : (
                  <span className="text-red-600">{result.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
