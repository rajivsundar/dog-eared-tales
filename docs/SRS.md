__Twice Told__

Software Requirements Specification · Version 2\.1

A discovery\-first e\-reader for free short stories, essays and classics — with an AI build crew, human gates, and a full user story board\.

September 26, 2026 · Draft for Gate G0

![Your Shortlist, work detail and reading ladder \(mock\-ups, Part 3\.4\)](1\.jpeg)

*Your Shortlist, work detail and reading ladder \(mock\-ups, Part 3\.4\)*

## <a id="_Toc241360751"></a>Document control

__Item__

__Value__

__Document__

Twice Told — Software Requirements Specification \(SRS\), version 2\.1

__Date__

September 26, 2026

__Status__

Draft for Gate G0 \(Charter\), version 2\.1\. You confirmed D1 \(16\+\), D2 \(Antigravity\), D4 \(private repository — on Gitea\) and D6 \(Standard Ebooks\) on September 26, 2026; the other decisions are recommended defaults\.

__Supersedes__

LuminaRead SRS v1 \(Lumina\_read\_SRS\.docx\)

__Prepared by__

Claude \(Anthropic\), using four role\-based review passes: Product Management, UX/UI, Architecture, AI implementation

__Independent reviewer__

Gemini 3\.1 Pro via your Google AI Pro plan \(prompts P1–P2, Part 11\)

__Agent\-readable twin__

luminaread\-starter\-kit\.zip → docs/SRS\.md, docs/stories/, docs/use\-cases/, TASKS\.md, AGENTS\.md

## <a id="_Toc241360752"></a>How to use this document

This SRS has two audiences\. __You__ \(the product owner\) read it to understand, decide and approve\. __The AI agents__ read its twin — the Markdown files in the starter kit — to build the product on their own between your approvals\. Both come from the same source, so they always match\.

__If you want to…__

__Read__

Get Gemini on its best model and run the independent review

Part 1\.1 and prompts P1–P2

Understand the product in ten minutes

Part 1\.2, Part 2, the mockups in Part 3\.4

See what changed from v1 and what you must decide

Parts 1\.3 and 1\.4

Understand agents, skills and gates

Part 9

Set everything up, step by step

Part 10 \(no technical background assumed\)

Copy a prompt

Part 11 — every prompt says which tool it goes into

Review the build plan in detail

Parts 4–8

## <a id="_Toc241360753"></a>Contents

[Document control	2](\#\_Toc241360751)

[How to use this document	2](\#\_Toc241360752)

[Contents	2](\#\_Toc241360753)

[Part 1 — Start here	5](\#\_Toc241360754)

[1\.1 Before you begin: make sure Gemini is on its most advanced model	5](\#\_Toc241360755)

[1\.2 Twice Told in plain English	5](\#\_Toc241360756)

[1\.3 What changed from v1, and why	6](\#\_Toc241360757)

[1\.4 Decisions you need to make	7](\#\_Toc241360758)

[Part 2 — Product	9](\#\_Toc241360759)

[2\.1 Vision and problem	9](\#\_Toc241360760)

[2\.2 Goals and success metrics	9](\#\_Toc241360761)

[2\.3 Personas	9](\#\_Toc241360762)

[2\.4 Scope and releases	10](\#\_Toc241360763)

[2\.5 Content strategy and sources	11](\#\_Toc241360764)

[2\.6 How the four reviewers re\-examined the plan	12](\#\_Toc241360765)

[Part 3 — Experience \(UX/UI\)	14](\#\_Toc241360766)

[3\.1 Experience principles	14](\#\_Toc241360767)

[3\.2 Key flows	14](\#\_Toc241360768)

[3\.3 Design system	14](\#\_Toc241360769)

[3\.4 Mock\-ups	15](\#\_Toc241360770)

[3\.5 What we borrow from existing e\-readers	20](\#\_Toc241360771)

[3\.6 Accessibility requirements	20](\#\_Toc241360772)

[Part 4 — Architecture	21](\#\_Toc241360773)

[4\.1 Principles	21](\#\_Toc241360774)

[4\.2 System context	21](\#\_Toc241360775)

[4\.3 Runtime architecture	23](\#\_Toc241360776)

[4\.4 Content Factory	25](\#\_Toc241360777)

[4\.5 Data model on the device	27](\#\_Toc241360778)

[4\.6 Recommendation engine	28](\#\_Toc241360779)

[4\.7 Reader engine decision \(ADR\-0002, to confirm at G2\)	30](\#\_Toc241360780)

[4\.8 Cover art pipeline	30](\#\_Toc241360781)

[4\.9 Deployment and CI/CD	31](\#\_Toc241360782)

[4\.10 Security and privacy	32](\#\_Toc241360783)

[4\.11 Technology stack	32](\#\_Toc241360784)

[Part 5 — AI implementation	33](\#\_Toc241360785)

[5\.1 Where AI runs	33](\#\_Toc241360786)

[5\.2 Can a lightweight free local model be bundled?	33](\#\_Toc241360787)

[5\.3 Evaluation plan \(bake\-off, EN\-801\)	34](\#\_Toc241360788)

[5\.4 Guardrails	34](\#\_Toc241360789)

[Part 6 — Requirements	36](\#\_Toc241360790)

[6\.1 Functional requirements	36](\#\_Toc241360791)

[6\.2 Non\-functional requirements	36](\#\_Toc241360792)

[Part 7 — Epics, features and use cases	38](\#\_Toc241360793)

[7\.1 Epics	38](\#\_Toc241360794)

[7\.2 Key sequences	38](\#\_Toc241360795)

[7\.3 Use cases \(fully dressed\)	42](\#\_Toc241360796)

[Part 8 — User story board	52](\#\_Toc241360797)

[8\.1 How to read the story map	52](\#\_Toc241360798)

[8\.2 Story cards	55](\#\_Toc241360799)

[Part 9 — The AI build crew: agents, skills and gates	67](\#\_Toc241360800)

[9\.1 The crew	67](\#\_Toc241360801)

[9\.2 Skills, explained	68](\#\_Toc241360802)

[9\.3 Which of Matt Pocock's skills to use, and when	69](\#\_Toc241360803)

[9\.4 Twice Told's own skills \(in the kit\)	70](\#\_Toc241360804)

[9\.5 The gated pipeline	71](\#\_Toc241360805)

[9\.6 The sprint assembly line	72](\#\_Toc241360806)

[9\.7 Why Gitea instead of GitHub	75](\#\_Toc241360807)

[9\.8 How agent\-homelab fits now	75](\#\_Toc241360808)

[Part 10 — Step\-by\-step setup \(no technical background needed\)	76](\#\_Toc241360809)

[10\.1 Accounts and apps you need	76](\#\_Toc241360810)

[10\.2 Install the tools	76](\#\_Toc241360811)

[10\.3 Start your private Gitea server	77](\#\_Toc241360812)

[10\.4 Create the Twice Told repository	78](\#\_Toc241360813)

[10\.5 Open the project in Antigravity	78](\#\_Toc241360814)

[10\.6 Connect Cloudflare \(when the architect asks\)	78](\#\_Toc241360815)

[10\.7 Install Matt Pocock's skills	78](\#\_Toc241360816)

[10\.8 Set up your Gemini reviewer	79](\#\_Toc241360817)

[10\.9 Your first session: Gate G0	79](\#\_Toc241360818)

[10\.10 Then: G1–G3, content, and sprints	79](\#\_Toc241360819)

[10\.11 Alternative track: Claude Code	79](\#\_Toc241360820)

[10\.12 Troubleshooting and safety	79](\#\_Toc241360821)

[Part 11 — Prompt library	81](\#\_Toc241360822)

[Part 12 — Risks, assumptions, glossary and references	84](\#\_Toc241360823)

[12\.1 Risks and mitigations	84](\#\_Toc241360824)

[12\.2 Assumptions	84](\#\_Toc241360825)

[12\.3 Glossary	85](\#\_Toc241360826)

[12\.4 References \(checked September 2026\)	85](\#\_Toc241360827)

[Appendix — What is in the starter kit	86](\#\_Toc241360828)

*If the contents list is empty, right\-click it in Word and choose Update Field\.*

# <a id="_Toc241360754"></a>Part 1 — Start here

## <a id="_Toc241360755"></a>1\.1 Before you begin: make sure Gemini is on its most advanced model

On Google AI Pro, the most capable model you can choose in the Gemini app is __Gemini 3\.1 Pro__, labeled simply __Pro__ in the model picker\. Google announced Gemini 3\.5 Pro at I/O in May 2026, but as of late September 2026 it has not been broadly released; when it arrives it is expected to sit behind the same __Pro__ option\. __Deep Think__ is an Ultra\-only mode and is not part of AI Pro\.

1. Open gemini\.google\.com \(or the Gemini app\) and sign in with the Google account that pays for AI Pro\. Your account or plan area should show __Google AI Pro__; if not, you are in the wrong account\.
2. Start a new chat and open the model picker \(the model name near the prompt box\)\. Choose __Pro__ — not Fast or Thinking\.
3. Before a long review, check the picker again\. When a paid plan reaches its Pro allowance, Gemini can continue on a lighter model; if that happens, wait for the allowance to reset\.
4. Attach the file with the __\+__ button\. AI Pro's large context window easily holds this SRS\.

__NOTE · Who wrote this document__

This SRS was produced by Claude \(Anthropic\), not Gemini\. To honor your instruction that your most advanced Google model reviews the instructions, the pipeline builds in a Gemini 3\.1 Pro review at every planning gate\. Prompts P1 \(a reusable "Twice Told Reviewer" Gem\) and P2 \(a full review of this SRS\) are in Part 11\.

__IMPORTANT · Gemini CLI no longer works with AI Pro__

On June 18, 2026 Google stopped serving Gemini CLI for AI Pro and Ultra personal accounts\. Its successor is __Antigravity__ \(a desktop app and a CLI\), which keeps Agent Skills, hooks and subagents and uses Gemini 3\.1 Pro by default\. Your build crew runs in Antigravity \(Part 10\)\.

## <a id="_Toc241360756"></a>1\.2 Twice Told in plain English

Twice Told is a free reading app that learns what you like and serves you great free reading — starting with short stories and essays you can finish in one sitting, then gradually mixing in longer classics when you are ready\. Everything it learns about you stays on your own phone\.

1. __Tell it your taste\.__ Pick a few moods and react to eight quick "taste cards"\. Optionally add books you have loved, even modern ones\.
2. __Get a shortlist\.__ Each visit shows a small shortlist: one hero pick, a row of short reads, a row of essays and one wildcard\. Every pick says why it was chosen\.
3. __Read\.__ A built\-in reader with comfortable fonts, themes, time\-left estimates, word definitions and read\-aloud\.
4. __React\.__ One tap when you finish \("Loved it", "It was OK", "Not for me"\)\. The app also notices what you finish or abandon\.
5. __Grow\.__ Once you are enjoying short works, longer ones appear on a "reading ladder" — novelettes, then novellas, then novels — at your pace\.

__Behind the scenes__, a "Content Factory" prepares the library once: it collects public\-domain texts the way the libraries ask, splits anthologies into single stories, writes honest blurbs and content notes, computes a compact "taste fingerprint" for each work, and generates cover art in one consistent style\. You approve samples\. An __AI build crew__ then writes and tests the app, and you approve its work at a handful of __gates__\.

## <a id="_Toc241360757"></a>1\.3 What changed from v1, and why

Four role\-based reviews re\-examined every v1 suggestion\. The table lists each change and which reviewer raised it\.

__v1 plan__

__v2 decision__

__Why__

__Raised by__

Runtime calls to the public Gutendex API and on\-the\-fly Pollinations images

A build\-time Content Factory publishes a static, versioned catalog with precomputed blurbs, vectors and covers

The public Gutendex instance is meant for testing and has had outages; Pollinations' anonymous tier is rate\-limited and may watermark\. Core flows should not depend on third parties\.

Architect

App downloads books directly from gutenberg\.org

Curated texts mirrored on our own static host with Project Gutenberg license handling

Project Gutenberg blocks automated access to its website and asks for mirrors and offline catalogs\.

Architect

Whole books only

Short\-first catalog: anthologies split into single stories and essays; non\-fiction essays and articles added; longer works via a reading ladder

This is what you asked for — short reads first, longer works later\.

Product Manager

Each phone embeds 10–20 summaries at runtime

Catalog vectors precomputed once; phones only do vector arithmetic

Faster, cheaper on battery, deterministic, and works offline\.

AI Engineer

A local AI model auto\-downloads on first open

No model needed for the core app\. Optional "Explain \(Labs\)" with tiers: browser built\-in AI → opt\-in small model → glossary

Hundreds of MB on first open hurts the first impression and mobile data; small models must earn their place in a bake\-off\.

UX/UI \+ AI Engineer

epub\.js / react\-reader

foliate\-js \(MIT\) behind a ReaderEngine adapter; Readium ts\-toolkit as plan B; decided by a bake\-off

epub\.js has had no release since February 2022\.

Reader Researcher

@xenova/transformers

@huggingface/transformers v4

The old package name is superseded \(v2\.17\.2, 2024 vs v4\.3\.0, Sept 2026\)\.

AI Engineer

LocalForage key\-value store

Dexie \(IndexedDB with schema and migrations\) behind typed stores

LocalForage's last release was 2021; we need queries and migrations\.

Architect

Next\.js with webpack tweaks on Vercel

Vite \+ React \+ TypeScript PWA on Cloudflare Pages

Client\-only app needs no server framework; recent Next\.js versions default to Turbopack, so webpack tweaks may not apply\. Same stack Lovable uses, if you prototype there\.

Architect

Swipe cards showing summaries

Taste cards with cover, one\-line hook, genuine first line, reading time; buttons plus swipe

Faster taste signal; accessible to people who cannot swipe\.

UX/UI

A top\-3 gallery in a masonry layout

Your Shortlist: hero, short reads, essays, wildcard — each with "Why this?"

More choice without a feed; explanations build trust\.

UX/UI

Feedback = swipe and add\-to\-library

Explicit reactions with reasons \+ implicit signals \(progress, finish, abandon\) in an on\-device event log with time decay

Better learning, explainable, editable, and privacy\-preserving\.

AI Engineer

Cover images generated per user at runtime

Covers generated once at build time, human\-approved, text\-free art with app\-rendered titles; procedural fallback

Consistent quality, no runtime dependency, correct titles\.

UX/UI

Middle\-school persona

MVP audience 16\+ with content notes; younger\-reader mode deferred

Children's\-privacy law and content suitability need dedicated work\.

Product Manager

No success metrics

Activation, first\-read completion, hit rate, return, ladder progression, cost

You cannot steer what you do not measure\.

Product Manager

Storage risk not addressed

Persistent\-storage request, install prompt, export/import

Browsers can evict website storage; Safari limits storage for sites not added to the Home Screen\.

Architect

No accessibility requirements

WCAG 2\.2 AA baseline, dyslexia\-friendly and high\-legibility fonts, read\-aloud, CI checks

A reading app must work for everyone\.

UX/UI

Single "agent handoff" step

A gated pipeline with a named agent crew, skills, and an agent\-readable starter kit

You asked to be involved only at gates\.

Product Manager

GitHub as the code host \(implied\)

Self\-hosted Gitea: private repository, Gitea Actions CI, enforced branch protection

Your decision D4; free enforced protection on private repos; agent\-homelab's native forge; code stays on your machine\.

Architect

Claude Code as the build harness

Antigravity with Gemini 3\.1 Pro, a Claude\-model reviewer, and Gemini\-app reviews at planning gates

Your decision D2; included in Google AI Pro\.

Product Manager

Human involvement throughout the build

Sprint assembly line: humans gate only the plan \(G4\) and the promotion \(G5\); a machine gate \(review \+ CI\) blocks bad merges; auto\-rollout to test

The pipeline you shared; fewer interruptions for you\.

Product Manager

Gutenberg\-only content

Plus Standard Ebooks, Wikisource, Library of Congress newspapers, The Conversation extracts, LibriVox audio

Richer non\-fiction and audio, each with explicit license handling\.

Content Curator

## <a id="_Toc241360758"></a>1\.4 Decisions you need to make

You confirmed D1, D2, D4 and D6 on September 26, 2026\. The rest have recommended defaults so the agents can proceed; confirm or change them in the G0 interview \(/kickoff\)\.

__ID__

__Decision__

__Recommendation__

__Why it matters__

__When__

D1

Audience for the first release

__Confirmed:__ adults and older teens \(16\+\)\. Younger\-reader mode later\.

Under\-13 users bring children's\-privacy \(COPPA\) duties and content\-suitability work; public\-domain texts include dated and offensive material\.

Confirmed

D2

Main build harness

__Confirmed:__ Google Antigravity with Gemini 3\.1 Pro as the builder; the reviewer agent runs on a Claude model inside Antigravity for cross\-model review; the Gemini app reviews planning gates\. Claude Code is an optional alternative track\.

Included in your Google AI Pro plan; supports agent skills, workflows, rules and subagents\.

Confirmed

D3

Usage limits

Keep sprints small \(≤ 6 stories\); consider a higher Google plan only if limits interrupt sprints\.

Parallel agents use allowance faster\.

G0

D4

Repository

__Confirmed:__ private repository, hosted on your own __Gitea__ server\.

Gitea enforces branch protection on private repositories at no cost \(GitHub Free does not\); it is also the forge agent\-homelab was built and run on\.

Confirmed

D5

MVP catalog size

≈300 short works \(≈200 stories, ≈100 essays/articles\) \+ ≈60 longer works\.

Enough variety for learning; small enough to review samples and generate covers on free tiers\.

G3

D6

Standard Ebooks Patrons Circle

__Confirmed:__ yes — small donation for feed access\.

Feeds and bulk downloads for software use are a Patrons Circle benefit\.

Confirmed

D7

CC BY\-SA content \(e\.g\., Wikipedia\)

Not in R1; consider in R2 with an attribution panel\.

Share\-alike and attribution add UI and compliance work\.

G3

D8

Cover art style

"Risograph modern": text\-free illustration, limited palette, app\-rendered titles\.

Consistent and legible; avoids garbled AI text in images\.

G1

D9

Product name

Keep "Twice Told" as the working name; trademark search before public launch\.

Similar names exist in the app ecosystem\.

Before launch

D10

Hosting

Cloudflare Pages, deployed from Gitea Actions with Wrangler \(Direct Upload\)\.

Cloudflare's automatic Git integration supports only GitHub and GitLab; Direct Upload still gives branch URLs for dev and test\.

G2

D11

Analytics

None by default; opt\-in, reader\-initiated metrics summary \(US\-1006\)\.

Privacy promise; you still need beta metrics\.

G0

D12

Where Gitea runs

Start in Docker on your computer; move to an always\-on small device \(mini PC, NAS\) if you want CI while the laptop sleeps\.

Simplest start; CI and the merge queue pause when the host is off\.

G2

D13

Extra content sources

Add Library of Congress historic newspapers \(R2\), The Conversation extracts with link\-out \(R2\), LibriVox audio \(R3\), and evaluate Internet Archive scans \(R3\)\. Exclude sources that rely on non\-US public\-domain rules\.

Richer non\-fiction and audio while staying license\-safe\.

G3

# <a id="_Toc241360759"></a>Part 2 — Product

## <a id="_Toc241360760"></a>2\.1 Vision and problem

__Vision:__ make great free writing irresistible — one well\-chosen short read at a time — until readers are happily finishing classics they would never have picked up\.

__Problem:__ public\-domain libraries hold tens of thousands of free works, but they are hard to enjoy: catalogs are search\-driven, works come as whole books, great short pieces are buried inside anthologies, covers are dated, nothing is personalized, and most readers do not know where to start\.

- __Short first\.__ Complete, satisfying reads in 5–30 minutes build the habit\.
- __Explain every pick\.__ Trust comes from transparency\.
- __Calm, not compulsive\.__ No infinite feed, no streak guilt\.
- __Private by design\.__ Your reading life stays on your device\.
- __Beautiful by default\.__ Typography and art worthy of the works\.
- __Zero running cost\.__ Static hosting and free tiers at MVP scale\.
- __Agents build, humans decide\.__ You approve at gates; agents do the rest\.

## <a id="_Toc241360761"></a>2\.2 Goals and success metrics

__Goal__

__Metric__

__MVP target__

__How measured__

Activation

New readers who reach their first shortlist

≥ 80%

Beta summaries \(US\-1006\)

Fast value

Median time from first open to first read

≤ 2 min

Scripted usability tests

Great first picks

Short works started in session 1 that are finished

≥ 60%

Beta summaries

Recommendation quality

Opened picks rated Loved/OK or finished

≥ 50% by week 2

Beta summaries; persona simulation

Habit

7\-day / 30\-day return of beta readers

≥ 35% / ≥ 20%

Beta summaries

Growth to longer works

Active readers finishing a work over 7,500 words within 30 days

≥ 25%

Beta summaries

Helpful AI \(Labs\)

Explanations rated helpful in the blind sample

≥ 70%

G2 bake\-off

Trust & quality

License violations; serious accessibility violations

0 / 0

CI validators

Cost

Monthly infrastructure spend at MVP scale

$0

Hosting dashboards

Because Twice Told collects no analytics, metrics come from beta readers who choose to share an aggregate summary \(US\-1006\), plus scripted tests and simulations\.

## <a id="_Toc241360762"></a>2\.3 Personas

__Persona__

__Context__

__Needs__

__What Twice Told does__

Maya, the commute sampler \(29\)

Reads on her phone in 10–20 minute gaps

Complete, satisfying reads; no half\-finished books

Short\-reads row, minutes on every card, offline library

Daniel, the lapsed reader \(45\)

Used to read novels; now scrolls instead

A gentle way back; classics feel intimidating

Taste cards, "Why this?", reading ladder

Priya, the curious learner \(22\)

Grad student who loves ideas

Essays and non\-fiction; help with archaic language

Essays row, glossary, Explain \(Labs\)

Grace, the comfort reader \(67\)

Low vision; loves mysteries

Large text, high contrast, read\-aloud

Atkinson Hyperlegible, Night/Black themes, read\-aloud

Leo, 13 \(future\)

Middle\-school student \(from v1\)

Age\-appropriate works

Deferred: younger\-reader mode after MVP \(decision D1\)

## <a id="_Toc241360763"></a>2\.4 Scope and releases

__In scope for the MVP \(R0 \+ R1\):__ onboarding and Reading DNA, a short\-first catalog of stories and essays, Your Shortlist with explanations, the feedback loop, the built\-in reader essentials, generated covers, offline library, privacy controls, accessibility and performance budgets, and the gated agent pipeline\.

__Out of scope for the MVP:__ accounts and cloud sync, social features, copyrighted or modern books, DRM, audiobooks \(read\-aloud uses device voices\), payments or ads, readers under 13, languages other than English, server\-side analytics\.

__Release__

__Goal__

__Highlights__

__Exit gate__

R0 Walking skeleton

Prove the pipeline end to end

Scaffold, CI, test and production sites, design tokens, storage layer, 25\-work sample catalog, basic reader, reader\-engine bake\-off

G5 for R0

R1 Short\-reads MVP

Delight with short reads

Onboarding, Your Shortlist, Why this?, feedback loop, reader essentials, covers, offline library, privacy controls, local\-model bake\-off

G5 \+ beta launch

R2 Mixed reads

Grow into longer works

Your Long List row, reading ladder, mix control, DNA insights, highlights, read\-aloud, recaps, history import, Explain \(Labs\)

G5

R3 Native & smarter

Reach and depth

Android/iOS wrappers, personal re\-ranker, Ask\-the\-book, optional encrypted sync

G5

![Figure 1 — Release plan \(sequenced by readiness, not dates\)](2\.png)

*Figure 1 — Release plan \(sequenced by readiness, not dates\)*

## <a id="_Toc241360764"></a>2\.5 Content strategy and sources

__Source__

__What we use__

__License basis__

__How we access it__

__When__

Project Gutenberg

Stories, essays, novellas, novels

Public domain in the US; Project Gutenberg license and trademark terms

Offline RDF catalog \+ mirror downloads, ≥ 2 s apart; never crawl the website

R0–R1

Standard Ebooks

Carefully produced editions

Public\-domain texts; Standard Ebooks' own work dedicated to the public domain \(CC0\)

Patrons Circle feeds \(confirmed, D6\)

R1

Wikisource

Essays, speeches, historical articles

Public\-domain texts \(verify per item\)

Per item with provenance

R1

Library of Congress — Chronicling America

Historic newspaper articles and features \(pre\-1930\)

Public domain

loc\.gov JSON API \(the legacy Chronicling America API was retired in 2025\) or bulk OCR data; OCR cleanup \+ human QA

R2

The Conversation

Contemporary expert essays

CC BY\-ND 4\.0 with republishing guidelines \(no edits, credit, page\-view counter for full republishing, no systematic republishing\)

Hand\-picked extracts with a "Read the full article" link — no tracking counter

R2

LibriVox

Volunteer\-narrated audiobooks of public\-domain works

Recordings dedicated to the public domain

Stream per work with attribution \("Listen" option\)

R3

Internet Archive / Open Library

Public\-domain scans; metadata for books readers loved

Public domain for pre\-1930 scans; in\-copyright lending is not usable

Open Library search API \(R2, reader\-initiated\); scan quality evaluated first \(EN\-212\)

R2 / R3

Wikipedia featured articles

Modern non\-fiction

CC BY\-SA 4\.0 — attribution and share\-alike

Per article with attribution block

R2 \(D7\)

US federal works \(e\.g\., NASA\)

Science non\-fiction

US government works are public domain \(third\-party images excepted\)

Per item

R2 option

__Not recommended:__ Project Gutenberg Australia and Faded Page \(Canada\) publish works that are public domain under their countries' rules but often still copyrighted in the US; HathiTrust limits full downloads for non\-members; aggregators \(ManyBooks, Feedbooks and similar\) repackage primary sources — use the originals\. Hugging Face corpora built from these sources \(e\.g\., PG\-19, US\-PD\-Newspapers\) are handy for experiments and finding candidates, but shipped texts always come from the primary source with provenance\.

- __Public domain means US public domain\.__ Works published in 1930 or earlier are generally public domain in the US as of 2026; status differs in other countries\. State this in About and get a quick legal review before public launch\.
- __Project Gutenberg texts:__ either keep Project Gutenberg's full license with each text or remove all Project Gutenberg references and marks \(the rule is chosen in ADR\-0001\)\.
- __Our own words:__ blurbs, hooks and summaries are written fresh by the Content Factory and labeled as generated; source text is never paraphrased or altered\.
- __Historical content:__ many older works contain racism, violence and other harms\. Content notes and filters let readers choose\.

__Length class__

__Words__

__Typical reading time\*__

__Role in Twice Told__

Flash / short story

under 7,500

under ~30 min

The core of R1

Novelette

7,500 – 17,499

~30–75 min

First rung of the ladder

Novella

17,500 – 39,999

~1\.2–2\.8 h

Second rung

Novel

40,000\+

3 h and up

Top rung

\*At a default 238 words per minute, then personalized to each reader's measured speed\. Length classes follow common genre\-award conventions\.

## <a id="_Toc241360765"></a>2\.6 How the four reviewers re\-examined the plan

__Reviewer__

__Focus__

__Biggest insight__

Product Manager

Goals, audience, scope, metrics

The v1 plan was book\-first; your goal is short\-first with a path to longer works\. Split anthologies and add essays\.

UX/UI Designer

First\-run, trust, reading comfort, accessibility

Get to a first story in two minutes; explain every pick; never auto\-download a model on first open\.

Architect

Reliability, cost, privacy, maintainability

Move all heavy work to build time; no runtime dependency on third\-party APIs; replace unmaintained libraries\.

AI Engineer

Where AI adds value and where it does not

Recommendations need maths, not a language model\. Use small models only where a bake\-off proves they help\.

# <a id="_Toc241360766"></a>Part 3 — Experience \(UX/UI\)

## <a id="_Toc241360767"></a>3\.1 Experience principles

1. __First story in under two minutes\.__ No account, no download, no questionnaire\.
2. __Explain every pick__ with a one\-line reason\.
3. __Short first, long when ready__ — never pushed\.
4. __Calm, not compulsive:__ a shortlist, not an infinite feed; stats without guilt\.
5. __Typography first:__ reading comfort beats decoration\.
6. __Accessible by default__ in every flow\.
7. __Show privacy, don't just claim it:__ an inventory of what is stored\.

## <a id="_Toc241360768"></a>3\.2 Key flows

__Onboarding:__ welcome → mood board → taste cards → reading context → first shortlist\. __Daily loop:__ shortlist → detail → read → check\-in → updated shortlist\. __Growth loop:__ positive finishes → longer reads row → ladder rung → recap on return\. The state diagram shows how a single work moves for a reader\.

![Figure 2 — Lifecycle of a work for one reader](3\.png)

*Figure 2 — Lifecycle of a work for one reader*

## <a id="_Toc241360769"></a>3\.3 Design system

__Token__

__Value__

__Use__

Ink

\#1B2238

Primary text, dark surfaces, primary navigation

Lumen amber

\#E8A33D

Primary actions, progress, highlights

Parchment

\#FAF5EA

App background \(light\)

Dusk violet

\#5B4B8A

Secondary accents, exploration

Sage

\#5E8C6A

Success, privacy reassurance

Coral

\#D8674F

Warnings, destructive actions, gates

Teal

\#2F7F7A

Links, AI and agent accents

Slate

\#3A4152

Secondary text

__Role__

__Font \(all SIL Open Font License\)__

__Notes__

Display & titles

Fraunces

Also used for cover title overlays

Reading text

Literata

Designed for long\-form screen reading

Interface

Inter

Labels, buttons, metadata

Accessibility options

Atkinson Hyperlegible, OpenDyslexic

Selectable in the Aa panel

__Reading theme__

__Background__

__Text__

__Contrast target__

Paper

\#FBF6EA

\#2B2A26

≥ 7:1

Sepia

\#F1E4C8

\#3B2F1E

≥ 7:1

Night

\#15171E

\#D9D3C3

≥ 7:1

Black \(OLED\)

\#000000

\#CFCFCF

≥ 7:1

Spacing uses a 4\-point scale \(4, 8, 12, 16, 24, 32, 48\)\. Corner radii: 8 \(covers\), 14–18 \(cards\), 26 \(buttons, sheets\)\. Motion is short \(150–250 ms\) and disabled under reduced\-motion settings\. Tokens live in docs/design/tokens\.json in the kit\.

## <a id="_Toc241360770"></a>3\.4 Mock\-ups

Twelve high\-fidelity screens across four boards\. Cover art in these mock\-ups is procedurally drawn to show the "risograph modern" house style; real covers come from the cover pipeline\. Titles are always rendered by the app, never baked into images\.

![Board 1 — Getting started: welcome, mood board, taste cards](4\.jpeg)

*Board 1 — Getting started: welcome, mood board, taste cards*

![Board 2 — Discover & decide: Your Shortlist, work detail, library and reading ladder](5\.jpeg)

*Board 2 — Discover & decide: Your Shortlist, work detail, library and reading ladder*

![Board 3 — Read & react: reader, Explain \(Labs\), end\-of\-story check\-in](6\.jpeg)

*Board 3 — Read & react: reader, Explain \(Labs\), end\-of\-story check\-in*

![Board 4 — Comfort & control: Night theme and type panel, Reading DNA insights, Privacy & AI](7\.jpeg)

*Board 4 — Comfort & control: Night theme and type panel, Reading DNA insights, Privacy & AI*

## <a id="_Toc241360771"></a>3\.5 What we borrow from existing e\-readers

The Reader Researcher agent studies established readers for proven patterns\. Copyleft projects such as KOReader \(AGPL\-3\.0\) are studied for UX only; no code is copied\. Open\-source engines are evaluated in the bake\-off \(Part 4\.7\)\.

__Pattern__

__Seen in__

__Our decision__

__Release__

Edge tap zones, centre tap for controls

Kindle, Apple Books, KOReader

Adopt, plus labeled buttons

R1

Pages vs scroll

Apple Books, Readest, Moon\+ Reader

Adopt

R0–R1

Time left in chapter/book

Kindle

Adopt, using the reader's own speed

R1

Themes and typography controls

Apple Books, Kobo, KOReader

4 themes, 4 fonts, size, spacing, margins

R1

Dictionary on long\-press

Kindle, Apple Books, Kobo

Build\-time glossary first, dictionary second

R1

Highlights, notes, export

Kindle, Kobo, Readwise

Adopt; Markdown export

R2

Read aloud with sentence highlight

Apple Books, Readest

Device voices via Web Speech API

R2

"Previously…" recaps

Kindle Recaps \(series level\)

Chapter\-level, spoiler\-safe

R2

Inline hints for hard words

Kindle Word Wise

Consider as glossary hints

R3

Reading stats

Kobo

Gentle stats, no streak penalties

R2

Sync across devices

Kindle, Readest

Export/import now; optional encrypted sync later

R1 / R3

## <a id="_Toc241360772"></a>3\.6 Accessibility requirements

- WCAG 2\.2 AA across the app; reading text at 7:1 contrast or better in every theme\.
- Every control reachable by keyboard and labeled for VoiceOver, TalkBack and NVDA; no swipe\-only actions\.
- Touch targets at least 44 × 44 px; text scalable to 200% without loss\.
- Respect reduced\-motion and high\-contrast settings\.
- Dyslexia\-friendly and high\-legibility fonts; read\-aloud\.
- Automated axe checks in CI plus a manual checklist at every G5\.

# <a id="_Toc241360773"></a>Part 4 — Architecture

## <a id="_Toc241360774"></a>4\.1 Principles

- __Edge\-first and static\.__ The product is a static website plus the reader's device\. There is no application server to run or secure\.
- __Intelligence at build time\.__ Heavy AI work runs once in the Content Factory, with human sampling\. Phones do light maths\.
- __No runtime third\-party dependency__ for core flows \(discovery, reading, feedback\)\.
- __Private by default\.__ Personal data never leaves the device unless the reader exports it\.
- __Deep modules with small interfaces__ \(ReaderEngine, RecEngine, Stores, AIService\) so agents can work in parallel and parts can be swapped\.
- __Everything testable by agents\.__ Every story has automated acceptance tests\.

## <a id="_Toc241360775"></a>4\.2 System context

![Figure 3 — System context](8\.png)

*Figure 3 — System context*

The reader's device downloads the app, catalog, texts and covers from a static host and sends nothing personal back\. Optional lookups \(Open Library search, dictionary\) happen only when the reader asks\. The Content Factory runs on your computer or in CI, never on readers' phones\.

## <a id="_Toc241360776"></a>4\.3 Runtime architecture

![Figure 4 — Runtime architecture inside the reader's device](9\.png)

*Figure 4 — Runtime architecture inside the reader's device*

__Module__

__Responsibility__

__Interface \(sketch\)__

app/ \(shell\)

Routing, layout, theme, install prompt

React routes

features/onboarding, shelf, detail, reader, library, settings

Screens and flows

React components using stores and engines only

engine/rec \(worker\)

Scoring, beliefs, MMR, slots, mix composer, explanations

recommend\(slots\), updateProfile\(events\), explain\(workId\)

engine/reader

ReaderEngine adapter over foliate\-js \(or Readium\)

open\(work, locator\), next\(\), prev\(\), goTo\(\), onLocation\(\), highlight\(\)

services/ai \(worker\)

Embeddings and Explain tiers

capabilities\(\), embed\(text\), explain\(passage, glossary\)

stores/

Dexie\-backed typed stores with migrations

ProfileStore, EventLog, LibraryStore, ProgressStore, HighlightStore, SettingsStore

catalog/

Load shards and vectors, search index, updates

getWork\(id\), vectors\(\), search\(query, filters\)

pwa/

Service worker: offline, cache, catalog updates

Workbox via vite\-plugin\-pwa

scripts/ \(build time\)

Content Factory and covers

npm run catalog:build, covers:generate, catalog:validate

## <a id="_Toc241360777"></a>4\.4 Content Factory

![Figure 5 — Content Factory pipeline with human gates C1 and C2](10\.png)

*Figure 5 — Content Factory pipeline with human gates C1 and C2*

__Catalog field__

__Example__

__Produced by__

id, title, author, year

pg\-1234\-s03, "The Monkey's Paw", W\. W\. Jacobs, 1902

Harvest \+ split

form, lengthClass, wordCount, readingMinutes

fiction, short, 4,000, 17

Deterministic scripts

readability

Grade 8

Deterministic formula

firstLine

Genuine opening sentence

Extracted verbatim

hook, blurb

≤ 20 and ≤ 60 words, no spoilers

Build\-time LLM, human\-sampled

genres, moods, contentNotes

horror; eerie; death, grief

Build\-time LLM, human\-sampled

glossary, chapterSummaries

Archaic words; recap per chapter

Build\-time LLM

vector

384 numbers \(int8\)

Embedding model

cover, coverAlt, coverPrompt, coverModel

WebP set \+ alt text

Cover pipeline, C2\-approved

provenance: sourceName, sourceUrl, license, retrievedAt, sha256

Project Gutenberg mirror URL, checksum

Harvester

__How enrichment runs without extra cost:__ by default the Content Curator and AI Engineer agents do the enrichment inside your Antigravity sessions \(Gemini 3\.1 Pro, included in AI Pro\), in batches\. Alternatives: a scripted run on the Gemini API free tier \(Flash models\), or a local model via Ollama for a fully offline pipeline\.

## <a id="_Toc241360778"></a>4\.5 Data model on the device

![Figure 6 — On\-device data model \(WORK is the read\-only catalog; everything else lives in IndexedDB\)](11\.png)

*Figure 6 — On\-device data model \(WORK is the read\-only catalog; everything else lives in IndexedDB\)*

- The __event log is the source of truth__; the profile is a cache that can be rebuilt from it at any time\. This makes "forget a signal" and import/export exact\.
- The app requests __persistent storage__ on first profile creation and prompts readers to install the app and export backups, because browsers can clear website storage — Safari in particular limits storage for sites not added to the Home Screen\.
- Export is a versioned JSON file containing profile, events, library, progress, highlights and settings\.

## <a id="_Toc241360779"></a>4\.6 Recommendation engine

![Figure 7 — The feedback loop that powers recommendations](12\.png)

*Figure 7 — The feedback loop that powers recommendations*

__Representations\.__ Each work has a unit\-length vector \(from the embedding model\) and facet values \(genre, mood, era band, form, length class, readability band\)\. The reader has a __taste accumulator__ a; the taste vector is t = a / |a|\. Onboarding seeds a from the chosen mood tiles \(each tile maps to a build\-time centroid\) and the taste\-card reactions\.

__Update rule\.__ For each event with weight w on a work with vector e: a ← a · 0\.5^\(Δdays/90\) \+ w · e\. This gives a 90\-day half\-life and is exactly reproducible by replaying the log\.

__Event__

__Weight w__

__Facet belief update__

Love \(card or check\-in\)

\+1\.0

success \+1 on the work's facets

It was OK

\+0\.3

success \+0\.5, failure \+0\.5

Not for me

−0\.5

failure \+1, plus the reason rule below

Finished with no rating

\+0\.6

success \+1

Read ≥ 50% then stopped

\+0\.2

—

Abandoned \(< 15% read, idle 14 days\)

−0\.3

failure \+0\.5

Dog\-eared

\+0\.2

—

Highlight or note

\+0\.1 each \(max \+0\.3 per work\)

—

Opened detail only; used Explain

0

— \(difficulty is never penalized\)

Onboarding: Love / Maybe / Not for me

\+1\.0 / \+0\.3 / −0\.5

as above

__Reason rules:__ "Too long" lowers length comfort by one class \(no taste penalty\); "Too old\-fashioned" adds failure to the era facet; "Too dark" adds double failure to dark moods; "Not my genre" adds double failure to the genre; "Already read" marks the work read with weight 0\.

__Facet beliefs\.__ Each facet value has a Beta\(α, β\) belief starting at \(1, 1\); a selected mood tile adds 2 to α\. At each refresh the engine draws a sample from each belief \(Thompson sampling\), so uncertain facets get explored naturally\.

__Score\.__ s = 0\.55·cos\(t, e\) \+ 0\.20·facetSample \+ 0\.10·lengthFit \+ 0\.10·qualityPrior \+ 0\.05·novelty − penalties\. The quality prior comes from curator picks, Standard Ebooks inclusion and download\-popularity percentiles\. Works that are blocked by filters, finished or dismissed are excluded; works shown three times without a tap lose 0\.15\.

__Diversify and slot\.__ Maximal Marginal Relevance \(λ = 0\.7\) re\-ranks for variety, with at most one work per author per shortlist\. Slots: hero \(best that fits a typical session\), 4 short stories, 2 essays, 1 wildcard \(drawn from the most uncertain facet or an unexplored cluster\)\.

__Ladder level__

__Longer works on a 7–8 item shortlist__

__Level up__

__Level down__

0 \(start\)

0

3 positive finishes of short works

—

1

1 novelette

3 positive finishes at level

2 abandoned longer works in a row

2

1–2 novelettes/novellas

same

same

3

2 novellas/novels

same

same

4

2–3

—

same

Mix settings modify the table: __Mostly short__ caps longer works at 1; __Balanced__ uses the table; __Mostly long__ adds 1; __Surprise me__ samples within the table with higher exploration\. __Why this?__ shows the template for the largest scoring term \(e\.g\., "Because you loved …", "A theme you enjoy: …", "Wildcard: a little outside your usual", "Next rung on your ladder"\)\.

__Evaluation\.__ Offline, the engine is tested against five synthetic personas with known tastes \(hit rate in the top 5 at least 2× random; catalog coverage ≥ 30%\)\. In beta, hit rate and completion come from shared summaries\. Performance: 5,000 × 384 int8 dot products run in a Web Worker well inside the 150 ms budget\.

## <a id="_Toc241360780"></a>4\.7 Reader engine decision \(ADR\-0002, to confirm at G2\)

__Criterion__

__foliate\-js__

__Readium ts\-toolkit__

__epub\.js / react\-reader__

License

MIT

BSD\-3\-Clause

BSD\-2 \(epub\.js\), ISC \(react\-reader\)

Maintenance \(checked Sept 2026\)

Active; author states the API is not yet stable; used by Foliate and Readest

Active; @readium/navigator 2\.10\.3 released Sept 2026

epub\.js last released Feb 2022

Formats

EPUB, MOBI/KF8, FB2, CBZ; PDF experimental

EPUB via a publication manifest

EPUB

Integration

Plain ES modules; opens \.epub in the browser; include as a pinned git submodule

Needs a Readium publication manifest \(can be generated at build time\)

Simple React wrapper

Verdict

__Default__, behind the ReaderEngine adapter

__Plan B__ if accessibility or stability fall short

Not recommended

Because we control the catalog, the Content Factory normalizes every work to clean EPUB 3 at build time, which simplifies whichever engine wins\.

## <a id="_Toc241360781"></a>4\.8 Cover art pipeline

- __House style \(decision D8\):__ "risograph modern" — bold shapes, limited palette per genre, subtle grain, 2:3 portrait, __no text__\. Titles are overlaid by the app in Fraunces, so they are always correct, legible and screen\-readable\.
- __Generation:__ FLUX\.1 \[schnell\] \(Apache\-2\.0\) via Cloudflare Workers AI\. The free allocation is 10,000 "neurons" a day; at the published per\-tile and per\-step rates that is roughly 150 covers a day \(estimate\)\. Alternatives: Pollinations with a registered key \(the anonymous tier is limited to about one request per 15 seconds and may watermark\), or a local GPU\.
- __Automatic checks:__ OCR rejects any image containing text; a safety check rejects unsafe content; perceptual hashing rejects near\-duplicates\.
- __Human gate C2:__ you approve on an HTML contact sheet; rejected works are regenerated or get the procedural fallback cover\.
- __Transparency:__ "Art notes" state that illustrations are AI\-generated and which model made them\. Identifiable real people are never depicted\.

__WHERE: Cover prompt template \(docs/content/house\-style\.md in the kit\)__

Illustrated book\-cover artwork, risograph\-modern style: bold flat shapes,

limited palette of \{palette\}, subtle paper grain, strong silhouette, calm

negative space in the lower third for a title overlay\.

Scene: \{scene\_from\_blurb\}\. Mood: \{mood\}\. Era cues: \{era\}\.

No text, no letters, no logos, no signatures, no real identifiable people\.

Portrait 2:3\.

## <a id="_Toc241360782"></a>4\.9 Deployment and CI/CD

![Figure 8 — From pull request to production, with Gate G5](13\.png)

*Figure 8 — From pull request to production, with Gate G5*

__Service__

__Used for__

__Cost at MVP scale__

Gitea \(self\-hosted, private repo\)

Code, pull requests, Gitea Actions CI, enforced branch protection, merge queue

Free \(open source\)

Docker Desktop

Runs Gitea and its CI runner on your computer

Free for personal use

Cloudflare Pages

Production \(main\), test site \(test\), preview \(dev\)

Free tier

Cloudflare Workers AI

Cover generation at build time

Free daily allocation

Google AI Pro

Antigravity build crew \(Gemini 3\.1 Pro; Claude models available inside Antigravity\) and Gemini\-app reviews

Your existing subscription

Claude \(optional\)

Alternative Claude Code track

Optional

Standard Ebooks Patrons Circle

Feed access for ingest

Small donation \(optional\)

## <a id="_Toc241360783"></a>4\.10 Security and privacy

- EPUB content renders in a sandboxed frame with scripts disabled and a strict Content\-Security\-Policy; the app self\-hosts fonts and loads no third\-party scripts\.
- Supply chain: lockfile, Dependabot, npm audit in CI, pinned foliate\-js commit, model downloads from pinned URLs with checksum verification\.
- Secrets \(Cloudflare token, feed credentials\) live only in a git\-ignored \.env or Gitea Actions secrets; never pasted into chats\.
- An automated network\-allowlist test proves no personal data leaves the device\.
- The export file is plain JSON; the app warns readers it contains their reading history\.

## <a id="_Toc241360784"></a>4\.11 Technology stack

__Layer__

__Choice__

__Version checked \(Sept 2026\)__

__Why__

UI

React \+ TypeScript

react 19\.3\.0

Mainstream, agent\-friendly

Build

Vite

vite 8\.3\.1

Fast static builds

PWA

vite\-plugin\-pwa \(Workbox\)

1\.3\.0

Offline, install, updates

Styling

Tailwind CSS with design tokens

current

Consistent UI

Storage

Dexie \(IndexedDB\)

dexie 4\.4\.6

Schema, queries, migrations

Reader engine

foliate\-js \(pinned commit\)

1\.0\.1 on npm; use git

MIT, multi\-format

Reader plan B

Readium ts\-toolkit

@readium/navigator 2\.10\.3

Industrial\-grade

On\-device ML

Transformers\.js

@huggingface/transformers 4\.3\.0

Embeddings, small LLMs on WebGPU

Alternative LLM runtime

WebLLM

@mlc\-ai/web\-llm 0\.2\.85

Prebuilt small models

Search

MiniSearch

7\.2\.0

Tiny on\-device full\-text index

Tests

Vitest, Playwright, axe\-core, Lighthouse CI

current

Agents verify their own work

Forge & CI

Gitea \+ Gitea Actions \(act\_runner\)

gitea 1\.x \(Docker image\)

Private repo, enforced protection, Actions\-compatible YAML

Hosting

Cloudflare Pages \(Direct Upload via Wrangler\) \+ Workers AI

—

Free tiers, branch URLs

# <a id="_Toc241360785"></a>Part 5 — AI implementation

## <a id="_Toc241360786"></a>5\.1 Where AI runs

__Task__

__Where__

__Approach__

__Why__

Blurbs, hooks, tags, content notes, glossary, chapter recaps

Build time

Gemini 3\.1 Pro in Antigravity \(or a Claude model\) \+ human sampling

Quality matters; done once

Splitting anthologies

Build time

Heuristics \+ LLM boundary check, verbatim slices only

Accuracy, no invented text

Catalog vectors

Build time

Small open embedding model via Transformers\.js in Node

Same weights as on device

Cover art

Build time

FLUX\.1 \[schnell\] via Cloudflare Workers AI

Free tier, consistent style

Recommendations and learning

Device

Maths, not a model: vectors, Beta beliefs, MMR

Instant, private, explainable

Free\-text taste input

Device \(lazy\)

Same embedding model, tens of MB

Private

Explain a passage

Device \(opt\-in\)

Tiers: built\-in browser AI → small open LLM → glossary

Private; honest limits

## <a id="_Toc241360787"></a>5\.2 Can a lightweight free local model be bundled?

__Yes, with care — and the core app does not need one\.__ Recommendations and learning are handled by fast arithmetic, so the only on\-device models are \(1\) a small embedding model for free\-text taste input and \(2\) an optional small language model for "Explain"\. In a web app, "bundling" means downloading once on demand and caching; a future native app \(R3\) can ship the small embedding model inside the package, but a language model should remain an optional download because of size\.

__Candidate__

__Approx\. download class__

__Runtime__

__Role__

Browser built\-in AI \(Chrome Prompt API\)

Managed by the browser

Chrome desktop only; needs lots of free disk and GPU memory

Tier 1 where available

Qwen3 0\.6B

~0\.35 GB

WebLLM

Smallest general candidate

Qwen3\.5 0\.8B / 2B

~0\.5 / ~1 GB class

Transformers\.js v4 \(WebGPU\)

Main contenders

Gemma 3 1B

~0\.5–0\.7 GB class

WebLLM / WebGPU

Contender

Gemma 4 E2B

~1–2 GB class

Transformers\.js v4 \(onnx\-community\)

Quality ceiling; likely too big as default

bge\-small\-en\-v1\.5 or all\-MiniLM\-L6\-v2 \(embeddings\)

tens of MB

Transformers\.js

Taste input; catalog vectors

Sizes are approximate classes; the bake\-off measures exact download size, memory and speed\. Check each model card's license before shipping\. WebGPU is available in current Chrome/Edge \(desktop and Android\) and Safari 26; some GPU and driver combinations have produced garbled output with certain kernels, so the device matrix and an output sanity check are mandatory\.

![Figure 9 — Which tier answers "Explain"](14\.png)

*Figure 9 — Which tier answers "Explain"*

## <a id="_Toc241360788"></a>5\.3 Evaluation plan \(bake\-off, EN\-801\)

- __Eval set:__ 30 real passages from the catalog across eras and genres, plus 10 hard cases \(dialect, archaic vocabulary, irony\)\. No invented passages\.
- __Rubric \(0–8\):__ accuracy 0–2, clarity 0–2, faithfulness \(nothing invented\) 0–2, brevity 0–1, safety 0–1\. Pass: mean ≥ 6 and invented facts in under 10% of answers\.
- __Speed:__ time to first token ≤ 3 s and at least 8 tokens per second on a mid\-range phone\.
- __Device matrix:__ an Android phone \(Chrome\), an iPhone \(Safari 26\), a Windows laptop \(Chrome/Edge, including an NVIDIA GPU if available\), a Mac\.
- __Human check:__ a blind sample of outputs is rated by you at G2; the AI Engineer prepares it\.

## <a id="_Toc241360789"></a>5\.4 Guardrails

__WHERE: Explain prompt template \(docs/ai/eval\-plan\.md in the kit\)__

You explain passages from public\-domain literature to a modern reader\.

Use ONLY the passage and glossary below\. If you are unsure, say so\.

Answer in 2–4 plain sentences\. Do not continue the story, invent events,

or reveal anything beyond the passage\.

PASSAGE: \{passage\}

GLOSSARY: \{glossary\_entries\}

- Outputs are labeled "AI\-generated on your device", can be cancelled instantly, and are never sent anywhere\.
- The feature is off until G2 approves a model; readers opt in and can delete the model\.
- Build\-time generated fields carry generatedBy and reviewed flags; humans sample every batch\.

# <a id="_Toc241360790"></a>Part 6 — Requirements

## <a id="_Toc241360791"></a>6\.1 Functional requirements

Functional requirements are expressed as the 80 user stories and enablers in Part 8; each one is testable and traceable to a use case\. The summary below groups them by epic\.

__FR__

__Requirement__

__Stories__

FR\-01

__Onboarding & Reading DNA\.__ Get a new reader from first open to a first great short read in under two minutes, and capture their taste\.

US\-101, US\-102, US\-103, US\-104, US\-105, US\-106, US\-107, US\-108

FR\-02

__Content Factory & catalog\.__ Build a legal, well\-described, short\-first catalog at build time, with provenance for every work\.

EN\-201, EN\-202, EN\-203, EN\-204, EN\-205, EN\-206, EN\-207, EN\-208, EN\-209, EN\-210, EN\-211, EN\-212

FR\-03

__Discovery & recommendations\.__ Serve a daily shortlist that fits the reader's taste, explains itself, and keeps exploring\.

US\-301, US\-302, US\-303, US\-304, US\-305, US\-306, EN\-307, EN\-308

FR\-04

__Feedback & learning loop\.__ Learn from explicit reactions and reading behaviour, on the device, in an explainable and editable way\.

US\-401, US\-402, US\-403, US\-404, US\-405, US\-406, US\-407

FR\-05

__Mixed reads & reading ladder\.__ Introduce longer works when the reader is ready, and let them control the short/long mix\.

US\-501, US\-502, US\-503, US\-504, EN\-505

FR\-06

__Built\-in e\-reader\.__ A comfortable, accessible reader that borrows the best patterns of established e\-readers\.

EN\-601, US\-602, US\-603, US\-604, US\-605, US\-606, US\-607, US\-608, US\-609, US\-610, US\-611, US\-612

FR\-07

__Covers & visual identity\.__ A cohesive, beautiful look: design tokens, generated text\-free cover art, typographic overlays\.

EN\-701, EN\-702, US\-703, US\-704, US\-705

FR\-08

__On\-device AI assist\.__ Private, optional AI help while reading, with honest limits and graceful fallbacks\.

EN\-801, US\-802, US\-803, US\-804, EN\-805, US\-806

FR\-09

__Library & offline\.__ Keep reading anywhere: library shortlists, offline copies, installable app\.

US\-901, US\-902, US\-903, US\-904

FR\-10

__Privacy & control\.__ Readers own their data: see it, move it, delete it, filter content\.

US\-1001, US\-1002, US\-1003, US\-1004, US\-1005, US\-1006

FR\-11

__Accessibility & performance\.__ WCAG 2\.2 AA, fast on mid\-range phones, enforced by CI\.

EN\-1101, EN\-1102, US\-1103, US\-1104

FR\-12

__Platform & delivery pipeline\.__ Scaffold, storage, CI/CD, hosting and the agent operating files\.

EN\-1201, EN\-1202, EN\-1203, EN\-1204, EN\-1205, EN\-1206, EN\-1207, EN\-1208, EN\-1209

## <a id="_Toc241360792"></a>6\.2 Non\-functional requirements

__ID__

__Category__

__Requirement__

__Target__

__Verified by__

NFR\-01

Performance

Largest Contentful Paint on a mid\-range phone \(Lighthouse mobile\)

≤ 2\.5 s

Lighthouse CI \(EN\-1102\)

NFR\-02

Performance

Recommendation refresh for ≤ 5,000 works

< 150 ms, off the UI thread

Benchmark test \(EN\-307\)

NFR\-03

Performance

Open a cached work / turn a page

< 1\.5 s / < 100 ms perceived

e2e timing \(US\-602\)

NFR\-04

Size

JavaScript shipped on first load \(gzipped\)

≤ 300 KB, excluding catalog

Lighthouse CI budget

NFR\-05

Offline

Shortlist, search and saved works without network

100% of core flows

Offline e2e \(UC\-08\)

NFR\-06

Privacy

Personal data sent off the device by default

None; network allowlist enforced

Allowlist e2e \(US\-1001\)

NFR\-07

Accessibility

WCAG 2\.2 AA; reading text contrast

AA; body text ≥ 7:1; targets ≥ 44 px

axe in CI \+ manual G5 checklist

NFR\-08

Compatibility

Browsers

Current Chrome, Edge, Safari \(iOS/macOS\), Firefox; AI features degrade gracefully

Playwright on Chromium, WebKit, Firefox

NFR\-09

Licensing

Provenance and license per work

100% of works

catalog:validate \(EN\-201\)

NFR\-10

Security

EPUB content isolation; dependency hygiene

Sandboxed rendering, strict CSP, no known high CVEs

CI audit \+ e2e

NFR\-11

Reliability

Runtime third\-party dependencies for core flows

None

Architecture review at G2

NFR\-12

AI

On\-device AI transparency and control

Opt\-in, labeled, cancellable, deletable, size shown

e2e \(UC\-07\) \+ G2

NFR\-13

Maintainability

Unit coverage of engines and stores; CI green to merge

≥ 80% lines in engine/ and stores/

Coverage report

NFR\-14

Cost

Monthly infrastructure at MVP scale

$0 on free tiers \(subscriptions you already have aside\)

G2 cost check

# <a id="_Toc241360793"></a>Part 7 — Epics, features and use cases

## <a id="_Toc241360794"></a>7\.1 Epics

__Epic__

__Goal__

__Stories__

__Releases__

__Lead agent__

__E1__ Onboarding & Reading DNA

Get a new reader from first open to a first great short read in under two minutes, and capture their taste\.

8

R1, R2

UX/UI Designer

__E2__ Content Factory & catalog

Build a legal, well\-described, short\-first catalog at build time, with provenance for every work\.

12

R0, R1, R2, R3

Content Curator

__E3__ Discovery & recommendations

Serve a daily shortlist that fits the reader's taste, explains itself, and keeps exploring\.

8

R1, R2

AI Engineer

__E4__ Feedback & learning loop

Learn from explicit reactions and reading behaviour, on the device, in an explainable and editable way\.

7

R1, R2

AI Engineer

__E5__ Mixed reads & reading ladder

Introduce longer works when the reader is ready, and let them control the short/long mix\.

5

R2

Product Manager

__E6__ Built\-in e\-reader

A comfortable, accessible reader that borrows the best patterns of established e\-readers\.

12

R0, R1, R2, R3

Reader Researcher

__E7__ Covers & visual identity

A cohesive, beautiful look: design tokens, generated text\-free cover art, typographic overlays\.

5

R0, R1, R2

Cover Artist

__E8__ On\-device AI assist

Private, optional AI help while reading, with honest limits and graceful fallbacks\.

6

R1, R2, R3

AI Engineer

__E9__ Library & offline

Keep reading anywhere: library shortlists, offline copies, installable app\.

4

R1, R2

Architect

__E10__ Privacy & control

Readers own their data: see it, move it, delete it, filter content\.

6

R1

Architect

__E11__ Accessibility & performance

WCAG 2\.2 AA, fast on mid\-range phones, enforced by CI\.

4

R0, R1

UX/UI Designer

__E12__ Platform & delivery pipeline

Scaffold, storage, CI/CD, hosting and the agent operating files\.

9

R0, R1, R3

Architect

## <a id="_Toc241360795"></a>7\.2 Key sequences

Three sequences show how the main use cases move through the system\.

![Figure 10 — UC\-01 onboarding sequence](15\.png)

*Figure 10 — UC\-01 onboarding sequence*

![Figure 11 — UC\-03/UC\-04 discovery and feedback sequence](16\.png)

*Figure 11 — UC\-03/UC\-04 discovery and feedback sequence*

![Figure 12 — UC\-07 explain\-passage sequence with tiered fallback](17\.png)

*Figure 12 — UC\-07 explain\-passage sequence with tiered fallback*

## <a id="_Toc241360796"></a>7\.3 Use cases \(fully dressed\)

Each use case ends with an __Agent handoff__: the lead agent, the acceptance\-test file it must make pass, and the definition of done\. The same text is in docs/use\-cases/UC\-xx\.md in the kit so agents can complete them on their own\.

### UC\-01 · Discover my Reading DNA \(first run\)

__Field__

__Detail__

__Primary actor__

New reader

__Level__

User goal

__Stakeholders & interests__

Reader — wants a fast, fun start and privacy\.

Product owner — wants high activation and a useful first profile\.

Content curators — want fair exposure across the catalog\.

__Preconditions__

The app has been loaded once online, so the catalog index is cached\.

__Success guarantee__

A Reading DNA \(taste vector \+ facet beliefs \+ reading context\) is saved on the device\.

Your Shortlist is shown with a highlighted first short read\.

__Minimal guarantee__

No half\-built profile is saved; progress through the cards is kept so the reader can resume\.

__Trigger__

The reader opens Twice Told for the first time \(or chooses Retune\)\.

__Main success scenario__

1\. Reader opens the app\.

2\. App shows the welcome and the privacy promise\.

3\. Reader taps "Find my first story"\.

4\. App shows the mood board\.

5\. Reader selects 2–5 moods and taps Next\.

6\. App seeds facet priors and selects 8 calibration works from diverse clusters\.

7\. Reader reacts to each taste card \(Love / Maybe / Not for me\)\.

8\. App asks when the reader reads and the preferred mix \(optional\)\.

9\. App builds the Reading DNA in the recommendation worker\.

10\. App shows Your Shortlist and highlights a first short read with its reading time\.

__Extensions__

3a\. Reader opens "How your privacy works": app shows the data page; reader returns to step 3\.

5a\. Reader taps Skip: app applies the Classic Essentials prior; continue at step 6\.

7a\. Reader leaves mid\-way: app saves card progress; on return, resumes at the next card\.

7b\. Reader marks every card "Not for me": app offers a broader set of moods and 4 more cards\.

9a\. Storage is unavailable \(e\.g\., private browsing\): app warns that the profile will not persist, continues for this session only, and suggests installing\.

__Special requirements__

Median time from first open to first shortlist ≤ 2 minutes\.

Fully operable without swipe gestures; screen\-reader labels on every control\.

Works offline after the first load\.

__Frequency__

Once per device, plus occasional retunes\.

__Stories__

US\-101, US\-102, US\-103, US\-104, US\-105, US\-108

__Agent handoff__

Lead: UX/UI Designer · Support: AI Engineer

Acceptance test: e2e/UC\-01\.spec\.ts

Definition of done: All linked stories done; the main scenario and extensions 5a, 7a and 9a pass as Playwright tests; axe reports no serious violations; median onboarding time from the scripted test ≤ 60 s of simulated taps\.

### UC\-02 · Bring my reading history

__Field__

__Detail__

__Primary actor__

Reader

__Level__

User goal

__Stakeholders & interests__

Reader — wants past favourites \(including modern books\) to count, without exposing their history\.

Product owner — wants better first recommendations\.

__Preconditions__

A Reading DNA exists \(UC\-01\) or the reader is in onboarding step 3\.

__Success guarantee__

Selected books are blended into the Reading DNA and reasons such as "Because you loved …" can appear\.

__Minimal guarantee__

Nothing is sent except the text the reader typed into search; imported files never leave the device\.

__Trigger__

Reader opens "Books you've loved" or "Import a reading log"\.

__Main success scenario__

1\. Reader opens "Books you've loved"\.

2\. App explains that only typed search text is sent to Open Library\.

3\. Reader searches and adds up to 10 books\.

4\. App fetches each book's subjects and description\.

5\. App embeds them on the device and blends them into the taste vector\.

6\. App shows an updated shortlist with history\-based reasons\.

__Extensions__

1a\. Reader chooses Import: app parses the CSV locally, shows a preview with ratings, and the reader confirms rows to include; continue at step 5\.

4a\. Device is offline: search is disabled with an explanation; imported CSV still works\.

5a\. Embedding model not yet downloaded: app offers a one\-time ~30 MB download or keyword\-based mapping\.

1b\. CSV is malformed: app lists the columns it needs and stops without changes\.

__Special requirements__

No account, no upload of the history file\.

Embedding uses the same model as the catalog build \(ADR\-0004\)\.

__Frequency__

Rare — typically once\.

__Stories__

US\-106, US\-107, EN\-805

__Agent handoff__

Lead: AI Engineer · Support: Architect

Acceptance test: e2e/UC\-02\.spec\.ts

Definition of done: Search and import paths pass with network assertions \(only openlibrary\.org receives the typed query\); vector\-space parity test ≥ 0\.99\.

### UC\-03 · Get Your Shortlist and choose what to read

__Field__

__Detail__

__Primary actor__

Reader

__Level__

User goal

__Stakeholders & interests__

Reader — wants a few great, well\-explained options\.

Product owner — wants a high hit rate and discovery beyond the obvious\.

__Preconditions__

A Reading DNA exists\.

__Success guarantee__

Reader starts, saves or dismisses at least one work; the choice is logged\.

__Minimal guarantee__

If recommendation fails, a curated "Staff picks" shortlist is shown\.

__Trigger__

Reader opens the app or taps Shortlist\.

__Main success scenario__

1\. Reader opens Your Shortlist\.

2\. App loads the profile, events and catalog vectors in the recommendation worker\.

3\. App fills the hero, short\-reads, essays and wildcard slots with reasons\.

4\. Reader browses and taps a card\.

5\. App shows the work detail with blurb, first lines, reading time, content notes and license\.

6\. Reader taps Read now \(continue with UC\-05\), Dog\-ear, or Not for me \(UC\-04\)\.

__Extensions__

2a\. A new catalog version is downloading: app keeps using the current version until the new one is complete\.

3a\. Filters exclude too many works: app relaxes the least important filter and says so\.

4a\. Reader taps "Something different": app raises exploration for one refresh\.

2b\. The worker errors: app shows the curated fallback shortlist and logs the error locally\.

__Special requirements__

Shortlist visible within 1 s of navigation on a mid\-range phone, including offline\.

No more than one work per author per shortlist\.

__Frequency__

Several times a week per active reader\.

__Stories__

US\-301, US\-302, US\-303, US\-304, US\-305, US\-306, EN\-307, US\-703

__Agent handoff__

Lead: AI Engineer · Support: UX/UI Designer

Acceptance test: e2e/UC\-03\.spec\.ts

Definition of done: Persona simulation targets met \(EN\-307\); shortlist e2e passes online and offline; reasons displayed for 100% of cards\.

### UC\-04 · Tell Twice Told what I think

__Field__

__Detail__

__Primary actor__

Reader

__Level__

User goal

__Stakeholders & interests__

Reader — wants effortless feedback that visibly matters\.

Product owner — wants reliable signals without nagging\.

__Preconditions__

Reader has seen or read a recommended work\.

__Success guarantee__

Feedback is stored in the event log; the profile updates; the next shortlist reflects it\.

__Minimal guarantee__

Dismissing any prompt never blocks the reader; implicit signals are still recorded\.

__Trigger__

Reader finishes a work, dismisses a card, or returns after abandoning a work\.

__Main success scenario__

1\. Reader reaches the end of a work\.

2\. App shows the check\-in: Loved it / It was OK / Not for me\.

3\. Reader picks an answer and optional reason chips\.

4\. App appends a feedback event and updates the profile per the weight table\.

5\. App suggests the next rung if the reader loved it\.

6\. Next shortlist reflects the new profile\.

__Extensions__

2a\. Reader dismisses the check\-in: only implicit "finished" is recorded\.

3a\. Reader selects "Already read": the work is marked read with no taste penalty\.

1a\. Reader taps Not for me on a card: optional reason picker; card animates away; continue at step 4\.

1b\. Work was abandoned under 15% for 7 days: one gentle follow\-up on next open \(at most once per work\)\.

__Special requirements__

Profile rebuild from the event log must equal incremental updates \(determinism\)\.

No feedback data leaves the device\.

__Frequency__

After most reading sessions\.

__Stories__

US\-401, US\-402, US\-403, US\-404, US\-405, US\-406, US\-407

__Agent handoff__

Lead: AI Engineer · Support: UX/UI Designer

Acceptance test: e2e/UC\-04\.spec\.ts \+ src/engine/rec/\_\_tests\_\_/weights\.test\.ts

Definition of done: Every weight\-table row has a unit test; rebuild\-equals\-incremental property test passes; check\-in flows pass e2e\.

### UC\-05 · Read a work in the built\-in reader

__Field__

__Detail__

__Primary actor__

Reader

__Level__

User goal

__Stakeholders & interests__

Reader — wants comfort, speed and accessibility\.

Content sources — want faithful presentation and attribution\.

__Preconditions__

The work is cached or the device is online\.

__Success guarantee__

Reader reads with preferred settings; position and reading time are saved\.

__Minimal guarantee__

Reading position is never lost, even if the app is killed\.

__Trigger__

Reader taps Read now or resumes from the Library\.

__Main success scenario__

1\. Reader opens the work\.

2\. App opens it at the last position via the ReaderEngine\.

3\. Reader turns pages \(tap zones, keys or buttons\) or scrolls\.

4\. Reader adjusts typography or theme as needed\.

5\. Reader long\-presses a word to define it \(optional\)\.

6\. App logs progress and active reading time locally\.

7\. Reader reaches the end; continue with UC\-04\.

__Extensions__

1a\. Work not cached and device offline: app explains and offers "Save for offline" for next time\.

4a\. Font change: app re\-anchors position and highlights\.

3a\. Screen reader active: controls are exposed as labeled buttons; page turns announce progress\.

5a\. Word not in glossary and dictionary lookup not yet consented: app asks once\.

__Special requirements__

Open from cache < 1\.5 s; page turn < 100 ms perceived\.

EPUB content rendered sandboxed with scripts disabled\.

Body text contrast ≥ 7:1 in every theme\.

__Frequency__

Daily for active readers\.

__Stories__

EN\-601, US\-602, US\-603, US\-604, US\-605, US\-606, US\-607, US\-608, US\-609, US\-610, US\-1103, US\-612

__Agent handoff__

Lead: Reader Researcher · Support: UX/UI Designer

Acceptance test: e2e/UC\-05\.spec\.ts

Definition of done: Reader flows pass on Chromium, WebKit and mobile emulation; position\-restore test after forced reload passes; axe clean\.

### UC\-06 · Grow from short reads to longer works

__Field__

__Detail__

__Primary actor__

Reader

__Level__

User goal

__Stakeholders & interests__

Reader — wants to try longer classics without being overwhelmed\.

Product owner — wants ladder progression\.

__Preconditions__

Reader has finished at least 3 works with positive feedback\.

__Success guarantee__

Reader starts a longer work that fits their session pattern; the ladder shows progress\.

__Minimal guarantee__

Readers who prefer short works are never pushed; the mix setting always wins\.

__Trigger__

Readiness threshold is met, or the reader changes the mix setting\.

__Main success scenario__

1\. App detects readiness and adds a Your Long List row\.

2\. App shows each longer work with estimated sessions at the reader's typical session length\.

3\. Reader chooses a novelette or novella\.

4\. Reader reads across several sessions \(UC\-05\)\.

5\. On return after 3\+ days, app offers a spoiler\-safe "Previously…" recap\.

6\. Reader finishes; app records the rung and suggests the next\.

__Extensions__

1a\. Mix is "Mostly short": at most one longer work is shown\.

4a\. Reader abandons two longer works in a row: ladder level decreases and fewer longer works are suggested\.

3a\. Reader chooses "Surprise me": composer uses higher exploration within the ratio table\.

__Special requirements__

Composer never exceeds the ratio table\.

Recaps never include content past the furthest position\.

__Frequency__

Weekly for engaged readers\.

__Stories__

US\-501, US\-502, US\-503, US\-504, EN\-505, US\-611

__Agent handoff__

Lead: Product Manager · Support: AI Engineer

Acceptance test: e2e/UC\-06\.spec\.ts \+ src/engine/rec/\_\_tests\_\_/composer\.test\.ts

Definition of done: Composer property tests pass for all ladder levels and mix settings; persona simulation shows level up/down rules\.

### UC\-07 · Understand a difficult passage \(on\-device AI\)

__Field__

__Detail__

__Primary actor__

Reader

__Level__

User goal

__Stakeholders & interests__

Reader — wants quick, private help\.

Product owner — wants helpful, honest AI with no privacy risk\.

__Preconditions__

Labs "Explain" is enabled in Settings \(off by default until Gate G2 approves the model\)\.

__Success guarantee__

Reader gets a short, clearly labeled explanation; nothing leaves the device\.

__Minimal guarantee__

If no AI tier is available, glossary and dictionary help is shown instead\.

__Trigger__

Reader selects up to 150 words and taps Explain\.

__Main success scenario__

1\. Reader selects a passage and taps Explain\.

2\. App checks available tiers: built\-in browser AI, downloaded small model, glossary\.

3\. App runs the best available tier in the AI worker with the guarded prompt\.

4\. App streams the explanation into a bottom sheet labeled "AI\-generated on your device"\.

5\. Reader reads, copies or dismisses\.

__Extensions__

2a\. No model and reader agrees to download: app shows size and Wi\-Fi advice, downloads, then continues at step 3\.

2b\. Reader declines: glossary and dictionary results are shown\.

3a\. WebGPU fails: app retries on the WASM runtime with the smallest model or falls back to glossary\.

4a\. Output is empty or fails the sanity check: app says it could not explain and offers word definitions\.

4b\. Reader taps Cancel: generation stops immediately\.

__Special requirements__

Time to first token < 3 s on supported devices\.

The passage never leaves the device \(asserted in e2e\)\.

Outputs are 2–4 sentences, no spoilers beyond the passage\.

__Frequency__

Occasional; more with older texts\.

__Stories__

EN\-801, US\-802, US\-803, US\-804, US\-806

__Agent handoff__

Lead: AI Engineer · Support: Architect

Acceptance test: e2e/UC\-07\.spec\.ts \(uses a mocked model tier\) \+ docs/ai/results/\*\.md

Definition of done: Bake\-off report approved at G2; tier fallback matrix passes; network assertions pass\.

### UC\-08 · Keep my library and read offline

__Field__

__Detail__

__Primary actor__

Reader

__Level__

User goal

__Stakeholders & interests__

Reader — wants reliability anywhere\.

__Preconditions__

At least one work is saved or in progress\.

__Success guarantee__

Dog\-eared works open and read offline; the Library reflects current progress\.

__Minimal guarantee__

If storage is full, the app explains and offers to remove offline copies\.

__Trigger__

Reader saves a work or opens the Library\.

__Main success scenario__

1\. Reader saves a work\.

2\. App caches the text and cover\.

3\. Reader opens the Library and sees Reading, Dog\-eared and Finished\.

4\. Reader goes offline and opens a saved work\.

5\. App opens it from cache\.

__Extensions__

2a\. Quota exceeded: app shows storage usage and offers to remove older copies\.

3a\. App not installed after the first finished work: app shows the install prompt \(at most monthly\)\.

__Special requirements__

Offline behaviour verified by e2e with the network disabled\.

__Frequency__

Daily\.

__Stories__

EN\-308, US\-901, US\-902, US\-903, US\-904, EN\-1206

__Agent handoff__

Lead: Architect · Support: UX/UI Designer

Acceptance test: e2e/UC\-08\.spec\.ts

Definition of done: Offline e2e passes on Chromium and WebKit; storage usage view matches actual cache size within 5%\.

### UC\-09 · Control my data and preferences

__Field__

__Detail__

__Primary actor__

Reader

__Level__

User goal

__Stakeholders & interests__

Reader — wants transparency and control\.

Product owner — wants trust and low compliance risk\.

__Preconditions__

None\.

__Success guarantee__

Reader can see, export, import, filter or delete their data\.

__Minimal guarantee__

Destructive actions always require explicit confirmation\.

__Trigger__

Reader opens Privacy & AI or Settings\.

__Main success scenario__

1\. Reader opens Privacy & AI\.

2\. App shows the data inventory with counts\.

3\. Reader exports a JSON backup\.

4\. Reader sets content filters or blocked authors\.

5\. App applies them to recommendations and search immediately\.

__Extensions__

3a\. Reader imports a backup on a new device: app validates and restores\.

3b\. Reader deletes everything by typing DELETE: app wipes data and returns to the welcome\.

2a\. Persistent storage not granted: app explains and suggests install or regular exports\.

__Special requirements__

Export schema is versioned and documented\.

No analytics; network allowlist test in CI\.

__Frequency__

Rare\.

__Stories__

US\-1001, US\-1002, US\-1003, US\-1004, US\-1005, US\-1006, US\-406, US\-407, US\-803, US\-1104, EN\-1204

__Agent handoff__

Lead: Architect · Support: Product Manager

Acceptance test: e2e/UC\-09\.spec\.ts

Definition of done: Export → wipe → import round\-trip reproduces the same shortlist; allowlist test passes\.

### UC\-10 · Build and publish the catalog \(Content Factory\)

__Field__

__Detail__

__Primary actor__

Content Curator agent

__Level__

System \(behind the scenes\)

__Stakeholders & interests__

Product owner — wants a legal, high\-quality catalog and approves samples at Gate C1\.

Readers — want accurate blurbs and content notes\.

Source libraries — want their rules respected\.

__Preconditions__

Sources and license rules are documented in docs/content/sources\.md; ADR\-0001 and ADR\-0004 are accepted\.

__Success guarantee__

A new catalog version passes validation, is approved at Gate C1, and is deployed through the normal pipeline\.

__Minimal guarantee__

No unlicensed, unverified or invented text is ever packaged\.

__Trigger__

A release needs more or better works, or the product owner requests a refresh\.

__Main success scenario__

1\. Content Curator agent harvests candidates from the offline catalogs and mirrors, recording provenance\.

2\. Agent cleans texts and splits anthologies into single works \(verbatim slices only\)\.

3\. AI Engineer agent enriches works \(metrics, blurbs, tags, content notes, glossary, recaps\)\.

4\. AI Engineer agent computes embeddings\.

5\. Agent assembles a Gate C1 packet: a random sample with source links and generated fields\.

6\. Product owner reviews the sample and approves or requests fixes\.

7\. Agent packages the catalog and opens a pull request\.

8\. CI validates schema, licenses and checksums; the change ships through Gate G5\.

__Extensions__

1a\. A source is unavailable: agent stops that source and reports; it never synthesizes text\.

1b\. License is unclear: work is excluded and listed in the report\.

3a\. LLM quota exhausted: steps are idempotent; the agent resumes later from the last completed item\.

6a\. Owner rejects: agent fixes the flagged items and re\-samples\.

__Special requirements__

Respect Project Gutenberg's robot policy \(mirrors, ≥ 2 s between requests\)\.

Every generated field is labeled and sampled by a human\.

__Frequency__

Per release, plus small top\-ups\.

__Stories__

EN\-201, EN\-202, EN\-203, EN\-204, EN\-205, EN\-206, EN\-207, EN\-208, EN\-209, EN\-210, EN\-211, EN\-212

__Agent handoff__

Lead: Content Curator · Support: AI Engineer

Acceptance test: npm run catalog:validate \+ scripts/\_\_tests\_\_/\*\.test\.ts

Definition of done: Validator green; C1 decision recorded in docs/gates/decisions/; provenance present for 100% of works\.

### UC\-11 · Generate and approve cover art

__Field__

__Detail__

__Primary actor__

Cover Artist agent

__Level__

System \(behind the scenes\)

__Stakeholders & interests__

Product owner — approves the contact sheet at Gate C2\.

Readers — want beautiful, appropriate covers\.

__Preconditions__

House style approved at Gate G1; Cloudflare Workers AI token in \.env\.

__Success guarantee__

Approved covers are packaged with alt text and provenance\.

__Minimal guarantee__

Works without approved art get a procedural fallback cover\.

__Trigger__

New works lack approved covers\.

__Main success scenario__

1\. Agent builds a scene prompt per work from its blurb, following the house style\.

2\. Agent generates 2–4 candidates per work, recording model, seed and prompt\.

3\. Automatic checks reject text, unsafe content and near\-duplicates\.

4\. Agent produces an HTML contact sheet\.

5\. Product owner approves, rejects or asks for regeneration\.

6\. Agent packages approved images \(WebP/AVIF, 3 sizes, alt text\)\.

__Extensions__

2a\. Free daily allowance used up: agent pauses and resumes the next day \(or uses a configured alternative such as a registered Pollinations key\)\.

3a\. All candidates fail: fallback procedural cover is used and the work is flagged\.

5a\. Owner rejects the style: agent proposes a revised house\-style prompt for approval, then regenerates\.

__Special requirements__

Never render titles inside images; the app overlays real text\.

Avoid depicting identifiable real people\.

__Frequency__

Per catalog batch\.

__Stories__

EN\-702, US\-703, US\-704, US\-705

__Agent handoff__

Lead: Cover Artist · Support: UX/UI Designer

Acceptance test: scripts/covers/\_\_tests\_\_/\*\.test\.ts

Definition of done: Contact sheet approved; zero text\-detected images packaged; alt text present for 100% of covers\.

### UC\-12 · Deliver stories through the sprint assembly line

__Field__

__Detail__

__Primary actor__

Product owner with the agent crew

__Level__

Development \(summary\)

__Stakeholders & interests__

Product owner — wants progress with minimal effort, deciding only at gates\.

Agents — need clear specs, tests and permissions\.

__Preconditions__

Gates G0–G3 passed; Gitea and its runner are up; stories are READY \(spec, testable ACs, deps done\)\.

__Success guarantee__

The story is live in production after human verification on the test site\.

__Minimal guarantee__

Nothing reaches production without a green CI run and the G5 human decision\.

__Trigger__

Product owner runs /sprint \(or /story <id> for a single story\)\.

__Main success scenario__

1\. Product owner types /sprint in Antigravity\.

2\. Release\-manager agent reads TASKS\.md, groups READY stories by dependency and writes PLAN\-<group>\.md files\.

3\. Workflow stops for plan approval \(human gate G4\); product owner approves\.

4\. For each group, a developer agent works in an isolated git worktree using TDD against the acceptance criteria\.

5\. A tester agent verifies, then a reviewer agent \(ideally on a different model\) reviews code, spec fit, security and fabricated material\.

6\. Release\-manager opens a Gitea pull request per group; merges run one at a time and only when required CI checks pass and the reviewer approves \(machine gate\)\.

7\. Regression agent runs the full suite on dev; docs agent updates docs and release notes\.

8\. Workflow auto\-rolls dev → test, unless regression failed or a concern is open\.

9\. Product owner validates the test site on a phone \(human gate G5\) and types promote; test merges to main and production deploys\.

__Extensions__

6a\. CI fails: the owning developer fixes and re\-pushes; after 3 failed attempts the group is parked with a diagnosis\.

6b\. Reviewer requests changes: the group returns to its developer; nothing merges\.

8a\. Regression failed or a concern is open: auto\-rollout skips itself and the sprint summary explains why\.

4a\. An agent lacks an input \(credential, source file\): it stops and asks — never invents it\.

9a\. Product owner finds a problem: it becomes a new task with the owner's notes; nothing is promoted\.

1a\. Parallel subagents unavailable: groups run one after another with the same gates\.

__Special requirements__

Human decisions are recorded in docs/gates/decisions/\.

Agents never approve gates on the owner's behalf\.

__Frequency__

Every sprint\.

__Stories__

EN\-1208, EN\-1209, EN\-1201, EN\-1202, EN\-1203, EN\-1207, EN\-1101, EN\-1102, EN\-1205

__Agent handoff__

Lead: Product Manager · Support: Architect

Acceptance test: Gitea Actions runs \+ docs/gates/decisions/\*\.md

Definition of done: One full cycle \(G4 → machine gate → auto\-rollout → G5 → promote\) completes for an R0 story\.

# <a id="_Toc241360797"></a>Part 8 — User story board

## <a id="_Toc241360798"></a>8\.1 How to read the story map

Columns are the reader's journey \(activities\), left to right\. Rows are releases: everything in a row is shipped together\. The coloured stripe on each card shows its epic, and the label on the right is its MoSCoW priority\. "Behind the scenes" columns hold enablers the reader never sees but everything depends on\. Every card is a file in docs/stories/ and a line in TASKS\.md\.

__Release__

__Items__

__Must__

__Should__

__Could__

__TASKS\.md priority__

R0

15

15

0

0

P1

R1

44

30

13

1

P2

R2

23

3

10

10

P3

R3

4

0

0

4

P4

![Story map, part 1 — Get started → Read](18\.png)

*Story map, part 1 — Get started → Read*

![Story map, part 2 — React → Control, and behind the scenes](19\.png)

*Story map, part 2 — React → Control, and behind the scenes*

## <a id="_Toc241360799"></a>8\.2 Story cards

Acceptance criteria are written as Given/When/Then so agents can turn each one into an automated test\. Size: S ≈ one agent session, M ≈ two or three, L ≈ four or more\.

### E1 · Onboarding & Reading DNA

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__US\-101__

User story

__Welcome that gets to a first story fast__

As a new reader, I want a short, friendly welcome that explains Twice Told in one screen, so that I can start reading within two minutes\.

AC1\. Given a first\-time visitor, when the app loads, then the welcome shows the value proposition, one primary "Find my first story" button and a privacy link, and no request is made to any host other than the app's own static host \(asserted from the e2e network log\)\.

AC2\. Given the welcome screen, when I open "How your privacy works", then a plain\-language page lists what is stored on the device and states that nothing personal is sent anywhere\.

AC3\. Given a returning reader with a saved profile, when the app loads, then the welcome is skipped and Your Shortlist opens\.

R1 · Must

Size S

UX/UI Designer

Deps: EN\-1201, EN\-701

__US\-102__

User story

__Mood board theme picker__

As a new reader, I want to pick a few moods and themes from illustrated tiles, so that my first recommendations feel like me\.

AC1\. Given the mood board, when it renders, then 8–16 illustrated theme tiles are shown, each a labeled button reachable by keyboard and screen reader\.

AC2\. Given I select 2–5 tiles, when I tap Next, then the selections are saved as facet priors and step 2 opens; with fewer than 2 selected, Next is disabled and a hint explains why\.

AC3\. Given I tap Skip, then a balanced "Classic Essentials" prior is applied and step 2 opens\.

R1 · Must

Size M

UX/UI Designer

Deps: US\-101, EN\-1204

__US\-103__

User story

__Taste calibration cards__

As a new reader, I want to react to a handful of real works with one tap, so that the app learns my taste quickly without a questionnaire\.

AC1\. Given step 2, when cards load, then 8 works are shown one at a time with cover, title, author, year, reading time, a one\-line hook and the work's genuine first line taken from the catalog text \(never generated\)\.

AC2\. Given a card, when I choose Love, Maybe or Not for me \(button, swipe or keyboard\), then an event is appended to the event log and the next card appears within 150 ms\.

AC3\. Given the 8 calibration works, then they come from at least 5 different taste clusters and include at least 1 essay/article and 1 work under 10 minutes\.

R1 · Must

Size M

UX/UI Designer

Deps: US\-102, EN\-307, EN\-205

__US\-104__

User story

__Create the Reading DNA__

As a new reader, I want my choices turned into a taste profile immediately, so that my first shortlist is already personal\.

AC1\. Given completed calibration, when buildProfile\(\) runs in the recommendation worker, then a normalized taste vector and facet beliefs are saved to IndexedDB in under 200 ms on a mid\-range phone CPU profile\.

AC2\. Given identical calibration answers, when the profile is built twice, then the resulting vectors are identical \(deterministic\)\.

AC3\. Given the profile exists, then Your Shortlist opens with at least 6 recommendations, none of which I marked "Not for me"\.

R1 · Must

Size M

AI Engineer

Deps: US\-103, EN\-307

__US\-105__

User story

__Reading context and preferred mix__

As a new reader, I want to say when I usually read and whether I want short or long works, so that recommendations fit my time\.

AC1\. Given step 3, when I choose when I read \(quick breaks / evenings / weekends\) and my preferred mix \(mostly short / balanced / mostly long\), then both are saved in settings and used by the mix composer\.

AC2\. Given I skip step 3, then the defaults are "evenings" and "mostly short"\.

R1 · Should

Size S

Product Manager

Deps: US\-104

__US\-106__

User story

__Tell Twice Told the books I've loved__

As a reader, I want to add a few books I loved, including modern ones, so that my history shapes recommendations from day one\.

AC1\. Given the "Books you've loved" screen, when I type a title or author and tap Search, then results come from the Open Library search API, and a note explains that only the typed text is sent\.

AC2\. Given I add up to 10 books, when I tap Done, then each book's subjects and description are embedded on the device and blended into the taste vector with weight \+0\.5 each\.

AC3\. Given the embedding model is unavailable, then subjects are mapped to facets by keyword rules and the flow still completes\.

R2 · Should

Size M

AI Engineer

Deps: EN\-805, US\-104

__US\-107__

User story

__Import a reading log \(CSV\)__

As a reader who tracks books elsewhere, I want to import my Goodreads or StoryGraph export, so that I don't have to re\-enter my history\.

AC1\. Given a Goodreads or StoryGraph CSV export, when I import it, then it is parsed entirely on the device and a preview lists recognized books with their ratings\.

AC2\. Given the preview, when I confirm, then ratings of 4–5 become positive signals, 1–2 negative and 3 neutral, and I can exclude any row first\.

AC3\. Given a malformed file, then a friendly error explains which columns are needed \(title, author, rating\)\.

R2 · Could

Size M

AI Engineer

Deps: US\-106

__US\-108__

User story

__Retune my Reading DNA__

As a reader whose taste has changed, I want to run the calibration again, so that recommendations catch up with me\.

AC1\. Given Settings → Retune, when I confirm, then the calibration flow runs again and the new profile replaces the old one while the event log is preserved\.

AC2\. Given I cancel midway, then the previous profile is unchanged\.

R1 · Should

Size S

Product Manager

Deps: US\-104

### E2 · Content Factory & catalog

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__EN\-201__

Enabler

__Catalog schema and validator__

As the content pipeline, I want a strict schema for every catalog record, so that bad or unlicensed records can never ship\.

AC1\. Given docs/content/catalog\.schema\.json, when \`npm run catalog:validate\` runs, then every record is validated and CI fails on any error\.

AC2\. Given any record, then provenance fields \(sourceName, sourceUrl, license, retrievedAt, sha256\) are required\.

AC3\. Given a record whose license is not on the allow\-list, then validation fails and names the record id\.

R0 · Must

Size S

Architect

Deps: EN\-1201

__EN\-202__

Enabler

__Policy\-compliant Project Gutenberg harvester__

As the content pipeline, I want to collect candidate texts the way Project Gutenberg asks, so that we are never blocked and every file is traceable\.

AC1\. Given Project Gutenberg's offline RDF catalog, when the harvester runs, then it selects candidates by language, subject and length without crawling gutenberg\.org web pages\.

AC2\. Given selected ids, when texts are downloaded, then downloads come from a Project Gutenberg mirror with at least 2 seconds between requests, and each file's sha256 and source URL are recorded\.

AC3\. Given a download fails, then the item is skipped and reported; the pipeline never substitutes, paraphrases or invents text\.

R0 · Must

Size M

Content Curator

Deps: EN\-201

__EN\-203__

Enabler

__Split anthologies into single works__

As the content pipeline, I want each story or essay inside a collection to become its own work, so that readers can be recommended one short piece at a time\.

AC1\. Given a collection, when the splitter runs, then each story or essay becomes its own work with a title, parent collection id and character offsets into the source file\.

AC2\. Given the split results, then 100% of each work's text is a verbatim slice of the source file \(verified by substring check\)\.

AC3\. Given a random sample of 20 splits reviewed at Gate C1, then at least 19 have correct boundaries\.

R1 · Must

Size L

Content Curator

Deps: EN\-202

__EN\-204__

Enabler

__Enrich works with metadata and reading aids__

As a reader, I want every work to have an honest blurb, reading time, level and content notes, so that I can choose well\.

AC1\. Given a work, then wordCount, readingMinutes \(at 238 words per minute\), lengthClass, readability grade and firstLine are computed deterministically from the text\.

AC2\. Given a work, when the build\-time LLM step runs, then hook \(≤ 20 words\), blurb \(≤ 60 words\), genres, moods, content notes and a glossary of archaic words are produced from the actual text and stored with generatedBy and reviewed=false\.

AC3\. Given a blurb, then it does not reveal the ending \(LLM self\-check plus Gate C1 sampling\)\.

R1 · Must

Size L

AI Engineer

Deps: EN\-203

__EN\-205__

Enabler

__Catalog embeddings__

As the recommendation engine, I want a compact vector for every work computed once at build time, so that phones only do fast arithmetic\.

AC1\. Given enriched works, when embeddings are computed with the model chosen in ADR\-0004, then vectors are L2\-normalized, int8\-quantized and written to vectors\.bin with an ids index\.

AC2\. Given the same inputs, then the output is byte\-identical across runs\.

AC3\. Given the output, then vectors take no more than 1 MB per 2,500 works\.

R1 · Must

Size M

AI Engineer

Deps: EN\-204

__EN\-206__

Enabler

__Standard Ebooks ingester__

As the content pipeline, I want to include beautifully produced Standard Ebooks editions, so that the catalog has the best available texts\.

AC1\. Given Patrons Circle feed access configured in \.env, when the ingester runs, then it reads the feed, downloads selected EPUBs and records provenance; credentials never appear in logs or commits\.

AC2\. Given no credentials, then the step is skipped with a warning and the pipeline still succeeds\.

R1 · Should

Size M

Content Curator

Deps: EN\-202

__EN\-207__

Enabler

__Essay and article sources__

As a curious reader, I want non\-fiction essays and articles alongside stories, so that I can read ideas as well as fiction\.

AC1\. Given the curated source list in docs/content/sources\.md, when the ingester runs, then essays and articles from Project Gutenberg and Wikisource are added with form=nonfiction\.

AC2\. Given any CC BY\-SA item \(e\.g\., Wikipedia\), then an attribution block \(title, authors link, license, changes\) is stored and shown in the reader; such items are excluded unless enabled in config\.

R1 · Should

Size M

Content Curator

Deps: EN\-202

__EN\-208__

Enabler

__Package and publish the catalog__

As the app, I want a versioned, sharded catalog with checksums \(vectors are added once EN\-205 lands\), so that updates are small, atomic and verifiable\.

AC1\. Given approved works, when \`npm run catalog:build\` runs, then it outputs catalog shards \(≤ 500 KB each\), vectors\.bin, texts and covers, plus a manifest with version and checksums\.

AC2\. Given a new catalog version, when the app next starts online, then it downloads only changed shards and keeps the previous version until the new one is complete\.

R0 · Must

Size M

Architect

Deps: EN\-201

__EN\-209__

Enabler

__License compliance and attribution__

As a product owner, I want every text to comply with its source license, so that Twice Told is safe to publish\.

AC1\. Given any Project Gutenberg text, then either the full Project Gutenberg license is kept with it or all Project Gutenberg references and trademarks are removed, following the rule chosen in ADR\-0001\.

AC2\. Given any work, then the detail sheet shows source, license and a link to the original\.

AC3\. Given About → Sources, then all sources and licenses are listed\.

R1 · Must

Size S

Content Curator

Deps: EN\-208

__EN\-210__

Enabler

__Historic newspaper articles \(Library of Congress\)__

As a curious reader, I want short historic articles and features from old American newspapers, so that I get vivid non\-fiction from the past\.

AC1\. Given the loc\.gov API \(or the bulk OCR data\) for Chronicling America, when the ingester runs, then pre\-1930 articles are selected by topic and saved with provenance\.

AC2\. Given OCR text, then cleanup only fixes recognition errors against the page image and every changed word is logged; articles below a quality threshold are excluded\.

AC3\. Given a sample of 20 articles at Gate C1, then at least 18 read cleanly\.

R2 · Could

Size M

Content Curator

Deps: EN\-207

__EN\-211__

Enabler

__Contemporary essays as extracts with link\-out__

As a curious reader, I want occasional modern essays alongside the classics, so that my non\-fiction mix is not only historical\.

AC1\. Given a hand\-picked list of The Conversation articles, then the app shows only the opening paragraphs, author, institution and a "Read the full article on The Conversation" link, following its republishing guidelines\.

AC2\. Given the privacy rule, then no tracking counter or third\-party script is loaded; full reading happens on the publisher's site\.

R2 · Could

Size S

Content Curator

Deps: EN\-207

__EN\-212__

Enabler

__Evaluate Internet Archive / Open Library public\-domain scans__

As a product owner, I want to know whether scanned public\-domain books can fill catalog gaps, so that we only add sources that meet our quality bar\.

AC1\. Given 20 candidate public\-domain titles missing from Project Gutenberg and Standard Ebooks, then a report compares OCR quality, license clarity and effort, and recommends go or no\-go\.

R3 · Could

Size M

Content Curator

Deps: EN\-202

### E3 · Discovery & recommendations

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__US\-301__

User story

__Your Shortlist__

As a reader, I want a small, curated shortlist each time I open the app, so that I can pick something good without scrolling forever\.

AC1\. Given a profile, when I open Your Shortlist, then I see 1 hero pick, a Short reads row \(≥ 4\), an Ideas & essays row \(≥ 2\) and 1 wildcard, each with cover, title, author and minutes\.

AC2\. Given the shortlist, then it renders within 1 second of navigation on a mid\-range phone profile, including offline\.

AC3\. Given I have dismissed or finished a work, then it does not appear on the shortlist again\.

R1 · Must

Size M

UX/UI Designer

Deps: US\-104, EN\-307, US\-703

__US\-302__

User story

__Why this? explanations__

As a reader, I want to see why each work was picked for me, so that I trust the recommendations and understand my DNA\.

AC1\. Given any recommended card, then a one\-line reason is shown, generated from the top\-scoring factor \(similar to a loved work, a liked theme, the wildcard, or the next rung\)\.

AC2\. Given the wildcard, then the reason says it is intentionally outside my usual picks\.

R1 · Must

Size S

AI Engineer

Deps: EN\-307

__US\-303__

User story

__Work detail sheet__

As a reader, I want the key facts about a work before I start, so that I choose confidently\.

AC1\. Given a card, when I tap it, then the detail sheet shows cover, title, author, year, reading time at my speed, length class, reading level, blurb, the genuine first lines, content notes, and source & license\.

AC2\. Given the detail sheet, then Read now, Dog\-ear and Not for me are available and each records an event\.

R1 · Must

Size M

UX/UI Designer

Deps: US\-301, EN\-209

__US\-304__

User story

__Show me something different__

As a reader, I want to ask for a fresh, more adventurous shortlist, so that I can break out of a rut\.

AC1\. Given the shortlist, when I tap "Something different", then exploration is raised for one refresh and at least half of the new picks come from clusters I have not engaged with\.

AC2\. Given this action, then my taste vector is not changed\.

R1 · Should

Size S

AI Engineer

Deps: EN\-307

__US\-305__

User story

__Search and browse the catalog__

As a reader, I want to find a specific author, title or theme, so that I can read what I already have in mind\.

AC1\. Given the Search tab, when I type 2\+ characters, then matching titles and authors appear within 100 ms from an on\-device index\.

AC2\. Given filters for length, form, era and mood, when applied, then results update instantly and work offline\.

R1 · Should

Size M

Architect

Deps: EN\-208

__US\-306__

User story

__Themed collections__

As a reader, I want hand\-curated themed rows, so that I discover great works around a mood\.

AC1\. Given curated collections in the catalog \(e\.g\., "Ghost stories for a rainy night"\), then the shortlist can show one collection row ordered by my taste\.

R2 · Could

Size S

Product Manager

Deps: US\-301

__EN\-307__

Enabler

__Recommendation engine v1 \(worker\)__

As a reader, I want recommendations computed privately and instantly on my device, so that the app feels smart without sending my data anywhere\.

AC1\. Given the algorithm specified in SRS §4\.6, then the worker exposes recommend\(slots\), updateProfile\(events\) and explain\(workId\) behind one module interface\.

AC2\. Given 5 synthetic personas with known preferences simulated for 30 sessions, then each persona's liked\-rate in the top 5 is at least 2× a random baseline and catalog coverage stays at or above 30%\.

AC3\. Given 5,000 catalog items, then recommend\(\) completes in under 150 ms on a mid\-range mobile CPU profile\.

R1 · Must

Size L

AI Engineer

Deps: EN\-205, EN\-1204

__EN\-308__

Enabler

__Offline catalog cache and updates__

As a reader, I want the shortlist and search to work without a connection, so that I can read on a plane or a train\.

AC1\. Given the app has loaded once online, when the device is offline, then the shortlist, search and all saved works function\.

AC2\. Given a new catalog manifest, then the service worker updates in the background and switches atomically on the next launch\.

R1 · Must

Size M

Architect

Deps: EN\-208, EN\-1201

### E4 · Feedback & learning loop

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__US\-401__

User story

__Quick reactions on cards__

As a reader, I want to dismiss a pick with an optional reason, so that the app stops showing me similar things\.

AC1\. Given a card or detail sheet, when I tap Not for me, then an optional reason picker \(too long, not my genre, too old\-fashioned, too dark, already read\) appears and can be skipped\.

AC2\. Given a reaction, then it is appended to the event log with a timestamp and the card animates away\.

R1 · Must

Size S

UX/UI Designer

Deps: US\-301

__US\-402__

User story

__End\-of\-read check\-in__

As a reader, I want a quick "How was it?" when I finish, so that the next picks get better\.

AC1\. Given I reach the end of a work, then a check\-in asks "How was it?" with Loved it / It was OK / Not for me plus optional reason chips, and it can be dismissed\.

AC2\. Given I answer, then the feedback event is saved and the next shortlist reflects it\.

AC3\. Given I loved it and a next rung exists, then the next rung is suggested\.

R1 · Must

Size M

UX/UI Designer

Deps: US\-602, US\-404

__US\-403__

User story

__Implicit reading signals__

As a reader, I want the app to notice what I finish or abandon without asking me, so that I get better picks with no extra effort\.

AC1\. Given reading activity, then open, start, progress \(every 10%\), finish, abandon and active reading seconds are logged locally in batches and never sent over the network\.

AC2\. Given more than 2 minutes without interaction, then that time is not counted as reading\.

R1 · Must

Size M

Architect

Deps: US\-602, EN\-1204

__US\-404__

User story

__Reading DNA update rules__

As a reader, I want my profile to update from my feedback in a predictable way, so that recommendations improve and can be explained\.

AC1\. Given the weight table in SRS §4\.6, when events arrive, then the taste vector and facet beliefs update exactly as specified \(unit\-tested per row\)\.

AC2\. Given events older than 90 days, then their influence is halved \(half\-life of 90 days\)\.

AC3\. Given the event log, when the profile is rebuilt from scratch, then it equals the incrementally updated profile within 1e\-6\.

R1 · Must

Size M

AI Engineer

Deps: EN\-307

__US\-405__

User story

__Gentle follow\-up on abandoned works__

As a reader, I want to be asked once, kindly, why I stopped, so that the app learns without nagging\.

AC1\. Given a work was started, is under 15% read and untouched for 7 days, when I next open the app, then one gentle prompt asks why \(including a "Just busy" option\) and appears at most once per work\.

R2 · Should

Size S

UX/UI Designer

Deps: US\-403

__US\-406__

User story

__Reading DNA insights__

As a reader, I want to see and edit what the app has learned about my taste, so that I stay in control\.

AC1\. Given a profile, then the insights page shows top themes, sweet\-spot length, favourite era and the taste / explore / wildcard split\.

AC2\. Given I remove a theme or forget a book, then the profile is rebuilt without it and the next shortlist reflects the change\.

R2 · Should

Size M

UX/UI Designer

Deps: US\-404

__US\-407__

User story

__Forget a signal__

As a reader, I want to remove a work from my history, so that one odd choice doesn't skew my recommendations\.

AC1\. Given my history list, when I choose "Forget this", then the related events are deleted, the profile is recomputed and the work may be recommended again\.

R2 · Could

Size S

Architect

Deps: US\-404

### E5 · Mixed reads & reading ladder

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__US\-501__

User story

__Your Long List row__

As a reader who is enjoying short works, I want longer works suggested when I seem ready, so that I can grow into novellas and novels\.

AC1\. Given readiness \(at least 3 positively rated finished works\), then the shortlist adds a Your Long List row of novelettes, novellas or novels, each showing estimated sessions at my typical session length\.

AC2\. Given my mix setting is "Mostly short", then at most 1 longer work appears\.

R2 · Must

Size M

AI Engineer

Deps: EN\-505, US\-602

__US\-502__

User story

__Reading ladder__

As a reader, I want a clear, optional path from short stories to longer classics, so that longer books feel approachable\.

AC1\. Given I finish and love a short work, then a "next rung" \(a longer work by the same author or the closest cluster\) is suggested\.

AC2\. Given the Library, then the ladder card shows completed rungs and the next rung\.

R2 · Must

Size M

Product Manager

Deps: US\-501

__US\-503__

User story

__Mix control__

As a reader, I want to choose Mostly short, Balanced, Mostly long or Surprise me, so that the shortlist matches my mood and time\.

AC1\. Given Settings or the shortlist header, when I choose a mix, then the next shortlist follows the ratio table in SRS §4\.6\.

R2 · Should

Size S

UX/UI Designer

Deps: EN\-505

__US\-504__

User story

__Author affinity__

As a reader, I want more from authors I love, especially their longer works, so that I can follow a voice I enjoy\.

AC1\. Given I loved 2 or more works by an author, then that author's longer works get a score boost and the reason "More from <author>"\.

R2 · Could

Size S

AI Engineer

Deps: EN\-505

__EN\-505__

Enabler

__Mix composer and readiness model__

As the recommendation engine, I want a policy that balances short and long works, so that longer works appear at the right pace\.

AC1\. Given ladder level and mix setting, then the composer fills slots per the ratio table and never shows more longer works than the table allows\.

AC2\. Given simulated personas, then the ladder level only increases after positive finishes and decreases after two consecutive abandoned longer works\.

R2 · Must

Size M

AI Engineer

Deps: EN\-307

### E6 · Built\-in e\-reader

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__EN\-601__

Enabler

__Reader engine bake\-off__

As a product owner, I want evidence for which open\-source reading engine to build on, so that the reader is solid and maintainable\.

AC1\. Given candidates foliate\-js, Readium ts\-toolkit and epub\.js/react\-reader, when each renders the same 5 test works on Chrome Android, iOS Safari and a desktop browser, then a scored matrix \(pagination, reflow, locators, highlights, TTS hooks, accessibility, bundle size, maintenance, license\) is written to docs/research/reader\-engines\.md\.

AC2\. Given the matrix, then ADR\-0002 is updated with a recommendation and a ReaderEngine interface proposal for Gate G2\.

R0 · Must

Size M

Reader Researcher

Deps: EN\-1201

__US\-602__

User story

__Open and read a work__

As a reader, I want to open a work and read it comfortably, so that reading feels natural\.

AC1\. Given a work, when I tap Read now, then it opens at my last position \(or the start\) in under 1\.5 s from cache\.

AC2\. Given paginated mode, then tapping the right/left edges or pressing arrow keys turns pages; a scroll mode is also available\.

AC3\. Given the work has a table of contents, then I can jump to any chapter\.

R0 · Must

Size L

Reader Researcher

Deps: EN\-601

__US\-603__

User story

__Typography and themes__

As a reader, I want to adjust fonts, size, spacing and colour theme, so that reading is comfortable for my eyes\.

AC1\. Given the Aa panel, then I can choose Literata, Atkinson Hyperlegible, OpenDyslexic or a system serif; size \(10 steps\); line spacing \(3\); margins \(3\); and Paper, Sepia, Night or Black themes\.

AC2\. Given any change, then it applies instantly without losing my place and persists across sessions\.

AC3\. Given each theme, then body text contrast is at least 7:1\.

R1 · Must

Size M

UX/UI Designer

Deps: US\-602, EN\-701

__US\-604__

User story

__Progress and time left__

As a reader, I want to see how much time is left in the story or chapter, so that I know if I can finish now\.

AC1\. Given reading, then a progress bar shows percent and minutes left in the story or chapter, using my measured words per minute \(default 238\)\.

AC2\. Given my speed changes over sessions, then estimates update using a rolling median\.

R1 · Must

Size S

Architect

Deps: US\-602, US\-403

__US\-605__

User story

__Tap zones and accessible controls__

As a reader, I want familiar gestures plus accessible buttons, so that anyone can navigate\.

AC1\. Given reading, then the left and right 25% of the screen turn pages, the centre toggles controls, and every action is also available as a labeled button for assistive technology\.

R1 · Must

Size S

UX/UI Designer

Deps: US\-602

__US\-606__

User story

__Define a word__

As a reader of older texts, I want to look up unfamiliar or archaic words, so that I keep reading without friction\.

AC1\. Given I long\-press or double\-tap a word, then a card shows its definition from the work's build\-time glossary if present, otherwise from the dictionary API after a one\-time consent note\.

AC2\. Given I am offline, then glossary definitions still work and dictionary lookups show a friendly offline message\.

R1 · Should

Size M

Content Curator

Deps: US\-602, EN\-204

__US\-607__

User story

__Highlights and notes__

As a reader, I want to highlight passages and add notes, so that I can keep what moved me\.

AC1\. Given a text selection, then I can highlight in 4 colours and add a note; highlights persist and re\-anchor correctly after font changes\.

AC2\. Given the highlights list, then I can export all highlights of a work as Markdown\.

R2 · Should

Size M

Reader Researcher

Deps: US\-602

__US\-608__

User story

__Read aloud__

As a reader, I want to listen to a work with the text highlighted, so that I can read with my ears or rest my eyes\.

AC1\. Given Read aloud, then text is spoken with the device's built\-in voices \(Web Speech API\), the current sentence is highlighted, and speed can be set from 0\.75× to 2×\.

AC2\. Given I pause or the screen locks, then my position is remembered\.

R2 · Should

Size M

Reader Researcher

Deps: US\-602

__US\-609__

User story

__Search inside a work__

As a reader, I want to search within the text, so that I can find a passage again\.

AC1\. Given a query, then all matches are listed with surrounding context and tapping one navigates there\.

R2 · Could

Size S

Reader Researcher

Deps: US\-602

__US\-610__

User story

__Bookmarks__

As a reader, I want to bookmark places, so that I can return to them\.

AC1\. Given reading, when I tap Bookmark, then the location is saved and listed, and tapping it navigates back\.

R1 · Should

Size S

Reader Researcher

Deps: US\-602

__US\-611__

User story

__"Previously…" recap__

As a reader returning to a longer work, I want a spoiler\-safe reminder of what happened, so that I can pick up the thread\.

AC1\. Given I return to a longer work after 3 or more days, then a recap of chapters already read is offered, drawn from build\-time chapter summaries\.

AC2\. Given any recap, then it never includes content beyond my furthest reading position\.

R2 · Could

Size M

AI Engineer

Deps: US\-602, EN\-204

__US\-612__

User story

__Listen to a human\-narrated recording__

As a reader, I want to switch to a volunteer\-narrated public\-domain audiobook when one exists, so that I can listen on a walk\.

AC1\. Given a work with a matching LibriVox recording, then a Listen button plays it with chapter navigation and remembers position; recordings are streamed from the source with attribution\.

R3 · Could

Size M

Reader Researcher

Deps: US\-608

### E7 · Covers & visual identity

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__EN\-701__

Enabler

__Design tokens and component library__

As an UI\-building agent, I want one set of tokens and components, so that every screen looks consistent\.

AC1\. Given docs/design/tokens\.json, then colours, type scale, spacing, radii, elevation and motion are available as CSS variables and Tailwind theme values\.

AC2\. Given the component gallery page, then buttons, chips, cards, sheets, tabs and toggles render in all 4 themes and pass axe checks\.

R0 · Must

Size M

UX/UI Designer

Deps: EN\-1201

__EN\-702__

Enabler

__Cover generation pipeline__

As a reader, I want every work to have beautiful, consistent cover art, so that browsing is a pleasure\.

AC1\. Given a work, when \`npm run covers:generate \-\- \-\-ids …\` runs, then 2–4 candidates are generated with the house\-style prompt \(docs/content/house\-style\.md\) via Cloudflare Workers AI, recording prompt, seed and model\.

AC2\. Given candidates, then automatic checks reject any image with detected text \(OCR\), unsafe content or near\-duplicates \(perceptual hash\)\.

AC3\. Given passing candidates, then an HTML contact sheet is produced for Gate C2, and only approved images are packaged as WebP/AVIF in 3 sizes with alt text\.

R1 · Must

Size L

Cover Artist

Deps: EN\-204

__US\-703__

User story

__Cover display with typographic overlay__

As a reader, I want titles that are always legible and correct on covers, so that covers look great and are accessible\.

AC1\. Given a cover image, then the app overlays title and author in Fraunces over a legibility gradient; the text is real text \(screen\-readable\), never baked into the image\.

AC2\. Given images load slowly, then a blurred placeholder or procedural cover shows first and the layout does not shift\.

R1 · Must

Size S

UX/UI Designer

Deps: EN\-701, EN\-702

__US\-704__

User story

__Procedural fallback cover__

As a reader, I want a good\-looking cover even when art is missing, so that the shortlist never looks broken\.

AC1\. Given no approved art for a work, then a deterministic SVG cover \(seeded by work id and genre palette\) is shown in the house style\.

R1 · Should

Size S

UX/UI Designer

Deps: EN\-701

__US\-705__

User story

__Art notes__

As a reader, I want to know how a cover was made, so that the use of AI imagery is transparent\.

AC1\. Given a work detail, when I open Art notes, then I see that the illustration is AI\-generated, the model used, and a short description of the scene\.

R2 · Could

Size S

Cover Artist

Deps: US\-703

### E8 · On\-device AI assist

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__EN\-801__

Enabler

__Local model bake\-off__

As a product owner, I want measured evidence about which small model \(if any\) should run on devices, so that we ship AI help only where it is genuinely good\.

AC1\. Given docs/ai/eval\-plan\.md, when the candidates \(browser built\-in AI where available plus 3–4 small open models\) run on 30 real passages from the catalog, then quality \(rubric\), latency, download size, memory and failure rate are recorded per device class\.

AC2\. Given the results, then a report and an ADR\-0005 update recommend a default model, a fallback, and a go/no\-go for "Explain \(Labs\)" at Gate G2\.

R1 · Must

Size M

AI Engineer

Deps: EN\-204

__US\-802__

User story

__Explain this passage \(Labs\)__

As a reader of older or difficult texts, I want a plain\-language explanation of a passage, so that I understand without leaving the story\.

AC1\. Given Labs is on and a model tier is available, when I select up to 150 words and tap Explain, then an explanation streams into a bottom sheet with time\-to\-first\-token under 3 s on a supported device\.

AC2\. Given generation is running, when I tap Cancel or close the sheet, then it stops immediately\.

AC3\. Given any output, then it is labeled "AI\-generated on your device" and no passage text leaves the device \(asserted by e2e network checks\)\.

R2 · Should

Size M

AI Engineer

Deps: EN\-801, US\-803

__US\-803__

User story

__AI model manager__

As a reader, I want to see, download and delete on\-device AI models, so that I control storage and data use\.

AC1\. Given Settings → AI, then I see available tiers, model name, download size and storage used; I can download on demand \(with a Wi\-Fi reminder where detectable\) and delete the model\.

AC2\. Given insufficient storage quota, then the download is blocked with an explanation\.

R2 · Should

Size S

Architect

Deps: EN\-801

__US\-804__

User story

__Tiered AI fallback__

As a reader on any device, I want Explain to work as well as my device allows, so that nobody is left with a broken button\.

AC1\. Given capability detection, then Explain uses built\-in browser AI if available, else the downloaded model, else glossary plus dictionary, and the sheet says which tier answered\.

R2 · Should

Size S

AI Engineer

Deps: US\-802

__EN\-805__

Enabler

__On\-device embeddings for free text__

As a reader, I want free\-text taste input understood on my device, so that my history can be used privately\.

AC1\. Given the embedding model chosen in ADR\-0004, when it is loaded lazily in the AI worker, then free text is embedded into the same vector space as the catalog: cosine similarity between device and build\-time vectors for 20 sample works is at least 0\.99\.

R2 · Should

Size M

AI Engineer

Deps: EN\-205

__US\-806__

User story

__Ask the book \(spoiler\-safe\)__

As a reader of a long work, I want to ask questions about what I have read so far, so that I can keep track of characters and plot\.

AC1\. Given a longer work, when I ask a question, then the answer uses only chapters I have read \(spoiler\-safe\) and cites the passage it relied on\.

R3 · Could

Size L

AI Engineer

Deps: US\-802

### E9 · Library & offline

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__US\-901__

User story

__My Library__

As a reader, I want one place for what I am reading, saved and finished, so that I can pick up where I left off\.

AC1\. Given saved, reading and finished works, then the Library shows them in three tabs with cover, progress and minutes left, sorted by last opened\.

AC2\. Given a work in Reading, when I tap it, then it resumes at the last position\.

R1 · Must

Size M

UX/UI Designer

Deps: US\-602, EN\-1204

__US\-902__

User story

__Offline reading__

As a reader, I want saved works to be readable without a connection, so that I can read anywhere\.

AC1\. Given I save a work, then its text and cover are cached, and with the network off it opens and reads normally\.

AC2\. Given Settings → Storage, then I see the space used and can remove offline copies\.

R1 · Must

Size M

Architect

Deps: EN\-308

__US\-903__

User story

__Install\-as\-app prompt__

As a reader, I want to be told why and how to install the app, so that my data is safer and the app works offline\.

AC1\. Given I have finished 1 work and the app is not installed, then a dismissible prompt explains installing \(offline use; keeps data safer from browser clean\-up on iPhone\) with platform\-specific steps, shown at most once per 30 days\.

R1 · Should

Size S

UX/UI Designer

Deps: EN\-1201

__US\-904__

User story

__Gentle reading stats__

As a reader, I want to see my reading over time, so that I feel good about my progress\.

AC1\. Given reading history, then I can see minutes read, works finished and my short/long mix per month, with no streak penalties or guilt messages\.

R2 · Could

Size S

UX/UI Designer

Deps: US\-403

### E10 · Privacy & control

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__US\-1001__

User story

__Privacy promise and data inventory__

As a reader, I want to see exactly what the app stores, so that I can trust it\.

AC1\. Given the Privacy page, then it lists every data type stored on the device with counts and states that no analytics or personal data is sent\.

AC2\. Given an automated e2e run of all core flows, then no request goes to any host except the app's static host \(plus opt\-in lookups only when explicitly used\)\.

R1 · Must

Size S

Architect

Deps: EN\-1204

__US\-1002__

User story

__Export and import my data__

As a reader, I want to move my Reading DNA and library to another device, so that I don't lose anything\.

AC1\. Given Export, then a single JSON file with schema version, profile, events, library, progress, highlights and settings downloads\.

AC2\. Given Import on another device, then the file is validated and restored, and the shortlist matches the original device's shortlist for the same catalog version\.

R1 · Must

Size M

Architect

Deps: EN\-1204

__US\-1003__

User story

__Delete everything__

As a reader, I want to erase all my data in one step, so that I can leave cleanly\.

AC1\. Given Delete all, when I confirm by typing DELETE, then IndexedDB, caches \(except the app shell\) and model files are removed and the app returns to the welcome screen\.

R1 · Must

Size S

Architect

Deps: EN\-1204

__US\-1004__

User story

__Content preferences__

As a reader, I want to hide works with certain content or authors, so that recommendations respect my boundaries\.

AC1\. Given content\-note filters \(e\.g\., graphic violence, racism, suicide, sexual content\) and blocked authors, when set, then matching works never appear in recommendations or search results\.

R1 · Should

Size S

Product Manager

Deps: EN\-204, EN\-307

__US\-1005__

User story

__Keep my data safe from browser clean\-up__

As a reader, I want my data protected against automatic deletion, so that my Reading DNA is not lost\.

AC1\. Given first profile creation, then the app requests persistent storage and records whether it was granted\.

AC2\. Given storage is not persistent and the app is not installed, then a gentle monthly reminder suggests exporting or installing\.

R1 · Must

Size S

Architect

Deps: EN\-1204

__US\-1006__

User story

__Share an anonymous metrics summary \(opt\-in\)__

As a beta reader, I want to share aggregate reading stats if I choose, so that the team can measure success without tracking me\.

AC1\. Given Settings → Help improve Twice Told, when I tap "Share a summary", then a preview shows only aggregate counts \(no titles, no text, no ids\) and nothing is sent unless I choose how to share it myself\.

R1 · Should

Size S

Product Manager

Deps: US\-403

### E11 · Accessibility & performance

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__EN\-1101__

Enabler

__Automated accessibility checks in CI__

As a product owner, I want accessibility regressions caught automatically, so that every release stays usable by everyone\.

AC1\. Given CI, then axe\-core runs on every core screen in Playwright and fails the build on any serious or critical violation\.

R0 · Must

Size S

UX/UI Designer

Deps: EN\-1202

__EN\-1102__

Enabler

__Performance budgets in CI__

As a reader on a mid\-range phone, I want the app to stay fast as it grows, so that it always feels instant\.

AC1\. Given CI, then Lighthouse CI with mobile emulation enforces LCP ≤ 2\.5 s, CLS ≤ 0\.1, total JavaScript ≤ 300 KB gzipped, and PWA installability\.

R0 · Must

Size S

Architect

Deps: EN\-1202

__US\-1103__

User story

__Screen reader and keyboard support__

As a reader who uses assistive technology, I want every core flow to work with my screen reader or keyboard, so that Twice Told works for me\.

AC1\. Given VoiceOver, TalkBack or NVDA, then onboarding, shortlist, detail, reader controls, check\-in and settings are completable; verified by automated role/label assertions and a scripted manual checklist at Gate G5\.

R1 · Must

Size M

UX/UI Designer

Deps: EN\-1101

__US\-1104__

User story

__Reduced motion and high contrast__

As a reader sensitive to motion or low contrast, I want the interface to respect my system settings, so that reading is comfortable\.

AC1\. Given prefers\-reduced\-motion, then non\-essential animations are disabled\.

AC2\. Given the high\-contrast option, then all text meets 7:1 contrast and focus indicators are at least 3 px\.

R1 · Should

Size S

UX/UI Designer

Deps: EN\-701

### E12 · Platform & delivery pipeline

__ID__

__Story__

__Acceptance criteria__

__Release__

__Lead · deps__

__EN\-1201__

Enabler

__Project scaffold__

As a build agent, I want a clean, conventional project skeleton, so that every later story has a solid base\.

AC1\. Given the repo, then a Vite \+ React \+ TypeScript \+ Tailwind app with vite\-plugin\-pwa, Dexie, Vitest and Playwright exists, with npm scripts dev, build, test, e2e, lint and typecheck\.

AC2\. Given the scaffold, then the folder structure matches the module table in SRS §4\.3 and \`npm run build\` produces a static site\.

R0 · Must

Size M

Architect

No deps

__EN\-1202__

Enabler

__CI on Gitea Actions__

As a product owner, I want every pull request checked automatically by Gitea Actions, so that I only look at work that already passes\.

AC1\. Given a pull request into dev, test or main, then Gitea Actions \(act\_runner\) runs typecheck, lint, unit, e2e, accessibility, Lighthouse and catalog validation and reports a status on the PR\.

AC2\. Given the repository has no package\.json yet \(docs\-only phase\), then CI passes with a "docs\-only" notice instead of failing\.

AC3\. Given the workflow, then AGENTS\.md lists the exact status\-check names that branch protection requires \(the machine gate\)\.

R0 · Must

Size M

Architect

Deps: EN\-1201, EN\-1208

__EN\-1203__

Enabler

__Deploy to Cloudflare Pages via Direct Upload__

As a product owner, I want test and production sites that update automatically, so that I can verify work on my phone\.

AC1\. Given a push to dev, test or main, then a Gitea Actions job builds the site and runs wrangler pages deploy dist \-\-project\-name=luminaread \-\-branch=<branch>; main is production, and test and dev get the branch aliases test\.luminaread\.pages\.dev and dev\.luminaread\.pages\.dev\.

AC2\. Given the Cloudflare token and account id, then they are stored only as Gitea Actions secrets and never printed in logs\.

AC3\. Given the URLs, then they are recorded in AGENTS\.md for the assembly line and Gate G5\.

R0 · Must

Size S

Architect

Deps: EN\-1201, EN\-1208

__EN\-1204__

Enabler

__On\-device storage layer__

As a build agent, I want typed stores with migrations behind small interfaces, so that data is safe and features stay independent\.

AC1\. Given Dexie, then ProfileStore, EventLog, LibraryStore, ProgressStore, HighlightStore and SettingsStore expose typed interfaces with versioned migrations and unit tests\.

AC2\. Given the codebase, then no other module accesses IndexedDB directly \(enforced by a lint rule\)\.

R0 · Must

Size M

Architect

Deps: EN\-1201

__EN\-1205__

Enabler

__Privacy\-safe error reporting__

As a product owner, I want to learn about crashes without collecting personal data, so that I can fix problems\.

AC1\. Given an error, then it is stored in a local ring buffer \(last 50\) with no reading content, and Settings → Report a problem composes a pre\-filled message the reader can review and send themselves\.

R1 · Could

Size S

Architect

Deps: EN\-1204

__EN\-1206__

Enabler

__Android and iOS app wrappers__

As a reader, I want Twice Told from the app stores, so that installation is familiar\.

AC1\. Given Capacitor, then Android and iOS builds run the same web app offline with the embedding model bundled, and pass store pre\-launch checks\.

R3 · Could

Size L

Architect

Deps: US\-902

__EN\-1207__

Enabler

__Agent operating files in place__

As a product owner, I want the agents, skills, gates and backlog installed and verified, so that the crew can work autonomously between gates\.

AC1\. Given the starter kit, then AGENTS\.md, CONTEXT\.md, \.agents/rules, \.agents/skills, \.agents/workflows and \.agents/agents are present and Antigravity lists them\.

AC2\. Given /gate G0, then a gate packet is produced; given /sprint in dry\-run mode, then a plan is printed without changing any branch\.

R0 · Must

Size S

Product Manager

No deps

__EN\-1208__

Enabler

__Private Gitea server and Actions runner__

As a product owner, I want a private code home with enforced branch protection at no cost, so that agents can only change dev, test and main through pull requests\.

AC1\. Given Docker, when docker compose up \-d runs in infra/gitea, then Gitea is reachable on port 3000 with an admin account and a registered act\_runner\.

AC2\. Given scripts/forge/gitea\-init\.sh luminaread, then a private repository with branches dev, test and main exists and all three reject direct pushes\.

AC3\. Given a pull request with a trivial change, then a hello\-world workflow runs on the runner and reports success\.

AC4\. Given the Gitea data folder, then a nightly backup copy is documented \(and optionally a push mirror to a second host\)\.

R0 · Must

Size M

Architect

No deps

__EN\-1209__

Enabler

__Sprint assembly line in Antigravity__

As a product owner, I want a sprint pipeline where I only approve the plan and the promotion, so that the agents do everything else on their own\.

AC1\. Given READY tasks in TASKS\.md, when I run /sprint, then written plans \(PLAN\-<group>\.md\) are produced and the workflow stops for my plan approval \(G4\)\.

AC2\. Given approval, then each group runs developer → tester → reviewer in its own git worktree \(in parallel where Antigravity allows, otherwise one after another\)\.

AC3\. Given a reviewed group, then a Gitea pull request is opened and merged only when the required CI checks pass and the reviewer verdict is "approve" \(machine gate\); merges happen one at a time \(merge queue\)\.

AC4\. Given all merges, then regression and docs steps run on dev, and the workflow auto\-rolls dev → test unless regression failed or a concern is open, in which case it stops and reports\.

AC5\. Given the test site, then the workflow stops for Gate G5; only promote typed by me merges test → main\.

R0 · Must

Size L

Product Manager

Deps: EN\-1208, EN\-1207, EN\-1202

# <a id="_Toc241360800"></a>Part 9 — The AI build crew: agents, skills and gates

## <a id="_Toc241360801"></a>9\.1 The crew

![Figure 13 — Who does what](20\.png)

*Figure 13 — Who does what*

__Agent \(file\)__

__In plain English__

__Main outputs__

__Gates__

__Skills it leans on__

__Product Manager__

product\-manager

Owns the why and the what: charter, scope, backlog, acceptance criteria, release plans\. Runs interviews with you\.

charter\.md, TASKS\.md, docs/stories

G0, G3

grill\-me, to\-spec, to\-tickets, gate\-review

__UX/UI Designer__

ux\-designer

Designs flows and screens, keeps the design system, builds throwaway prototypes, guards accessibility\.

prototypes, tokens\.json, design\-system\.md

G1

prototype, design\-system, gate\-review

__Architect__

architect

Owns structure, module boundaries, data, security/privacy, CI/CD and hosting; writes ADRs\.

docs/adr, module map, CI workflow

G2

domain\-modeling, codebase\-design, improve\-codebase\-architecture

__AI Engineer__

ai\-engineer

Owns the recommender, embeddings, enrichment prompts, the local\-model bake\-off and AI guardrails\.

engine/rec, docs/ai, eval results

G2, C1

recsys, local\-ai\-eval, tdd, research

__Reader Researcher__

reader\-researcher

Studies existing e\-readers and engines; runs the reader bake\-off; owns the ReaderEngine adapter\.

docs/research/reader\-engines\.md, ADR\-0002

G2

reader\-engine, research, prototype

__Content Curator__

content\-curator

Runs the compliant harvest, splitting and license checks\. Never invents or paraphrases source text\.

catalog records, provenance, sample sheets

C1

content\-pipeline

__Cover Artist__

cover\-artist

Keeps the cover house style, generates and checks candidates, builds contact sheets\.

covers, house\-style\.md, contact sheets

C2

cover\-art

The seven planning specialists and the six\-member build crew all ship in the starter kit as Antigravity custom agents \(\.agents/agents/\), mirrored into \.claude/agents/ for the optional Claude Code track\. The build crew is our own, written for this project and inspired by agent\-homelab's pipeline:

__Build agent__

__Job__

__Gate role__

__Release Manager__

release\-manager

Runs the assembly line: plans, worktrees, merge queue, auto\-rollout, promotion\.

G4, G5

__Developer__

developer

Implements one plan group test\-first in its own worktree\.

—

__Tester__

tester

Adds missing tests and verifies every acceptance criterion\.

—

__Reviewer__

reviewer

Reviews spec fit, code quality, security and fabricated material; ideally on a different model\.

Machine gate

__Regression__

regression

Runs the full suite on dev after merges; raises concerns instead of hiding failures\.

Auto\-rollout rule

__Docs__

docs

Keeps AGENTS\.md, CONTEXT\.md, ADRs and release notes true to the code\.

—

## <a id="_Toc241360802"></a>9\.2 Skills, explained

![Figure 14 — Handbook, specialists, recipe cards, buttons and sign\-offs](21\.png)

*Figure 14 — Handbook, specialists, recipe cards, buttons and sign\-offs*

A __skill__ is a folder containing a SKILL\.md file: a short name, a one\-line description of when to use it, and step\-by\-step instructions \(optionally with scripts and templates\)\. The agent always sees every skill's name and description, but reads the full instructions only when a task matches\. So you can install many skills without cluttering the agent's attention\.

__WHERE: Anatomy of a skill \(\.agents/skills/gate\-review/SKILL\.md\)__

\-\-\-

name: gate\-review

description: Prepare a gate packet for the human product owner and record their decision\. Use when running /gate or when any agent reaches a gate\.

\-\-\-

\# Gate review

1\. Read docs/gates/README\.md for this gate's checklist\.

2\. Collect evidence \(links, test results, screenshots\) into docs/gates/<GATE>\-packet\.md\.

3\. Write the Gemini review prompt at the end of the packet\.

4\. STOP\. Wait for "APPROVE <GATE>" or "CHANGES <GATE>" from the human\.

- __User\-invoked__ skills run only when you type them \(e\.g\., /grill\-me\); __model\-invoked__ skills are picked up automatically when the task fits \(e\.g\., tdd\)\. This split comes from Matt Pocock's repository\.
- __Where skills live:__ for Antigravity, in the project's \.agents/skills/ folder \(with rules in \.agents/rules/, workflows in \.agents/workflows/ and custom agents in \.agents/agents/\); the kit mirrors them into \.claude/ for the Claude Code track\. Some Antigravity versions use \.agent/ \(singular\); the architect agent checks at setup\.
- __Skills are portable\.__ They follow the open Agent Skills format, which Claude Code and Antigravity both support\.
- __Safety:__ skills can contain scripts\. Read a third\-party skill before installing it; the two repos in this plan are well known, readable Markdown\.

## <a id="_Toc241360803"></a>9\.3 Which of Matt Pocock's skills to use, and when

__Skill__

__What it does__

__When in Twice Told__

__Triggered by__

/grill\-me, /grill\-with\-docs

Interviews you relentlessly about a plan; the docs version also updates CONTEXT\.md and ADRs

G0 charter interview; any time a plan feels fuzzy

You

/to\-spec

Turns the conversation into a spec in your tracker

After a G0/G1 discussion

You

/to\-tickets

Breaks a plan into small tickets with blocking links

G3 backlog refinement \(mirror into TASKS\.md\)

You

/implement

Builds from a spec or tickets, using /tdd and finishing with /code\-review

Inside /story for a single story

You or /story

/wayfinder

Maps a huge piece of work as decision tickets

Planning R2/R3

You

/triage

Moves bug reports through triage roles and writes agent\-ready briefs

After G5 feedback

You

/improve\-codebase\-architecture

Scans for "deepening" opportunities and reports visually

Every 2–3 sprints

You

tdd

Red\-green\-refactor loop

Every implementation story

Agents automatically

prototype

Throwaway prototypes to answer design questions

G1 screens; reader bake\-off

Agents automatically

research

Investigates primary sources and writes a cited Markdown file

Reader engines, model candidates, licenses

Agents automatically

domain\-modeling, codebase\-design

Shared vocabulary \(CONTEXT\.md\), ADRs, deep modules

G2 and ongoing

Agents automatically

code\-review

Two\-axis review: standards and spec

Before every merge

Agents automatically

diagnosing\-bugs

Disciplined debug loop

When something breaks

Agents automatically

wizard

Generates an interactive script to walk you through steps only you can do

Cloudflare and GitHub dashboard steps

Agents automatically

/handoff, /wait\-what

Hand work to a fresh session; re\-explain a confusing message in plain English

Long sessions; whenever a reply does not land

You

git\-guardrails\-claude\-code

Hooks that block destructive git commands

Install once at setup

You \(once\)

Install them with the skills installer \(Part 10\.7\), choosing Antigravity if it is listed, and run /setup\-matt\-pocock\-skills once\. Choose __local files__ as the tracker and docs/ as the docs location; the Product Manager agent mirrors any tickets into TASKS\.md, which stays the single backlog the assembly line reads\. Matt's skills also rely on CONTEXT\.md \(a shared glossary\) and ADRs — both are pre\-filled in the kit\.

## <a id="_Toc241360804"></a>9\.4 Twice Told's own skills \(in the kit\)

__Skill__

__Purpose__

__Used by__

__Key rules__

luminaread\-story

Take one story from TASKS\.md to a merged pull request: read spec, use case and ADRs; test first; verify every acceptance criterion; update docs\.

All build agents

Never mark done without passing acceptance tests; stop and ask if an input is missing\.

gate\-review

Assemble a gate packet \(what changed, evidence, risks, checklist, questions\) and the Gemini review prompt; record your decision\.

Product Manager, all leads

Agents never approve a gate; only "APPROVE <gate>" from you counts\.

content\-pipeline

Harvest, clean, split, enrich and package the catalog with provenance\.

Content Curator, AI Engineer

Mirrors only, ≥ 2 s between requests; verbatim text only; license allow\-list\.

cover\-art

Generate covers in the house style, run automatic checks, build the contact sheet, package approved art\.

Cover Artist

No text in images; no real identifiable people; record prompt, seed, model\.

recsys

The recommendation maths: vectors, weights, Beta beliefs, MMR, slots, mix composer, persona simulation\.

AI Engineer, developer

Deterministic; rebuild\-from\-log equals incremental; all in the worker\.

reader\-engine

How to use the ReaderEngine adapter, locators, pagination tests and EPUB sandboxing\.

Reader Researcher, developer

UI never imports the engine directly; scripts disabled in content\.

local\-ai\-eval

Run the on\-device model bake\-off: eval set, rubric, device matrix, report\.

AI Engineer

Real catalog passages only; blind human sample at G2\.

design\-system

Tokens, components, typography and accessibility rules for any UI work\.

UX/UI Designer, developer

Use tokens only; 44 px targets; 7:1 body text contrast\.

assembly\-line

Run a sprint: plans → G4 → isolated worktrees \(developer → tester → reviewer\) → merge queue with machine gate → regression → docs → auto\-rollout → G5\.

Release\-manager, build crew

Humans gate only the plan and the promotion; never merge red; auto\-rollout skips on failure or open concern\.

gitea\-forge

Open pull requests, post reviews, check statuses, merge when checks succeed, protect branches — via scripts/forge/gitea\.sh\.

Release\-manager, architect

Token read from a file, never printed; PR\-only changes to dev, test and main\.

## <a id="_Toc241360805"></a>9\.5 The gated pipeline

![Figure 15 — Planning gates, content gates and the sprint loop](22\.png)

*Figure 15 — Planning gates, content gates and the sprint loop*

__Gate__

__Name__

__Prepared by__

__What you check__

__Evidence in the packet__

__Your time__

G0

Charter

Product Manager \(with you, via /kickoff\)

Vision, audience, success metrics, scope and non\-goals; decisions D1–D11

docs/charter\.md, decisions table, Gemini review notes

30–45 min

G1

Experience

UX/UI Designer

Clickable prototype of the core screens on your phone; design tokens; cover house style

Prototype link, tokens\.json, house\-style samples, accessibility notes

30 min

G2

Architecture & AI

Architect \+ AI Engineer \+ Reader Researcher

ADRs; reader\-engine and local\-model bake\-off results; privacy and cost check

docs/adr/\*, docs/research/reader\-engines\.md, docs/ai/results

45 min

G3

Backlog ready

Product Manager

Release scope, story order, acceptance criteria are testable

TASKS\.md, docs/stories/\*, story map

30 min

C1

Content sample

Content Curator \+ AI Engineer

Random sample: text boundaries, blurbs \(no spoilers\), content notes, licenses

Sample sheet with source links

20–30 min per batch

C2

Cover contact sheet

Cover Artist

Covers fit the house style, contain no text, are appropriate

HTML contact sheet

10–20 min per batch

G4

Plan approval

Release\-manager agent \(/sprint\)

Groupings and PLAN files make sense; nothing you did not ask for

PLAN\-\*\.md files

10 min per sprint

G5

Validate \+ promote

Release\-manager agent \(after auto\-rollout to test\)

Try the test site on your phone with the story checklists; then type "promote"

Test URL, CI results, sprint summary

15–20 min per sprint

At every gate, the agents stop\. You read the packet, optionally run the Gemini review \(prompts P2/P4\), and type APPROVE G1 or CHANGES G1 — … in Antigravity's agent chat\. The decision is saved in docs/gates/decisions/\. Agents are forbidden from approving gates for you\.

## <a id="_Toc241360806"></a>9\.6 The sprint assembly line

This implements the pipeline from the talk you photographed: __humans gate only the plan and the promotion__\. Everything between is automated, and a __machine gate__ stops anything that fails review or CI from merging\.

__Station__

__Who__

__What happens__

__Stops when__

Backlog → written plans

Release Manager

Picks READY tasks from TASKS\.md, groups them by dependency, writes PLAN\-<group>\.md with files, tests and sources

—

Plan approval \(G4\)

__You__

Read the plans; type APPROVE G4 or CHANGES G4

Always — human gate

Isolated worktrees

Developer → Tester → Reviewer, per group

Each group gets its own git worktree and branch; test\-first implementation; independent review

Reviewer requests changes \(loops back, max 3\)

Merge queue

Release Manager

One Gitea pull request per group, merged one at a time on top of the latest dev

—

Machine gate

Gitea

Branch protection requires green CI checks and the reviewer's approval; merges use "merge when checks succeed"

Any red check or missing approval

Regression → docs

Regression, Docs

Full test suite on dev; docs and release notes updated

Real bugs are logged as open concerns

Auto\-rollout → test

Release Manager

Merges dev into test automatically; Gitea Actions deploys the test site

Skips itself if regression failed or a concern is open

Validate \+ promote \(G5\)

__You__

Try the test site on your phone with the story checklists; type promote

Always — human gate

PROD

Gitea Actions

test merges to main; Wrangler deploys production

—

- __Parallel work:__ Antigravity 2\.0 supports subagents and background tasks, so groups can run in parallel worktrees\. If your version cannot, the workflow runs groups one after another with the same gates\.
- __Model mix:__ planner and developers on Gemini 3\.1 Pro; tester on a faster Flash model; reviewer on a Claude model inside Antigravity, so a different model family checks the work\.
- __Where it lives:__ \.agents/workflows/sprint\.md and promote\.md, the six build agents in \.agents/agents/, the assembly\-line and gitea\-forge skills, scripts/forge/gitea\.sh, and \.gitea/workflows/ for CI and deploys\.

![Figure 16 — The sprint assembly line: two human gates, one machine gate](23\.png)

*Figure 16 — The sprint assembly line: two human gates, one machine gate*

## <a id="_Toc241360807"></a>9\.7 Why Gitea instead of GitHub

- __Private and protected for free\.__ Gitea enforces branch protection and required checks on private repositories at no cost; on GitHub's free plan that enforcement needs a public repository \(your decision D4 was private\)\.
- __It is agent\-homelab's home forge\.__ agent\-homelab defaults to Gitea, and its README notes the GitHub path was only dry\-run tested — so Gitea is the better\-trodden path for this style of pipeline\.
- __Familiar CI\.__ Gitea Actions uses GitHub\-Actions\-style YAML and runs on a small runner \(act\_runner\) next to Gitea\.
- __Your code stays with you\.__ Everything runs in Docker on your computer\.
- __Trade\-offs:__ you run it \(Docker\), CI pauses when the computer sleeps, and you must back up its data folder\. Cloudflare Pages cannot auto\-connect to self\-hosted Git, so Gitea Actions deploys with Wrangler's Direct Upload — branch URLs such as test\.luminaread\.pages\.dev still work\.

__Where to run Gitea__

__Pros__

__Cons__

__Recommendation__

Docker on your computer

Free, 15\-minute setup, private

Pauses when asleep; back up regularly

__Start here \(D12\)__

Always\-on mini PC / NAS

CI runs anytime; still private

Small hardware cost; some admin

Move here once sprints are routine

Gitea Cloud \(managed\)

No maintenance

Paid

If you never want to run servers

Codeberg \(Forgejo\)

Free hosting

Intended for free/open\-source projects

Not for a private repo

## <a id="_Toc241360808"></a>9\.8 How agent\-homelab fits now

- __Concept source\.__ The assembly line follows agent\-homelab's pipeline shape: plan approval, parallel worktrees, reviewer before merge, regression, auto\-rollout to test, human promotion\.
- __Written fresh for Antigravity\.__ agent\-homelab's files are Claude Code\-specific and its repository has no license file, so the kit's workflows, agents and Gitea scripts are original and do not copy its text\.
- __Alternative track\.__ If you ever use Claude Code, agent\-homelab can run directly against the same Gitea server \(KIT\_FORGE=gitea, KIT\_GITEA\_URL, a token in ~/\.gitea\-token\) — installed from source into your own ~/\.claude folder\.

# <a id="_Toc241360809"></a>Part 10 — Step\-by\-step setup \(no technical background needed\)

Plan about two to three hours for first\-time setup\. Every command says where to type it\. Words in this style are typed exactly\. If anything fails, paste the error into Antigravity's agent chat and ask what to do — that is normal\.

__TIP · Six words you will see__

__Terminal__ — a window where you type commands\. __Docker__ — runs small self\-contained servers on your computer\. __Gitea__ — your private code home \(like GitHub, but yours\)\. __Branch__ — a parallel version of the project \(dev, test, main\)\. __Pull request \(PR\)__ — a proposed change waiting to merge\. __Agent__ — an AI worker with one job\.

## <a id="_Toc241360810"></a>10\.1 Accounts and apps you need

__Service__

__Why__

__Cost__

__Action__

Google AI Pro

Antigravity \(the build crew\) and Gemini reviews

Your subscription

Nothing new

Google Antigravity

Where the agents work

Included with AI Pro

Download from antigravity\.google and sign in

Docker Desktop

Runs Gitea and its CI runner

Free for personal use

Download from docker\.com

Cloudflare

Hosting \(Pages\) and cover art \(Workers AI\)

Free tier

Create an account \(needed at story EN\-1203\)

Standard Ebooks Patrons Circle

Feed access for the catalog

Small donation

Join before Gate C1 \(D6 confirmed\)

## <a id="_Toc241360811"></a>10\.2 Install the tools

### On a Mac

1. Install __Docker Desktop__ and __Antigravity__ from their websites \(drag to Applications, open each once, sign in to Antigravity with your AI Pro Google account\)\.
2. Open __Terminal__ \(Cmd \+ Space, type Terminal\)\. Install Homebrew, then the tools:

__WHERE: Terminal \(Mac\)__

/bin/bash \-c "$\(curl \-fsSL https://raw\.githubusercontent\.com/Homebrew/install/HEAD/install\.sh\)"

Run the two "Next steps" lines Homebrew prints, then:

__WHERE: Terminal \(Mac\)__

brew install git node jq

git config \-\-global credential\.helper osxkeychain

### On Windows

Install __Docker Desktop__ \(it will switch on WSL2, Windows' built\-in Linux\) and __Antigravity__\. Then open __PowerShell \(Admin\)__ and run wsl \-\-install if Ubuntu is not installed yet; restart and create a username \(rajiv\)\. In the __Ubuntu terminal__, install Homebrew with the same command as the Mac, run its "Next steps", then:

__WHERE: Ubuntu terminal \(Windows WSL2\)__

sudo apt update && sudo apt install \-y build\-essential unzip

brew install git node jq

git config \-\-global credential\.helper store

### Check everything works

__WHERE: Terminal \(Mac\) or Ubuntu terminal \(Windows\)__

git \-\-version

node \-\-version

jq \-\-version

docker \-\-version

## <a id="_Toc241360812"></a>10\.3 Start your private Gitea server

Download __luminaread\-starter\-kit\.zip__ from this chat and unzip it\. Copy its infra/gitea folder somewhere permanent outside the project, then start Gitea:

__WHERE: Terminal \(Mac\) or Ubuntu terminal \(Windows\)__

mkdir \-p ~/lumina\-infra

cp \-R ~/Downloads/luminaread\-starter\-kit/infra/gitea ~/lumina\-infra/

cd ~/lumina\-infra/gitea && docker compose up \-d gitea

1. Open __http://host\.docker\.internal:3000__ in your browser\. \(On a Mac, if it does not load, run echo "127\.0\.0\.1 host\.docker\.internal" | sudo tee \-a /etc/hosts in Terminal and try again\.\)
2. On the first\-run page keep the defaults \(SQLite database\), scroll to __Administrator Account Settings__, create your admin user, and click __Install Gitea__\.
3. Create an access token: your avatar → __Settings → Applications → Generate New Token__; give it read and write access to repository, user and organization; copy it\.
4. Save the token where the scripts expect it \(commands below\), then register the CI runner: __Site Administration → Actions → Runners → Create new runner__, copy the registration token, and put it in ~/lumina\-infra/gitea/\.env as RUNNER\_TOKEN=…\.

__WHERE: Terminal \(Mac\) or Ubuntu terminal \(Windows\)__

mkdir \-p ~/\.config/luminaread && chmod 700 ~/\.config/luminaread

printf '%s' 'PASTE\-YOUR\-GITEA\-TOKEN' > ~/\.config/luminaread/gitea\-token && chmod 600 ~/\.config/luminaread/gitea\-token

cd ~/lumina\-infra/gitea && cp \.env\.example \.env && nano \.env

docker compose up \-d runner

In nano, paste the runner token after RUNNER\_TOKEN=, press Ctrl\+O, Enter, Ctrl\+X\. The runner should appear as __Idle__ under Site Administration → Actions → Runners\.

## <a id="_Toc241360813"></a>10\.4 Create the Twice Told repository

__WHERE: Terminal \(Mac\) or Ubuntu terminal \(Windows\)__

mkdir \-p ~/code

bash ~/Downloads/luminaread\-starter\-kit/scripts/forge/gitea\-init\.sh luminaread

This creates a __private__ repository on your Gitea with branches dev, test and main, loads the starter kit as the first commit, protects all three branches, and makes three folders: ~/code/luminaread/luminaread\-dev \(where work happens\), \-test and \-prod\. On Windows, your Downloads folder inside Ubuntu is /mnt/c/Users/<YourWindowsName>/Downloads\.

## <a id="_Toc241360814"></a>10\.5 Open the project in Antigravity

1. In Antigravity choose __Open Folder__ and select ~/code/luminaread/luminaread\-dev \(on Windows, the folder inside Ubuntu\)\.
2. Open the agent chat and set the model to __Gemini 3\.1 Pro__\.
3. Check that Antigravity sees the kit: its customization or settings area should list the Twice Told rules, skills, workflows \(kickoff, gate, sprint, promote, story\) and agents\. If they are missing, your version may expect \.agent/ instead of \.agents/ — ask the agent to check and rename\.
4. Optional but recommended: set the __reviewer__ agent to a Claude model for cross\-model review\.

## <a id="_Toc241360815"></a>10\.6 Connect Cloudflare \(when the architect asks\)

Not needed until story EN\-1203\. Then use prompt P16: the Architect agent walks you through creating the Pages project luminaread as a Direct Upload project \(production branch main\), creating an API token with Cloudflare Pages edit and Workers AI permissions, and adding CLOUDFLARE\_API\_TOKEN and CLOUDFLARE\_ACCOUNT\_ID as Actions secrets in your Gitea repository \(repository __Settings → Actions → Secrets__\)\. For cover generation, the same two values also go into luminaread\-dev/\.env\. Never paste tokens into a chat\.

## <a id="_Toc241360816"></a>10\.7 Install Matt Pocock's skills

__WHERE: Terminal \(Mac\) or Ubuntu terminal \(Windows\)__

cd ~/code/luminaread/luminaread\-dev

npx skills@latest add mattpocock/skills

Choose Antigravity if it is offered \(otherwise choose a generic/\.agents option, or install for Claude Code and copy the chosen folders into \.agents/skills/\)\. Pick at least: setup\-matt\-pocock\-skills, grill\-me, grilling, to\-spec, to\-tickets, tdd, prototype, research, domain\-modeling, codebase\-design, code\-review, diagnosing\-bugs, wizard, handoff, wait\-what\. Then, in Antigravity:

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\)__

/setup\-matt\-pocock\-skills

Use local files as the tracker and docs/ as the docs location\. TASKS\.md stays our main backlog\.

## <a id="_Toc241360817"></a>10\.8 Set up your Gemini reviewer

1. In the Gemini app, open __Explore Gems → New Gem__, name it __Twice Told Reviewer__ and paste prompt P1 as its instructions\.
2. Add this SRS \(docx\) and, later, AGENTS\.md and CONTEXT\.md as the Gem's knowledge files\.
3. Whenever you use it, set the model picker to __Pro__\.

## <a id="_Toc241360818"></a>10\.9 Your first session: Gate G0

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\)__

/kickoff

The Product Manager agent interviews you on the open decisions, writes docs/charter\.md, and prepares the G0 packet\. Upload the packet to your Gemini Gem \(P2 or the per\-gate prompt\), bring the findings back \(P4\), then type APPROVE G0\.

## <a id="_Toc241360819"></a>10\.10 Then: G1–G3, content, and sprints

1. G1 — prompt P7\. G2 — prompt P8\. G3 — prompt P9\.
2. Content — prompts P10 and P11 \(they can run alongside G1–G3\)\.
3. Build — type /sprint \(P12\)\. Approve the plan \(G4\)\. The assembly line runs; you are free until it reports that the test site is ready\.
4. Open the test\-site link on your phone, walk through the checklist, and type promote \(P13\)\.
5. If a sprint misbehaves, use /story <id> \(P14\) one story at a time — the same gates apply\.
6. First sprint tip: run it on one small R0 story as a rehearsal\.

## <a id="_Toc241360820"></a>10\.11 Alternative track: Claude Code

The kit mirrors every agent, skill and workflow into \.claude/ \(workflows become commands\), and CLAUDE\.md points to AGENTS\.md\. If you ever switch, install Claude Code, open luminaread\-dev, and type /kickoff \(P17\)\. agent\-homelab can also run against your Gitea \(Part 9\.8\)\.

## <a id="_Toc241360821"></a>10\.12 Troubleshooting and safety

__Situation__

__What to do__

Gitea page does not load

Make sure Docker Desktop is running; run docker compose ps in ~/lumina\-infra/gitea; add the hosts line from 10\.3\.

CI never starts

Check the runner is Idle under Site Administration → Actions → Runners; restart it with docker compose restart runner\.

CI cannot check out the code

The runner's jobs must reach Gitea at host\.docker\.internal:3000; ask the architect agent to diagnose \(it owns EN\-1208\)\.

Nothing happens while your laptop sleeps

Expected: Gitea and CI pause\. Keep it awake during sprints, or move Gitea to an always\-on device \(D12\)\.

The agent asks permission to run a command

Read it\. Approve ordinary project commands \(npm, git, scripts/forge\) in luminaread\-dev\. Refuse anything outside the project, deleting data, or revealing tokens\.

An agent says it is blocked on a missing file or credential

Good — the anti\-fabrication rule is working\. Provide it, or tell it to skip that item\.

Usage limit reached

Let the agent write a handoff note \(handoff skill\) and continue later\.

You pasted a secret by mistake

Revoke it in that service immediately and create a new one\.

Backups

Weekly \(or nightly\) copy of ~/lumina\-infra/gitea/data to cloud storage or an external drive\.

# <a id="_Toc241360822"></a>Part 11 — Prompt library

Every prompt says exactly which tool it goes into\. Replace anything in <angle brackets>\.

### P1

__PASTE INTO: Gemini app → Explore Gems → New Gem \(name it "Twice Told Reviewer"\)__

You are an independent senior reviewer for Twice Told, a privacy\-first e\-reader that recommends free public\-domain short stories and essays and learns from feedback\. Other AI agents produced the plans; your job is to find what they got wrong or missed\.

For every review:

1\. List findings as a numbered table: ID, severity \(Blocker / Major / Minor\), section, finding, evidence or reasoning, recommended change\.

2\. Check factual claims about tools, versions, licenses and pricing\. If you cannot verify something, say so rather than guessing\.

3\. Flag anything a non\-technical product owner could not follow\.

4\. End with: the 3 changes you would make first, and anything you agree is well done\.

Be direct\. Do not rewrite the whole document\.

### P2

__PASTE INTO: Gemini app → your "Twice Told Reviewer" Gem → model picker set to Pro → attach Twice Told\_SRS\_v2\.docx__

Review the attached Twice Told SRS v2\.1 end to end\. Focus on: \(a\) whether the product plan matches the goal of short reads first, then a mix with longer works, with feedback loops; \(b\) the build\-time Content Factory, the on\-device recommender and the local\-model plan; \(c\) the Antigravity \+ Gitea sprint assembly line and its human and machine gates; \(d\) whether the setup guide is truly followable by a non\-technical person; \(e\) licensing and privacy risks, including the added content sources; \(f\) gaps in the epics, use cases and user stories\. Use the finding table format\.

### P3

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\)__

/kickoff

### P4

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — after a Gemini review__

Here is Gemini 3\.1 Pro's review of gate <GATE>:

<paste Gemini's findings table>

Triage every finding: accept, partially accept or reject, with one line of reasoning each\. Apply accepted changes to the docs, list what changed, then run /gate <GATE> again so I can decide\.

### P5

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — approve a gate__

APPROVE <GATE> — notes: <anything you want recorded>

### P6

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — send a gate back__

CHANGES <GATE> — <what you want changed>

### P7

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — Gate G1 \(experience\)__

Use the ux\-designer agent\. Build the G1 clickable prototype of the 12 core screens described in docs/SRS\.md Part 3 using docs/design/tokens\.json and the mock\-ups in docs/design/mockups, include 3 cover house\-style samples, tell me how to open it on my phone, then run /gate G1\.

### P8

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — Gate G2 \(architecture and AI\)__

Use the reader\-researcher agent to run EN\-601 \(reader engine bake\-off\) and the ai\-engineer agent to run EN\-801 \(local model bake\-off\), then have the architect agent update ADRs 0001–0008 from the evidence and confirm the Gitea \+ Cloudflare setup \(D10, D12\)\. Run /gate G2 when done\.

### P9

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — Gate G3 \(backlog ready\)__

Use the product\-manager agent\. Re\-check TASKS\.md and docs/stories against the approved G0–G2 decisions, make every story independently testable, confirm the R0 and R1 order, and run /gate G3\.

### P10

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — content batch \(Gate C1\)__

Use the content\-curator agent with the content\-pipeline skill\. Build a first batch of 25 works \(15 short stories, 7 essays, 3 longer works\) from the sources in docs/content/sources\.md, prepare the C1 sample sheet, and run /gate C1\.

### P11

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — covers batch \(Gate C2\)__

Use the cover\-artist agent with the cover\-art skill\. Generate covers for the works approved at C1, produce the contact sheet, and run /gate C2\.

### P12

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — start a sprint \(the assembly line\)__

/sprint

### P13

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — after you have checked the test site on your phone \(Gate G5\)__

promote

### P14

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — single\-story fallback__

/story EN\-1201

### P15

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — when something breaks__

Something went wrong: <paste what you saw>\. Diagnose it step by step \(use the diagnosing\-bugs skill if installed\), explain the cause in plain English, and propose the smallest fix\. Do not change anything until I say go\.

### P16

__PASTE INTO: Antigravity — agent chat in the luminaread\-dev folder \(model: Gemini 3\.1 Pro\) — connect Cloudflare \(when the architect asks\)__

Use the architect agent and the wizard skill to walk me, one step at a time, through creating the Cloudflare Pages project "luminaread" \(Direct Upload, production branch main\), creating the API token, and adding CLOUDFLARE\_API\_TOKEN and CLOUDFLARE\_ACCOUNT\_ID as Gitea Actions secrets\. Wait for me to confirm each step\.

### P17

__PASTE INTO: Claude Code \(alternative track\) — in luminaread\-dev__

/kickoff

# <a id="_Toc241360823"></a>Part 12 — Risks, assumptions, glossary and references

## <a id="_Toc241360824"></a>12\.1 Risks and mitigations

__Risk__

__Likelihood__

__Impact__

__Mitigation__

The assembly line is a new port of agent\-homelab's ideas to Antigravity

Medium

High

First sprint: one small R0 story as a dry run; /story fallback; short, explicit workflow steps\.

Gitea runs on your laptop: CI pauses while it sleeps; disk loss loses history

Medium

High

Nightly backup of the Gitea data folder; optional push mirror; move to an always\-on device later \(D12\)\.

Antigravity folder conventions change \(e\.g\., \.agent vs \.agents\)

Medium

Low

The architect agent verifies discovery at setup \(EN\-1207\); the kit notes both names\.

The same model builds and reviews \(shared blind spots\)

Medium

Medium

Reviewer agent on a Claude model inside Antigravity; Gemini\-app reviews at planning gates\.

Usage limits interrupt long agent sprints

Medium

Medium

Small sprints; /handoff; stagger content and code work; consider a higher plan tier\.

Small on\-device models give wrong explanations of archaic prose

High

Medium

Bake\-off with go/no\-go; glossary grounding; short outputs; "Labs" label; feedback button\.

Public\-domain status differs outside the US

Medium

High

US\-PD basis stated in About; lawyer review before public launch; option to geo\-limit later\.

Generated blurbs spoil endings or misstate content

Medium

Medium

Self\-check prompt; human sampling at C1; reviewed flag; easy correction path\.

Offensive historical content surprises readers

High

Medium

Content notes, filters \(US\-1004\), 16\+ audience, curator exclusions\.

Browser storage eviction wipes a reader's DNA

Medium

High

persist\(\), install prompt, export reminders \(US\-1005\)\.

foliate\-js API changes

Medium

Medium

Pin a commit; ReaderEngine adapter; Readium plan B\.

Free\-tier limits change \(Cloudflare, Pollinations, Gemini API\)

Medium

Low

Build\-time only; resumable pipelines; alternatives documented\.

WebGPU driver quirks produce garbage output on some GPUs

Medium

Medium

Device matrix in bake\-off; sanity check on output; WASM or glossary fallback\.

Agents fabricate "source" material or test fixtures

Low

High

Anti\-fabrication rule in AGENTS\.md; code\_quality hunts for it; provenance checksums\.

Scope creep from the agents

Medium

Medium

G4 plan approval; stories must trace to TASKS\.md; /review\-plan\.

Secrets committed to the repo

Low

High

\.env ignored; secret scanning; git guardrails; never paste tokens into chat\.

Name conflict / trademark

Medium

Medium

Trademark search before launch \(D9\)\.

## <a id="_Toc241360825"></a>12\.2 Assumptions

- Decisions D1–D11 hold as recommended until you change them at G0\.
- You have Google AI Pro \(Antigravity and Gemini 3\.1 Pro\); a Claude subscription is optional\.
- Docker Desktop can run on your computer, and it is awake during sprints\.
- Your computer is a Mac \(macOS 13\+\) or Windows 10/11 able to run WSL2, with at least 8 GB RAM\.
- Free tiers named here remain broadly as described \(checked September 2026\); pipelines are resumable if limits change\.
- English\-language catalog for the MVP; US public\-domain basis\.

## <a id="_Toc241360826"></a>12\.3 Glossary

__Term__

__Meaning__

Reading DNA

The reader's on\-device taste profile: taste vector, facet beliefs, reading context\.

Work

One readable item: a story, essay, novella or novel\.

Shortlist / slot

The curated set of picks; each position \(hero, short reads, essays, wildcard\) is a slot\.

Reading ladder / rung

The optional path from short stories to novels; each length class is a rung\.

Signal / event

Anything the reader does that teaches the app \(explicit or implicit\), stored in the event log\.

Facet

A property of a work used for learning \(genre, mood, era, form, length, level\)\.

Content Factory

The build\-time pipeline that prepares the catalog\.

Provenance

Where a text came from, its license, retrieval date and checksum\.

Embedding / vector

A list of numbers representing meaning; similar works have similar vectors\.

PWA

Progressive Web App — a website that installs and works offline like an app\.

Agent / subagent

An AI worker with a role, instructions and tools\.

Skill

A folder with a SKILL\.md recipe an agent loads when relevant\.

Gate

A human decision point where agents stop and wait\.

Worktree

A separate folder for one branch, so agents can work in parallel\.

ADR

Architecture Decision Record — a short note of one decision and why\.

MoSCoW

Must, Should, Could, Won't — a priority scale\.

## <a id="_Toc241360827"></a>12\.4 References \(checked September 2026\)

- Gemini release notes — [gemini\.google/release\-notes](https://gemini\.google/release\-notes/)
- Gemini 3\.5 Pro status — [eesel\.ai/blog/gemini\-3\-5\-pro](https://www\.eesel\.ai/blog/gemini\-3\-5\-pro)
- Gemini CLI to Antigravity transition — [developers\.googleblog\.com](https://developers\.googleblog\.com/an\-important\-update\-transitioning\-gemini\-cli\-to\-antigravity\-cli/)
- Claude Code setup — [code\.claude\.com/docs/en/getting\-started](https://code\.claude\.com/docs/en/getting\-started)
- agent\-homelab — [github\.com/jhjacobson/agent\-homelab](https://github\.com/jhjacobson/agent\-homelab)
- Matt Pocock's skills — [github\.com/mattpocock/skills](https://github\.com/mattpocock/skills)
- Project Gutenberg robot access policy — [gutenberg\.org/policy/robot\_access\.html](https://www\.gutenberg\.org/policy/robot\_access\.html)
- Project Gutenberg offline catalogs — [gutenberg\.org/ebooks/offline\_catalogs\.html](https://www\.gutenberg\.org/ebooks/offline\_catalogs\.html)
- Standard Ebooks bulk downloads — [standardebooks\.org/bulk\-downloads](https://standardebooks\.org/bulk\-downloads)
- Cloudflare Workers AI pricing — [developers\.cloudflare\.com/workers\-ai/platform/pricing](https://developers\.cloudflare\.com/workers\-ai/platform/pricing/)
- foliate\-js — [github\.com/johnfactotum/foliate\-js](https://github\.com/johnfactotum/foliate\-js)
- Transformers\.js v4 demos — [huggingface\.co/collections/webml\-community/transformersjs\-v4\-demos](https://huggingface\.co/collections/webml\-community/transformersjs\-v4\-demos)
- Gemma 4 E2B for Transformers\.js — [huggingface\.co/onnx\-community/gemma\-4\-E2B\-it\-ONNX](https://huggingface\.co/onnx\-community/gemma\-4\-E2B\-it\-ONNX)
- Antigravity rules, skills and workflows — [kdnuggets\.com](https://www\.kdnuggets\.com/build\-better\-ai\-agents\-with\-google\-antigravity\-skills\-and\-workflows)
- Cloudflare Pages Git integration and Direct Upload — [developers\.cloudflare\.com/pages/get\-started/direct\-upload](https://developers\.cloudflare\.com/pages/get\-started/direct\-upload/)
- The Conversation republishing guidelines — [theconversation\.com/us/republishing\-guidelines](https://theconversation\.com/us/republishing\-guidelines)
- Chronicling America and the loc\.gov API — [chroniclingamerica\.loc\.gov/about/api](https://chroniclingamerica\.loc\.gov/about/api/)

## <a id="_Toc241360828"></a>Appendix — What is in the starter kit

__Path__

__What it is__

README\.md

Start here, in plain English

AGENTS\.md

The handbook every agent reads first \(CLAUDE\.md and GEMINI\.md point to it\)

CONTEXT\.md

Shared glossary \(ubiquitous language\) used by agents and Matt Pocock's skills

TASKS\.md

The backlog in agent\-homelab format \(80 items\)

docs/SRS\.md

This document in Markdown

docs/stories/\*\.md

One file per story with acceptance criteria and handoff

docs/use\-cases/\*\.md

The 12 fully dressed use cases

docs/story\-map\.md, docs/epics\.md

Story map and epics as text

docs/gates/

Gate checklists; decisions/ records your approvals

docs/adr/

Eight proposed architecture decisions for G2

docs/diagrams/\*\.mmd

All diagrams as editable Mermaid source

docs/design/

Tokens, design\-system notes, mock\-up images

docs/content/

Sources and license rules, cover house style, catalog schema

docs/ai/eval\-plan\.md

Local\-model bake\-off plan and prompt

docs/prompts/

Gemini review prompts

\.agents/agents/

13 Antigravity custom agents: 7 specialists \+ 6 build crew

\.agents/skills/

10 Twice Told skills

\.agents/workflows/

/kickoff, /gate, /sprint, /promote, /story

\.agents/rules/

Always\-on project rules

\.claude/

Mirror of agents, skills and workflows for the Claude Code track

\.gitea/workflows/

CI \(the machine gate\) and Cloudflare deploys

infra/gitea/

Docker Compose for Gitea \+ runner

scripts/forge/

gitea\.sh helpers and gitea\-init\.sh

