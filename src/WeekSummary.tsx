import { useEffect, useState } from "react";
import { socialSummaryApi } from "./api";
import type { SocialSummary } from "./api";

const STATE_LABEL: Record<string, string> = { READY: "Ready", NEEDS_APPROVAL: "Needs your Approve", NEEDS_EDITS: "Needs edits", HELD: "On hold", MEDIA_PENDING: "Picture or video pending" };

export default function WeekSummary() {
  const [data, setData] = useState<SocialSummary | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    socialSummaryApi.get().then(setData).catch(() => setError(true));
  }, []);
  return (
    <section className="sm-real">
      <div className="sm-zh"><h2>This week</h2><span className="sm-pill sm-pill-live">live data</span></div>
      {error ? <div className="sm-empty">Could not load the weekly view. The backend may still be deploying.</div> : null}
      {data ? (
        <>
          <p className="sm-zs">Next 7 days. Posted in the last 7 days: {data.postedLast7Days}.</p>
          {data.items.length === 0 ? <div className="sm-empty">No drafts for the next 7 days.</div> : (
            <div className="sm-draftlist">
              {data.items.map((i) => (
                <div className="sm-draftmeta" key={i.id}>
                  <b>{i.date}{i.time ? ` · ${i.time}` : ""}</b> · {i.format ?? ""} · {i.occasion ?? ""} · <b>{STATE_LABEL[i.state] ?? i.state}</b>. {i.note}
                </div>
              ))}
            </div>
          )}
          {data.noDraft.length ? (
            <div className="sm-empty">No draft yet for: {data.noDraft.map((n) => `${n.date} (${n.title ?? n.format ?? ""})`).join("; ")}. Press Write next drafts.</div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
