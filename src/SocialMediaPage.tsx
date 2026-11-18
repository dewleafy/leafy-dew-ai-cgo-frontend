import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./social-media.css";
import { MediaLibrary } from "./MediaLibrary";
import { instagramApi, socialContentLogApi, socialDraftsApi } from "./api";
import type { InstagramStatusResponse } from "./api";
import type { SocialContentLogRow, SocialDraft, SocialDraftStatus } from "./types";

/*
  Social Media tab (preview).
  An animated sample run of an agent team that runs social media: a crew lead, eight departments,
  shared knowledge, two gates (voice and budget), a "needs your OK" queue, and event runs that
  interrupt the weekly plan. Nothing here posts, replies or edits anything.
  The numbers in the sample runs are made up.
  The only live data on this page is the founder's own Social Content Calendar log (bottom card).
*/

const SELLER_ID = "default";
const BRANDS = ["Leafy Dew", "Ziro Kart"] as const;
type Brand = (typeof BRANDS)[number];
type Gate = "voice" | "budget";
type Mode = "weekly" | "review" | "spike" | "viral" | "dm";

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
  { id: "d6", name: "Publish", role: "Schedules approved posts", idle: "Only moves after the gates pass",
    tools: [["Ig", "Instagram"], ["Yt", "YT Shorts"], ["Pi", "Pinterest"], ["Fb", "Facebook"], ["Sc", "Scheduler"]] },
  { id: "d7", name: "Engage and Reviews", role: "Replies, reviews and leads", idle: "Starts when posts go live",
    tools: [["Cm", "Comments"], ["Dm", "DMs"], ["Rv", "Reviews"], ["Qa", "Product Q&A"], ["Es", "Escalate"]] },
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

const CHECKPOINTS: string[] = [
  "Approve the week before anything posts",
  "Decide on any flagged claim",
  "Answer escalated messages and spend requests",
  "Read the Friday review"
];

const LEVERS = ["Brand voice", "Budget cap", "Approval bar"];

type QueueItem = { id: string; item: string; why: string; resolvedBy: number };

type Step = {
  title: string;
  desc: string;
  pipe: number;
  dur: number;
  on: string[];
  acts: Record<string, string>;
  log: [string, string][];
  gates?: Gate[];
  cp?: number;
  queue?: QueueItem;
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

function Approval({ text, next }: { text: string; next: () => void }) {
  return (
    <>
      <div className="sm-phone">
        <small>Needs your OK</small>
        <p>{text}</p>
        <div className="sm-btns">
          <button type="button" onClick={next}>Approve</button>
          <button type="button" className="secondary" onClick={next}>Hold</button>
        </div>
      </div>
      <p className="sm-note">Preview only. These buttons just move the sample run forward.</p>
    </>
  );
}

const WEEKLY: Step[] = [
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
          <Row m="Ap" title="Approval bar" sub="Promises and spend wait for your OK" status="on" />
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
        <Row m="6" title="Publish" sub="schedule posts" status="after the gates" tone="quiet" />
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
    title: "Run the two gates", pipe: 2, dur: 7500, on: ["d5", "own"], gates: ["voice", "budget"], cp: 1,
    desc: "Every item passes a voice check and a budget check. Compliance also reads claims and platform rules. One post is held.",
    acts: { d5: "Checking 7 items against 14 rules", own: "One flagged claim for you" },
    log: [["voice gate", "7 of 7 sound like the brand"], ["budget gate", "no paid spend planned, 0 of cap used"], ["compliance", "claims list: 13 of 14 clear"], ["compliance", "HELD: Wed reel promises delivery timing"], ["compliance", "suggested fix attached, asking owner"]],
    queue: { id: "wk-claim", item: "Wed reel promises delivery timing", why: "Reads like a promise", resolvedBy: 7 },
    outLabel: "Gate results",
    out: () => (
      <>
        <div className="sm-rows">
          <Row m="Vo" title="Voice gate" sub="7 of 7 match the saved voice" status="pass" />
          <Row m="Bu" title="Budget gate" sub="0 of cap used" status="pass" />
          <Row m="Cl" title="Claims list" sub="13 of 14 rules clear" status="1 held" tone="warn" />
          <Row m="Mu" title="Music rights" sub="licensed tracks only" status="clear" />
        </div>
        <div className="sm-held"><small>HELD FOR YOU</small><p>Wed reel CTA says "Ships in time for the festive week". Delivery dates are not guaranteed. Suggested: "Order early for the festive week."</p></div>
      </>
    )
  },
  {
    title: "You decide", pipe: 3, dur: 8000, on: ["own"], cp: 0,
    desc: "The crew pauses here. You approve the week and the fix, or ask for changes. Nothing that promises or spends goes out without you.",
    acts: { own: "Waiting for your answer" },
    log: [["crew lead", "approval card ready for you"], ["crew lead", "7 items ready, 1 with a fix"], ["you", "reads the fix, approves"], ["crew lead", "approved, releasing to publish"]],
    queue: { id: "wk-week", item: "Approve this week's 7 items", why: "Approval bar: nothing posts unseen", resolvedBy: 8 },
    outLabel: "Needs your OK",
    out: (_b, next) => <Approval text="7 items ready for this week. One reel CTA was reworded to avoid a delivery promise." next={next} />
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
    title: "Reply and escalate", pipe: 3, dur: 7500, on: ["d7", "own"], cp: 2,
    desc: "Engage answers simple comments in the brand voice and hands anything sensitive to you.",
    acts: { d7: "Reading comments, DMs and reviews", own: "One message needs you" },
    log: [["engage", "18 comments read"], ["engage", "15 answered from product facts"], ["engage", "2 creator requests logged"], ["engage", "ESCALATED: skin safety question"]],
    queue: { id: "wk-skin", item: "Skin safety question from a customer", why: "Health topics are never answered by the crew", resolvedBy: 10 },
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
    title: "Learn and close the loop", pipe: 3, dur: 7500, on: ["d8", "kb", "inp"], cp: 3,
    desc: "Analytics reads the results, writes what worked into the knowledge base, and feeds the inputs so next week's plan starts from it.",
    acts: { d8: "Reading insights, writing learnings", kb: "Updating past-winners", inp: "Fed with this week's results" },
    log: [["analytics", "reach, saves and clicks pulled"], ["analytics", "hook A beat hook B on saves"], ["analytics", "UTM clicks matched to listings"], ["knowledge", "3 notes added to past-winners"], ["inputs", "results added to trend feeds"]],
    outLabel: "Friday review",
    out: () => (
      <>
        <div className="sm-mets">
          <div><b>18.4k</b><span>Reach</span><em>+12%</em></div>
          <div><b>612</b><span>Saves</span><em>+9%</em></div>
          <div><b>340</b><span>Link clicks</span><em>+15%</em></div>
        </div>
        <p className="sm-note">Sample run. Numbers are made up.</p>
        <div className="sm-held sm-held-ok"><small>WRITTEN BACK</small><p>Unboxing hooks that name the gift occasion get saved more. Next week's brief starts from this.</p></div>
      </>
    )
  }
];

const REVIEW: Step[] = [
  {
    title: "A 1-star review lands", pipe: 0, dur: 6000, on: ["d7", "orch"],
    desc: "Engage spots a new low rating. The event goes to the crew lead first, which scores it and decides who handles it.",
    acts: { d7: "Reading a new 1-star review" },
    log: [["engage", "new 1-star review on a listing"], ["crew lead", "score 9 of 10, needs a reply today"], ["crew lead", "briefing Engage and Reviews"]],
    outLabel: "The event",
    out: () => (
      <div className="sm-msg sm-msg-esc"><small>1-star review · just now</small>The box arrived crushed and one item was missing.</div>
    )
  },
  {
    title: "Draft the reply", pipe: 2, dur: 6000, on: ["d7"],
    desc: "Engage writes a calm reply from product facts. It does not blame the customer or argue.",
    acts: { d7: "Drafting a calm reply" },
    log: [["engage", "read product-facts and return policy"], ["engage", "tone: calm, no blame"], ["engage", "reply offers a replacement"]],
    outLabel: "Draft reply",
    out: () => (
      <div className="sm-msg sm-msg-draft"><small>Draft reply</small>We are sorry this happened. We would like to send a replacement. Please message us with your order number so we can fix it quickly.</div>
    )
  },
  {
    title: "Gates and your OK", pipe: 3, dur: 7000, on: ["d5", "own"], gates: ["voice", "budget"], cp: 2,
    desc: "The reply passes the voice gate. It offers a replacement, which reads like a promise, so it waits for you.",
    acts: { d5: "Checking the reply", own: "A promise needs your OK" },
    log: [["voice gate", "sounds like the brand"], ["budget gate", "no spend"], ["compliance", "HELD: reply offers a replacement"], ["crew lead", "added to needs-your-OK"]],
    queue: { id: "rv-promise", item: "Reply to 1-star review offers a replacement", why: "Reads like a promise", resolvedBy: 3 },
    outLabel: "Needs your OK",
    out: (_b, next) => <Approval text="Reply to a 1-star review offers a free replacement. Send it?" next={next} />
  },
  {
    title: "Send and learn", pipe: 3, dur: 6500, on: ["d7", "d8", "inp"],
    desc: "The reply goes out. The complaint is logged, and the packaging issue goes back to the inputs for the next plan.",
    acts: { d7: "Reply sent", d8: "Logging the complaint", inp: "Packaging complaint added" },
    log: [["engage", "reply sent"], ["analytics", "packaging complaints: 1 more this week"], ["inputs", "added to Reviews and Q&A"], ["crew lead", "next brief will mention packaging care"]],
    outLabel: "Result logged",
    out: () => (
      <div className="sm-rows">
        <Row m="Rv" title="Reply sent" sub="after your OK" status="done" />
        <Row m="Lg" title="Result logged" sub="feeds next week's research" status="done" />
      </div>
    )
  }
];

const SPIKE: Step[] = [
  {
    title: "Search demand spikes", pipe: 0, dur: 6000, on: ["d1", "orch"],
    desc: "Research sees a topic jump in search. The crew lead scores it and decides whether it is worth a post today.",
    acts: { d1: "Watching a search jump" },
    log: [["research", "'gift under 999' searches jumped"], ["crew lead", "score 8 of 10, matches a listing"], ["crew lead", "briefing Copy and Visual"]],
    outLabel: "The event",
    out: () => (
      <>
        <div className="sm-rows"><Row m="Tr" title="'gift under 999'" sub="search interest, last 48 hours" status="+340%" /></div>
        <p className="sm-note">Sample run. Numbers are made up.</p>
      </>
    )
  },
  {
    title: "Write a fast post", pipe: 2, dur: 6500, on: ["d3", "d4"],
    desc: "Copy and Visual make one quick post for the topic, in the brand voice.",
    acts: { d3: "Writing one caption", d4: "Making one image" },
    log: [["copy", "caption in Hindi and English"], ["visual", "one image, 4:5"], ["visual", "alt-text written"]],
    outLabel: "Draft post",
    out: () => (
      <div className="sm-card-in"><pre className="sm-script"><span className="sm-dim">INSTAGRAM POST</span>{"\n"}Gifting on a budget does not have to look like it.{"\n"}Our festive sets, ready to give.{"\n"}Link in bio.</pre></div>
    )
  },
  {
    title: "Both gates pass", pipe: 3, dur: 6000, on: ["d5"], gates: ["voice", "budget"],
    desc: "The post sounds like the brand, makes no promise and spends nothing. It does not need you, so it goes out by itself.",
    acts: { d5: "Checking the post" },
    log: [["voice gate", "pass"], ["budget gate", "no spend"], ["compliance", "no claims or promises"], ["crew lead", "routine, ships without asking"]],
    outLabel: "Gate results",
    out: () => (
      <div className="sm-rows">
        <Row m="Vo" title="Voice gate" sub="matches the saved voice" status="pass" />
        <Row m="Bu" title="Budget gate" sub="no spend" status="pass" />
        <Row m="Ap" title="Approval bar" sub="routine post, no promise" status="auto" />
      </div>
    )
  },
  {
    title: "Post and log", pipe: 3, dur: 6500, on: ["d6", "d8", "inp"],
    desc: "Publish posts it. Analytics logs the result, and the topic goes back to the inputs.",
    acts: { d6: "Posting to Instagram", d8: "Logging the result", inp: "Topic added to trend feeds" },
    log: [["publish", "posted to Instagram"], ["analytics", "result line written"], ["inputs", "topic saved for next week's plan"]],
    outLabel: "Result logged",
    out: () => (
      <div className="sm-rows"><Row m="Ig" title="Posted" sub="no approval needed" status="done" /><Row m="Lg" title="Result logged" sub="read by Analytics tomorrow" status="done" /></div>
    )
  }
];

const VIRAL: Step[] = [
  {
    title: "A post takes off", pipe: 0, dur: 6000, on: ["d8", "orch"],
    desc: "Analytics notices a reel getting far more reach than usual. The crew lead decides how to use the moment.",
    acts: { d8: "Watching reach climb" },
    log: [["analytics", "reel reach 6x the usual"], ["crew lead", "score 9 of 10"], ["crew lead", "plan: follow-ups first, then ask about a boost"]],
    outLabel: "The event",
    out: () => (
      <>
        <div className="sm-mets"><div><b>6x</b><span>Usual reach</span></div><div><b>4 h</b><span>Since posting</span></div><div><b>212</b><span>Saves</span></div></div>
        <p className="sm-note">Sample run. Numbers are made up.</p>
      </>
    )
  },
  {
    title: "Plan follow-ups", pipe: 2, dur: 6500, on: ["d2", "d3"],
    desc: "Strategy adds two follow-up posts to the calendar and Copy drafts them while interest is high.",
    acts: { d2: "Adding 2 follow-up slots", d3: "Drafting 2 follow-ups" },
    log: [["strategy", "2 slots added, tomorrow and day after"], ["copy", "follow-up 1: behind the scenes"], ["copy", "follow-up 2: answers to top comments"]],
    outLabel: "Follow-ups",
    out: () => (
      <div className="sm-rows"><Row m="1" title="Behind the scenes" sub="tomorrow, Instagram" status="drafted" /><Row m="2" title="Answers to top comments" sub="day after, Instagram" status="drafted" /></div>
    )
  },
  {
    title: "Budget gate stops", pipe: 3, dur: 7500, on: ["orch", "own"], gates: ["budget"], cp: 2,
    desc: "Boosting the reel would spend money. The budget gate stops and asks you before anything is spent.",
    acts: { own: "A spend request needs you" },
    log: [["crew lead", "boost would cost 2,000 rupees"], ["budget gate", "month so far: 90% of cap"], ["budget gate", "HELD: over the cap if approved"], ["crew lead", "asking owner: raise cap or skip"]],
    queue: { id: "vr-boost", item: "Boost the reel for 2,000 rupees", why: "Spend request, month is at 90% of cap", resolvedBy: 3 },
    outLabel: "Needs your OK",
    out: (_b, next) => <Approval text="The reel is taking off. A boost would cost 2,000 rupees and this month is at 90% of your cap. Approve the boost?" next={next} />
  },
  {
    title: "Follow-ups go out", pipe: 3, dur: 6500, on: ["d6", "d8", "inp"],
    desc: "The follow-ups pass both gates and are scheduled. The boost follows your answer. The result goes back to the inputs.",
    acts: { d6: "Scheduling 2 follow-ups", d8: "Tracking the spike", inp: "Learnings added" },
    log: [["publish", "2 follow-ups scheduled"], ["analytics", "tracking reach and saves"], ["inputs", "what made the reel work, saved"]],
    outLabel: "Result logged",
    out: () => (
      <div className="sm-rows"><Row m="Ig" title="2 follow-ups" sub="scheduled" status="done" /><Row m="Lg" title="Learnings saved" sub="feeds next plan" status="done" /></div>
    )
  }
];

const DM: Step[] = [
  {
    title: "A lead writes at 11 pm", pipe: 0, dur: 6000, on: ["d7", "orch"],
    desc: "Someone sends a DM late at night. The crew replies right away so the lead does not go cold.",
    acts: { d7: "Reading a new DM" },
    log: [["engage", "new DM at 11:04 pm"], ["crew lead", "score 8 of 10, looks like a bulk buyer"], ["crew lead", "briefing Engage and Reviews"]],
    outLabel: "The event",
    out: () => (<div className="sm-msg"><small>Instagram DM · 11:04 pm</small>Hi, do you do bulk orders of the gifting sets for a wedding? About 50.</div>)
  },
  {
    title: "Reply and capture", pipe: 2, dur: 6500, on: ["d7"],
    desc: "Engage replies from product facts, asks the questions a seller needs, and saves the lead. It does not quote a price.",
    acts: { d7: "Replying and saving the lead" },
    log: [["engage", "reply asks city, date and set type"], ["engage", "no price quoted"], ["engage", "lead saved with the chat"]],
    outLabel: "Reply, sent by the crew",
    out: () => (<div className="sm-msg sm-msg-draft"><small>Reply sent</small>Thank you for writing. We can help with larger orders. Which city is it for, and what date do you need them by? Someone from our team will confirm details in the morning.</div>)
  },
  {
    title: "Your morning ask", pipe: 3, dur: 7000, on: ["own"], cp: 2,
    desc: "A price for 50 sets is a promise, so it waits for you instead of being guessed.",
    acts: { own: "Price quote needs you" },
    log: [["crew lead", "price request is a promise"], ["crew lead", "added to needs-your-OK for the morning"], ["you", "sends the quote"]],
    queue: { id: "dm-quote", item: "Price quote for 50 gifting sets", why: "Prices are promises", resolvedBy: 3 },
    outLabel: "Needs your OK",
    out: (_b, next) => <Approval text="A bulk buyer wants a quote for 50 gifting sets. Approve sending your price?" next={next} />
  },
  {
    title: "Follow up and log", pipe: 3, dur: 6500, on: ["d7", "d8", "inp"],
    desc: "Engage follows up after your answer. The lead and its source are logged for the next plan.",
    acts: { d7: "Sending the follow-up", d8: "Logging the lead source", inp: "Lead source added" },
    log: [["engage", "follow-up sent with your quote"], ["analytics", "lead source: reel comments"], ["inputs", "bulk-order interest noted"]],
    outLabel: "Result logged",
    out: () => (<div className="sm-rows"><Row m="Dm" title="Follow-up sent" sub="after your OK" status="done" /><Row m="Lg" title="Lead logged" sub="source: reel comments" status="done" /></div>)
  }
];

const SCRIPTS: Record<Mode, { label: string; steps: Step[] }> = {
  weekly: { label: "Weekly run", steps: WEEKLY },
  review: { label: "Bad review lands", steps: REVIEW },
  spike: { label: "Search demand spike", steps: SPIKE },
  viral: { label: "A post goes viral", steps: VIRAL },
  dm: { label: "DM at 11 pm", steps: DM }
};
const MODES = Object.keys(SCRIPTS) as Mode[];

function agentOf(step: Step): string {
  const d = step.on.find((z) => z.startsWith("d"));
  if (d) return DEPTS.find((x) => x.id === d)?.name ?? "Crew lead";
  return step.on.includes("own") && step.on.length === 1 ? "You" : "Crew lead";
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type LogState = { state: "loading" | "error" | "ok"; rows: SocialContentLogRow[] };
type DraftState = { state: "loading" | "error" | "ok"; rows: SocialDraft[] };

const DRAFT_LABEL: Record<SocialDraftStatus, string> = {
  DRAFT: "Waiting for you",
  APPROVED: "Approved",
  EDIT_REQUESTED: "Needs edits",
  HELD: "On hold"
};

const FIRST_POST = {
  title: "Key holder with test tube planter",
  imageUrl: "https://app.leafydew.in/ig-post-1.jpg",
  caption: "Keys on the hooks, a little green by the door. This wall key holder has five hooks and an acrylic test tube where a plant cutting can grow in water.\n\nSmall corner, fresh start to the day. \u{1F33F}\n\n#LeafyDew #KeyHolder #PlantLovers #HomeDecorIndia"
};

export function SocialMediaPage({ onOpenCalendar }: { onOpenCalendar?: () => void }) {
  const reduce = prefersReducedMotion();
  const [mode, setMode] = useState<Mode>("weekly");
  const steps = SCRIPTS[mode].steps;
  const [pos, setPos] = useState({ cur: 0, t: reduce ? WEEKLY[0].dur * 0.9 : 0 });
  const [playing, setPlaying] = useState(!reduce);
  const [speed, setSpeed] = useState(1);
  const [brand, setBrand] = useState<Brand>("Leafy Dew");
  const [decisions, setDecisions] = useState<Record<string, "approved" | "held">>({});
  const [realLog, setRealLog] = useState<LogState>({ state: "loading", rows: [] });
  const [drafts, setDrafts] = useState<DraftState>({ state: "loading", rows: [] });
  const [draftBusy, setDraftBusy] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [igPost, setIgPost] = useState<{ state: "idle" | "loading" | "ok" | "error"; text?: string }>({ state: "idle" });
  const [igCheck, setIgCheck] = useState<{ state: "idle" | "loading" | "ok" | "error"; data?: InstagramStatusResponse }>({ state: "idle" });

  const { cur, t } = pos;
  const step = steps[cur];

  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      setPos((p) => {
        const nt = p.t + 100 * speed;
        if (nt >= steps[p.cur].dur) return { cur: (p.cur + 1) % steps.length, t: 0 };
        return { cur: p.cur, t: nt };
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [playing, speed, steps]);

  useEffect(() => {
    let alive = true;
    socialContentLogApi
      .list(SELLER_ID)
      .then((res) => { if (alive) setRealLog({ state: "ok", rows: Array.isArray(res.rows) ? res.rows : [] }); })
      .catch(() => { if (alive) setRealLog({ state: "error", rows: [] }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    socialDraftsApi
      .list(SELLER_ID)
      .then((res) => { if (alive) setDrafts({ state: "ok", rows: Array.isArray(res.rows) ? res.rows : [] }); })
      .catch(() => { if (alive) setDrafts({ state: "error", rows: [] }); });
    return () => { alive = false; };
  }, []);

  // Records the owner's decision only. Nothing is published to any platform from here.
  async function decideDraft(id: string, status: SocialDraftStatus) {
    setDraftBusy(id);
    setDraftError(null);
    try {
      const res = await socialDraftsApi.decide(id, { status });
      setDrafts((d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? res.row : r)) }));
    } catch {
      setDraftError("Could not save your decision. Try again.");
    } finally {
      setDraftBusy(null);
    }
  }

  // Publishes ONE photo. Only runs when the owner clicks and confirms. Backend also needs INSTAGRAM_PUBLISH_ENABLED=true.
  async function publishFirstPost() {
    if (!window.confirm("Post this photo to @leafy_dew on Instagram right now?")) return;
    setIgPost({ state: "loading" });
    try {
      const res = await instagramApi.publish({ imageUrl: FIRST_POST.imageUrl, caption: FIRST_POST.caption, title: FIRST_POST.title });
      setIgPost({ state: "ok", text: `Posted.${res.permalink ? ` ${res.permalink}` : ""}` });
    } catch (e) {
      setIgPost({ state: "error", text: e instanceof Error && e.message ? e.message : "Could not post. Posting may be switched off." });
    }
  }

  // Read-only check. It never posts anything and never shows the token.
  async function checkInstagram() {
    setIgCheck({ state: "loading" });
    try {
      const data = await instagramApi.status();
      setIgCheck({ state: "ok", data });
    } catch {
      setIgCheck({ state: "error" });
    }
  }

  function goTo(i: number, keepPlaying = false) {
    const next = (i + steps.length) % steps.length;
    setPos({ cur: next, t: keepPlaying || playing ? 0 : steps[next].dur * 0.9 });
  }

  function chooseMode(m: Mode) {
    setMode(m);
    setDecisions({});
    setPlaying(!reduce);
    setPos({ cur: 0, t: reduce ? SCRIPTS[m].steps[0].dur * 0.9 : 0 });
  }

  const p = Math.min(1, t / (step.dur * 0.85));
  const logCount = Math.min(step.log.length, Math.floor(p * step.log.length) + 1);
  const toolIdx = Math.min(4, Math.floor(p * 5));
  const earlier = new Set(steps.slice(0, cur).flatMap((s) => s.on));
  const earlierCp = new Set(steps.slice(0, cur).map((s) => s.cp));
  const queueItems = steps.slice(0, cur + 1).flatMap((s) => (s.queue ? [s.queue] : []));

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
    const i = steps.findIndex((s) => s.on.includes(id));
    if (i >= 0) { setPlaying(false); setPos({ cur: i, t: steps[i].dur * 0.9 }); }
  }

  function queueStatus(q: QueueItem): "waiting" | "approved" | "held" {
    const d = decisions[q.id];
    if (d) return d;
    return cur >= q.resolvedBy ? "approved" : "waiting";
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
  const gates = step.gates ?? [];
  const loopOn = step.on.includes("inp") && cur > 0;

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

      <section className="sm-events" aria-label="Choose a run">
        <span className="sm-events-lab">Run</span>
        {MODES.map((m) => (
          <button type="button" key={m} className={`sm-chip-event ${mode === m ? "active" : ""} ${m === "weekly" ? "" : "sm-chip-interrupt"}`} onClick={() => chooseMode(m)} aria-pressed={mode === m}>
            {m === "weekly" ? SCRIPTS[m].label : `Event: ${SCRIPTS[m].label}`}
          </button>
        ))}
      </section>

      <div className="sm-grid">
        <div className="sm-left">
          <section className={`sm-zone sm-orch sm-${orchState}`} onClick={() => openZone("orch")}>
            <div className="sm-zh"><h2>Crew lead</h2><span className="sm-pill">{chipText("orch", orchState, "idle")}</span></div>
            <p className="sm-zs">One agent that sees every event first. It scores it, hands it to a department, and runs the two gates before anything goes out.</p>
            <div className="sm-pipe">
              {PIPELINE.map(([a, b], k) => (
                <div key={a} className={`sm-ps ${k === step.pipe ? "on" : ""} ${k < step.pipe ? "past" : ""}`}><b>{a}</b><small>{b}</small></div>
              ))}
            </div>
            <div className="sm-gates">
              <span>Gates on every item</span>
              <div className={`sm-gate ${gates.includes("voice") ? "on" : ""}`}>Voice check</div>
              <div className={`sm-gate ${gates.includes("budget") ? "on" : ""}`}>Budget check</div>
              <div className={`sm-loop ${loopOn ? "on" : ""}`}>Results feed the next brief</div>
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
                  <div className="sm-dst">{s === "on" ? (step.acts[d.id] ?? "Working") : s === "done" ? "Finished this run" : d.idle}</div>
                  <div className="sm-bar2"><i style={{ width: s === "on" ? `${Math.round(p * 100)}%` : s === "done" ? "100%" : "0%" }} /></div>
                </section>
              );
            })}
          </div>

          <section className={`sm-zone sm-queue sm-human sm-${ownState}`}>
            <div className="sm-zh"><h2>Needs your OK</h2><span className="sm-pill">{queueItems.filter((q) => queueStatus(q) === "waiting").length} waiting</span></div>
            <p className="sm-zs">Anything that promises, spends or is sensitive stops here. You answer Approve or Hold. Routine posts that pass both gates do not come here.</p>
            {queueItems.length === 0 ? (
              <div className="sm-empty">Nothing waiting. Items appear here when a gate stops the crew.</div>
            ) : (
              <div className="sm-qlist">
                {queueItems.map((q) => {
                  const st = queueStatus(q);
                  return (
                    <div key={q.id} className={`sm-qi sm-qi-${st}`}>
                      <div><b>{q.item}</b><span>{q.why}</span></div>
                      {st === "waiting" ? (
                        <div className="sm-qbtns">
                          <button type="button" onClick={() => setDecisions({ ...decisions, [q.id]: "approved" })}>Approve</button>
                          <button type="button" className="secondary" onClick={() => setDecisions({ ...decisions, [q.id]: "held" })}>Hold</button>
                        </div>
                      ) : <i className="sm-qst">{st}</i>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="sm-trio">
            <section className={`sm-zone sm-${inpState}`} onClick={() => openZone("inp")}>
              <div className="sm-zh"><h2>Inputs</h2><span className="sm-pill">{chipText("inp", inpState, "read")}</span></div>
              <p className="sm-zs">What the crew reads. Read-only. Results flow back in here.</p>
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
                <div className="ask">publish needs gates</div><div>reply</div><div className="ask">escalate to you</div>
              </div>
            </section>
            <section className={`sm-zone sm-human sm-${ownState}`} onClick={() => openZone("own")}>
              <div className="sm-zh"><h2>You</h2><span className="sm-pill">{chipText("own", ownState, "standby")}</span></div>
              <p className="sm-zs">You own three things and four moments.</p>
              <div className="sm-levers">{LEVERS.map((l) => (<span key={l} className="sm-lever">{l}</span>))}</div>
              <div className="sm-cps">
                {CHECKPOINTS.map((label, k) => (
                  <div key={label} className={`sm-cp ${step.cp === k ? "on" : ""} ${earlierCp.has(k) && step.cp !== k ? "done" : ""}`}><i /><b>{label}</b></div>
                ))}
              </div>
              <p className="sm-zs sm-foot">Agents never publish, spend, or reply on sensitive topics, without you.</p>
            </section>
          </div>
        </div>

        <aside className="sm-con" aria-label="Run console">
          <div className="sm-ch">
            <div className="sm-lab"><span>{SCRIPTS[mode].label} · step {cur + 1} of {steps.length}</span><b>{agentOf(step)}</b></div>
            <h2>{step.title}</h2>
            <p>{step.desc}</p>
            <div className="sm-rail">
              {steps.map((s, i) => (
                <button type="button" key={s.title} className={`sm-chip-step ${i === cur ? "on" : ""} ${i < cur ? "done" : ""}`} onClick={() => goTo(i)} aria-label={`Step ${i + 1}: ${s.title}`}>{i + 1}</button>
              ))}
            </div>
            <div className="sm-prog"><i style={{ width: `${Math.min(100, (t / step.dur) * 100)}%` }} /></div>
          </div>
          <div className="sm-log">
            {step.log.slice(0, logCount).map(([a, b]) => (<div key={a + b}><b>{a}</b> {b}</div>))}
          </div>
          <div className="sm-out" key={`${mode}-${cur}`}>
            <h4><span>Output</span><span>{step.outLabel}</span></h4>
            {step.out(brand, () => goTo(cur + 1, true))}
          </div>
        </aside>
      </div>

      <section className="sm-real sm-drafts">
        <div className="sm-zh"><h2>Drafts for your OK</h2><span className="sm-pill sm-pill-live">live data</span></div>
        <p className="sm-zs">Real drafts written for your planned posts. Approve, ask for edits or hold. Approving only records your decision. Nothing is posted from here.</p>
        {drafts.state === "loading" ? <div className="sm-empty">Loading...</div> : drafts.state === "error" ? (
          <div className="sm-empty">Could not load the drafts. The backend may still be deploying.</div>
        ) : drafts.rows.length === 0 ? (
          <div className="sm-empty">No drafts yet.</div>
        ) : (
          <div className="sm-draftlist">
            {draftError ? <div className="sm-empty">{draftError}</div> : null}
            {drafts.rows.map((d) => (
              <article className={`sm-draft sm-draft-${d.status.toLowerCase()}`} key={d.id}>
                <header>
                  <b>{d.plannedDate ?? "no date"}{d.slotTime ? ` · ${d.slotTime} IST` : ""}</b>
                  <span className="sm-pill">{DRAFT_LABEL[d.status]}</span>
                </header>
                <small>{[d.occasion, d.format].filter(Boolean).join(" · ")}</small>
                <p className="sm-draftcap">{d.caption}</p>
                {d.hashtags ? <p className="sm-drafttags">{d.hashtags}</p> : null}
                {d.creativeBrief ? <p className="sm-draftmeta"><b>To shoot:</b> {d.creativeBrief}</p> : null}
                {d.checks ? <p className="sm-draftmeta"><b>Checks:</b> {d.checks}</p> : null}
                <div className="sm-draftact">
                  <button type="button" disabled={draftBusy === d.id || d.status === "APPROVED"} onClick={() => decideDraft(d.id, "APPROVED")}>Approve</button>
                  <button type="button" className="secondary" disabled={draftBusy === d.id || d.status === "EDIT_REQUESTED"} onClick={() => decideDraft(d.id, "EDIT_REQUESTED")}>Needs edits</button>
                  <button type="button" className="secondary" disabled={draftBusy === d.id || d.status === "HELD"} onClick={() => decideDraft(d.id, "HELD")}>Hold</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <MediaLibrary />

      <section className="sm-real">
        <div className="sm-zh"><h2>Instagram connection</h2><span className="sm-pill sm-pill-live">live check</span></div>
        <p className="sm-zs">Checks that the app can reach @leafy_dew. This only looks. It does not post anything.</p>
        <div className="sm-realact"><button type="button" onClick={checkInstagram} disabled={igCheck.state === "loading"}>{igCheck.state === "loading" ? "Checking..." : "Check Instagram"}</button></div>
        <div className="sm-realact">
          <button type="button" className="secondary" onClick={publishFirstPost} disabled={igPost.state === "loading"}>{igPost.state === "loading" ? "Posting..." : "Post first photo to Instagram"}</button>
        </div>
        {igPost.state === "ok" || igPost.state === "error" ? <div className="sm-empty">{igPost.text}</div> : null}
        {igCheck.state === "error" ? <div className="sm-empty">Could not reach the backend. It may still be deploying. Try again in a minute.</div> : null}
        {igCheck.state === "ok" && igCheck.data ? (
          <div className="sm-empty">
            {!igCheck.data.configured
              ? "Not set up yet. The token or account ID is missing in Railway."
              : igCheck.data.error
                ? `Connection problem: ${igCheck.data.error}`
                : `Connected to @${igCheck.data.username ?? "unknown"}.`}
            {" "}Posting is {igCheck.data.publishEnabled ? "ON" : "OFF"}.
          </div>
        ) : null}
      </section>

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
