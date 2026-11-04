"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_IMAGES } from "@/lib/listings/input";
import { cx } from "@/lib/format";

type Mode = "blob" | "local" | "none";
type Pending = { key: string; name: string; error?: string };

const MAX_EDGE = 2000;

/** Downscale to MAX_EDGE px and re-encode as JPEG. Phone photos shrink from ~6 MB to ~400 KB. */
async function prepare(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) {
    throw new Error("Use a JPG, PNG or WebP photo.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This browser can’t read that photo. Save it as JPG and try again.");
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.type === "image/jpeg" && file.size < 1_500_000) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.84));
  if (!blob) throw new Error("Couldn’t process that photo.");
  return blob;
}

async function send(mode: Mode, blob: Blob, folder: string, name: string): Promise<string> {
  const safe = name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 40) || "photo";
  if (mode === "blob") {
    const { upload } = await import("@vercel/blob/client");
    const r = await upload(`listings/${folder}/${safe}.jpg`, blob, {
      access: "public",
      handleUploadUrl: "/api/admin/upload",
      contentType: blob.type || "image/jpeg",
    });
    return r.url;
  }
  if (mode === "local") {
    const fd = new FormData();
    fd.append("file", blob, `${safe}.jpg`);
    const res = await fetch("/api/admin/upload/local", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Upload failed.");
    return data.url;
  }
  throw new Error("Photo storage isn’t set up yet. Add a Vercel Blob store to the project.");
}

export function PhotoUploader({
  images,
  onChange,
  folder,
  onBusyChange,
}: {
  images: string[];
  onChange: (next: string[]) => void;
  folder: string;
  /** Number of uploads still running, so the form can hold saving until they finish. */
  onBusyChange?: (uploading: number) => void;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const uploading = pending.filter((p) => !p.error).length;
  useEffect(() => onBusyChange?.(uploading), [uploading, onBusyChange]);
  const [drag, setDrag] = useState(false);
  const modeRef = useRef<Mode | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The photo list as of the last change we made, so uploads finishing back to back never
  // overwrite each other while React hasn't re-rendered yet.
  const latest = useRef(images);
  latest.current = images;
  const inFlight = useRef(0);
  const commit = (next: string[]) => {
    latest.current = next;
    onChange(next);
  };

  async function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const room = MAX_IMAGES - latest.current.length - inFlight.current;
    if (room <= 0) return;
    inFlight.current += Math.min(room, list.length);
    if (!modeRef.current) {
      const r = await fetch("/api/admin/upload").then((x) => x.json()).catch(() => ({ mode: "none" }));
      modeRef.current = r.mode ?? "none";
    }
    const batch = list.slice(0, room).map((file) => ({ file, key: `${file.name}-${Math.random()}` }));
    setPending((p) => [...p, ...batch.map(({ file, key }) => ({ key, name: file.name }))]);
    for (const { file, key } of batch) {
      try {
        const blob = await prepare(file);
        const url = await send(modeRef.current!, blob, folder, file.name);
        if (!latest.current.includes(url)) commit([...latest.current, url]);
        setPending((p) => p.filter((x) => x.key !== key));
      } catch (err) {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: (err as Error).message || "Upload failed." } : x)));
      } finally {
        inFlight.current -= 1;
      }
    }
  }

  const move = (i: number, d: number) => {
    const next = [...latest.current];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  return (
    <div className="lf-photos">
      <ol className="lf-thumbs">
        {images.map((src, i) => (
          <li key={src} className="lf-thumb">
            <img src={src} alt={`Photo ${i + 1}`} />
            {i === 0 && <span className="lf-cover">Cover</span>}
            <div className="lf-thumb-actions">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`}>
                ←
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label={`Move photo ${i + 1} later`}>
                →
              </button>
              <button type="button" onClick={() => commit(latest.current.filter((u) => u !== src))} aria-label={`Remove photo ${i + 1}`}>
                ✕
              </button>
            </div>
          </li>
        ))}
        {pending.map((p) => (
          <li key={p.key} className={cx("lf-thumb lf-thumb-pending", p.error && "is-error")}>
            <span>{p.error ? p.error : `Uploading ${p.name}…`}</span>
            {p.error && (
              <button type="button" className="text-link" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
                Dismiss
              </button>
            )}
          </li>
        ))}
      </ol>
      {images.length < MAX_IMAGES && (
        <div
          className={cx("lf-drop", drag && "is-drag")}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
        >
          <p>
            Drag photos here, or{" "}
            <button type="button" className="text-link" onClick={() => inputRef.current?.click()}>
              choose files
            </button>
            . JPG, PNG or WebP — large photos are resized automatically. The first photo is the cover.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}
      <p className="st-hint">
        {images.length} of {MAX_IMAGES} photos
      </p>
    </div>
  );
}
