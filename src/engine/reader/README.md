# engine/reader

The reader engine adapter that opens and displays book files.

Other code uses the `ReaderEngine` interface from `index.ts` and never imports foliate-js. Only this folder may import it (a lint rule enforces this).

## How it works

foliate-js shows one chapter file of an EPUB at a time, as pages. Our stories are slices of a book: a slice can start or end in the middle of a chapter file and can run across two files. `FoliateReaderEngine` makes foliate-js show just the slice.

1. **Cut the page.** When foliate-js loads a chapter file, `trimDocument.ts` removes the text before `startHref` and from `endHref` on. Only the copy on screen changes, never the EPUB.
2. **Count the story.** When a story opens, the engine counts the words of the story in each chapter file it touches. If the next story begins at the very top of a file, that file is left out.
3. **Keep to the range.** `rangeRules.ts` holds the rules:
   - On the first page of the story, previous does nothing.
   - On the last page of the story, next fires `onRangeEnd` instead of turning the page.
   - A saved place before the story moves to the start. A place after it moves to the last page.
4. **Measure inside the story.** Progress and minutes left use the story's own word count (238 words per minute unless the reader's own speed is given), never the whole book.
5. **Style.** `readerStyle.ts` builds the CSS for font, text size step (1–10) and theme. The reading fonts are packaged with the app (`fonts.ts`, from Fontsource: Literata, Atkinson Hyperlegible, OpenDyslexic), so there is no font CDN and it works offline. Atkinson Hyperlegible and OpenDyslexic are packaged the same way.

Locators are saved from the trimmed page, and a story is always trimmed the same way, so a saved locator finds its place again in that story. Don't use a locator with a different story range.

## Files

| File                     | Job                                                          |
| ------------------------ | ------------------------------------------------------------ |
| `types.ts`               | The `ReaderEngine` interface and its types                   |
| `index.ts`               | What other code imports                                      |
| `FoliateReaderEngine.ts` | The adapter. The only file that loads foliate-js             |
| `rangeRules.ts`          | Plain-arithmetic rules for start, end, clamping and progress |
| `trimDocument.ts`        | Removes the text outside the story from the page on screen   |
| `readerStyle.ts`         | CSS for fonts, sizes and themes, and the contrast check      |
| `fonts.ts`               | The Literata `@font-face` rules                              |
| `words.ts`               | Word counting, the same as the catalog script                |
| `foliate-js.d.ts`        | A one-line type stub, because foliate-js ships no types      |

foliate-js is pinned to exactly `1.0.1`. Its README says the API is not stable, so upgrade on purpose and run the tests.
