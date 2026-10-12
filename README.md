# TRINETRA

Multimodal AI Hackathon 2026 · Track B · Anvi + Arnav

TRINETRA aims to turn a selected area and flood date into satellite-based flood
mapping, potentially affected infrastructure, settlement access analysis, and a
grounded situation report.

**Current stage: scaffold, Sentinel-1 discovery, and a Trishuli raw-download runner.** Implemented
features include API health, configuration, tests, the existing React health-check
page, and a catalog-only Sentinel-1 pair-selection CLI. Discovery live verification
is blocked in the authoring workspace; see the detailed verification status below.
Real raw-download verification remains pending on Anvi's laptop.
Preprocessing, flood detection, training, maps, infrastructure analysis,
connectivity, reports, and evaluation are not implemented.
There are no sample flood predictions or fabricated satellite results.

## Sentinel-1 acquisition discovery

The first analysis feature is implemented as `select_s1_pair(aoi, flood_date)`.
It searches official CDSE STAC metadata, rejects incompatible orbit/direction or
insufficient footprint coverage, and caches metadata. No imagery is downloaded.
Follow [the discovery guide](docs/sentinel1_discovery.md) for Windows commands,
selection constraints, result fields, and actual verification status.

## Trishuli raw downloads

The authenticated runner discovers/pins two scenes, downloads only those selected
SAFE archives, caches verified files, supports safe resume when the server permits,
and checks archive integrity plus VV/VH raster readability. Follow
[the download guide](docs/trishuli_download.md) for credentials, Windows commands,
storage paths, and the pending real-download verification. No preprocessing runs.

## Intended workflow

Area + date → satellite discovery → preprocessing → flood detection with terrain
and model evidence → infrastructure exposure → road connectivity → map + report.

This is an intended workflow, not a claim of current functionality.

## Architecture and ownership

One repository, one installable Python package, one FastAPI process, and one React
application. Use local files for later data and outputs. No database, queue,
Docker, paid service, or additional deployment stack is needed for this scaffold.

| Location | Purpose | Primary owner |
| --- | --- | --- |
| `src/trinetra/discovery/` | Satellite catalog queries and defensible before/after selection | Anvi |
| `src/trinetra/downloads/` | Authenticated raw SAFE storage, resume, and validation | Anvi |
| `src/trinetra/preprocessing/` | SAR preparation, correction, and common raster grid | Anvi |
| `src/trinetra/flood_detection/` | Physical baseline, model fusion, flood masks, uncertainty | Anvi |
| `src/trinetra/models/` | Model architecture, training, and inference | Anvi |
| `src/trinetra/terrain/` | DEM preparation, slope, and radar observability | Anvi |
| `src/trinetra/infrastructure/` | Historical OSM and potential buildings/roads/bridges exposure | Arnav |
| `src/trinetra/connectivity/` | Compare baseline and hazard-affected road access | Arnav |
| `src/trinetra/reporting/` | Reports from measured results and provenance | Shared |
| `src/trinetra/api/` | HTTP routes and future orchestration adapters | Arnav |
| `src/trinetra/core/` | Small shared environment configuration | Shared |
| `src/trinetra/evaluation/` | Held-out metrics and check-only reference comparison | Anvi |
| `web/` | React frontend; map interface will come later | Arnav |
| `tests/` | Offline checks of real implemented behavior | Shared |
| `notebooks/` | Future Anvi experiments; reusable code belongs in `src/` | Anvi |
| `scripts/` | Future small CLI entry points; empty today | Shared |
| `data/` | Ignored local inputs, cache, processed products, and run outputs | Shared |
| `artifacts/` | Ignored future model checkpoints and exported reports | Shared |
| `docs/` | Architecture boundaries and project decisions | Shared |

Domain folders except `discovery/` and `downloads/` currently contain documentation-only
`__init__.py` placeholders.
They are separate Python modules, not separate services. See
[architecture](docs/architecture.md) for boundaries before adding pipeline code.

## Local prerequisites

**Anvi's Windows ML/geospatial environment:** follow
[the Windows setup guide](docs/windows_setup.md). It adds optional geospatial
packages and CPU-only PyTorch, and runs functional environment checks. The
lightweight API-only setup below remains available for Arnav.

- Git.
- Python 3.11 or 3.12 recommended, with pip and venv.
- Node.js 22.12+ (Node 22 LTS recommended) and npm for frontend work.
- An editor such as VS Code.

A GPU, CUDA, GDAL/SNAP, and geospatial packages are not needed at this stage.

## Backend setup

Clone this repository and run commands from its root:

```bash
git clone https://github.com/anvinandwani17/TRINETRA.git
cd TRINETRA
python -m venv .venv
```

If you received the scaffold as a ZIP, extract it and open the `TRINETRA` folder
instead of cloning an empty repository. Create the virtual environment there.
To publish those files to the currently empty repository from your own terminal:

```bash
git init -b main
git remote add origin https://github.com/anvinandwani17/TRINETRA.git
git add .
git commit -m "Initialize TRINETRA project scaffold"
git push -u origin main
```

Use your normal GitHub login when prompted. These publication commands assume
the remote remains empty; if someone has added commits, clone that repository
and copy the scaffold into it instead. Never force-push to replace teammates' work.

Activate the environment on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
```

Or macOS/Linux:

```bash
source .venv/bin/activate
cp .env.example .env
```

Then install, test, and run:

```bash
python -m pip install -r requirements.txt
python -m pytest
python -m uvicorn trinetra.api.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell restricts activation, run the environment's Python directly, for
example `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`, and use
that same executable for tests and uvicorn. Changing system policy is unnecessary.

- Health: <http://127.0.0.1:8000/api/v1/health>
- Interactive API docs: <http://127.0.0.1:8000/docs>
- OpenAPI: <http://127.0.0.1:8000/openapi.json>

Expected health response:

```json
{"status":"ok","service":"TRINETRA","version":"0.1.0"}
```

This confirms the API process responds. It does not verify satellite access,
credentials, model availability, or readiness for flood analysis. There is no
analysis/jobs endpoint yet; unimplemented routes return 404.

## Frontend setup

Keep the backend running. Open a second terminal:

```bash
cd TRINETRA/web
npm install
npm run dev
```

If already at the repository root, use `cd web`. Open <http://127.0.0.1:5173>
and click **Check API health**. Vite proxies `/api` to the backend on port 8000;
there is no need for permissive CORS or frontend credentials. Port 5173 is fixed
so a port conflict fails clearly.

```bash
npm run build
```

This validates and creates a static build in `web/dist/`. `npm run preview`
previews static assets only; API routing for a deployed build will be configured
later. Health integration is supported via `npm run dev` today.

## Dependencies

Python requirements are defined in `pyproject.toml`; `requirements.txt` installs
the local package with development extras. Compatible ranges are used for Python
dependencies; this is not a full transitive lockfile.

| Dependency | Purpose |
| --- | --- |
| FastAPI | API routes, response validation, OpenAPI docs |
| Uvicorn | Local ASGI server |
| pydantic-settings | Environment and `.env` configuration |
| pytest (development) | Basic tests |
| HTTPX (development) | FastAPI test client transport |
| setuptools (build) | Install the `src/` Python package |
| React + React DOM | Frontend UI |
| Vite + React plugin (development) | Frontend development server and build |

Frontend dependencies use compatible ranges. The first successful `npm install`
will generate `web/package-lock.json`; commit it, then use `npm ci` thereafter.
A lockfile could not be generated in the authoring workspace because registry access
is blocked. Backend tests and the frontend build also require local verification.
Later, add only the packages needed by each approved step. Likely candidates are
NumPy/Rasterio for rasters, PyTorch for the model, GeoPandas/Shapely for exposure,
NetworkX for connectivity, and MapLibre for maps. None is installed by this scaffold.
The Sentinel-1 preprocessing toolchain must be chosen before claiming raw SAR
processing is supported; Rasterio alone is not an SAR calibration/RTC processor.

## Configuration and future accounts

No accounts or credentials are required for local health checks or tests.
Real scene downloads require the local CDSE login documented in the download guide.
`.env.example` contains an optional app name and empty Copernicus credential
placeholders. The current application only reads `TRINETRA_APP_NAME`.
Start the backend from the repository root so its `.env` can be found.

| Account/service | When needed | Credential policy |
| --- | --- | --- |
| GitHub | Collaborating on this repository | Add Arnav as a collaborator; use local Git authentication, never commit tokens |
| Copernicus Data Space Ecosystem | Future authenticated Sentinel downloads | Register a free account; exact token/auth flow will be selected when discovery/downloads are implemented |
| Kaggle or Google Colab | Future free GPU experiments/training | Choose an available free option; no GPU account is required for the API |
| Historical OSM service | Future infrastructure snapshots | Select a suitable historical service and check its access requirements; do not substitute present-day OSM |
| Report generation | Future deterministic reports | No paid LLM/API account is assumed |

Do not put secrets in `web/`, Git history, notebooks, URLs, or screenshots.
Any future `VITE_*` variable is public browser configuration, never a secret.
Large datasets, caches, checkpoints, and generated reports are ignored by Git.

## Data and scientific boundaries

Working constraints below follow the supplied execution plan; confirm them
against the official brief before implementing data access and evaluation:

- Discover real satellite acquisitions for user-selected areas/dates; validate
  before/after geometry and record acquisition provenance.
- Keep radar-unobservable terrain distinct from non-flooded terrain.
- Use an approved pre-event historical OSM snapshot. Do not hardcode a single
  event's snapshot date as a universal setting.
- Keep EMS/UNOSAT/published damage references check-only in `evaluation/`;
  never import them into discovery, preprocessing, training, or prediction.
- Split future model data by event and prevent evaluation-event leakage.
- Describe intersecting buildings, roads, and bridges as **potentially affected**,
  not confirmed destroyed. Road-access outputs will be analytical estimates.
- Generate reports from computed metrics and provenance, with no invented values.

## Team workflow

Anvi works primarily inside satellite, flood, model, terrain, and evaluation
modules. Arnav works primarily inside infrastructure, connectivity, API, and web.
Coordinate shared output contracts before the next implementation step. Use small
feature branches, run `python -m pytest`, and run `npm run build` for frontend edits.
Both checks must work without downloading datasets.

## Scope boundary

Work stops at selected raw downloads and file validation. No models trained,
no fake satellite results, and no preprocessing or downstream analysis implemented.
No real imagery has been downloaded in the authoring workspace.

Educational prototype. Not an operational emergency-response product.

For repeated OData archive HTTP 502 errors, use the official CDSE S3 route:
`python scripts/run_case.py --aoi examples/trishuli.geojson --date 2026-08-26 --transport s3`.
Install the `s3` extra and set the two CDSE S3 keys in `.env` first; see
[download instructions](docs/trishuli_download.md#official-s3-route-when-the-archive-service-fails).

Physical preprocessing of the verified Trishuli pair is available through
`python scripts/preprocess_case.py`. It requires ESA SNAP with Microwave Toolbox
and the `preprocess` Python extra. See [preprocessing instructions](docs/sentinel1_preprocessing.md)
for the shared 20 m VV/VH gamma-nought outputs, change, terrain observability,
and PNG previews. Real Trishuli outputs have not yet been verified in the authoring workspace.
# Deterministic flood fallback

After completing and checking Trishuli preprocessing, install
`requirements-baseline.txt`, then run `python scripts/run_flood_baseline.py`
and `python scripts/check_flood_baseline.py`. This CPU-only stage combines
VV/VH darkening, DEM slope, observability and small-region cleanup without a
neural network. It exports candidate flood GeoTIFF/GeoJSON, an uncalibrated
evidence score and PNG previews under `data/processed/trishuli/baseline/`.
Unknown pixels remain unknown. See `docs/deterministic_flood_baseline.md`
for exact Windows commands, thresholds, validation and limitations.

