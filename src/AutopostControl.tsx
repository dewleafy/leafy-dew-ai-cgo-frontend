import { useEffect, useState } from "react";
import { socialAutopostApi } from "./api";
import type { AutopostLogRow, AutopostSettings } from "./api";

const LABEL: Record<string, string> = { WOULD_POST: "Would post", POSTING: "Posting", POSTED: "Posted", FAILED: "Failed", SKIPPED: "Skipped" };

export default function AutopostControl() {
  const [settings, setSettings] = useState<AutopostSettings | null>(null);
  const [log, setLog] = useState<AutopostLogRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await socialAutopostApi.get();
      setSettings(res.settings);
      setLog(res.log);
    } catch {
      setMsg("Could not load auto-post status. The backend may still be deploying.");
    }
  }
  useEffect(() => { void load(); }, []);

  async function change(mode: "OFF" | "SHADOW" | "LIVE") {
    if (mode === "LIVE" && !window.confirm("Switch to LIVE? Approved posts will be published to Instagram automatically on their planned day and time.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await socialAutopostApi.setMode(mode);
      setSettings(res.settings);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not change the mode.");
    }
    setBusy(false);
  }

  async function checkNow() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await socialAutopostApi.checkNow();
      setMsg(res.result);
      setLog(res.log);
    } catch {
      setMsg("Could not run the check.");
    }
    setBusy(false);
  }

  return (
    <section className="sm-real">
      <div className="sm-zh"><h2>Auto-posting</h2><span className="sm-pill sm-pill-live">live data</span></div>
      {settings ? (
        <>
          <p className="sm-zs">
            Mode: <b>{settings.mode === "SHADOW" ? "Shadow (practice, posts nothing)" : settings.mode === "LIVE" ? "LIVE (publishing)" : "OFF"}</b>.
            {" "}Shadow day {Math.min(settings.shadowDays, settings.shadowDaysRequired)} of {settings.shadowDaysRequired}. Live unlocks after {settings.shadowDaysRequired} days.
            {" "}Only Approved drafts on their planned day and time are used. One post a day at most.
          </p>
          <div className="sm-realact">
            <button type="button" onClick={checkNow} disabled={busy}>Check now</button>
            <button type="button" className="secondary" onClick={() => change("SHADOW")} disabled={busy || settings.mode === "SHADOW"}>Shadow</button>
            <button type="button" className="secondary" onClick={() => change("OFF")} disabled={busy || settings.mode === "OFF"}>Stop all (OFF)</button>
            <button type="button" className="secondary" onClick={() => change("LIVE")} disabled={busy || settings.mode === "LIVE" || !settings.liveAllowed}>Go LIVE</button>
          </div>
          {settings.mode === "LIVE" && !settings.publishSwitchOn ? <div className="sm-empty">Live is on, but the Railway setting INSTAGRAM_PUBLISH_ENABLED is not true, so nothing will post.</div> : null}
        </>
      ) : null}
      {msg ? <div className="sm-empty">{msg}</div> : null}
      {log.length ? (
        <div className="sm-draftlist">
          {log.slice(0, 8).map((r) => (
            <div className="sm-draftmeta" key={r.id}>
              <b>{LABEL[r.outcome] ?? r.outcome}</b> · {new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {r.message ?? ""}
              {r.permalink ? <> · <a href={r.permalink} target="_blank" rel="noreferrer">view</a></> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
