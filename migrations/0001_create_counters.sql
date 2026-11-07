-- Holds aggregate integers only. No per-visitor data, no IP addresses, no timestamps per hit.
CREATE TABLE counters (
  name TEXT PRIMARY KEY NOT NULL,
  value INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;

INSERT INTO counters (name, value) VALUES ('pageviews', 0);
