# Run reports

One file per end-to-end run of the testbed against a DataPipe deployment, written
by whoever (or whatever) drove the run, from
`.claude/skills/e2e-testbed/output-template.md`. Named `<YYYY-MM-DD>-<topic>.md`.

These are history: what a particular run did and saw, with its dates and timings.
The runbook and the scenario manifest are the opposite — timeless procedure and
facts — and nothing from here is copied back into them except a fact stated
plainly, without its date. That split is deliberate; it is what keeps the runbook
readable.

## This repository is public. Redact before committing.

- No account emails or names.
- No storage-provider folder IDs or links, and no file IDs.
- No tokens of any kind, and no DataPipe session IDs.
- No local filesystem paths, browser tab IDs, or machine names.
- Filenames are fine when the testbed generated them (`testbed-…`); leave out
  anything that came from a real study.

DataPipe experiment IDs are public by design and may stay.

Screenshots are not committed. Describe what they showed.

GitHub Pages publishes only `site/`, so nothing in this directory appears on the
testbed website.
