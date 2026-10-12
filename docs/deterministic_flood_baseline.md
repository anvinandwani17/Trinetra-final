# Deterministic flood fallback — first Trishuli version

This CPU-only baseline consumes the existing verified Sentinel-1 pair. It does
not download data, train a model, or add OSM/frontend functionality. Outputs
are candidate newly inundated open-water areas, not confirmed flood damage.

## Windows instructions for Anvi

In PowerShell at the TRINETRA project root, with the existing virtual environment:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-baseline.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_flood_baseline.py -v
.\.venv\Scripts\python.exe scripts\run_flood_baseline.py
.\.venv\Scripts\python.exe scripts\check_flood_baseline.py
explorer .\data\processed\trishuli\baseline\previews
```

Stop if any command fails. Alternatively, after installing dependencies:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run_trishuli_baseline.ps1
```

The runner stops on failed tests, processing, or output validation. Python 3.11+
is supported. It needs NumPy, Rasterio, Matplotlib and SciPy; SciPy is the only
additional library beyond the preprocessing stack and supplies connected-region
cleanup and small-window filtering. No GPU, SNAP rerun, system GDAL install,
new DEM download or Copernicus credentials are needed for this stage. Existing
preprocessing GeoTIFFs and `intermediate/*/radiometry.verified.json` must remain
in place because they provide the recorded, checked elevation rasters.

## Reproducible rules

1. Require a complete Trishuli preprocessing manifest. Verify SHA-256, the
   common north-up EPSG:32645 20 m grid, VV/VH order, shadow/layover flags and
   unknown-pixel policy. Check post-minus-pre dB consistency.
2. Reuse the verified pre/post terrain-corrected elevation bands. Calculate
   Horn 3x3 slope using metric pixel spacing and take the larger slope from
   either date. Missing DEM neighborhoods or >20 m pre/post DEM disagreement
   remain unknown. Elevation is not used as an arbitrary absolute-height cutoff.
3. Apply a 3x3 mean to **linear power**, then convert back to dB. Both dates
   use the identical valid-neighbor mask. Require at least five valid neighbors;
   never fill an unknown center or use shadow samples in the mean.
4. Require all the following initial engineering defaults:

| Rule | Default |
| --- | --- |
| VV post-minus-pre | <= -3 dB |
| VH post-minus-pre | <= -2 dB |
| Filtered post-event VV | <= -15 dB |
| Filtered post-event VH | <= -22 dB |
| DEM-derived slope | <= 10 degrees |
| Reference low-backscatter exclusion | Before VV <= -17 **and** VH <= -24 dB |
| Minimum four-connected candidate region | 2,000 m2 = 5 pixels |

The single reference low-backscatter mask is a proxy for already-water-like
areas, not a validated permanent-water map. Thresholds have not been calibrated
against Trishuli ground truth. They can reject true floods as well as false
positives. Every chosen value is recorded in the manifest.

5. Remove small components. Do not fill holes, connect diagonal-only patches,
   or bridge excluded pixels. Steep/unsupported terrain stays unknown, rather
   than being relabeled dry. A valid zero-candidate result exports an empty
   FeatureCollection; it does not prove that no flood occurred.

## Evidence score

`evidence_score.tif` is a heuristic score in [0,1], **not a probability**.
Each of the four backscatter rules contributes
`clip(0.5 + margin_db / 6, 0, 1)`. Use the weakest contribution and multiply by
`clip(1 - slope/(2*max_slope), 0, 1)`. Already-low-reference pixels and rejected
small candidate components get zero. Unknown/unsupported pixels get NaN.
The final binary mask is determined by the rules, not a score threshold.

## Files

All baseline outputs are separate from raw and preprocessing files:
`data/processed/trishuli/baseline/`.

| File | Meaning |
| --- | --- |
| `flood_mask.tif` | UInt8: 1 candidate flood; 0 no candidate evidence; 255 unknown |
| `flood_candidates.geojson` | WGS84 polygons of candidate pixels only, area and mean evidence score |
| `evidence_score.tif` | Float score; NaN for unknown |
| `slope_deg.tif` | Reused DEM-derived slope in degrees |
| `reasons.tif` | UInt16 input/terrain/rule/cleanup flags; manifest includes legend |
| `filtered_before_db.tif`, `filtered_after_db.tif`, `filtered_change_db.tif` | VV/VH audit layers |
| `baseline_manifest.json` | Parameters, source hashes, output hashes, summary, limits, completion status |
| `previews/flood_mask.png` | Candidate flooding versus unknown |
| `previews/evidence_score.png` | Uncalibrated evidence score |
| `previews/slope_deg.png` | Terrain for manual review |

GeoJSON areas are computed from original metric pixels, not WGS84 square
degrees. The checker reprojects and rasterizes the polygons, requiring exact
agreement with the candidate raster, including holes. It also checks score
bounds/NaNs, candidate change/slope rules, minimum mapping area, all hashes and
PNG readability. Output status becomes `complete` only after these checks pass.

## Limits and validation status

This detects darkening associated with new open water. It may miss flooded
vegetation, urban double-bounce responses, narrow streams and steep valley
flooding. Wind, sediment, soil and agricultural changes can create false
positives. Spatial averaging and DEM thresholds also affect boundary accuracy.
Review the original SAR previews alongside candidate polygons.

The development workspace contains screenshots, not the real Trishuli
GeoTIFFs. Numerical unit tests use explicitly synthetic tiny fixtures. Raster
and vector integration tests are included and must pass on Anvi's installed
geospatial environment. No real Trishuli flood area or accuracy is claimed
until the Windows runner completes on the actual files. No synthetic baseline
preview is presented as a real flood map.

Primary methodological references (the numeric defaults above are our own):
- Copernicus/JRC review of Sentinel-1 flood change detection, limitations and
  exclusion layers: https://publications.jrc.ec.europa.eu/repository/bitstream/JRC119812/global_flood_monitoring.pdf
- Copernicus GFM workflow includes terrain slope and low-backscatter shadow
  exclusions: https://global-flood.emergency.copernicus.eu/media/events/3/2021_cems_gfm_final-min.pdf
