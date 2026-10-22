import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./social-media.css";
import { socialContentLogApi } from "./api";
import type { SocialContentLogRow } from "./types";

/*
  Social Media tab (preview).
  An animated sample run of an agent team that runs social media: a crew lead, eight departments,
  shared knowledge, and four points where it stops and asks the founder.
  Nothing here posts, replies or edits anything. The numbers in the sample run are made up.
  The only live data on this page is the founder's own Social Content Calendar log (bottom card).
*/

const SELLER_ID = "default";
const BRANDS = ["Leafy Dew", "Ziro Kart"] as const;
type Brand = (typeof BRANDS)[number];

type Dept = { id: string; name: string; role: string; idle: string; tools: [string, string][] };

const DEPTS: Dept[] = [
  { id: "d1", name: "Research", role: "Finds angles worth posting", idle: "Waiting for the plan",
    tools: [["Rv", "Review miner"], ["Tr", "Trends"], ["Ba", "Brand Analytics"], ["Rd", "Reddit"], ["Cp", "Competitors"]] },
  { id: "d2", name: "Strategy", role: "Turns angles into a week", idle: "Waiting for research",
    tools: [["Cal", "Calendar"], ["Au", "Audience"], ["Kp", "KPI goals"], ["Ex", "Experiments"], ["Mx", "Channel mix"]] },
  { id: "d3", name: "Copy", role: "Hooks, captions, scripts", idle: "Waiting for the calendar",
    tools: [["Hk", "Hooks"], ["Cp", "Captions"], ["Sc", "Scripts"], ["Hi", "Hindi"], ["En", "English"]] },
  { id: "d4", name: "Visual", role: "Images and short video", idle: "Waiting for copy",
    tools: [["Cv", "Canva"], ["Cc", "CapCut"], ["Im", "Image variants"], ["Vd", "Clip cutter"], ["Alt", "Alt text"]] },
  { id: "d5", name: "Compliance", role: "Checks claims and rules", idle: "Checks everything before you see it",
    tools: [["Cl", "Claims"], ["Am", "Amazon rules"], ["As", "ASCI code"], ["Mu", "Music rights"], ["Br", "Brand check"]] },
  { id: "d6", name: "Publish", role: "Schedules approved posts", idle: "Only moves after your approval",
    tools: [["Ig", "Instagram"], ["Yt", "YT Shorts"], ["Pi", "Pinterest"], ["Fb", "Facebook"], ["Sc", "Scheduler"]] },
  { id: "d7", name: "Engage", role: "Replies and escalates", idle: "Starts when posts go live",
    tools: [["Cm", "Comments"], ["Dm", "DMs"], ["Qa", "Product Q&A"], ["Cr", "Creators"], ["Es", "Escalate"]] },
  { id: "d8", name: "Analytics", role: "Measures and teaches the crew", idle: "Reads results after posting",
    tools: [["In", "Insights"], ["At", "Attribution"], ["Ut", "UTM links"], ["Wr", "Weekly report"], ["Lr", "Learnings"]] }
];

const INPUTS: [string, string, string][] = [
  ["Br", "Weekly brief", "one line, from you"],
  ["Ct", "Catalogue", "listings, prices, images"],
  ["Rv", "Reviews and Q&A", "last 90 days"],
  ["Tr", "Trend feeds", "search, social, festivals"],
  ["Kt", "Brand kit", "logo, colours, fonts"],
  ["Cl", "Calendar", "festivals and launches"]
];

const FOLDERS: [string, string][] = [
  ["brand-voice/", "tone and phrases"],
  ["product-facts/", "what each listing really is"],
  ["claims-to-avoid/", "rules agents must follow"],
  ["past-winners/", "posts that worked"],
  ["audience/", "who we write for"],
  ["platform-rules/", "per channel"]
];

const PIPELINE: [string, string][] = [["Brief", "read inputs"], ["Plan", "split tasks"], ["Delegate", "8 departments"], ["Review", "learn, repeat"]];

const CHECKPOINTS: { label: string; step: number }[] = [
  { label: "Approve the week before anything posts", step: 7 },
  { label: "Decide on any flagged claim", step: 6 },
  { label: "Answer escalated messages", step: 9 },
  { label: "Read the Friday review", step: 10 }
];

type Step = {
  title: string;
  desc: string;
  pipe: number;
  dur: number;
  on: string[];
  acts: Record<string, string>;
  log: [string, string][];
  outLabel: string;
  out: (brand: Brand, next: () => void) => ReactNode;
};

function Mono({ children }: { children: ReactNode }) {
  return <span className="sm-mono">{children}</span>;
}

function Row({ m, title, sub, status, tone = "ok" }: { m: string; title: string; sub: string; status: string; tone?: "ok" | "warn" | "quiet" }) {
  return (
    <div className="sm-row">
      <Mono>{m}</Mono>
      <div><b>{title}</b><span>{sub}</span></div>
      <i className={`sm-st sm-st-${tone}`}>{status}</i>
    </div>
  );
}

const STEPS: Step[] = [
  {
    title: "Brief arrives", pipe: 0, dur: 6500, on: ["inp", "orch"],
    desc: "You send one line. The crew lead reads the catalogue, calendar and reviews before doing anything.",
    acts: {},
    log: [["you", "Push the festive gifting sets this week"], ["catalogue", "listings loaded"], ["calendar", "festive window ahead, 3 free slots"], ["crew lead", "brief understood, opening knowledge"]],
    outLabel: "Weekly brief",
    out: (brand) => (
      <>
        <div className="sm-card-in">
          <pre className="sm-script"><span className="sm-dim">FROM YOU · MONDAY MORNING · {brand.toUpperCase()}</span>{"\n"}Push the festive gifting sets this week.{"\n"}5 posts and 2 reels. Hindi + English.{"\n"}No paid spend.</pre>
        </div>
        <div className="sm-rows">
          <Row m="Pf" title="Platforms" sub="Instagram, YouTube Shorts, Pinterest" status="set" />
          <Row m="Ap" title="Approval rule" sub="Nothing goes live without your OK" status="on" />
        </div>
      </>
    )
  },
  {
    title: "Plan the week", pipe: 1, dur: 6500, on: ["orch", "kb"],
    desc: "The crew lead opens brand voice, claims to avoid and past winners, then splits the brief into tasks.",
    acts: { kb: "Reading brand rules" },
    log: [["knowledge", "read brand-voice"], ["knowledge", "read claims-to-avoid, 14 rules"], ["knowledge", "read past-winners, top 5 reels"], ["crew lead", "8 tasks, 3 can run in parallel"]],
    outLabel: "Task graph",
    out: () => (
      <div className="sm-rows">
        <Row m="1" title="Research" sub="3 angles from reviews and trends" status="queued" tone="quiet" />
        <Row m="2" title="Strategy" sub="7-day calendar" status="after 1" tone="quiet" />
        <Row m="3" title="Copy" sub="hooks, captions, scripts" status="after 2" tone="quiet" />
        <Row m="4" title="Visual" sub="images and reels" status="after 3" tone="quiet" />
        <Row m="5" title="Compliance" sub="claims and platform rules" status="before you" tone="quiet" />
        <Row m="6" title="Publish" sub="schedule posts" status="after OK" tone="quiet" />
      </div>
    )
  },
  {
    title: "Find the angles", pipe: 2, dur: 7000, on: ["d1"],
    desc: "Research reads reviews, search trends and past winners, then hands over ranked angles.",
    acts: { d1: "Reading reviews and 3 trend feeds" },
    log: [["research", "reviews: 212 read"], ["research", "'gift-ready packaging' repeats 31 times"], ["research", "trend feeds: gifting interest rising"], ["research", "2 of top 5 past reels were unboxings"], ["research", "3 angles ranked, handing to strategy"]],
    outLabel: "Ranked angles",
    out: () => (
      <>
        <div className="sm-rows">
          <Row m="1" title="Gift-ready packaging" sub="31 review mentions" status="0.82" />
          <Row m="2" title="Gifting under a set budget" sub="rising search interest" status="0.74" />
          <Row m="3" title="Family unboxing moment" sub="2 of 5 past top reels" status="0.69" />
        </div>
        <p className="sm-note">Sample run. Numbers are made up.</p>
      </>
    )
  },
  {
    title: "Build the calendar", pipe: 2, dur: 6500, on: ["d2"],
    desc: "Strategy places each angle on a day and channel and sets one thing to test.",
    acts: { d2: "Placing 5 posts and 2 reels" },
    log: [["strategy", "7 slots across 3 channels"], ["strategy", "reels on Wed and Fri for reach"], ["strategy", "experiment: hook A vs hook B"], ["strategy", "calendar ready, handing to copy"]],
    outLabel: "Week at a glance",
    out: () => (
      <div className="sm-cal">
        {[["MON", "Packaging photo", "Instagram"], ["TUE", "Gift ideas board", "Pinterest"], ["WED", "Unboxing reel", "Instagram"], ["THU", "Review spotlight", "Instagram"], ["FRI", "Unboxing short", "YT Shorts"], ["SAT", "Set comparison", "Instagram"], ["SUN", "Gift ideas board", "Pinterest"]].map(([d, a, c]) => (
          <div key={d}><b>{d}</b><span>{a}</span><em>{c}</em></div>
        ))}
      </div>
    )
  },
  {
    title: "Write the words", pipe: 2, dur: 7000, on: ["d3"],
    desc: "Copy writes hooks, captions and the reel script in Hindi and English, in the brand voice.",
    acts: { d3: "Drafting 7 captions and 2 scripts" },
    log: [["copy", "brand voice loaded"], ["copy", "12 hook options, keeping 2 for the test"], ["copy", "7 captions, Hindi + English"], ["copy", "2 reel scripts drafted"]],
    outLabel: "Reel script, Wednesday",
    out: (brand) => (
      <div className="sm-card-in">
        <pre className="sm-script"><span className="sm-dim">REEL · 18s · HINDI + ENGLISH · {brand.toUpperCase()}</span>{"\n"}<span className="sm-dim">0:00</span> Hook   "Gift sorted in 30 seconds."{"\n"}<span className="sm-dim">0:03</span> Beat   Hands open the box, tissue folds back{"\n"}<span className="sm-dim">0:09</span> Proof  A real review appears on screen{"\n"}<span className="sm-dim">0:15</span> CTA    "Ships in time for the festive week.{"\n"}                Link in bio."</pre>
      </div>
    )
  },
  {
    title: "Make the visuals", pipe: 2, dur: 6500, on: ["d4"],
    desc: "Visual turns the scripts into images and short videos sized for each channel.",
    acts: { d4: "Cutting 2 reels, 9 image sets" },
    log: [["visual", "9 product images, 3 variants each"], ["visual", "reel 1 cut to 18s, captions burned in"], ["visual", "reel 2 cut to 15s for Shorts"], ["visual", "14 alt-texts written"]],
    outLabel: "Asset list",
    out: () => (
      <div className="sm-rows">
        <Row m="Im" title="9 images" sub="3 variants each, 4:5 and 2:3" status="ready" />
        <Row m="Vd" title="2 reels" sub="18s Instagram, 15s Shorts" status="ready" />
        <Row m="Alt" title="14 alt-texts" sub="one per image and video" status="ready" />
      </div>
    )
  },
  {
    title: "Check the rules", pipe: 2, dur: 7500, on: ["d5", "own"],
    desc: "Compliance reads every post against claims, platform and music rules. One post is held.",
    acts: { d5: "Checking 7 items against 14 rules", own: "One flagged claim for you" },
    log: [["compliance", "claims list: 13 of 14 clear"], ["compliance", "Amazon brand-use rules: clear"], ["compliance", "ad code and music rights: clear"], ["compliance", "HELD: Wed reel promises delivery timing"], ["compliance", "suggested fix attached, asking owner"]],
    outLabel: "Check results",
    out: () => (
      <>
        <div className="sm-rows">
          <Row m="Cl" title="Claims list" sub="13 of 14 rules clear" status="1 held" tone="warn" />
          <Row m="Am" title="Amazon rules" sub="brand use and links" status="clear" />
          <Row m="As" title="Ad code" sub="no restricted claims" status="clear" />
          <Row m="Mu" title="Music rights" sub="licensed tracks only" status="clear" />
        </div>
        <div className="sm-held"><small>HELD FOR YOU</small><p>Wed reel CTA says "Ships in time for the festive week". Delivery dates are not guaranteed. Suggested: "Order early for the festive week."</p></div>
      </>
    )
  },
  {
    title: "You decide", pipe: 3, dur: 8000, on: ["own"],
    desc: "The crew pauses here. You approve the week and the fix, or ask for changes. Nothing posts without you.",
    acts: { own: "Waiting for your answer" },
    log: [["crew lead", "approval card ready for you"], ["crew lead", "7 items ready, 1 with a fix"], ["you", "reads the fix, approves"], ["crew lead", "approved, releasing to publish"]],
    outLabel: "Approval inbox",
    out: (_brand, next) => (
      <>
        <div className="sm-phone">
          <small>Approval needed</small>
          <p>7 items ready for this week. One reel CTA was reworded to avoid a delivery promise.</p>
          <div className="sm-btns">
            <button type="button" onClick={next}>Approve all 7</button>
            <button type="button" className="secondary" onClick={next}>Review changes</button>
          </div>
        </div>
        <p className="sm-note">Preview only. These buttons just move the sample run forward.</p>
      </>
    )
  },
  {
    title: "Schedule the posts", pipe: 3, dur: 7000, on: ["d6"],
    desc: "Publish queues each approved item at the best slot for its channel.",
    acts: { d6: "Scheduling 7 items on 3 channels" },
    log: [["publish", "Instagram: 4 items queued"], ["publish", "Pinterest: 2 boards queued"], ["publish", "YouTube Shorts: 1 queued"], ["publish", "UTM link added to every post"]],
    outLabel: "Queue",
    out: () => (
      <div className="sm-pb">
        {[["Ig", "Instagram", "4 of 4"], ["Pi", "Pinterest", "2 of 2"], ["Yt", "YouTube Shorts", "1 of 1"]].map(([m, n, c]) => (
          <div key={m}><Mono>{m}</Mono><div>{n}<div className="sm-track"><i className="sm-fill" /></div></div><em>{c}</em></div>
        ))}
      </div>
    )
  },
  {
    title: "Reply and escalate", pipe: 3, dur: 7500, on: ["d7", "own"],
    desc: "Engage answers simple comments in the brand voice and hands anything sensitive to you.",
    acts: { d7: "Reading comments and DMs", own: "One message needs you" },
    log: [["engage", "18 comments read"], ["engage", "15 answered from product facts"], ["engage", "2 creator requests logged"], ["engage", "ESCALATED: skin safety question"]],
    outLabel: "Inbox",
    out: () => (
      <>
        <div className="sm-msg"><small>Comment</small>Does this come in a smaller size?</div>
        <div className="sm-msg sm-msg-draft"><small>Draft reply, sent by the crew</small>Yes, the smaller set is on our listing. The link is in our bio.</div>
        <div className="sm-msg sm-msg-esc"><small>Escalated to you</small>Is this safe for sensitive skin?</div>
      </>
    )
  },
  {
    title: "Learn and repeat", pipe: 3, dur: 7500, on: ["d8", "kb"],
    desc: "Analytics reads the results and writes what worked back into the knowledge base for next week.",
    acts: { d8: "Reading insights, writing learnings", kb: "Updating past-winners" },
    log: [["analytics", "reach, saves and clicks pulled"], ["analytics", "hook A beat hook B on saves"], ["analytics", "UTM clicks matched to listings"], ["knowledge", "3 notes added to past-winners"]],
    outLabel: "Friday review",
    out: () => (
      <>
        <div className="sm-mets">
          <div><b>18.4k</b><span>Reach</span><em>+12%</em></div>
          <div><b>612</b><span>Saves</span><em>+9%</em></div>
          <div><b>340</b><span>Link clicks</span><em>+15%</em></div>
        </div>
        <p className="sm-note">Sample run. Numbers are made up.</p>
        <div className="sm-held sm-held-ok"><small>WRITTEN BACK</small><p>Unboxing hooks that name the gift occasion get saved more. Next week's plan will start from this.</p></div>
      </>
    )
  }
];

function agentOf(step: Step): string {
  const d = step.on.find((z) => z.startsWith("d"));
  if (d) return DEPTS.find((x) => x.id === d)?.name ?? "Crew lead";
  return step.on.includes("own") && step.on.length === 1 ? "You" : "Crew lead";
}

function usePrefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type LogState = { state: "loading" | "error" | "ok"; rows: SocialContentLogRow[] };

export function SocialMediaPage({ onOpenCalendar }: { onOpenCalendar?: () => void }) {
  const reduce = usePrefersReducedMotion();
  const [pos, setPos] = useState({ cur: 0, t: reduce ? STEPS[0].dur * 0.9 : 0 });
  const [playing, setPlaying] = useState(!reduce);
  const [speed, setSpeed] = useState(1);
  const [brand, setBrand] = useState<Brand>("Leafy Dew");
  const [realLog, setRealLog] = useState<LogState>({ state: "loading", rows: [] });

  const { cur, t } = pos;
  const step = STEPS[cur];

  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      setPos((p) => {
        const nt = p.t + 100 * speed;
        if (nt >= STEPS[p.cur].dur) return { cur: (p.cur + 1) % STEPS.length, t: 0 };
        return { cur: p.cur, t: nt };
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  useEffect(() => {
    let alive = true;
    socialContentLogApi
      .list(SELLER_ID)
      .then((res) => { if (alive) setRealLog({ state: "ok", rows: Array.isArray(res.rows) ? res.rows : [] }); })
      .catch(() => { if (alive) setRealLog({ state: "error", rows: [] }); });
    return () => { alive = false; };
  }, []);

  function goTo(i: number, keepPlaying = false) {
    const next = (i + STEPS.length) % STEPS.length;
    setPos({ cur: next, t: keepPlaying || playing ? 0 : STEPS[next].dur * 0.9 });
  }

  const p = Math.min(1, t / (step.dur * 0.85));
  const logCount = Math.min(step.log.length, Math.floor(p * step.log.length) + 1);
  const toolIdx = Math.min(4, Math.floor(p * 5));
  const earlier = new Set(STEPS.slice(0, cur).flatMap((s) => s.on));

  function stateOf(id: string): "on" | "done" | "idle" {
    if (step.on.includes(id)) return "on";
    return earlier.has(id) ? "done" : "idle";
  }

  function chipText(id: string, state: "on" | "done" | "idle", idle: string): string {
    if (state === "on") return id === "own" ? "your turn" : "working";
    if (state === "done") return "done";
    return idle;
  }

  function openZone(id: string) {
    const i = STEPS.findIndex((s) => s.on.includes(id));
    if (i >= 0) { setPlaying(false); setPos({ cur: i, t: STEPS[i].dur * 0.9 }); }
  }

  const posted = realLog.rows.filter((r) => r.status === "POSTED").length;
  const planned = realLog.rows.filter((r) => r.status === "PLANNED").length;
  const upcoming = realLog.rows
    .filter((r) => r.status === "PLANNED")
    .sort((a, b) => new Date(a.plannedDate ?? a.createdAt).getTime() - new Date(b.plannedDate ?? b.createdAt).getTime())
    .slice(0, 3);

  const orchState = stateOf("orch");
  const ownState = stateOf("own");
  const inpState = stateOf("inp");
  const kbState = stateOf("kb");

  return (
    <div className="sm">
      <div className="sm-banner">
        <strong>Preview.</strong> This is a sample run of the social media crew with made-up numbers. No agent is connected yet, and nothing is posted, sent or changed anywhere.
      </div>

      <section className="sm-bar">
        <div className="sm-status">
          <i className={`sm-dot ${playing ? "sm-dot-on" : ""}`} />
          <span><b>{agentOf(step)}</b> · {step.title}</span>
        </div>
        <div className="sm-brands" role="group" aria-label="Brand">
          {BRANDS.map((b) => (
            <button type="button" key={b} className={`sm-chip-brand ${brand === b ? "active" : ""}`} onClick={() => setBrand(b)} aria-pressed={brand === b}>{b}</button>
          ))}
        </div>
        <div className="sm-ctl">
          <button type="button" onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
          <button type="button" className="secondary" onClick={() => goTo(cur - 1)}>Prev</button>
          <button type="button" className="secondary" onClick={() => goTo(cur + 1)}>Next</button>
          <button type="button" className="secondary" onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)}>{speed}x</button>
        </div>
      </section>

      <div className="sm-grid">
        <div className="sm-left">
          <section className={`sm-zone sm-orch sm-${orchState}`} onClick={() => openZone("orch")}>
            <div className="sm-zh"><h2>Crew lead</h2><span className="sm-pill">{chipText("orch", orchState, "idle")}</span></div>
            <p className="sm-zs">One agent that plans, hands out work and reviews it. It stops and asks you when a post is flagged, a claim is unclear, or a message is about health or safety.</p>
            <div className="sm-pipe">
              {PIPELINE.map(([a, b], k) => (
                <div key={a} className={`sm-ps ${k === step.pipe ? "on" : ""} ${k < step.pipe ? "past" : ""}`}><b>{a}</b><small>{b}</small></div>
              ))}
            </div>
          </section>

          <div className="sm-depts">
            {DEPTS.map((d) => {
              const s = stateOf(d.id);
              return (
                <section key={d.id} className={`sm-zone sm-dept sm-${s}`} onClick={() => openZone(d.id)}>
                  <div className="sm-zh"><h2>{d.name}</h2><span className="sm-pill">{s === "idle" ? "idle" : chipText(d.id, s, "idle")}</span></div>
                  <p className="sm-zs">{d.role}</p>
                  <div className="sm-tools">
                    {d.tools.map(([m, n], k) => (
                      <div key={n} className={`sm-t ${s === "on" && k === toolIdx ? "on" : ""}`}><Mono>{m}</Mono><span>{n}</span></div>
                    ))}
                  </div>
                  <div className="sm-dst">{s === "on" ? (step.acts[d.id] ?? "Working") : s === "done" ? "Finished this week" : d.idle}</div>
                  <div className="sm-bar2"><i style={{ width: s === "on" ? `${Math.round(p * 100)}%` : s === "done" ? "100%" : "0%" }} /></div>
                </section>
              );
            })}
          </div>

          <div className="sm-trio">
            <section className={`sm-zone sm-${inpState}`} onClick={() => openZone("inp")}>
              <div className="sm-zh"><h2>Inputs</h2><span className="sm-pill">{chipText("inp", inpState, "read")}</span></div>
              <p className="sm-zs">What the crew reads. Read-only.</p>
              <div className="sm-list">
                {INPUTS.map(([m, a, b]) => (<div className="sm-li" key={a}><Mono>{m}</Mono><div><b>{a}</b><span>{b}</span></div></div>))}
              </div>
            </section>
            <section className={`sm-zone sm-${kbState}`} onClick={() => openZone("kb")}>
              <div className="sm-zh"><h2>Knowledge</h2><span className="sm-pill">{chipText("kb", kbState, "open")}</span></div>
              <p className="sm-zs">Shared memory every agent reads.</p>
              <div className="sm-folders">
                {FOLDERS.map(([a, b]) => (<div className="sm-fd" key={a}><b>{a}</b><span>{b}</span></div>))}
              </div>
              <div className="sm-acc">
                <div>read</div><div>draft</div><div>schedule</div>
                <div className="ask">publish needs OK</div><div>reply</div><div className="ask">escalate to you</div>
              </div>
            </section>
            <section className={`sm-zone sm-human sm-${ownState}`} onClick={() => openZone("own")}>
              <div className="sm-zh"><h2>You</h2><span className="sm-pill">{chipText("own", ownState, "standby")}</span></div>
              <p className="sm-zs">The crew pauses at these four points.</p>
              <div className="sm-cps">
                {CHECKPOINTS.map((c) => (
                  <div key={c.label} className={`sm-cp ${cur === c.step ? "on" : ""} ${cur > c.step ? "done" : ""}`}><i /><b>{c.label}</b></div>
                ))}
              </div>
              <p className="sm-zs sm-foot">Agents never publish, or reply on sensitive topics, without you.</p>
            </section>
          </div>
        </div>

        <aside className="sm-con" aria-label="Run console">
          <div className="sm-ch">
            <div className="sm-lab"><span>Step {cur + 1} of {STEPS.length}</span><b>{agentOf(step)}</b></div>
            <h2>{step.title}</h2>
            <p>{step.desc}</p>
            <div className="sm-rail">
              {STEPS.map((s, i) => (
                <button type="button" key={s.title} className={`sm-chip-step ${i === cur ? "on" : ""} ${i < cur ? "done" : ""}`} onClick={() => goTo(i)} aria-label={`Step ${i + 1}: ${s.title}`}>{i + 1}</button>
              ))}
            </div>
            <div className="sm-prog"><i style={{ width: `${Math.min(100, (t / step.dur) * 100)}%` }} /></div>
          </div>
          <div className="sm-log">
            {step.log.slice(0, logCount).map(([a, b]) => (<div key={a + b}><b>{a}</b> {b}</div>))}
          </div>
          <div className="sm-out" key={cur}>
            <h4><span>Output</span><span>{step.outLabel}</span></h4>
            {step.out(brand, () => goTo(cur + 1, true))}
          </div>
        </aside>
      </div>

      <section className="sm-real">
        <div className="sm-zh"><h2>Your real post log</h2><span className="sm-pill sm-pill-live">live data</span></div>
        <p className="sm-zs">This part is real. It reads your Social Content Calendar. When the crew is connected, its plans and posts will be logged here.</p>
        {realLog.state === "loading" ? <div className="sm-empty">Loading...</div> : realLog.state === "error" ? (
          <div className="sm-empty">Could not load the social content log. The backend may still be deploying.</div>
        ) : (
          <div className="sm-realgrid">
            <div className="sm-mets">
              <div><b>{posted}</b><span>Logged posts</span></div>
              <div><b>{planned}</b><span>Planned</span></div>
              <div><b>{realLog.rows.length}</b><span>All entries</span></div>
            </div>
            <div className="sm-up">
              {upcoming.length === 0 ? <div className="sm-empty">Nothing planned yet.</div> : upcoming.map((r) => (
                <div className="sm-li" key={r.id}><Mono>{r.platform.slice(0, 2)}</Mono><div><b>{r.title || r.contentType || r.platform}</b><span>{r.plannedDate ?? "no date"} · {r.platform}</span></div></div>
              ))}
            </div>
          </div>
        )}
        {onOpenCalendar ? <div className="sm-realact"><button type="button" className="secondary" onClick={onOpenCalendar}>Open Social Content Calendar</button></div> : null}
      </section>
    </div>
  );
}
