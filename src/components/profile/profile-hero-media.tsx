"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, ImagePlus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getProfileMediaUploadUrlAction, updateStudentMediaAction } from "@/lib/opportunities/student-profile-sections-actions";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_BANNER_BYTES = 8 * 1024 * 1024; // 8MB — matches the bucket's own limit

function validateImage(file: File, maxBytes: number): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return "Only JPG, PNG, or WebP images are supported.";
  if (file.size > maxBytes) return `That image is too large — max ${Math.round(maxBytes / (1024 * 1024))}MB.`;
  return null;
}

export function ProfileHeroMedia({ avatarUrl, bannerUrl, initials }: { avatarUrl: string | null; bannerUrl: string | null; initials: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"avatar" | "banner" | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  async function upload(kind: "avatar" | "banner", file: File) {
    const setLocalError = kind === "avatar" ? setAvatarError : setBannerError;
    setLocalError(null);
    const validationError = validateImage(file, kind === "avatar" ? MAX_AVATAR_BYTES : MAX_BANNER_BYTES);
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setBusy(kind);
    try {
      const { path, token, publicUrl } = await getProfileMediaUploadUrlAction(file.name, kind);
      const supabase = createClient();
      const { error } = await supabase.storage.from("student-portfolio").uploadToSignedUrl(path, token, file);
      if (error) throw new Error(error.message);
      await updateStudentMediaAction(kind === "avatar" ? { avatarUrl: publicUrl } : { bannerUrl: publicUrl });
      startTransition(() => router.refresh());
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function remove(kind: "avatar" | "banner") {
    const setLocalError = kind === "avatar" ? setAvatarError : setBannerError;
    setLocalError(null);
    startTransition(async () => {
      try {
        await updateStudentMediaAction(kind === "avatar" ? { avatarUrl: null } : { bannerUrl: null });
        router.refresh();
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Couldn't remove. Try again.");
      }
    });
  }

  return (
    <div className="relative">
      <div className="relative h-[120px] w-full overflow-hidden bg-gradient-to-br from-teal/12 via-teal/6 to-transparent">
        {bannerUrl && <Image src={bannerUrl} alt="" fill sizes="1300px" className="object-cover" />}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
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
          {bannerError && <p className="pointer-events-none max-w-[220px] rounded-lg bg-white/90 px-2 py-1 text-right text-[11px] font-medium text-destructive shadow-sm">{bannerError}</p>}
        </div>
        <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("banner", f); e.target.value = ""; }} />
      </div>

      <div className="absolute -bottom-[38px] left-6 flex items-end gap-2">
        <div className="relative size-20 shrink-0">
          <div className="size-20 overflow-hidden rounded-full border-4 border-white bg-teal/10 shadow-sm">
            {avatarUrl ? (
              <div className="relative h-full w-full">
                <Image src={avatarUrl} alt="Profile photo" fill sizes="80px" className="object-cover" />
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-base font-semibold text-teal-ink">{initials}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={busy === "avatar" || isPending}
            aria-label="Change profile photo"
            className="absolute bottom-0 right-0 flex size-7 translate-x-[20%] translate-y-[20%] items-center justify-center rounded-full border-2 border-white bg-navy text-white shadow-md hover:bg-navy/85"
          >
            <Camera className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        {avatarUrl && (
          <button type="button" onClick={() => remove("avatar")} disabled={isPending} className="mb-1 text-xs font-medium text-navy/50 hover:text-destructive">
            Remove
          </button>
        )}
        <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload("avatar", f); e.target.value = ""; }} />
      </div>
      {avatarError && <p className="pointer-events-none absolute -bottom-[62px] left-6 max-w-[240px] text-xs font-medium text-destructive">{avatarError}</p>}
    </div>
  );
}
