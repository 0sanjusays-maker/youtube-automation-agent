# 8 videos → YouTube, ready to go

Prepared **11 Nov 2026**. Every video below already exists in your Drive at 9:16 (or is a finished long-form), has a Hindi title + hook line, a description with the CTA, tags, alt titles, a 9:16 Shorts tile and a 16:9 cover.

Two batches, one script, one ledger. Batch 1 ships this week; Batch 2 follows the week after.

## Batch 1 — this week

| # | Video | Length | Goes live (IST) | Drive file |
|---|-------|--------|-----------------|-----------|
| 1 | **आख़िरी चाय** — The Last Chai | 1:19 | Thu 12 Nov, 7:30 PM | `THE LAST CHAI - Instagram 9x16.mp4` |
| 2 | **3:33 AM · कमरा 204** | 0:54 | Fri 13 Nov, 7:30 PM | `3-33-AM-KABIR-JJK-Horror-9x16.mp4` |
| 3 | **माँ का आँचल** | 1:00 | Sat 14 Nov, 7:30 PM | `MAA KA AANCHAL — Living Still 2.5D (full 57s).mp4` |
| 4 | **₹10,000 का जाल · HEERA Ep 01** | 1:30 | Sun 15 Nov, 7:30 PM | `Heera_Reel1_Official_60FPS_Anime.mp4` |

Rotation logic: **loved → creepy → emotional → series opener**. Sat–Sun gets the mother story and the series, because that is when Indian family audiences are actually on the app.

## Batch 2 — next week

| # | Video | Length | Goes live (IST) | Drive file |
|---|-------|--------|-----------------|-----------|
| 5 | **आख़िरी बेंच** — The Last Bench | 1:07 | Tue 17 Nov, 7:30 PM | `THE LAST BENCH - Instagram 9x16.mp4` |
| 6 | **फ्लैट नंबर 309** — Flat No. 309 | 0:50 | Thu 19 Nov, 7:30 PM | `FLAT NO. 309 - Instagram Reels 9x16.mp4` |
| 7 | **नियंत्रण एवं समन्वय** — Class 10 Biology Ch 6, Part 2 | 1:14 | Sat 21 Nov, **10:00 AM** | `Ch 6 Control and Coordination Part II.mp4` |
| 8 | **THE BOX** — silent film (long-form, 16:9) | 2:40 | Sun 22 Nov, 7:30 PM | `THE BOX — Stickman Silent Film (2-40).mp4` |

Batch 2 logic: one Short every other day keeps the upload signal steady without cannibalising Batch 1's first 72 hours. The education Short goes out **Saturday morning** — board-prep search traffic peaks then, and it should not compete with the evening story slot. `THE BOX` is the week's long-form anchor.

> `THE BOX` is only 720p in Drive. It still uploads and plays fine, but a 1080p re-export is worth doing before Sunday if you can.

---

## 1. What is in this folder

```
youtube-uploads/
├── manifest.json          ← Batch 1 source of truth (titles, tags, schedule, file IDs)
├── manifest-batch2.json   ← Batch 2, same shape
├── packs/                 ← thumbnails, already sized for YouTube
│   ├── the-last-chai_9x16.jpg      1080×1920  Shorts tile
│   ├── the-last-chai_16x9.jpg      1280×720   normal thumbnail
│   └── … same pair for all eight videos
├── captions/
│   ├── 3-33-am-kabir.srt  ← real Hindi dialogue subs, already synced
│   └── maa-ka-aanchal.srt ← Roman-transliterated subs, already synced
├── audit/
│   ├── video-audit.json   ← every render since 8 Nov, with verdicts (31 files)
│   └── video-audit.md     ← the same thing as a readable table
└── publish-ledger.json    ← created on first run; records what was uploaded (no double uploads)
```

`scripts/publish-from-drive.js` does the whole job: pull the MP4 from Drive → upload → set thumbnails → attach captions → schedule. `scripts/build-video-audit.js` regenerates `audit/video-audit.md` from the JSON.

## 2. Run it

```bash
# 0. one-time, if the channel is not connected yet
npm run credentials:setup

# 1. check everything without touching YouTube
node scripts/publish-from-drive.js --manifest youtube-uploads/manifest.json --dry-run
node scripts/publish-from-drive.js --manifest youtube-uploads/manifest-batch2.json --dry-run

# 2. upload Batch 1 as scheduled uploads
node scripts/publish-from-drive.js --manifest youtube-uploads/manifest.json --publish --yes

# 3. upload Batch 2 (any time before 17 Nov)
node scripts/publish-from-drive.js --manifest youtube-uploads/manifest-batch2.json --publish --yes

# or one at a time, as you review each
node scripts/publish-from-drive.js --manifest youtube-uploads/manifest-batch2.json --publish --slug the-last-bench
```

Both manifests share one ledger, so a re-run of either never double-uploads.

What the script guarantees:

- **Nothing goes live early.** Every video is uploaded `private` with a `publishAt`; YouTube flips it public at the scheduled minute.
- **No duplicates.** The ledger remembers the video ID; a re-run skips finished items. Use `--force` only if you deliberately want a second upload.
- **Metadata is checked before upload** (title ≤100, description ≤5000, tags ≤450, numeric category, valid date).
- **Both thumbnails are tried.** 16:9 first. YouTube still refuses custom thumbnails on some Shorts — the 9:16 tile is attempted next and, if refused, the ledger records it so you can set it in Studio in 20 seconds.
- **AI disclosure** is set to `containsSyntheticMedia: true` (these visuals/voices are AI-made). Turn it off per video in the manifest only if a video is fully shot by hand.
- **Music/rights stay your call.** Each manifest item has a `rightsNote`; read it before publishing, mostly about the BGM.

## 3. Titles you can swap in (A/B)

YouTube's title test works on long-form only, so swap these by hand if a video underperforms in its first 48 hours. Keep the Hindi word first — that is what gets searched.

**आख़िरी चाय**
- `आख़िरी चाय | रोज़ बनती है, रोज़ ठंडी रहती है`
- `पापा ने 5 साल से चाय बनाई — आख़िर क्यों?`

**3:33 AM**
- `कमरा 204 | 3:33 AM — Hindi Horror`
- `मम्मी का फोन: "कबीर को गुज़रे 8 महीने हो गए"`

**माँ का आँचल**
- `माँ का आँचल | रात 12 बजे दरवाज़े पर माँ`
- `बुखार में माँ आई... पर सुबह पता चला सच`

**HEERA**
- `₹10,000 का जाल | Rule 2: लाल पेन मत उठाना`
- `HEERA Ep 01 | 11:30 PM की ट्यूशन — Hindi Suspense`

**आख़िरी बेंच**
- `आख़िरी बेंच | वो सीट जो आज तक खाली है`
- `The Last Bench | रो 5, सीट 4 — कभी नहीं भरती`

**फ्लैट नंबर 309**
- `फ्लैट नंबर 309 | वो फ्लैट जो कोई नहीं लेता`
- `Flat No. 309 | हर रात वहाँ बत्ती जलती है`

**Class 10 Biology Ch 6**
- `Class 10 Biology Ch 6 | Control & Coordination Part 2 in 74 sec`
- `Control and Coordination Part 2 | Class 10 Board Quick Revision`

**THE BOX**
- `THE BOX — What He Found Inside Will Stay With You`
- `THE BOX | 2-Minute Silent Film | Stickman Motivation`

## 4. Checklist before you hit publish

- [ ] Watch the Drive file once — confirm it is the final cut (the Drive has older cuts of the same films; both manifests already point at the newest).
- [ ] Music: confirm it is yours or AI-generated (phonk/bass drops are what Content ID usually flags).
- [ ] `containsSyntheticMedia` stays `true` unless the video is fully hand-made.
- [ ] After 48 h, read retention in Studio: if viewers drop before 0:03, swap in the alt title and the other hook line from §3.

## 5. What is deliberately not uploading

The Drive holds **31 renders since 8 Nov**, and only 8 of them are going out. The rest are alternate cuts, working animatics and duplicate phone exports — see `audit/video-audit.md` for the full list with a verdict on each.

Still in the workshop, not on the calendar:

- **HEERA Ep 02** — `Updated Visual Story — No Voice` needs VO + music, then a clean export. Slot it ~7 days after Ep 01 (around 22 Nov).
- **HEERA Ep 03** — `Part 3 — 90 seconds` needs a continuity pass before it counts as a final.
- **THE LAST BENCH (16:9)** — optional long-form version of Short #5; hold it unless the Short overperforms.

When a new video is ready, add an item to a manifest — same shape, one item per video — and run the same command. `--slug` lets you ship it alone.
