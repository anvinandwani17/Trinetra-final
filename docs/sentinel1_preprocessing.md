# Trishuli Sentinel-1 preprocessing: first physical version

This stage consumes the automatically selected, verified pair recorded in
`data/runs/trishuli/download_manifest.json`. It introduces no model, segmentation,
OSM analysis, API endpoint, or frontend feature. It does not invent imagery.

## What it does

For each date and both VV/VH polarizations, ESA SNAP executes:

1. Read the downloaded SAFE/COG_SAFE archive and preserve its SAR metadata.
2. Create a cached raw subset of the AOI with 20 km terrain context using only
   Read/Subset/Write. Retain original SAR metadata and subset pixel offsets.
   In this local DIMAP intermediate, restore the abstracted processor identifier
   from the original SAFE IPF version if SNAP instead reports the COGifier.
   Record both identifiers, metadata hashes and the untouched raw archive hash.
   Do not change raster samples, LUTs, original metadata, or raw archives.
3. Apply a precise orbit file; stop if orbit application fails.
4. Read the original IPF version from `manifest.safe`. For IPF below 2.90,
   run legacy GRD border-noise removal. For IPF 2.90 and newer, preserve the
   provider zero-valued no-data borders and exclude zeros from valid radiometry.
   Thermal-noise removal runs for both cases.
5. Calibrate to linear beta-nought (`Beta0_VV`, `Beta0_VH`).
6. Apply two range looks with approximately square ground pixels to reduce
   speckle before terrain correction. Actual effective resolution is not assumed.
7. Radiometric terrain flattening to gamma-nought using a DEM.
8. Range-Doppler terrain correction to UTM, 20 m output spacing, with no second
   radiometric normalization. Save elevation and local incidence angle too.

A separate branch runs SAR-Simulation from the calibrated/multilooked product
and saves its DEM/orbit-based layover-shadow mask. That mask is geocoded with
nearest-neighbour interpolation. It is not derived by thresholding dark SAR
pixels: dark water alone does not establish radar shadow.

SNAP can save this physical mask as `layover_shadow_mask`,
`layover_shadow_mask_VV`, or `layover_shadow_mask_VH`. TRINETRA accepts exactly
one of these explicit names and records it in `geometry_mask_bands` in the
processing report. It does not substitute a dark-pixel mask. Missing or
ambiguous geometry bands stop processing; unknown mask values remain unknown.

The Python stage creates one pixel-aligned grid in UTM zone 45N (`EPSG:32645`)
for the example Trishuli AOI. Bounds snap to multiples of 20 m. Both dates,
both polarizations, terrain masks, and outputs share the same CRS, transform,
shape, and extent. Linear gamma-nought is resampled before conversion to dB.
Risky source pixels are excluded before bilinear interpolation. A one-pixel
buffer around shadow/layover/unknown geometry makes the output conservative.

This is geometric alignment by DEM/orbit geocoding and common-grid resampling.
No empirically measured subpixel registration accuracy is claimed. Actual
before/after previews must be checked for residual misregistration.

## Windows prerequisites

Finish `scripts/run_case.py --transport s3` first. Its manifest must say
`status: complete`, with valid pre and post records. The runner checks product
IDs, byte counts, and SHA-256 against the raw files before processing them.
Metadata listing success alone is insufficient.

Install **ESA SNAP 14 with the Microwave Toolbox** from the
[official SNAP download page](https://step.esa.int/main/download/snap-download/).
The current Sentinel Toolboxes installer is approximately 1 GB. Install/update
its Microwave Toolbox modules. SNAP is a necessary SAR processing dependency,
not a Python package. Use its bundled Java runtime; no GPU/CUDA, Docker,
`esa_snappy`, or separate system GDAL installation is required.

Overlay the updated source archive on your existing TRINETRA folder. Preserve
your `.env`, `.venv`, and `data/` directories. Install Python dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev,discovery,download,s3,preprocess]"
```

Add the actual GPT executable location to your existing root `.env`:

```dotenv
SNAP_GPT="C:/Program Files/esa-snap/bin/gpt.exe"
```

Confirm that path exists; replace it if SNAP was installed elsewhere:

```powershell
Test-Path "C:\Program Files\esa-snap\bin\gpt.exe"
& "C:\Program Files\esa-snap\bin\gpt.exe" SAR-Simulation -h
```

The help must include `saveLayoverShadowMask`. The pipeline saves installed
operator help and stops if required operators/mask support are unavailable.
If a SNAP reader/calibration error occurs for COG_SAFE or Sentinel-1D, preserve
its log and update/check Microwave Toolbox support; do not rename products,
strip `_COG`, substitute TIFF values, or silently skip calibration.

## Run and tests

From the project root:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_s1_*.py" -v
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_preprocessing*.py" -v

.\.venv\Scripts\python.exe scripts\preprocess_case.py
.\.venv\Scripts\python.exe scripts\check_preprocessed_case.py
```

The first command exercises acquisition/downloads; the second exercises
preprocessing. All installed-library checks should run on the configured laptop.
The independent checker verifies the written file hashes, shared grid, actual
post-minus-pre values, unknown-pixel policy, terrain-mask contradictions, and
readability of all four PNG previews. Tests use tiny synthetic fixtures in temporary directories; they do not supply
real satellite results or prove SNAP execution succeeded.

Default GPT tile cache is 2048 MiB and two threads. For limited memory, use
`--cache-mb 1024 --threads 1`. At least 2 GiB free working disk space is checked;
SNAP/JVM and intermediate processing can require more than its tile cache.
Scenes and radiometry/mask branches run sequentially. Intermediate outputs
with matching graph/input/software signatures and file hashes are reused.
A CLI lock prevents concurrent writers. After a forced crash, remove the lock
only after confirming the old process stopped.

To inspect the graphs without running SNAP:

```powershell
.\.venv\Scripts\python.exe scripts\preprocess_case.py --prepare-only
```

This still requires verified raw files and Python geospatial packages. It only
reports `graphs_prepared_only`; it generates no previews and claims no physical
processing success.

## DEM and auxiliary data

Default DEM is SNAP's built-in **Copernicus 30m Global DEM**, auto-downloaded
and cached by SNAP. The buffered regional subset controls the terrain area
needed by the operators; no global imagery or DEM archive is requested. SNAP
also fetches required precise-orbit auxiliary files. These are necessary for
physical correction, distinct from downloading additional satellite scenes.

For an existing local DEM, use `--dem PATH --dem-nodata VALUE`. The external
GeoTIFF must be single-band, WGS84 geographic (`EPSG:4326`), height in meters
relative to the WGS84 ellipsoid, and cover the entire AOI plus 20 km context.
An unconverted Copernicus DEM (EGM2008 orthometric heights) is **not** suitable
for this external-ellipsoidal option; do not simply label it ellipsoidal.
External EGM correction is disabled to avoid applying a geoid correction twice.
Use the built-in option until datum-correct external DEM preparation is available.

The 20 m operational grid does not turn a 30 m DEM into 20 m terrain truth.
Masks are DEM-based estimates and cannot resolve every small ridge/building
shadow or guarantee flood detectability. Extreme relief and distant occluders
can require larger terrain context or a higher-quality DEM. Manual review of
terrain artifacts and registration is required before downstream flood analysis.

## Files produced after a successful real run

All final rasters are tiled, compressed GeoTIFFs with CRS, transform, nodata,
band descriptions, and overviews. They are reopened and their pixel values/grid
are checked after writing. They are ordinary GeoTIFFs, not certified COGs.

| Output in `data/processed/trishuli/` | Meaning |
|---|---|
| `before_gamma0_db.tif` | Two bands: pre-event VV and VH, terrain-flattened gamma-nought in dB |
| `after_gamma0_db.tif` | Same bands/grid for post-event |
| `change_db.tif` | Two bands: **post dB minus pre dB**; negative = decreased backscatter |
| `observability.tif` | `1` jointly usable, `0` unknown/unobservable, `255` outside AOI |
| `quality_reasons.tif` | UInt16 bit flags identifying why a pixel is unknown |
| `pre_layover_shadow.tif` | Pre DEM mask: 0 none predicted, 1 layover, 2 shadow, 3 both, 255 unknown/outside |
| `post_layover_shadow.tif` | Same for post |
| `processing_manifest.json` | Provenance, checks, observable fraction, output paths/hashes and completion status |
| `previews/before.png` | VV/VH side-by-side, fixed -30..0 dB display |
| `previews/after.png` | Same shared limits |
| `previews/change.png` | VV/VH change, fixed -10..10 dB diverging display |
| `previews/observability.png` | Green usable, orange predicted shadow/layover, gray other unknown, white outside |
| `intermediate/pre/`, `intermediate/post/` | SNAP graphs, logs, calibrated/terrain-corrected DIMAP outputs and cache markers |
| `snap_operator_help.txt` | Installed operator capabilities used for execution |

Both radiometry dates and change are NaN wherever the pair is unobservable.
Zero is a valid *change* for unchanged observable pixels; it is never substituted
for unknown data. No output is a dry/flood prediction.

Quality bits are combinable:
1 pre missing radiometry, 2 post missing radiometry, 4 pre layover, 8 post layover,
16 pre shadow, 32 post shadow, 64 unknown geometry/DEM/incidence, 128 outside AOI,
256 one-pixel terrain risk buffer. Nearest-neighbour resampling preserves
categorical values; unknown source codes remain unknown.

Only `status: complete` establishes that the actual run and output checks passed.
A failed run can leave intermediates or older TIFFs: do not interpret their
existence as evidence of a completed current run. A wholly unobservable AOI
stops with an error; it is never reported as dry.

## Validation status of this delivery

Numerical/graph/identity tests run in the authoring workspace. Rasterio/pyproj/
Shapely tests require the installed laptop packages. No downloaded Trishuli
archives, download manifest, or ESA SNAP executable are present in the authoring
workspace, so real Trishuli calibration, geocoding, mask correctness, and PNG
previews are **not yet verified**. No synthetic PNGs are supplied as case results.
Run the commands above locally and review the actual four previews and manifest.

## Official references

- [SNAP terrain flattening: beta-nought input, gamma-nought output](https://step.esa.int/main/wp-content/help/versions/14.0.0/snap-toolboxes/eu.esa.microwavetbx.sar.op.sar.processing.ui/operators/TerrainFlatteningOp.html)
- [SNAP SAR simulation and DEM requirements](https://step.esa.int/main/wp-content/help/versions/14.0.0/snap-toolboxes/eu.esa.microwavetbx.sar.op.sar.processing.ui/operators/SARSimulationOp.html)
- [SNAP layover/shadow coding](https://step.esa.int/main/wp-content/help/versions/14.0.0/snap-toolboxes/eu.esa.microwavetbx.sar.op.sar.processing.ui/operators/SARSimTerrainCorrectionOp.html)
- [Official Copernicus COG_SAFE representation](https://documentation.dataspace.copernicus.eu/Data/Others/Sentinel1_COG.html)

## Metadata-aware border operator fix

The real laptop log reported `noiseVectorListElem is null` inside
`RemoveGRDBorderNoiseOp`. Border handling now uses the original Sentinel-1 IPF
software version from each raw SAFE manifest, including COG_SAFE products.
Missing, malformed, or conflicting versions stop processing. The COG conversion
software version is not substituted for IPF. The policy is saved in the processing
manifest and printed for each date. Updated graphs are generated automatically;
raw downloads and their verification manifest are unchanged.

ESA [MPC-0243 v2.2](https://sentinels.copernicus.eu/documents/247904/2142675/S-1-IPF-Sentinel-1-products-Release-Note.pdf),
section 4, states that IPF 2.90 and higher supplies zero-valued border no-data
pixels and needs no specific border denoising. Thermal-noise removal, beta0
calibration, terrain flattening, terrain correction, and geometry masks remain
enabled. This fixes the graph policy; it is not a claim that later physical
processing steps have already succeeded on Trishuli.
# ENVI header and calibration diagnostics

SNAP BEAM-DIMAP can reference `.hdr` files. TRINETRA resolves these to the
companion `.img` raster, checks that it exists inside the processing directory,
and lets Rasterio read its header automatically. Keep both files together.

If SNAP warns that its calibration LUT could be incorrect, TRINETRA stops
without certifying the radiometry, including when older cached outputs exist.
The observed Trishuli DIMAP field is `CloudFerro Sentinel-1 COGifier 001.00`,
while the original SAFE manifest reports IPF `004.03`. The compatibility stage
restores only the abstracted field before any calibration/noise removal. It
accepts only the observed COGifier naming pattern or a matching Sentinel IPF
identifier; unknown processors fail. Both final branches must retain the
restored identifier and produce no unreliable-LUT warning. Previously generated
results are rerun using the new source and signature; changing an already
calibrated output's label is not a fix.

The workaround has unit tests but still requires a real SNAP run on the laptop.
An absent warning alone does not establish scientific validity; complete the
output checker and manually inspect all previews before using the results.

Published implementation references:
- https://github.com/senbox-org/s1tbx/blob/master/s1tbx-op-calibration/src/main/java/org/esa/s1tbx/calibration/gpf/calibrators/Sentinel1Calibrator.java
- https://github.com/senbox-org/s1tbx/blob/master/s1tbx-op-calibration/src/main/java/org/esa/s1tbx/calibration/gpf/Sentinel1RemoveThermalNoiseOp.java

These archived implementations show the version-field check and retention/use
of subset offsets. Installed SNAP 14 behavior is verified by the run-time gates,
not inferred solely from archived source.

Inspect the existing output without running SNAP again:

```powershell
.\.venv\Scripts\python.exe scripts\inspect_snap_metadata.py
```

The command prints processing identifiers only. Send that console output for
investigation. Existing downloaded scenes and intermediate files stay in place.

