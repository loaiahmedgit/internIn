"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, ImagePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getProfileMediaUploadUrlAction, updateStudentMediaAction } from "@/lib/opportunities/student-profile-sections-actions";

export function ProfileHeroMedia({ avatarUrl, bannerUrl, initials }: { avatarUrl: string | null; bannerUrl: string | null; initials: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"avatar" | "banner" | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  async function upload(kind: "avatar" | "banner", file: File) {
    setBusy(kind);
    try {
      const { path, token, publicUrl } = await getProfileMediaUploadUrlAction(file.name, kind);
      const supabase = createClient();
      const { error } = await supabase.storage.from("student-portfolio").uploadToSignedUrl(path, token, file);
      if (error) throw new Error(error.message);
      await updateStudentMediaAction(kind === "avatar" ? { avatarUrl: publicUrl } : { bannerUrl: publicUrl });
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  function remove(kind: "avatar" | "banner") {
    startTransition(async () => {
      await updateStudentMediaAction(kind === "avatar" ? { avatarUrl: null } : { bannerUrl: null });
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <div className="relative h-[120px] w-full overflow-hidden bg-gradient-to-br from-teal/12 via-teal/6 to-transparent">
        {bannerUrl && <Image src={bannerUrl} alt="" fill sizes="1300px" className="object-cover" />}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={busy === "banner" || isPending}
            className="flex items-center gap-1.5 rounded-lg bg-white/85 px-2.5 py-1.5 text-xs font-medium text-navy shadow-sm backdrop-blur hover:bg-white"
          >
            <ImagePlus className="size-3.5" aria-hidden="true" />
            {busy === "banner" ? "Uploading…" : bannerUrl ? "Replace cover" : "Add cover"}
          </button>
          {bannerUrl && (
            <button type="button" onClick={() => remove("banner")} disabled={isPending} aria-label="Remove cover" className="rounded-lg bg-white/85 p-1.5 text-navy/60 shadow-sm backdrop-blur hover:bg-white hover:text-destructive">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("banner", f); e.target.value = ""; }} />
      </div>

      <div className="absolute -bottom-[38px] left-6 flex items-end gap-2">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-teal/10 shadow-sm">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-base font-semibold text-teal-ink">{initials}</div>
          )}
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={busy === "avatar" || isPending}
            aria-label={avatarUrl ? "Replace photo" : "Add photo"}
            className="absolute bottom-0 right-0 flex size-6 items-center justify-center rounded-full bg-navy text-white shadow-sm hover:bg-navy/85"
          >
            <Camera className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        {avatarUrl && (
          <button type="button" onClick={() => remove("avatar")} disabled={isPending} className="mb-1 text-xs font-medium text-navy/50 hover:text-destructive">
            Remove
          </button>
        )}
        <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("avatar", f); e.target.value = ""; }} />
      </div>
    </div>
  );
}
