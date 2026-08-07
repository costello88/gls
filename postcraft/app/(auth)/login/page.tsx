"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Field, Input } from "@/components/ui/primitives";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "magic">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        setMessage("Check your inbox — a sign-in link is on its way.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Account created. If email confirmation is on, check your inbox — otherwise sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(params.get("next") ?? "/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-rise">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <span className="w-3 h-3 rounded-full bg-accent" />
          <span className="display text-2xl text-paper">Postcraft</span>
        </div>

        <Card className="p-6">
          <div className="microlabel mb-4">
            {mode === "signup" ? "Create account" : mode === "magic" ? "Magic link" : "Sign in"}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Email">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                autoComplete="email"
              />
            </Field>

            {mode !== "magic" ? (
              <Field label="Password">
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </Field>
            ) : null}

            {error ? <p className="text-xs text-danger">{error}</p> : null}
            {message ? <p className="text-xs text-lime">{message}</p> : null}

            <Button type="submit" variant="accent" size="lg" disabled={busy}>
              {busy ? "Working…" : mode === "signup" ? "Create account" : mode === "magic" ? "Send link" : "Sign in"}
            </Button>
          </form>

          <div className="flex items-center justify-between mt-5 text-xs text-paper-dim">
            <button
              className="hover:text-paper transition-colors cursor-pointer"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}
            </button>
            <button
              className="hover:text-paper transition-colors cursor-pointer"
              onClick={() => setMode(mode === "magic" ? "signin" : "magic")}
            >
              {mode === "magic" ? "Use password" : "Use magic link"}
            </button>
          </div>
        </Card>

        <p className="text-center text-xs text-muted mt-6">
          Instagram content production &amp; posting machine
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
