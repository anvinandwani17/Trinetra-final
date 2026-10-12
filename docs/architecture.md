# Architecture boundaries

The initial implementation is deliberately one Python package plus a React app.
Each analysis stage is a module boundary; no microservices or worker infrastructure
are introduced. Domain modules except discovery and downloads are documentation placeholders today.

## Responsibilities and future dependencies

| Module | Future input | Future output |
| --- | --- | --- |
| discovery | AOI, flood date, search constraints | Real scene pair and acquisition provenance |
| preprocessing | Selected scenes and common grid definition | Aligned SAR observations and validity masks |
| terrain | DEM and common grid | Terrain layers and observability masks |
| models | Prepared tensors; training data in a separate training path | Learned flood probabilities and model metadata |
| flood_detection | Prepared SAR, terrain, optional model probabilities | Flood estimates, uncertainty, observability |
| infrastructure | Pre-event historical OSM and hazard estimates | Potential exposure of buildings, roads, bridges |
| connectivity | Baseline graph and potentially affected edges | Access changes and possible disconnected settlements |
| reporting | Computed metrics, uncertainty, provenance | Grounded situation report |
| evaluation | Frozen predictions and separate references | Validation metrics; no influence on prediction |
| api | Validated requests | Future orchestration and result responses |
| web | API responses | Future interactive map and report views |

These are conceptual contracts, not implemented functions or final schemas.
Before pipeline integration, agree on AOI coordinate conventions, flood-date/time
semantics, CRS/grid/nodata, provenance fields, and GeoJSON properties. In particular,
unknown/unobservable must not be represented as dry, and zero affected assets must
not be used as a placeholder for missing analysis.

## Import boundaries

- Python analysis components never import React code or FastAPI routes.
- API routes adapt requests/results; keep scientific processing out of route files.
- Flood detection may use model inference; baseline flood logic stays separate
  from training. Training is a separate future entry point, never triggered on import.
- Terrain owns DEM preparation; preprocessing owns SAR preparation. Neither should
  silently download data or run expensive work at import time.
- Infrastructure exposure and network access remain separate computations.
- Evaluation may consume frozen prediction outputs; prediction and training paths
  must never import check-only evaluation references.
- Reporting consumes measured outputs rather than independently estimating damage.

## Current implemented discovery

`discovery.select_s1_pair(aoi, flood_date)` queries official CDSE STAC metadata,
validates orbit/direction, time, SAR product type, and AOI footprint coverage, and
caches metadata. It is available through a Python function and CLI. No imagery or
analysis jobs are run. See `sentinel1_discovery.md` for verification limits.

## Raw download stage

`downloads/` stores only selected original SAFE archives in `data/raw/sentinel1/`.
The Trishuli `scripts/run_case.py` pins its selected pair and records a run manifest.
`data/processed/` is not written. Complete archives are locally validated and
reused. Real download verification remains pending on Anvi's laptop.

## Current implemented API contract

`GET /api/v1/health` returns HTTP 200 and
`{"status":"ok","service":"TRINETRA","version":"0.1.0"}` with the configured
service name. The health route makes no external requests and checks process health
only. OpenAPI documentation describes this route; no pipeline endpoints exist.

The React development server proxies `/api` to localhost port 8000. It displays
health or an unavailable state without maps, datasets, or fabricated flood results.
Future deployment must route `/api` alongside static assets before the build is
usable as a complete application.

## Storage

`data/` and `artifacts/` are local, Git-ignored workspaces. No database is needed
now. Decide output schemas and run naming only when the first real processing stage
is authorized. Secrets remain in environment variables or untracked `.env` files.

## Deferred work

Live download verification, preprocessing tool choice, model training,
analysis jobs, historical OSM access, map layers, evaluation, and report generation
all require subsequent implementation steps. Nothing here starts them automatically.
