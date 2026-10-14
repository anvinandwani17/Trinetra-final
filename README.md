# TRINETRA

Multimodal AI Hackathon 2026 · Track B · Anvi + Arnav

TRINETRA turns a selected area and flood date into satellite-based flood mapping, potentially affected infrastructure, settlement access analysis, and a grounded situation report.

> Educational prototype. Not an operational emergency-response product.

## Current status

The repository currently implements a **Sentinel-1 pipeline for the Trishuli (Nepal) case, up to a deterministic flood-candidate baseline**, plus a FastAPI health API and a React health-check page.

| Stage | Status | Entry point |
| --- | --- | --- |
| API health + config + tests | Implemented | `uvicorn trinetra.api.main:app` |
| Sentinel-1 before/after pair discovery (CDSE STAC) | Implemented | `python -m trinetra.discovery` |
| Authenticated raw SAFE download + validation (OData or S3) | Implemented | `scripts/run_case.py` |
| SAR preprocessing with ESA SNAP (20 m VV/VH gamma-nought, change, terrain observability) | Implemented, real-run verification pending | `scripts/preprocess_case.py` |
| Deterministic flood baseline (no neural network) | Implemented | `scripts/run_flood_baseline.py` |
| Model training / fusion, infrastructure exposure, road connectivity, maps, reports, evaluation | **Not implemented** | – |

There are no sample flood predictions and no fabricated satellite results. Only a run manifest with `status: complete` proves that a stage actually ran and passed its checks.

## How a run works

```
AOI + flood date
   │
   ▼  1. Discovery      select_s1_pair() → pinned pre/post Sentinel-1 GRD pair
   ▼  2. Download       two raw SAFE archives, hash-verified, VV/VH readable
   ▼  3. Preprocess     ESA SNAP: orbit, noise, calibration, terrain flattening,
   │                    terrain correction, layover/shadow, common 20 m UTM grid
   ▼  4. Check          independent verification of grid, hashes, previews
   ▼  5. Flood baseline VV/VH darkening + DEM slope + observability → candidate flood mask
   ▼  6. Check          independent verification of baseline outputs

(Later, not implemented: model fusion → infrastructure exposure → road connectivity → map + report)
```

Each stage reads the previous stage's manifest and refuses to continue if it is not `complete`.

## Quick start: API and frontend only

Needs Git, Python 3.11/3.12, and Node.js 22.12+. No credentials, GPU, or geospatial tools.

```bash
git clone https://github.com/anvinandwani17/Trinetra-final.git
cd Trinetra-final
python -m venv .venv
```

Activate the environment and create your `.env`:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
```

```bash
# macOS / Linux
source .venv/bin/activate
cp .env.example .env
```

Install, test, and start the API (from the repo root, so `.env` is found):

```bash
python -m pip install -r requirements.txt
python -m pytest
python -m uvicorn trinetra.api.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks activation, call the venv's Python directly, e.g. `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`.

- Health: <http://127.0.0.1:8000/api/v1/health> → `{"status":"ok","service":"TRINETRA","version":"0.1.0"}`
- API docs: <http://127.0.0.1:8000/docs>

This only confirms the API process responds. There is no analysis/jobs endpoint yet; the flood pipeline is run from the command-line scripts below.

In a second terminal, start the frontend:

```bash
cd web
npm install
npm run dev
```

Open <http://127.0.0.1:5173> and click **Check API health**. Vite proxies `/api` to port 8000. `npm run build` creates a static build in `web/dist/`.

## Running the Trishuli flood pipeline (Windows)

The pipeline commands below are documented for Windows PowerShell, run from the repo root. They use the project's virtual environment explicitly (`.\.venv\Scripts\python.exe`).

### 0. Prerequisites

- Everything from the quick start above (venv created).
- A free [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu) account.
- **ESA SNAP 14 with the Microwave Toolbox** (for step 3). Install from the [official SNAP page](https://step.esa.int/main/download/snap-download/). It is a separate application, not a Python package.
- Free disk space: each Sentinel-1 scene can be hundreds of MB to over 1 GB. Plan for roughly 2 × one scene of temporary space on top of the saved scenes, plus SNAP working space.
- Optional ML/geospatial environment: see [`docs/windows_setup.md`](docs/windows_setup.md).

### 1. Configure `.env`

Edit the `.env` you copied from `.env.example`. Never commit this file.

```
# CDSE login (default OData download route)
CDSE_USERNAME=your_registered_email
CDSE_PASSWORD=your_password

# CDSE S3 keys (only for --transport s3; generate at https://eodata-s3keysmanager.dataspace.copernicus.eu)
CDSE_S3_ACCESS_KEY=your_access_key
CDSE_S3_SECRET_KEY=your_secret_key

# Path to SNAP's gpt executable (needed for preprocessing)
SNAP_GPT="C:/Program Files/esa-snap/bin/gpt.exe"
```

### 2. Install Python extras

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev,discovery,download,s3,preprocess]"
```

Verify SNAP is reachable and supports layover/shadow masks:

```powershell
Test-Path "C:\Program Files\esa-snap\bin\gpt.exe"
& "C:\Program Files\esa-snap\bin\gpt.exe" SAR-Simulation -h   # output must include saveLayoverShadowMask
```

### 3. Discover the pre/post pair (optional on its own)

`run_case.py` performs discovery automatically. To run it separately:

```powershell
.\.venv\Scripts\python.exe -m trinetra.discovery --aoi examples\trishuli_aoi.geojson --date 2026-08-26 --refresh --output data\runs\trishuli\s1_pair.json
```

This queries the official CDSE STAC catalog and downloads no imagery. It requires the same relative orbit and direction for both scenes and at least 99 % AOI coverage. Details: [`docs/sentinel1_discovery.md`](docs/sentinel1_discovery.md).

### 4. Download the raw scenes

```powershell
.\.venv\Scripts\python.exe scripts\run_case.py --aoi examples\trishuli.geojson --date 2026-08-26
```

Useful options:

| Option | When to use |
| --- | --- |
| `--transport s3` | The OData archive service keeps returning HTTP 502. Uses the official CDSE S3 route (needs the S3 keys). |
| `--two-factor` | Your CDSE account has 2FA; you will be prompted for a one-time code. |
| `--restart-partial` | A partial download cannot be resumed. Discards incomplete files only. |
| `--max-product-gib N` | Raise the per-scene size cap (default 3 GiB, max 6). |

Re-running the same command resumes or reuses verified files. On success, `data/runs/trishuli/download_manifest.json` says `status: complete`:

```powershell
Get-Content data\runs\trishuli\download_manifest.json
```

This first runner accepts only the date `2026-08-26` and a Trishuli-area AOI (longitude 84.5–85.6, latitude 27.6–28.8). Details and troubleshooting: [`docs/trishuli_download.md`](docs/trishuli_download.md).

### 5. Preprocess with SNAP

```powershell
.\.venv\Scripts\python.exe scripts\preprocess_case.py
.\.venv\Scripts\python.exe scripts\check_preprocessed_case.py
```

For low-memory machines add `--cache-mb 1024 --threads 1` to the first command. `--prepare-only` generates the SNAP graphs without running SNAP.

Outputs in `data/processed/trishuli/`: `before_gamma0_db.tif`, `after_gamma0_db.tif`, `change_db.tif`, `observability.tif`, `quality_reasons.tif`, layover/shadow masks, `processing_manifest.json`, and PNG previews in `previews/`. Open the four previews and the manifest and check them by eye before continuing. Details: [`docs/sentinel1_preprocessing.md`](docs/sentinel1_preprocessing.md).

### 6. Run the deterministic flood baseline

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-baseline.txt
.\.venv\Scripts\python.exe scripts\run_flood_baseline.py
.\.venv\Scripts\python.exe scripts\check_flood_baseline.py
```

This CPU-only stage combines VV/VH darkening, DEM slope, observability, and small-region cleanup. It writes a candidate flood GeoTIFF and GeoJSON, an uncalibrated evidence score, and PNG previews to `data/processed/trishuli/baseline/`. Pixels that radar cannot observe stay **unknown**, not "dry". Details and thresholds: [`docs/deterministic_flood_baseline.md`](docs/deterministic_flood_baseline.md).

### Where files end up

```
data/
  cache/s1_metadata/               discovery metadata cache
  raw/sentinel1/<UUID>/            raw SAFE zips + metadata
  runs/trishuli/                   s1_pair.json, download_manifest.json
  processed/trishuli/              preprocessed rasters, previews, manifest
  processed/trishuli/baseline/     flood baseline outputs
```

`data/` and `artifacts/` are ignored by Git.

## Architecture and ownership

One repository, one installable Python package (`src/trinetra`), one FastAPI process, one React app. Local files only: no database, queue, Docker, or paid service.

| Location | Purpose | Owner |
| --- | --- | --- |
| `src/trinetra/discovery/` | Catalog queries and before/after pair selection | Anvi |
| `src/trinetra/downloads/` | Authenticated raw SAFE storage, resume, validation | Anvi |
| `src/trinetra/preprocessing/` | SNAP-based SAR preparation and common raster grid | Anvi |
| `src/trinetra/flood_detection/` | Physical baseline, (later) model fusion, masks, uncertainty | Anvi |
| `src/trinetra/models/` | Model architecture, training, inference (not yet implemented) | Anvi |
| `src/trinetra/terrain/` | DEM preparation, slope, radar observability | Anvi |
| `src/trinetra/infrastructure/` | Historical OSM buildings/roads/bridges exposure (not yet implemented) | Arnav |
| `src/trinetra/connectivity/` | Baseline vs hazard-affected road access (not yet implemented) | Arnav |
| `src/trinetra/reporting/` | Reports from measured results and provenance (not yet implemented) | Shared |
| `src/trinetra/api/` | HTTP routes | Arnav |
| `src/trinetra/core/` | Shared environment configuration | Shared |
| `src/trinetra/evaluation/` | Held-out metrics, check-only reference comparison (not yet implemented) | Anvi |
| `scripts/` | CLI entry points: `run_case.py`, `preprocess_case.py`, `check_preprocessed_case.py`, `run_flood_baseline.py`, `check_flood_baseline.py`, `inspect_snap_metadata.py` | Shared |
| `web/` | React frontend (health check only; map comes later) | Arnav |
| `tests/` | Offline checks of implemented behaviour | Shared |
| `examples/` | Example AOI GeoJSON files | Shared |
| `notebooks/` | Experiments; reusable code belongs in `src/` | Anvi |
| `docs/` | Per-stage guides and architecture decisions | Shared |

See [`docs/architecture.md`](docs/architecture.md) for module boundaries before adding pipeline code.

## Dependencies

Python dependencies are declared in `pyproject.toml` with optional extras:

| Extra / file | Adds |
| --- | --- |
| core (`requirements.txt`) | FastAPI, Uvicorn, pydantic-settings, pytest, HTTPX |
| `discovery` | Shapely, pyproj |
| `download` | Rasterio (raw TIFF validation) |
| `s3` | S3 client for the CDSE object-storage route |
| `preprocess` | Preprocessing Python dependencies (SNAP itself is installed separately) |
| `requirements-baseline.txt` | CPU-only baseline dependencies |
| `requirements-ml-cpu.txt` / `requirements-anvi.txt` | Optional CPU PyTorch / Anvi's full Windows environment |

Frontend: React, React DOM, Vite. Run `npm ci` once `web/package-lock.json` is committed.

## Data and scientific boundaries

- Satellite scenes are discovered from the real CDSE catalog; before/after geometry is validated and provenance recorded.
- Radar-unobservable terrain (layover, shadow, missing data) is kept distinct from non-flooded terrain.
- Use an approved pre-event historical OSM snapshot; do not hardcode one event's date.
- EMS/UNOSAT/published damage references are check-only in `evaluation/`. Never use them in discovery, preprocessing, training, or prediction.
- Split future model data by event and prevent evaluation-event leakage.
- Intersecting buildings, roads, and bridges are **potentially affected**, not confirmed destroyed. Road access outputs are analytical estimates.
- Reports are generated from computed metrics and provenance, with no invented values.
- The flood baseline output is a *candidate* mask with an uncalibrated evidence score, not a validated flood extent.

## Known limitations

- The pipeline is currently hard-wired to the Trishuli case (date `2026-08-26`, Trishuli-area AOI).
- Real-data verification of download, SNAP preprocessing, and the baseline is expected on Anvi's Windows laptop; treat these stages as unverified until their manifests say `status: complete` and their previews have been inspected.
- Sentinel-1 scenes are large; downloads and SNAP runs are slow and need significant disk and memory.
- No API endpoint triggers the pipeline yet.

## Team workflow

Anvi works mainly in satellite, flood, model, terrain, and evaluation modules; Arnav in infrastructure, connectivity, API, and web. Agree on shared output contracts before the next implementation step. Use small feature branches, run `python -m pytest` and (for frontend edits) `npm run build`. Both must work without downloading datasets. Never commit `.env`, tokens, raw scenes, caches, or checkpoints.
