# 4 videos → YouTube, ready to go

Prepared **11 Nov 2026** for the channel. Every video below already exists in your Drive at 9:16, has a Hindi title + hook line, a description with the end-screen CTA, tags, a 9:16 Shorts tile and a 16:9 cover.

| # | Video | Length | Goes live (IST) | Drive file |
|---|-------|--------|-----------------|-----------|
| 1 | **आख़िरी चाय** — The Last Chai | 1:19 | Thu 12 Nov, 7:30 PM | `THE LAST CHAI - Instagram 9x16.mp4` |
| 2 | **3:33 AM · कमरा 204** | 0:54 | Fri 13 Nov, 7:30 PM | `3-33-AM-KABIR-JJK-Horror-9x16.mp4` |
| 3 | **माँ का आँचल** | 1:00 | Sat 14 Nov, 7:30 PM | `MAA KA AANCHAL — Living Still 2.5D (full 57s).mp4` |
| 4 | **₹10,000 का जाल · HEERA Ep 01** | 1:30 | Sun 15 Nov, 7:30 PM | `Heera_Reel1_Official_60FPS_Anime.mp4` |

Rotation logic: **loved → creepy → emotional → series opener**. Sat–Sun gets the mother story and the series, because that is when Indian family audiences are actually on the app.

---

## 1. What is in this folder

```
youtube-uploads/
├── manifest.json          ← the single source of truth (titles, tags, schedule, file IDs)
├── packs/                 ← thumbnails, already sized for YouTube
│   ├── the-last-chai_9x16.jpg      1080×1920  Shorts tile
│   ├── the-last-chai_16x9.jpg      1280×720   normal thumbnail
│   └── … same pair for the other three
├── captions/
│   ├── 3-33-am-kabir.srt  ← real Hindi dialogue subs, already synced
│   └── maa-ka-aanchal.srt ← Roman-transliterated subs, already synced
└── publish-ledger.json    ← created on first run; records what was uploaded (no double uploads)
```

`scripts/publish-from-drive.js` does the whole job: pull the MP4 from Drive → upload → set thumbnails → attach captions → schedule.

## 2. Run it

```bash
# 0. one-time, if the channel is not connected yet
npm run credentials:setup

# 1. check everything without touching YouTube
node scripts/publish-from-drive.js --manifest youtube-uploads/manifest.json --dry-run

# 2. upload all four as scheduled uploads
node scripts/publish-from-drive.js --manifest youtube-uploads/manifest.json --publish --yes

# or one at a time, as you review each
node scripts/publish-from-drive.js --manifest youtube-uploads/manifest.json --publish --slug the-last-chai
```

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

## 4. Checklist before you hit publish

- [ ] Watch the Drive file once — confirm it is the final cut (the Drive has older cuts of the same films; the manifest already points at the newest).
- [ ] Music: confirm it is yours or AI-generated (phonk/bass drops are what Content ID usually flags).
- [ ] `containsSyntheticMedia` stays `true` unless the video is fully hand-made.
- [ ] After 48 h, read retention in Studio: if viewers drop before 0:03, swap in the alt title and the other hook line from §3.

## 5. Videos deliberately left out

The Drive also holds alternate cuts and working versions. Re-uploading them would compete with the finals, so they are parked:
`Maa Ka Aanchal FINAL (with music)` and `(no music)` · `THE BOX` 20 s / 28 s / 2:40 · `Heera Part 3` and `Heera Updated Visual Story` · `Heera Reel 2 Animatic V1–V6` · `FLAT NO. 309` (4 versions) · `THE LAST BENCH` (16:9, not a Short) · seven identical 4K 10-second clips from the phone.

When you want them out, add an entry to `manifest.json` — same shape, one item per video — and run the same command.
