"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApiKeyAction, revokeApiKeyAction } from "@/lib/actions/settings";
import type { ApiKeyStub } from "@/lib/settings/api-keys";

interface ApiKeysManagerProps {
  initialKeys: ApiKeyStub[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function ApiKeysManager({ initialKeys }: ApiKeysManagerProps) {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyStub[]>(initialKeys);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [generated, setGenerated] = useState<{ token: string; name: string } | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function onCreate() {
    if (creating) return;
    if (name.trim().length === 0) {
      toast.error("Name your key first.");
      return;
    }
    setCreating(true);
    try {
      const result = await createApiKeyAction({ name: name.trim() });
      if (result?.serverError || !result?.data?.ok) {
        toast.error("Couldn't create key. Try again.");
        return;
      }
      const created = result.data;
      setKeys((current) => [
        {
          id: crypto.randomUUID(),
          name: created.name,
          last4: created.last4,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      setGenerated({ token: created.token, name: created.name });
      setName("");
      setOpen(false);
      toast.success("API key generated. Copy it now — you won't see it again.");
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setCreating(false);
    }
  }

  async function onRevoke(stub: ApiKeyStub) {
    if (revokingId) return;
    setRevokingId(stub.id);
    try {
      const result = await revokeApiKeyAction({ notificationId: stub.id });
      if (result?.serverError) {
        toast.error("Couldn't revoke. Try again.");
        return;
      }
      setKeys((current) => current.filter((k) => k.id !== stub.id));
      toast.success("Key revoked.");
      router.refresh();
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setRevokingId(null);
    }
  }

  async function copyToken() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.token);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Couldn't copy. Select and copy manually.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button type="button" onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden />
          Create API key
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="border-border bg-muted/20 text-muted-fg flex flex-col items-center gap-1 rounded-md border border-dashed p-6 text-center text-sm">
          <KeyRound className="text-muted-fg/70 h-6 w-6" aria-hidden />
          <p className="text-foreground font-medium">No API keys yet.</p>
          <p className="text-xs">Create one to script your sweepstakes-mode trades.</p>
        </div>
      ) : (
        <ul className="border-border divide-border divide-y rounded-md border">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col">
                <span className="text-foreground text-sm font-medium">{key.name}</span>
                <span className="text-muted-fg font-mono text-xs">
                  hcrt_sk_••••{key.last4} · created {formatDate(key.createdAt)}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRevoke(key)}
                disabled={revokingId === key.id}
                className="gap-1.5 self-start sm:self-auto"
              >
                {revokingId === key.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                )}
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Pick a label so you can revoke this key later if you lose it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-key-name">Name</Label>
            <Input
              id="api-key-name"
              autoFocus
              placeholder="e.g. local script"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={onCreate} disabled={creating} className="gap-2">
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={generated !== null}
        onOpenChange={(o) => {
          if (!o) setGenerated(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key generated</DialogTitle>
            <DialogDescription>
              Copy it now — you won&apos;t see it again. We only store the last 4 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="border-border bg-muted/30 flex flex-col gap-2 rounded-md border p-3">
            <code
              data-testid="generated-api-key"
              className="text-foreground break-all font-mono text-xs"
            >
              {generated?.token}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={copyToken}
              className="gap-2 self-start"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setGenerated(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
