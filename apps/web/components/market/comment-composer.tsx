"use client";

// HOMECOURT — Composer for new comments + replies. Mode-agnostic: the parent
// supplies `placeholder` + `onSubmit`. Submit text becomes "Reply"/"Post".

import { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { COMMENT_BODY_MAX } from "@homecourt/shared";

interface CommentComposerProps {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void> | void;
  onCancel?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  textareaId?: string;
}

export function CommentComposer({
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus,
  disabled,
  className,
  textareaId,
}: CommentComposerProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (trimmed.length === 0 || trimmed.length > COMMENT_BODY_MAX) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  };

  const counterClass =
    body.length > COMMENT_BODY_MAX
      ? "text-no-500"
      : body.length > COMMENT_BODY_MAX * 0.85
        ? "text-amber-500"
        : "text-muted-fg";

  const id = textareaId ?? "comment-composer";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Textarea
        id={id}
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || submitting}
        maxLength={COMMENT_BODY_MAX + 100}
        rows={3}
        aria-describedby={`${id}-counter`}
      />
      <div className="flex items-center justify-between gap-2">
        <span
          id={`${id}-counter`}
          aria-live="polite"
          className={cn("font-mono text-[11px] tabular-nums", counterClass)}
        >
          {body.length}/{COMMENT_BODY_MAX}
        </span>
        <div className="flex items-center gap-2">
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={
              disabled || submitting || body.trim().length === 0 || body.length > COMMENT_BODY_MAX
            }
          >
            {submitting ? "Posting…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
