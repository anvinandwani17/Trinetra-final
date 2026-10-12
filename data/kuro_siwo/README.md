# Kuro Siwo data workspace

This directory is separate from Trishuli inference data. It contains real
official Kuro Siwo GRD samples and an event-disjoint plan, not generated data.

| Folder | Purpose |
| --- | --- |
| `metadata/` | Pinned upstream revisions, release schema/provenance; optional original metadata caches |
| `splits/` | Complete train/validation/test JSONL sample indices and event assignments |
| `samples/event_<actid>/<grid_id>/` | Only locally selected official arrays plus `info.json` |
| `samples/local_manifest.json` | Local sample counts, partition, source shard and SHA-256 for every field |
| `cache/` | Temporary bounded archive prefixes, never full-release auto-downloads |
| `reports/` | One-batch test report and real sample preview |

The prepared release index covers 43 events / 67,490 samples. Only two training
samples from event 470 are downloaded for this initial test. Validation and
test imagery are not downloaded. The complete metadata plan is not a claim
that all indexed imagery is stored locally. See `docs/kuro_siwo_setup.md`.
