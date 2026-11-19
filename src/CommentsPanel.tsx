import { useEffect, useState } from "react";
import { socialCommentsApi } from "./api";
import type { SocialComment } from "./api";

export default function CommentsPanel() {
  const [rows, setRows] = useState<SocialComment[]>([]);
  const [text, setText] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function accept(list: SocialComment[]) {
    setRows(list);
    setText((t) => {
      const next = { ...t };
      for (const r of list) if (next[r.id] === undefined) next[r.id] = r.suggested_reply ?? "";
      return next;
    });
  }
  useEffect(() => { socialCommentsApi.list().then((r) => accept(r.rows)).catch(() => setMsg("Could not load comments. The backend may still be deploying.")); }, []);

  async function check() {
    setBusy(true); setMsg(null);
    try {
      const r = await socialCommentsApi.sync();
      accept(r.rows);
      setMsg(r.rows.length === 0 ? "No comments to reply to." : `${r.drafted} reply draft${r.drafted === 1 ? "" : "s"} written.${r.aiBlocked ? ` AI stopped: ${r.aiBlocked}.` : ""}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not read comments. Instagram may need the comments permission.");
    }
    setBusy(false);
  }
  async function send(id: string) {
    if (!window.confirm("Post this reply on Instagram now?")) return;
    setBusy(true); setMsg(null);
    try {
      await socialCommentsApi.send(id, text[id] ?? "");
      setRows((r) => r.map((x) => (x.id === id ? { ...x, status: "REPLIED" } : x)));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not send the reply.");
    }
    setBusy(false);
  }
  async function ignore(id: string) {
    setBusy(true);
    try { await socialCommentsApi.ignore(id); setRows((r) => r.filter((x) => x.id !== id)); } catch { setMsg("Could not ignore this comment."); }
    setBusy(false);
  }

  return (
    <section className="sm-real">
      <div className="sm-zh"><h2>Comments to reply</h2><span className="sm-pill sm-pill-live">live data</span></div>
      <p className="sm-zs">New comments on your posts, with a suggested reply. Nothing is sent until you press Send.</p>
      <div className="sm-realact"><button type="button" onClick={check} disabled={busy}>{busy ? "Working..." : "Check comments"}</button></div>
      {msg ? <div className="sm-empty">{msg}</div> : null}
      <div className="sm-draftlist">
        {rows.map((r) => (
          <article className="sm-draft" key={r.id}>
            <header><b>@{r.username ?? "someone"}</b><span className="sm-pill">{r.status === "NEEDS_OWNER" ? "Needs you" : r.status === "REPLIED" ? "Replied" : "Suggested reply"}</span></header>
            <p className="sm-draftcap">{r.comment_text}</p>
            {r.status !== "REPLIED" ? (
              <>
                <textarea className="sm-replybox" rows={2} maxLength={300} value={text[r.id] ?? ""} onChange={(e) => setText((t) => ({ ...t, [r.id]: e.target.value }))} />
                <div className="sm-draftact">
                  <button type="button" disabled={busy || !(text[r.id] ?? "").trim()} onClick={() => send(r.id)}>Send reply</button>
                  <button type="button" className="secondary" disabled={busy} onClick={() => ignore(r.id)}>Ignore</button>
                </div>
              </>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
