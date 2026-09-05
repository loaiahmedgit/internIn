"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Mail, Phone, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { deleteProfileLinkAction, upsertProfileLinkAction } from "@/lib/opportunities/student-profile-sections-actions";

export interface ProfileLinkItem {
  id: string;
  label: string;
  url: string;
}

const LABEL_OPTIONS = ["Email", "Phone", "LinkedIn", "GitHub", "Behance", "Dribbble", "Medium", "YouTube", "Website", "Google Scholar"];

const ICONS: Record<string, LucideIcon> = { Email: Mail, Phone: Phone };

function iconFor(label: string): LucideIcon {
  return ICONS[label] ?? Globe;
}

/** Renders the link value as a real clickable href when we can tell what
 * it is — mailto:/tel: for Email/Phone, https:// for everything else
 * (adding the scheme back if the student typed a bare domain). */
function hrefFor(label: string, url: string): string {
  if (label === "Email") return `mailto:${url}`;
  if (label === "Phone") return `tel:${url.replace(/\s+/g, "")}`;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function emptyDraft(): Omit<ProfileLinkItem, "id"> {
  return { label: "LinkedIn", url: "" };
}

export function ProfileLinksEditor({ items }: { items: ProfileLinkItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<ProfileLinkItem, "id">>(emptyDraft());
  const [customMode, setCustomMode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft());
    setCustomMode(false);
    setError(null);
    setOpen(true);
  }

  function openEdit(item: ProfileLinkItem) {
    setEditingId(item.id);
    setDraft({ ...item });
    setCustomMode(!LABEL_OPTIONS.includes(item.label));
    setError(null);
    setOpen(true);
  }

  function save() {
    setError(null);
    if (customMode && !draft.label.trim()) {
      setError("Enter a label for this custom link.");
      return;
    }
    if (!draft.url.trim()) {
      setError("Enter a value first.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertProfileLinkAction({ id: editingId ?? undefined, label: draft.label, url: draft.url.trim() });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteProfileLinkAction(id);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <section className="rounded-2xl border border-black/[0.04] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-navy">Contact &amp; Links</h2>
          <SheetTrigger onClick={openAdd} className="text-xs font-medium text-teal-ink hover:underline">Edit</SheetTrigger>
        </div>

        {items.length > 0 && (
          <div className="mt-3 space-y-2.5">
            {items.map((item) => {
              const Icon = iconFor(item.label);
              return (
                <div key={item.id} className="group flex items-center gap-2.5">
                  <Icon className="size-4 shrink-0 text-navy/40" aria-hidden="true" />
                  <a href={hrefFor(item.label, item.url)} target={item.label === "Email" || item.label === "Phone" ? undefined : "_blank"} rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-navy/72 hover:text-teal-ink hover:underline">
                    {item.url}
                  </a>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.label}`} className="rounded-md p-1 text-navy/35 hover:bg-navy/5 hover:text-teal-ink">
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.label}`} className="rounded-md p-1 text-navy/35 hover:bg-navy/5 hover:text-destructive">
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <SheetTrigger onClick={openAdd} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-teal-ink hover:underline">
          <Plus className="size-3.5" aria-hidden="true" />
          Add another link
        </SheetTrigger>
      </section>

      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-navy/8 px-5 py-4">
          <SheetTitle>{editingId ? "Edit link" : "Add a link"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 px-5 py-5">
          <div>
            <label className="text-sm font-medium text-navy">Type</label>
            <select
              value={customMode ? "Custom" : draft.label}
              onChange={(e) => {
                if (e.target.value === "Custom") {
                  setCustomMode(true);
                  setDraft((d) => ({ ...d, label: "" }));
                } else {
                  setCustomMode(false);
                  setDraft((d) => ({ ...d, label: e.target.value }));
                }
              }}
              className="mt-1.5 h-9 w-full rounded-lg border border-gray-cool/60 bg-white px-2.5 text-sm text-navy focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30"
            >
              {LABEL_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              <option value="Custom">Custom</option>
            </select>
          </div>
          {customMode && (
            <div>
              <label htmlFor="link-label" className="text-sm font-medium text-navy">Label</label>
              <Input id="link-label" placeholder="e.g. Portfolio site" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} className="mt-1.5" />
            </div>
          )}
          <div>
            <label htmlFor="link-value" className="text-sm font-medium text-navy">
              {draft.label === "Email" ? "Email address" : draft.label === "Phone" ? "Phone number" : "URL"}
            </label>
            <Input
              id="link-value"
              type={draft.label === "Email" ? "email" : "text"}
              placeholder={draft.label === "Email" ? "you@example.com" : draft.label === "Phone" ? "+974 …" : "https://…"}
              value={draft.url}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <Button type="button" onClick={save} disabled={isPending} className="h-9 bg-teal text-white hover:bg-teal-ink">{isPending ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending} className="h-9">Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
