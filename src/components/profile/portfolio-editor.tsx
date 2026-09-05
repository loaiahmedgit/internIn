"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImageIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { deletePortfolioItemAction, getPortfolioThumbnailUploadUrlAction, upsertPortfolioItemAction } from "@/lib/opportunities/student-profile-sections-actions";

export interface PortfolioItem {
  id: string;
  title: string;
  itemType: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  externalUrl: string | null;
  repositoryUrl: string | null;
  skills: string[];
  dateLabel: string | null;
}

const TYPE_OPTIONS = [
  "Software project",
  "GitHub repository",
  "Figma design",
  "Behance project",
  "Architecture project",
  "Writing sample",
  "Research paper",
  "Presentation",
  "Marketing campaign",
  "Case study",
  "Video",
  "Photography",
  "Engineering project",
  "Finance model",
  "Data analysis",
  "PDF document",
  "External URL",
  "Other",
];

function toList(value: string) {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

type Draft = Omit<PortfolioItem, "id" | "skills"> & { skillsText: string };

function emptyDraft(): Draft {
  return { title: "", itemType: TYPE_OPTIONS[0], description: "", thumbnailUrl: "", externalUrl: "", repositoryUrl: "", dateLabel: "", skillsText: "" };
}

export function PortfolioEditor({ items }: { items: PortfolioItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft());
    setError(null);
    setOpen(true);
  }

  function openEdit(item: PortfolioItem) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      itemType: item.itemType ?? TYPE_OPTIONS[0],
      description: item.description ?? "",
      thumbnailUrl: item.thumbnailUrl ?? "",
      externalUrl: item.externalUrl ?? "",
      repositoryUrl: item.repositoryUrl ?? "",
      dateLabel: item.dateLabel ?? "",
      skillsText: item.skills.join(", "),
    });
    setError(null);
    setOpen(true);
  }

  async function handleThumbnail(file: File) {
    setUploading(true);
    setError(null);
    try {
      const { path, token, publicUrl } = await getPortfolioThumbnailUploadUrlAction(file.name);
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("student-portfolio").uploadToSignedUrl(path, token, file);
      if (uploadError) throw new Error(`Couldn't upload "${file.name}": ${uploadError.message}`);
      setDraft((d) => ({ ...d, thumbnailUrl: publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setError(null);
    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertPortfolioItemAction({
          id: editingId ?? undefined,
          title: draft.title,
          itemType: draft.itemType || undefined,
          description: draft.description || undefined,
          thumbnailUrl: draft.thumbnailUrl || undefined,
          externalUrl: draft.externalUrl || undefined,
          repositoryUrl: draft.repositoryUrl || undefined,
          skills: toList(draft.skillsText),
          dateLabel: draft.dateLabel || undefined,
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deletePortfolioItemAction(id);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <section id="portfolio" className="scroll-mt-24 rounded-2xl border border-black/[0.04] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-4px_rgba(16,24,40,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-4 text-teal-ink" aria-hidden="true" />
            <h2 className="text-base font-semibold text-navy">Portfolio</h2>
          </div>
          <SheetTrigger onClick={openAdd} className="flex items-center gap-1 text-sm font-medium text-teal-ink hover:underline">
            <Plus className="size-3.5" aria-hidden="true" />
            Add project
          </SheetTrigger>
        </div>

        {items.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="group relative overflow-hidden rounded-xl border border-black/[0.04]">
                <button type="button" onClick={() => openEdit(item)} className="block w-full text-left">
                  <div className="relative aspect-[4/3] w-full bg-navy/5">
                    {item.thumbnailUrl ? (
                      <Image src={item.thumbnailUrl} alt={item.title} fill sizes="200px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center"><ImageIcon className="size-6 text-navy/20" aria-hidden="true" /></div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-medium text-navy">{item.title}</p>
                    {item.itemType && <p className="truncate text-xs text-navy/50">{item.itemType}</p>}
                  </div>
                </button>
                <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.title}`} className="rounded-md bg-white/90 p-1.5 text-navy/50 shadow-sm hover:text-destructive">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-navy/55">Show what you&apos;ve built, designed, written, researched, or created.</p>
        )}
      </section>

      <SheetContent className="flex flex-col gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-navy/8 px-5 py-4">
          <SheetTitle>{editingId ? "Edit project" : "Add project"}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 px-5 py-5">
          <div>
            <label htmlFor="pf-title" className="text-sm font-medium text-navy">Title</label>
            <Input id="pf-title" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label className="text-sm font-medium text-navy">Type</label>
            <select value={draft.itemType ?? ""} onChange={(e) => setDraft((d) => ({ ...d, itemType: e.target.value }))} className="mt-1.5 h-9 w-full rounded-lg border border-gray-cool/60 bg-white px-2.5 text-sm text-navy focus-visible:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/30">
              {TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pf-desc" className="text-sm font-medium text-navy">Description (optional)</label>
            <Textarea id="pf-desc" value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={3} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="pf-thumb" className="text-sm font-medium text-navy">Thumbnail image (optional)</label>
            {draft.thumbnailUrl && (
              <div className="relative mt-1.5 aspect-[4/3] w-32 overflow-hidden rounded-lg border border-navy/10">
                <Image src={draft.thumbnailUrl} alt="" fill sizes="128px" className="object-cover" />
              </div>
            )}
            <input
              id="pf-thumb"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleThumbnail(file);
                e.target.value = "";
              }}
              className="mt-1.5 text-sm text-navy/70"
            />
            {uploading && <p className="mt-1 text-xs text-navy/50">Uploading…</p>}
          </div>
          <div>
            <label htmlFor="pf-external" className="text-sm font-medium text-navy">External link (optional)</label>
            <Input id="pf-external" type="url" placeholder="https://…" value={draft.externalUrl ?? ""} onChange={(e) => setDraft((d) => ({ ...d, externalUrl: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="pf-repo" className="text-sm font-medium text-navy">Repository link (optional)</label>
            <Input id="pf-repo" type="url" placeholder="https://github.com/…" value={draft.repositoryUrl ?? ""} onChange={(e) => setDraft((d) => ({ ...d, repositoryUrl: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="pf-date" className="text-sm font-medium text-navy">Date (optional)</label>
            <Input id="pf-date" placeholder="2026, or Fall 2026" value={draft.dateLabel ?? ""} onChange={(e) => setDraft((d) => ({ ...d, dateLabel: e.target.value }))} className="mt-1.5" />
          </div>
          <div>
            <label htmlFor="pf-skills" className="text-sm font-medium text-navy">Skills / tools (optional)</label>
            <Input id="pf-skills" placeholder="React, Figma, Python…" value={draft.skillsText} onChange={(e) => setDraft((d) => ({ ...d, skillsText: e.target.value }))} className="mt-1.5" />
            <p className="mt-1 text-xs text-navy/50">Comma-separated.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <Button type="button" onClick={save} disabled={isPending || uploading} className="h-9 bg-teal text-white hover:bg-teal-ink">{isPending ? "Saving…" : "Save"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending} className="h-9">Cancel</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
