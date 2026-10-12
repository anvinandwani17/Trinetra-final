# Compare AI and deterministic candidates

Extract this patch into the TRINETRA root and run in the existing virtual environment:

```powershell
python scripts/compare_flood_outputs.py
```

Uses only already installed NumPy, Rasterio, Affine and Matplotlib. No downloads, GPU, training or threshold changes.

Requires completed `data/processed/trishuli/ai_flood_experimental/inference_manifest.json` and `data/processed/trishuli/baseline/baseline_manifest.json`, and their checksum-matching masks. The script resamples the baseline mask with nearest neighbour to the existing 10m AI grid. This preserves its original 20m information; it does not improve baseline resolution.

Outputs under `data/processed/trishuli/comparison/`: comparison.png (three panels), agreement.tif (georeferenced classes), comparison_report.json (counts and areas). Neither source mask is modified.

Agreement panel legend: purple = both candidates, blue = AI only, orange = baseline only, light grey = neither candidate, dark grey = excluded. Excluded means one or both methods cannot assess the pixel, including outside AOI. Unknown pixels never count as negatives. 'Neither candidate' is not proof of dry land.

Candidate-agreement IoU is intersection / union on jointly assessable pixels only. It measures agreement, not accuracy; the baseline is not ground truth. Empty candidate union produces null rather than an invented perfect agreement. Low common support must be reported alongside the score.

Next accuracy evaluation needs an independent flood reference with compatible spatial support, acquisition time, and mapped coverage. Official EMSR927 data can be used only for held-out evaluation if its actual metadata match this case. Do not interpret unmapped reference areas as dry, or use the reference to fit the model or tune thresholds. No reference download or accuracy evaluation occurs in this command.

Tests here use temporary synthetic masks to check unknown exclusion, categories, 20m-to-10m resampling and GeoTIFF readback. Real comparison runs on your laptop.
