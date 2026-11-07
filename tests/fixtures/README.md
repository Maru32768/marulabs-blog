# Test fixtures

Synthetic content for builds with `BLOG_CONTENT=fixtures`, which write to `dist-fixtures/`
and are never deployed.

- `articles/` exercises the layout, Markdown rendering, lists and search.
  `postgres-mvcc.md` is the sample text from the design prototype, used to compare the
  result with the design.
- `canary/` is draft-shaped content outside the content collection. Its marker string
  must never show up in any build output, which is what the boundary tests assert.

Nothing here is real investigation data. Do not put real notes in this directory:
everything in this repository is public.
