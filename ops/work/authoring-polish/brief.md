# Brief: authoring polish, triage of the 22c Tech Lead findings

Unit `authoring-polish`. Written by the Project Manager, 2026-11-22. This triages the 12 findings in `22c-full-batch/content-review-wave2.md` section 6 (W2.1 to W2.7) and `content-review-wave3.md` section 6 (W3.1 to W3.5). Decision logged in `decisions.md` as G.4.f.

---

# 1. Problem

**Three defects reach learners in lessons that are live today.**
- **校 is shown as "exam".** Its stored meaning is KANJIDIC2's first sense ("exam; school; printing"). The lesson recap card shows "exam" for a kanji that lesson 76 teaches as "school".
- **Verb kanji can't be answered in review.** A review asks "Type a reading for 「食」".
  - It accepts たべる or しょく. Nothing the learner sees tells them which verb is meant, or that a whole word is wanted.
  - Lessons 93 and 94 patch this in Teach ("type the whole verb"), which helps only a learner who remembers the note days later.
  - This affects all eight verb kanji: 食 飲 読 書 行 来 見 聞.
- **Examples print the same line twice.** When an example is all kana, its reading line repeats it (`いただきます。 / いただきます`). That's most example blocks in the live course.

**The rest are pipeline gaps.** A pipeline rule is only worth its build and test cost for the drafting that's left:
- **The 12 audio lessons** (Blocker 2). They are all I-Speaking (26, 48, 56, 64, 71, 96, 106, 119) or I-Listening (50, 63, 105, 118).
- **Occasional redrafts.**
- **No F-Vocab, F-Kanji, F-Grammar or I-Reading lesson is left to draft.** A rule that only guards those types protects nothing in the beta.

---

# 2. Users and use cases

- **Absolute beginner, in reviews and practice.** Sees 「食」 a few days after lesson 93 and has to produce an answer from a bare character. Looks at the recap card for 校 and is told "exam".
- **Absolute beginner, in Teach.** Reads `いただきます。` twice in a row on a small screen, and wonders whether the second line is different.
- **The PM reviewing the audio wave.** Needs the gate to catch the defects that recurred across every wave, so review time goes on what no rule can see.

---

# 3. Triage

| # | Finding | Call | Why |
|---|---|---|---|
| W2.1 | The drafter is told a lesson's own new words are already known, so drafts say "you already know …" | **Take** (P4) | Recurred in 15 drafts across waves 2 and 3, in every lesson type. Speaking lessons introduce phrases and will repeat it. Prompt-only, and the cheapest fix here |
| W2.2 | 校's stored meaning is "exam" | **Take** (P1) | Live and learner-facing. Audit below: 校 is the only beta kanji whose stored meaning differs from its lesson |
| W2.3 | Gate rule: each target kanji shown with a reading in Teach | **Defer** to the post-beta authoring backlog | Every beta kanji lesson is drafted and approved, with readings checked in review (F.2.j). No kanji lesson is left to draft. Revisit when post-beta Foundation drafting starts |
| W2.4 | "in kana" or "(katakana)" in a typed check's prompt | **Take** (P5) | Recurred in 25 checks across 12 drafts despite a correction note. Listening lessons will have typed checks. One rule |
| W2.5 | Warning for untaught kana words | **Defer**, own backlog line, before the audio wave is drafted if usage allows | The most useful rule left, because listening scripts are where untaught words creep in (95). But it's the largest item: it needs a tokenizer pass that understands conjugated forms, and it can only be a warning. It doesn't fit with the rest. Meanwhile PM review reads every audio lesson in full |
| W2.6 | An example whose reading equals its Japanese shows it twice | **Take** (P3) | Live on most lessons. A small change in the app. Fixing content instead would mean republishing almost every lesson, and lesson 20 can't be republished |
| W2.7 | Reading lessons translate the lines their checks ask about | **Drop** | Not mechanical. The I-Reading correction notes cover redrafts, and no I-Reading lesson is left to draft |
| W3.1 | に passes the gate before lesson 81 teaches it | **Defer** to the post-beta authoring backlog | Only the audio lessons before 81 are at risk (26, 48, 50, 56, 63, 64, 71). Their topics (greetings, names, jobs, questions, age) don't need location に. Age uses に as "two" (にじゅっさい), exactly what a narrow rule must spare, and particle rules have regressed before (H.2.b). Review caught the one case. Added to the audio-wave watch list (section 6) |
| W3.2 | Rōmaji give-aways the gate misses | **Defer** to the post-beta authoring backlog | All five cases were F-Vocab recall checks, and none is left to draft. Speaking lessons legitimately show rōmaji for pronunciation, so extending the rule to every lesson type risks false rejects in exactly the lessons left |
| W3.3 | The drafter's self-corrections reach learner text ("oops", "wait,") | **Take** as a warning (P6) | Three drafts in one wave. A pattern list is tiny, and a warning can't block fair text |
| W3.4 | Verb kanji in review | **Take** (P2), logged as G.4.f | Live and learner-facing (section 1) |
| W3.5 | An example's reading says a different sentence from the example | **Take** as a gate error (P7) | Two cases (98, 115), and the review only caught them by reading closely. When an example has no kanji its reading must equal it, which is fully mechanical. It pairs with W2.6: once identical lines are hidden, a mismatched one is the only reading line left on an all-kana example, and it shows the wrong sentence |

**Totals:** 7 taken, 4 deferred, 1 dropped.

**If the Tech Lead judges seven items too much for one PR,** split them in this order:
1. Learner-facing (P1 to P3) first, as this unit.
2. Pipeline (P4 to P7) as a second unit, which must land before the audio wave is drafted.

Don't trim inside either half.

---

# 4. Decisions

## 4.1 A kanji's shown meaning is the one its lesson teaches (W2.2)

**Audit, 2026-11-22, $0.** I compared the first KANJIDIC2 sense of all 41 kanji in the beta outline with the meaning their published lesson teaches:
- **Only 校 differs.** Stored "exam", taught "school".
- **Two close calls agree:** 分 ("'part' or 'minute'") and 間 ("interval"), as lesson 104 teaches them.
- **男 is "male"**, which wave 2 judged fine.

**The rule:** wherever the app shows a kanji's meaning, it's the meaning its lesson teaches. 校 becomes "school".

**The fix has to survive a re-import of KANJIDIC2.** How is the Tech Lead's call.

**Rejected**
- **Editing lesson 76 to teach "exam".** It's wrong for a beginner, and 学校 is what they meet.
- **Showing every KANJIDIC2 sense.** "exam; school; printing; proof" is noise on a card.

## 4.2 A verb kanji's reading is asked through its word (W3.4)

**Chosen:**
- When a review, practice question or chapter test asks me to read a kanji that its lesson taught as part of a verb, it shows the whole word, with its kana ending: 「食べる」, 「行く」, 「来る」.
- The reading of that word is accepted, in kana or rōmaji (たべる, taberu).
- Readings that aren't how that word is read (しょく for 「食べる」) are not accepted for it.
- The eight are 食 飲 読 書 行 来 見 聞. Any later verb kanji follows the same rule.

**Why**
- A kanji's reading only means something in a word. 食 is read た only before べる, and an ending is how a reader knows which verb it is.
- It matches lessons 93 and 94, which already tell learners to type the whole verb.
- It needs no content change.

**Rejected**
- **Adding "a whole word is fine" to the prompt.** The learner still has to guess which verb from a bare character.
- **Accepting the bare stem た.** It isn't a word and teaches nothing usable.
- **Leaving it to lesson text.** That's the patch we have, and it's forgotten by the first review.

## 4.3 An example's reading line is hidden when it says the same thing (W2.6)

- The reading line is hidden when it matches the Japanese once spaces and punctuation are ignored.
- An example with kanji keeps its reading.
- A block with a meaning keeps its meaning.
- It's a display rule only, and no lesson is republished.

## 4.4 Pipeline rules are weighed by what's left to draft

- **Four rules are taken (W2.1, W2.4, W3.3, W3.5).** Each defect recurred across lesson types, and each fix is small.
- **Rules that guard only fully drafted lesson types are deferred** (W2.3, W3.2), and so is one that would touch fragile particle logic for little remaining risk (W3.1).
- **A new gate error must not stop lessons that are already live from passing,** unless it finds a real defect. In that case the Tech Lead reports the lesson to the PM for a hand fix, rather than exempting it.

---

# 5. Promises

P1 to P3 are scored in the app on `Sensei 22a SE3`. P4 to P7 are scored by the person reviewing drafts, which is the PM, on the Tester's evidence now and on the audio wave later.

- **P1.** Everywhere the app shows what 校 means, it says "school", the meaning lesson 76 taught. Every other beta kanji still shows the meaning its lesson taught.
- **P2.** When a review, practice question or chapter test asks me to read a verb kanji, it shows me the whole word, such as 食べる. Typing the whole verb's reading (たべる or taberu) is accepted.
- **P3.** In a lesson's Teach, an example written only in kana shows its Japanese once, not twice. An example with kanji still shows its reading underneath.
- **P4.** In a lesson drafted from now on, the learner isn't told they already know words that the lesson itself introduces.
- **P5.** A draft with a typed check that tells me to answer "in kana" or "(katakana)" is refused before it reaches review.
- **P6.** When a draft's learner text contains the writer correcting itself, the reviewer is warned and shown where. Examples: "oops", "wait,", "you don't know … yet", "let's use words you know".
- **P7.** A draft is refused when an example with no kanji has a reading line that says a different sentence from the example.

**Scoring notes**
- **P2:** after a walker has done lesson 93, the Tester can make a verb kanji due on a throwaway Neon branch, or by whatever means the Tech Lead plans.
- **P4 to P7 are proved at $0, without drafting:**
  - For P4, by the prompt a lesson would get.
  - For P5 to P7, by running the gate over the pre-edit drafts in `tools/authoring/corrections.jsonl` and the `.prev.json` files. They contain real cases:
    - "in kana": 80, 102, 108, 120;
    - self-corrections: 99, 109, 120;
    - mismatched readings: 98, 115.
  - And by running the gate over every approved draft, to show nothing fair is refused.
- **The Alpha User scores P1 to P3.**

---

# 6. Out of scope, and the backlog this creates

**Backlog lines (deferred above)**
- **W2.5, untaught-word warning.** Its own unit, before the audio wave is drafted if usage allows.
- **Post-beta authoring:**
  - W2.3, kanji reading gate;
  - W3.1, narrow に rule;
  - W3.2, give-away matcher for F-Vocab recall checks, with hyphenated syllables and bracketed lookalikes.

**Audio-wave watch list (for PM review)**
- に used as a particle before lesson 81.
- Untaught words in listening scripts.
- Teach translating the lines a listening check asks about.

**Not here**
- Open checks: `open-check-followup`.
- The "Type in rōmaji or kana" placeholder (`check-explanation` section 5).
- Anything in the existing PM backlog in `ops/CHECKPOINT.md`.
- Whether any meaning or reading is linguistically right. Native-speaker sample, Blocker 6.
