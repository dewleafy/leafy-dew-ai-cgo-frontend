import { useEffect, useRef, useState } from "react";
import { socialMediaApi } from "./api";
import type { SocialMediaAsset } from "./api";

const MAX_BYTES = 50 * 1024 * 1024;

// Instagram needs JPEG photos. PNG, WebP and similar are converted here before upload.
async function toJpegIfNeeded(file: File): Promise<File> {
  if (file.type === "image/jpeg" || file.type.startsWith("video/")) return file;
  if (!file.type.startsWith("image/")) throw new Error(`${file.name}: only photos and MP4 or MOV videos can be uploaded.`);
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(`${file.name}: could not convert to JPEG.`);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error(`${file.name}: could not convert to JPEG.`);
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

function sizeLabel(bytes: number | null): string {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function MediaLibrary() {
  const [rows, setRows] = useState<SocialMediaAsset[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function load() {
    socialMediaApi
      .list()
      .then((res) => { setRows(Array.isArray(res.rows) ? res.rows : []); setState("ok"); })
      .catch(() => setState("error"));
  }

  useEffect(load, []);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMessage(null);
    const problems: string[] = [];
    let done = 0;
    for (const original of Array.from(files)) {
      try {
        const file = await toJpegIfNeeded(original);
        if (file.size > MAX_BYTES) throw new Error(`${original.name}: larger than 50 MB.`);
        const prep = await socialMediaApi.uploadUrl({ fileName: file.name, mimeType: file.type, sizeBytes: file.size });
        const form = new FormData();
        form.append("cacheControl", "3600");
        form.append("", file);
        const put = await fetch(prep.signedUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: form });
        if (!put.ok) throw new Error(`${original.name}: upload failed.`);
        await socialMediaApi.register({ path: prep.path, fileName: file.name, mimeType: file.type, sizeBytes: file.size });
        done += 1;
      } catch (e) {
        problems.push(e instanceof Error && e.message ? e.message : `${original.name}: upload failed.`);
      }
    }
    setMessage([done ? `${done} file${done > 1 ? "s" : ""} uploaded.` : "", ...problems].filter(Boolean).join(" "));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    load();
  }

  async function remove(row: SocialMediaAsset) {
    if (!window.confirm(`Delete ${row.fileName}? This cannot be undone.`)) return;
    try {
      await socialMediaApi.remove(row.id);
      setRows((r) => r.filter((x) => x.id !== row.id));
    } catch {
      setMessage("Could not delete the file. Try again.");
    }
  }

  async function copyLink(row: SocialMediaAsset) {
    try {
      await navigator.clipboard.writeText(row.publicUrl);
      setCopied(row.id);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setMessage(row.publicUrl);
    }
  }

  return (
    <section className="sm-real sm-media">
      <div className="sm-zh"><h2>Media Library</h2><span className="sm-pill sm-pill-live">live data</span></div>
      <p className="sm-zs">Upload photos and videos for posts. Files are stored publicly so Instagram can download them, so upload only post-ready pictures. Photos must be JPEG (PNG is converted for you). Videos: MP4 or MOV, up to 50 MB.</p>
      <div className="sm-realact">
        <input ref={inputRef} type="file" accept="image/*,video/mp4,video/quicktime" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Uploading..." : "Upload photos or videos"}</button>
      </div>
      {message ? <div className="sm-empty">{message}</div> : null}
      {state === "loading" ? <div className="sm-empty">Loading...</div> : state === "error" ? (
        <div className="sm-empty">Could not load the library. The backend may still be deploying.</div>
      ) : rows.length === 0 ? (
        <div className="sm-empty">No files yet.</div>
      ) : (
        <div className="sm-mediagrid">
          {rows.map((row) => (
            <figure className="sm-mediaitem" key={row.id}>
              {row.kind === "PHOTO"
                ? <img src={row.publicUrl} alt={row.fileName} loading="lazy" />
                : <video src={row.publicUrl} preload="metadata" muted playsInline />}
              <figcaption>
                <b title={row.fileName}>{row.fileName}</b>
                <span>{row.kind === "PHOTO" ? "Photo" : "Video"} · {sizeLabel(row.sizeBytes)}</span>
                <div className="sm-draftact">
                  <button type="button" className="secondary" onClick={() => copyLink(row)}>{copied === row.id ? "Copied" : "Copy link"}</button>
                  <button type="button" className="secondary" onClick={() => remove(row)}>Delete</button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
