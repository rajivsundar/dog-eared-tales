# Prompt: Story Guide sources

Skip Standard Ebooks: don't use the GitHub route or the Patrons Circle. Gutendex is down; Gutenberg's own site answers (HEAD on pg_catalog.csv returned 200). Build two sources for Story Guide, hackathon pace, no plan needed. Everything stays in tools/story-guide.

Gutenberg
1. Search the official pg_catalog.csv, downloaded once into tools/story-guide/cache/ (git-ignored) and refreshed only if older than 7 days. Search title and author locally, English texts only, case-insensitive and forgiving of small misspellings ("edgar allen" finds Edgar Allan Poe). Top 10 results.
2. Drop Gutendex entirely.

Wikisource
3. Use the MediaWiki API on en.wikisource.org only, server-side, one request at a time, with a descriptive User-Agent that includes the repo URL (Wikimedia's policy). No scraping of rendered pages beyond what the API returns.
4. Public domain only: accept a page only if its licence tags or categories mark it public domain in the US. Otherwise show it greyed out with "Not marked US public domain" and don't analyse it.
5. Picking a result:
   a. A single-page work: fetch its text, strip headers, navigation, footnote markers and editor notes, and count words.
   b. A work split into chapter subpages: fetch the subpages in order and join them, stopping at 20,000 words and saying so on the page.
   c. A versions or disambiguation page: list its editions as choices instead of analysing it.
   Cache fetched texts in tools/story-guide/cache/ws-<safe-title>.txt.

Shared
6. One search box with a source choice: Project Gutenberg, Wikisource or Both. Results show title, author, source and length.
7. Length filter: Any, Short (under 5,000 words), Medium (5,000 to 20,000), Long (over 20,000), shown as "about N words, N min" at 250 words a minute. Gutenberg: estimate from the plain-text file size with a HEAD request (about 6 bytes per word). Wikisource: estimate from the page size the API reports. Don't download a book just to measure it.
8. Above 20,000 words, analyse only the first 20,000 for the full-story call and say so. The blurb call still uses the first third of what is analysed.
9. Run the same two Gemma calls and checks. For outside books, the Curated column shows "Not in the Dog-Eared Tales catalog", and the page shows the source, the licence tag for Wikisource, and a link to the book's page.
10. README "Sources" note: Project Gutenberg is used through its public catalog and plain-text files. Wikisource is used through the MediaWiki API, public-domain-tagged pages only. Standard Ebooks is not fetched, because its robots.txt asks AI tools not to fetch book text.
11. Save this prompt as docs/prompts/story-guide-sources.md.

Before committing, run git status and confirm no .env file and nothing in tools/story-guide/cache/ is staged. Run the full checks, then commit and push as "Story Guide: local Gutenberg catalog, Wikisource and length filter". Tell me in two lines when to restart the tool, and suggest two short Wikisource stories and two short Gutenberg works for the demo.
