"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isSupabaseConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authError = searchParams.get("error");

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  if (!isSupabaseConfigured) {
    return (
      <Card className="max-w-sm w-full space-y-4 text-center">
        <h1 className="text-lg font-semibold text-text-primary">Sign In Unavailable</h1>
        <p className="text-sm text-text-muted">
          Authentication is not configured on this instance. You can still use Hone with your own API
          keys.
        </p>
        <Link href="/dashboard">
          <Button variant="primary" className="w-full">
            <ArrowLeft size={14} />
            Go to Dashboard
          </Button>
        </Link>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authErr } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (authErr) {
        setError(authErr.message);
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Card className="max-w-sm w-full space-y-4 text-center">
        <div className="w-10 h-10 rounded-full bg-accent-muted flex items-center justify-center mx-auto">
          <Mail size={20} className="text-accent" />
        </div>
        <h1 className="text-lg font-semibold text-text-primary">Check your email</h1>
        <p className="text-sm text-text-muted">
          We sent a sign-in link to <strong className="text-text-secondary">{email}</strong>. Click
          the link to sign in.
        </p>
        <button
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="text-xs text-accent hover:text-accent/80 transition-colors"
        >
          Use a different email
        </button>
      </Card>
    );
  }

  return (
    <Card className="max-w-sm w-full space-y-4">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-text-primary">Sign in to Hone</h1>
        <p className="text-sm text-text-muted mt-1">
          Get access to AI writing features without needing your own API key.
        </p>
      </div>

      {(error || authError) && (
        <div className="rounded-lg bg-danger-muted border border-danger/20 px-3 py-2 text-sm text-danger">
          {error || "Sign-in link expired or invalid. Please try again."}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="email" className="text-xs text-text-muted block mb-1">
            Email address
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={isSubmitting || !email.trim()}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Sending link…
            </>
          ) : (
            "Send magic link"
          )}
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/dashboard"
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Skip — I have my own API key
        </Link>
      </div>
    </Card>
  );
}
