# TRINETRA

**Satellite evidence for flood-response triage** · Multimodal AI Hackathon 2026 · Track B · Anvi Nandwani + Arnav

> A responder should be able to see both the evidence and the places the system cannot assess.

After a mountain disaster, a map of suspected inundation is only useful if responders can connect it to mapped infrastructure and understand its uncertainty. Radar geometry, steep terrain, incomplete roads and delayed acquisitions can otherwise turn an attractive map into misleading certainty.

TRINETRA takes a bounded area and an event date and produces **candidate flood evidence**, the **mapped infrastructure it potentially affects**, **conditional access analysis**, an **interactive map**, and an **exportable situation report**. Terrain the system cannot assess is shown as **unknown**, never as dry.

> **Educational prototype. Not an operational emergency-response product.** All outputs are candidate evidence. Field verification is required.

---

## What it does

| Stage | Method | Output |
| --- | --- | --- |
| 1. Acquire and process | Select a compatible Sentinel-1 pre/post pair from the CDSE catalog, download and verify raw scenes, process with ESA SNAP | Terrain-flattened gamma-nought, change, observability and layover/shadow masks, with scene IDs, orbit and hashes recorded |
| 2. Detect candidates | **Deterministic baseline** from physical SAR products; **experimental Siamese U-Net** on a separate 10 m linear Sigma0 branch | Candidate flood masks and uncalibrated evidence scores |
| 3. Respect observability | Invalid, unsupported or rejected terrain is retained as unknown. AI output never turns physically unknown terrain into supported evidence | Observability layer |
| 4. Optional HAND screen | Provisional height-above-nearest-drainage screening constrains candidates (not a water-depth model) | Screened candidates |
| 5. Assess exposure | Intersect candidates with **historical** OpenStreetMap roads, bridges and buildings; model conditional connectivity to mapped medical facilities | Potentially affected features, settlement and facility access (conditional) |
| 6. Explain and export | Map layers, dates, warnings and coverage | GeoJSON, `summary.json`, `provenance.json`, situation report, results ZIP |

---

## Verified results (read these limits first)

### Integrated demo: saved Trishuli case
Event 26 Aug 2026; Sentinel-1 observations 16–28 Aug 2026; method: pilot experimental AI + HAND; 10 m grid.

| Measure | Value |
| --- | --- |
| Candidate flood evidence | 0.6702 km² (6,702 AOI-clipped pixels) |
| Assessable area fraction | 6.464 % |
| Unknown / unsupported area | 102.0056 km² |
| Candidate-intersecting roads / bridges / buildings | 26 / 5 / 84 |
| Mapped settlements / with unknown road access | 12 / 12 |
| Medical facilities monitored | 6 |
| Historical OSM snapshot requested | 25 Aug 2026 |

HAND reduced AI candidates on the saved full raster from 27,868 to 6,719 (6,702 after clipping), and candidates on slopes ≥ 30° from 16,765 to 125. These are **changes in output composition, not accuracy**: no label-based study shows the removed pixels are all false positives or the retained ones true floods.

### Model evaluation (small held-out sample)
Two frozen checkpoints were compared on the **same 13 locally cached test patches from 6 events** (threshold fixed at 0.5, no threshold tuning).

| Held-out measure | Pilot | New candidate |
| --- | --- | --- |
| Pixel IoU | 18.87 % | 25.05 % |
| Pixel F1 | 31.75 % | 40.07 % |
| Precision / recall | 21.62 % / 59.75 % | 29.29 % / 63.37 % |
| Macro-event IoU | 10.92 % | 12.40 % |
| False-positive pixels | 21,144 | 14,932 |

This supports further evaluation, **not** a claim of general accuracy or operational readiness. Performance is weak and uneven across events. The sample is 13 of 15,896 recorded test patches (0.08 %), covers 6 of 10 test events, is not the full BlackBench benchmark, and does not validate Nepal. Candidate validation IoU (60.48 %) is not independent test performance, as those 12 validation patches also selected epoch 3.

### Submission boundary
- The **verified dashboard uses the existing pilot outputs**. The new candidate checkpoint was trained and evaluated separately; its integration into the cached demo has **not** been verified.
- **EMSR927 reference comparison is incomplete.** The supplied Bidur labels represent mass-movement / landslide context and must not be treated as water-flood truth. EMSR927 agreement and Himalayan damage-detection accuracy cannot be claimed.
- A saved baseline-vs-AI agreement raster compares two detectors (candidate agreement IoU 0.1023 over 124,492 jointly assessable pixels). It does not compare either detector against a reference map.

---

## Quick start: run the app

### Prerequisites
- Git
- Python 3.11 or 3.12 with `pip` and `venv`
- Node.js 22.12+ and `npm`
- For the full pipeline from raw data: a free [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu) account and [ESA SNAP 14 with the Microwave Toolbox](https://step.esa.int/main/download/snap-download/) (Windows commands below)

### 1. Backend (FastAPI, port 8000)
```bash
git clone https://github.com/anvinandwani17/Trinetra-final.git
cd Trinetra-final
python -m venv .venv
```
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
```bash
python -m pip install -r requirements.txt
python -m pytest
python -m uvicorn trinetra.api.main:app --reload --host 127.0.0.1 --port 8000
```
- Health check: <http://127.0.0.1:8000/api/v1/health> → `{"status":"ok","service":"TRINETRA","version":"0.1.0"}`
- API docs: <http://127.0.0.1:8000/docs>

The health check only confirms the API process is up. It does not verify satellite access, credentials, model availability or case assets.

### 2. Frontend (React/TypeScript + MapLibre + Vite)
In a second terminal:
```bash
cd web
npm install
npm run dev
```
Open the URL Vite prints (configured port; <http://127.0.0.1:5173> by default). Vite proxies `/api` to port 8000. `npm run build` creates a static build in `web/dist/`.

### 3. Inspect the saved Trishuli case
1. Configure local credentials and case assets (see *Delivery scope* below).
2. Load the **saved Trishuli case**.
3. Choose the **verified method** (pilot AI + HAND).
4. Keep **scene downloads unchecked**, so the cached case runs without silently acquiring replacement scenes.
5. Inspect acquisition dates, unknown terrain, the situation report and the results ZIP.

Downloads are always explicit. A bounded area and event date define each request, and cached cases never trigger new acquisitions on their own.

---

## Running the pipeline from raw Sentinel-1 data (Windows)

Commands run from the repo root in PowerShell, using the project venv explicitly.

### 0. Configure `.env` (never commit it)
```
CDSE_USERNAME=your_registered_email
CDSE_PASSWORD=your_password
CDSE_S3_ACCESS_KEY=your_access_key        # only for --transport s3
CDSE_S3_SECRET_KEY=your_secret_key        # keys from https://eodata-s3keysmanager.dataspace.copernicus.eu
SNAP_GPT="C:/Program Files/esa-snap/bin/gpt.exe"
```

### 1. Install extras and verify SNAP
```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev,discovery,download,s3,preprocess]"
Test-Path "C:\Program Files\esa-snap\bin\gpt.exe"
& "C:\Program Files\esa-snap\bin\gpt.exe" SAR-Simulation -h    # must list saveLayoverShadowMask
```

### 2. Discover the pre/post pair (optional; step 3 does it automatically)
```powershell
.\.venv\Scripts\python.exe -m trinetra.discovery --aoi examples\trishuli_aoi.geojson --date 2026-08-26 --refresh --output data\runs\trishuli\s1_pair.json
```
Pairs must share relative orbit and direction and cover at least 99 % of the AOI. Event-day scenes are excluded. See [`docs/sentinel1_discovery.md`](docs/sentinel1_discovery.md).

### 3. Download and verify raw scenes
```powershell
.\.venv\Scripts\python.exe scripts\run_case.py --aoi examples\trishuli.geojson --date 2026-08-26
```

| Option | Use when |
| --- | --- |
| `--transport s3` | The OData archive service keeps returning HTTP 502 (uses the official CDSE S3 route) |
| `--two-factor` | Your CDSE account has 2FA |
| `--restart-partial` | A partial download cannot be resumed (discards incomplete files only) |
| `--max-product-gib N` | Raise the per-scene cap (default 3 GiB, max 6) |

A successful run writes `data/runs/trishuli/download_manifest.json` with `status: complete`. Each scene can exceed 1 GB. See [`docs/trishuli_download.md`](docs/trishuli_download.md).

### 4. Preprocess with ESA SNAP and check
```powershell
.\.venv\Scripts\python.exe scripts\preprocess_case.py
.\.venv\Scripts\python.exe scripts\check_preprocessed_case.py
```
Outputs land in `data/processed/trishuli/` (before/after gamma-nought in dB, change, observability, quality flags, layover/shadow masks, manifest, PNG previews). Inspect the previews before continuing. See [`docs/sentinel1_preprocessing.md`](docs/sentinel1_preprocessing.md).

### 5. Deterministic flood baseline and check
```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-baseline.txt
.\.venv\Scripts\python.exe scripts\run_flood_baseline.py
.\.venv\Scripts\python.exe scripts\check_flood_baseline.py
```
CPU-only. Combines VV/VH darkening, DEM slope, observability and small-region cleanup, with unknown pixels kept unknown. Outputs go to `data/processed/trishuli/baseline/`. See `docs/deterministic_flood_baseline.md`.

### Where files go
```
data/
  cache/s1_metadata/            discovery cache
  raw/sentinel1/<UUID>/         raw SAFE archives + metadata
  runs/trishuli/                s1_pair.json, download_manifest.json
  processed/trishuli/           preprocessed rasters, previews, manifest
  processed/trishuli/baseline/  baseline flood outputs
artifacts/                      model checkpoints and exported reports
```
`data/` and `artifacts/` are ignored by Git.

---

## Experimental AI model

A Siamese U-Net takes pre-event VV/VH and post-event VV/VH.

- **Input:** linear backscatter converted to dB, clipped to [−35, 5], scaled with fixed parameters (fixed four-channel transform). DEM is **not** a model input.
- **Training:** masked BCE + soft Dice, AdamW (lr 0.001), batch size 8, base channels 16, seed 17. Decision threshold fixed at 0.5. Training stopped after epoch 8; the candidate checkpoint was selected on validation macro-event IoU (epoch 3).
- **Data:** Kuro Siwo (Webdataset, pinned revision `e8e61b7b1254b04bfa2b5e26d43db90cb86b5004`). Candidate: 173 training patches / 27 events; 12 validation patches / 6 events.
- **Split integrity:** samples follow the pinned author RandomEvents event assignments. The physical webdataset folder partition differs and does not override the recorded event split. Checks preserve held-out samples, source revisions, field hashes and event membership. The date guard admits recorded 2014 pre-event acquisitions for 2015 floods while keeping flood-event dates within 2015–2022.
- **Checkpoint hashes (SHA-256):**
  - Candidate: `3c53d37694310e4e73d0c1aa5e5f49d48382aa485247946bce54a9ed8f4a67f3`
  - Pilot: `02b9cfccc7f3a5f0953b69db4623738dfbe52beec93a4aab562e6f95f8562214`

---

## Limitations

| Limitation | Consequence |
| --- | --- |
| Temporal latency | Satellite passes and processing happen after observations. TRINETRA cannot warn of a sudden glacier collapse or provide continuous monitoring. In the Trishuli case the post-event scene is two days after the event. |
| Mountain geometry and domain shift | Layover, shadow, steep terrain and different processing domains restrict coverage (only 6.464 % of the Trishuli AOI is assessable by the selected method). Neither Kuro Siwo scores nor HAND reductions validate Himalayan accuracy. |
| Uncertain hazard class | No verified debris, landslide or glacier-collapse classifier. Sentinel-2 optical confirmation is not implemented. |
| Infrastructure and routing | OSM may be incomplete or stale (1,335 road features have unknown exposure). Medical-facility connectivity is a bounded graph proxy. No safe route, helicopter landing zone or confirmed structural damage is certified. |
| Calibration | Scores are not calibrated probabilities. HAND settings are provisional. |
| Small evaluation | Only 13 test patches. Full-event evaluation and baseline/AI/HAND accuracy comparisons remain pending. |
| Reference assessment | EMSR927 comparison incomplete (see above). |
| Delivery scope | The candidate model is separate from the verified cached demo. A source clone alone is insufficient to reproduce the saved case. |

Intersections with candidate flood evidence **prioritize inspection**; they do not confirm damage. Conditional graph access does not establish safe passage or complete isolation.

---

## Delivery scope

Public delivery of the large case assets (the saved Trishuli case, results ZIP and model checkpoints) is unresolved. A clone of this repository contains the code, tests, docs and example AOIs, but **not** the saved case data or large artifacts. To run the saved case you need to obtain these separately and place them locally, as described in the integration setup, and configure local credentials. Latest observed backend/training-fix commit: `792e994`. A later CSS polish build passed but its commit was not confirmed.

---

## Repository layout

| Location | Purpose |
| --- | --- |
| `src/trinetra/discovery/` | Catalog queries and before/after pair selection |
| `src/trinetra/downloads/` | Authenticated raw SAFE storage, resume, validation |
| `src/trinetra/preprocessing/` | SNAP-based SAR preparation and common raster grid |
| `src/trinetra/flood_detection/` | Deterministic baseline, model fusion, masks, uncertainty |
| `src/trinetra/models/` | Siamese U-Net architecture, training, inference |
| `src/trinetra/terrain/` | DEM, slope, radar observability, HAND screening |
| `src/trinetra/infrastructure/` | Historical OSM roads, bridges, buildings exposure |
| `src/trinetra/connectivity/` | Conditional access to settlements and medical facilities |
| `src/trinetra/reporting/` | Situation report and provenance export |
| `src/trinetra/evaluation/` | Held-out metrics; reference data is check-only |
| `src/trinetra/api/` | FastAPI routes |
| `src/trinetra/core/` | Shared configuration |
| `scripts/` | CLI entry points: `run_case.py`, `preprocess_case.py`, `check_preprocessed_case.py`, `run_flood_baseline.py`, `check_flood_baseline.py`, `inspect_snap_metadata.py` |
| `web/` | React/TypeScript frontend with MapLibre map |
| `tests/` | Offline tests (no dataset downloads needed) |
| `examples/` | Example AOI GeoJSON files |
| `notebooks/` | Experiments; reusable code belongs in `src/` |
| `docs/` | Per-stage guides and architecture ([architecture](docs/architecture.md)) |

Single repository, one installable Python package, one FastAPI process, one React app. Local files only: no database, queue, Docker or paid service.

**Tech stack:** Python/FastAPI, PyTorch, ESA SNAP, React/TypeScript, MapLibre, Vite.

---

## Scientific and data rules

- Discover real satellite acquisitions for user-selected areas and dates; validate before/after geometry and record provenance.
- Keep radar-unobservable terrain distinct from non-flooded terrain.
- Use an approved **pre-event historical** OSM snapshot; do not substitute present-day OSM. Basemap tiles are current context, not the historical analysis snapshot.
- Keep EMS/UNOSAT/published damage references **check-only** in `evaluation/`. Never use them in discovery, preprocessing, training or prediction.
- Split model data by event and prevent evaluation-event leakage.
- Describe intersecting features as **potentially affected**, never confirmed destroyed.
- Generate reports from computed metrics and provenance, with no invented values.
- Never commit secrets, `.env`, tokens, raw scenes, caches or checkpoints. Any `VITE_*` variable is public browser configuration.

## Team workflow

Anvi works mainly on satellite, flood, model, terrain and evaluation modules; Arnav on infrastructure, connectivity, API and web. Use small feature branches. Run `python -m pytest` and, for frontend changes, `npm run build`. Both must work without downloading datasets.

---

## License and attributions

Project code is **MIT-licensed**. Third-party data retain their own licenses.

- **Sentinel-1:** Contains Copernicus Sentinel data (2026), accessed through the [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu).
- **Terrain:** Copernicus DEM. Retain the source DEM product attribution and redistribution terms.
- **Infrastructure and basemap:** © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Historical extracts via HeiGIT [ohsome](https://ohsome.org/copyrights).
- **Reference maps:** Copernicus Emergency Management Service, activation [EMSR927](https://mapping.emergency.copernicus.eu/activations/EMSR927/). Reference products retain original EU/Copernicus credits.
- **Training data:** Bountos, N. I., Sdraka, M., Zavras, A., Karasante, I., Karavias, A., Herekakis, T., Thanasou, A., Michail, D., and Papoutsis, I. (2024). *Kuro Siwo: 33 billion m² under the water. A global multi-temporal satellite dataset for rapid flood mapping.* NeurIPS 37, 38105–38121. DOI: 10.52202/079017-1204.
- **Dataset:** [Kuro-Siwo-Webdataset](https://huggingface.co/datasets/orion-ai-lab/Kuro-Siwo-Webdataset), Orion AI Lab, CC BY 4.0.
