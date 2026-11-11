# What we are posting, and what to expect

Written **11 Nov 2026**. Covers both batches (12–22 Nov), what still needs doing, and a realistic view range for a channel that has not built a subscriber base yet.

> Views are **scenarios, not promises**. They assume the channel starts near zero subs, posting 4 Shorts + 1 long-form over 11 days, and that the content gets pushed into the Shorts feed at all. YouTube decides that in the first ~200 impressions; nothing below overrides that.

---

## 1. The slate

### Batch 1 — 12–15 Nov (manifest ready, dry run passing)

| # | Video | Live (IST) | Length | Shape | Thumbnail |
|---|-------|-----------|--------|-------|-----------|
| 1 | **आख़िरी चाय** — The Last Chai | Thu 12 Nov, 7:30 PM | 1:19 | 9:16 | `the-last-chai_9x16.jpg` + 16:9 |
| 2 | **3:33 AM · कमरा 204** | Fri 13 Nov, 7:30 PM | 0:54 | 9:16 | `3-33-am-kabir_9x16.jpg` + 16:9 |
| 3 | **माँ का आँचल** | Sat 14 Nov, 7:30 PM | 1:00 | 9:16 | `maa-ka-aanchal_9x16.jpg` + 16:9 |
| 4 | **₹10,000 का जाल · HEERA Ep 01** | Sun 15 Nov, 7:30 PM | 1:30 | 9:16 | `heera-10000-ka-jaal_9x16.jpg` + 16:9 |

### Batch 2 — 17–22 Nov (`manifest-batch2.json`)

| # | Video | Live (IST) | Length | Shape | Thumbnail |
|---|-------|-----------|--------|-------|-----------|
| 5 | **आख़िरी बेंच** — The Last Bench | Tue 17 Nov, 7:30 PM | 1:07 | 9:16 | `the-last-bench_9x16.jpg` + 16:9 |
| 6 | **फ्लैट नंबर 309** — Flat No. 309 | Thu 19 Nov, 7:30 PM | 0:50 | 9:16 | `flat-no-309_9x16.jpg` + 16:9 |
| 7 | **नियंत्रण एवं समन्वय** — Class 10 Biology Ch 6 Pt 2 | Sat 21 Nov, **10:00 AM** | 1:14 | 9:16 | `ch6-control-coordination_9x16.jpg` + 16:9 |
| 8 | **THE BOX** — silent film | Sun 22 Nov, 7:30 PM | 2:40 | 16:9 long-form | `the-box_16x9.jpg` + 9:16 |

Every entry carries: Hindi title first (searchable), English/Latin sub-line, a hook line for the thumbnail, full description with CTA, 14 tags, 2 alt titles for A/B, `containsSyntheticMedia: true`.

Contact sheet for all eight: `packs/00-preview-all-eight.jpg`.

---

## 2. What still needs doing

**Before Batch 1 ships**

- [ ] `npm run credentials:setup` once, on the machine that will publish.
- [ ] BGM rights confirmation — the one thing that can get a video claimed after it goes live.
- [ ] Watch each Drive file once to confirm it is the cut you want.

**Before Batch 2 ships**

- [ ] **THE BOX → re-export at 1080p.** It is the only 720p file in the slate; it uploads fine but quality is capped.
- [ ] **THE LAST BENCH → confirm the score/VO rights** (same BGM question as above).
- [ ] Nothing else. The other three are finished cuts.

**After Batch 2, before a Batch 3 exists**

- [ ] **HEERA Ep 02** — `Updated Visual Story — No Voice` is the picture lock. Needs VO + music + clean export. Target ~22 Nov.
- [ ] **HEERA Ep 03** — `Part 3 — 90 seconds` needs a continuity/script pass.
- [ ] **The Last Bench 16:9 master** — optional long-form. Hold it unless the Short overperforms; two uploads of one story split the audience.

**Done already (no action needed)**

- 8 manifest entries with full metadata, 16 thumbnails (8× 9:16 @1080×1920, 8× 16:9 @1280×720), 2 synced SRT caption files for the two Hindi ones.
- Dry runs pass for both manifests. One shared ledger, so re-running never double-uploads.

---

## 3. Views — honest numbers

### The shape of a new Shorts channel

Shorts are a lottery with a floor. Most uploads get a small test of a few hundred impressions; a minority break out. For a channel with roughly zero history:

| Outcome | Probability | Views per Short (30 days) |
|---|---|---|
| Flops quietly — feed doesn't pick it up | ~55–65% | 200–1,500 |
| Normal result — real but modest distribution | ~25–30% | 2,000–15,000 |
| Breakout — one of the eight catches | ~10–15% (across all 8) | 50,000–500,000 |
| Full breakout — Shorts feed loves it | ~1–3% | 1M+ |

**Expected total across the 7 Shorts, 30 days:** roughly **25,000–90,000 views**, with the distribution very lopsided — usually one video carries 60–80% of the total and the rest sit in the hundreds.

**The long-form (THE BOX)** behaves differently: 300–3,000 views is a normal first month for a 2:40 silent film on a new channel. Its real job is watch time and a subscribable "proper video", not reach.

### Per video — if the feed picks it up

| # | Video | Base case | Upside | Why |
|---|-------|-----------|--------|-----|
| 1 | The Last Chai | 4k–12k | 80k+ | Widest appeal of the eight: father/grief, no genre barrier. Strongest thumbnail face. |
| 2 | 3:33 AM | 2k–8k | 60k+ | Horror/hook genre carries in Shorts, but the anime style narrows it. |
| 3 | Maa Ka Aanchal | 5k–15k | 120k+ | Mother + fever + twist is the most-shared Hindi emotional template there is. Best weekend slot. |
| 4 | HEERA Ep 01 | 2k–6k | 40k+ | Series opener — lower ceiling per video, higher value if it converts subs. |
| 5 | The Last Bench | 3k–10k | 90k+ | "Last bench" is a mass-identity hook in Indian school content. |
| 6 | Flat No. 309 | 2k–7k | 60k+ | Suspense with a clean last-10-seconds payoff. Short = high completion. |
| 7 | Biology Ch 6 | 1k–5k | 25k+ | Smallest audience, but the most durable: evergreen board-prep search. |
| 8 | THE BOX | 300–1,500 | 8k | Long-form on a new channel. Value is watch time, not reach. |

**Most likely single breakout:** Maa Ka Aanchal (14 Nov) or The Last Bench (17 Nov). Both are identity stories rather than genre stories, and identity is what people send to a friend.

### What moves these numbers up

1. **First 3 seconds.** Every cut here starts in-scene, no logo. Keep it that way; a 0:03 drop kills the Short.
2. **Reply to every comment in the first 6 hours.** On Shorts this measurably extends the test window.
3. **Don't post two videos the same day.** The 11-day gap structure above is deliberate.
4. **Pin a comment with the hook line** from the thumbnail — it doubles as a second title.
5. **The education Short needs a different audience signal.** It ships Saturday morning, not evening, for exactly this reason.

### What will *not* happen

- Subscribers will not jump to thousands. 7 Shorts on a fresh channel typically convert 0.3–1% of viewers: expect **100–600 subs** if the batch does well.
- No revenue at these numbers. Shorts RPM in India is low; this batch is audience-building, not income.
- Uploading the alternate cuts to "get more views" would split the audience and lower every number above. That is why 17 files are parked.

---

## 4. The one-line version

Eight finished videos, zero render work left, ~11 days of schedule. Realistic outcome is **one video that does 50k+ and six that do a few thousand** — which is exactly what a first real batch should look like. The win to watch for is not total views; it is **whether one video's retention curve stays above 70% at the halfway mark**. That tells you which story to make Episode 2 of.
