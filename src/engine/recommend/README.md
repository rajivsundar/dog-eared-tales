# Recommender

Picks the 6 stories for Your Shortlist. Pure TypeScript: no UI, no database. The caller reads the
catalog, profile and event log and passes them to `recommend()`.

## Score (0 to 1)

mood match 45% + genre match 30% + length fit 15% + novelty 10%, then halved for each 3 times the
story was shown with no tap since.

- Mood and genre: the reader's weight for each tag, `(success + 1) / (success + failure + 2)`, averaged. No opinion is 0.5.
- Length fit: 1, 0.6, 0.3, 0.1 for 0 to 3 length classes away from the reader's usual class.
- Novelty: 1 for a story never shown, 0.5 after one showing, and so on. 0 once the reader has started it.

## Shortlist rules

Finished and "not for me" stories are never picked. The 6 include a wildcard (a mood the reader has
not picked), an essay when one scores at least 0.45, and a story under 10 minutes. With no taste
profile yet, `mode` is `"starter"` and the mix is varied and short.

Events used: `shown` (add one each time a card is displayed), `tap` (card opened), `open`, `save`,
`love`, `finished`, `notForMe`.
