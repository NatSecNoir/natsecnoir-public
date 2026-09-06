# NatSecNoir public corpus

Human-reviewed summaries of U.S. national-security telecom actions (FCC Covered List, Team Telecom, and related). `records/<id>/` holds `meta.json`, `summary.md`, and where licensed a stored copy of the source. `records.json` indexes them.

`records/` and `records.json` are written by the private review tool's mirror job; everything else here is the site.

## Site

[natsecnoir.com](https://natsecnoir.com) is built from this repo with [Eleventy](https://www.11ty.dev/) and deployed by GitHub Pages on every push to `main`.

```
npm ci
npm test          # builds with zero records and with tests/fixtures, checks the output
npm run build     # writes _site/
npm run serve     # local preview
```

Summaries are Markdown rendered with raw HTML disabled, so quoted source text can never become markup. Only records whose `meta.json` says `approved` are rendered. Each record is published at `/records/<id>/` with its `meta.json`, `summary.md`, and stored copy beside it; `/feed.xml` is RSS; `/by/list/`, `/by/agency/`, `/by/type/` are the indexes.
