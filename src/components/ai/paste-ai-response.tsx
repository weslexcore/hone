"use client";

import { useState } from "react";
import { ClipboardPaste, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface PasteAIResponseProps {
  onParsed: (data: unknown) => void;
  placeholder?: string;
  expectedShape?: string;
  /** When true, accept plain text as-is if JSON parsing fails */
  allowPlainText?: boolean;
  className?: string;
}

export function PasteAIResponse({
  onParsed,
  placeholder = "Paste the JSON response from your AI here...",
  expectedShape,
  allowPlainText = false,
  className,
}: PasteAIResponseProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleApply = () => {
    setError(null);
    setSuccess(false);

    const trimmed = value.trim();
    if (!trimmed) {
      setError("Paste a response first");
      return;
    }

    // Try to extract JSON from the response — the AI may wrap it in markdown code fences
    let jsonStr = trimmed;

    // Strip markdown code fences: ```json ... ``` or ``` ... ```
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      onParsed(parsed);
    } catch {
      if (allowPlainText) {
        onParsed(trimmed);
      } else {
        setError("Could not parse as JSON. Make sure you copied the full response.");
        return;
      }
    }

    setSuccess(true);
    setValue("");
    setTimeout(() => {
      setSuccess(false);
      setExpanded(false);
    }, 1500);
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          "flex items-center gap-2 w-full rounded-lg border border-dashed border-border px-3 py-2 text-xs text-text-muted hover:text-text-secondary hover:border-text-muted transition-colors",
          className,
        )}
      >
        <ClipboardPaste size={13} />
        Paste AI response
      </button>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
          setSuccess(false);
        }}
        placeholder={placeholder}
        rows={5}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 resize-none"
        autoFocus
      />
      {expectedShape && (
        <p className="text-[10px] text-text-muted leading-relaxed">
          Expected format: {expectedShape}
        </p>
      )}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={handleApply}
          disabled={!value.trim() || success}
          className="flex-1"
        >
          {success ? (
            <>
              <Check size={13} className="text-surface" />
              Applied!
            </>
          ) : (
            <>
              <ClipboardPaste size={13} />
              Apply Response
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setExpanded(false);
            setValue("");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
