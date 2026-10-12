# Experimental Trishuli Sigma0 branch

Extract this patch into the TRINETRA repository root. It adds a separate command and does not replace the existing SNAP, preprocessing, or deterministic flood detector modules.

With the existing Windows virtual environment active, run:

```powershell
python scripts/preprocess_ai_sigma0.py --prepare-only
```

Expected status: `graphs_prepared_only`. No SNAP computation runs in this mode. The command requires the completed `data/processed/trishuli/processing_manifest.json`, existing `intermediate/pre/radiometry.graph.xml` and post equivalent, and their prepared source files at their recorded paths.

After this succeeds, processing is available with:

```powershell
python scripts/preprocess_ai_sigma0.py
```

Run only one instance at a time. SNAP uses its existing cache and orbit/DEM mechanisms, which can fetch missing auxiliary files. No new satellite products or training datasets are requested. Verified intermediate products are reused by the existing SNAP runner.

New outputs: `data/processed/trishuli/ai_sigma0_10m/before_sigma0_linear.tif`, `after_sigma0_linear.tif`, `observability.tif`, `ai_processing_manifest.json`. VV is band 1, VH is band 2. Unknown pixels are NaN in the float rasters; observability uses 1=observable, 0=unknown, 255=outside AOI.

This branch uses linear Sigma0, Lee Sigma (7x7 estimation window, 3x3 target, sigma 0.9), terrain correction, and a shared 10 m UTM grid. It retains the completed pipeline's Copernicus DEM and inherits its conservative 20 m geometry mask through nearest-neighbor resampling. The mask gains no new spatial accuracy. The published Kuro Siwo graph uses SRTM and a different projection; matching selected settings does not verify model compatibility or accuracy. S1D also differs from training sensors.

No neural inference, training, threshold tuning, or flood classification occurs. Existing 20 m Gamma0 outputs remain the deterministic baseline inputs.

Tested here: graph rewiring and synthetic geospatial roundtrip/mask checks. Actual Trishuli SNAP execution requires the Windows source files and executable and has not been run here.

Reference: https://github.com/Orion-AI-Lab/KuroSiwo/blob/4347ed173c4e48f5a9d578bb5fe8453706b08e5e/configs/grd_preprocessing.xml
