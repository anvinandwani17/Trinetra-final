# Experimental frozen-model inference

Extract the patch into your existing TRINETRA project root. Keep the Windows virtual environment active.

```powershell
python scripts/infer_trishuli.py
```

Required existing files:
- `artifacts/models/siamese_v1/pilot/best.pt` and `run_config.json` (your own trained checkpoint)
- completed `data/processed/trishuli/ai_sigma0_10m/ai_processing_manifest.json` and its checksum-matching rasters
- the existing `src/trinetra/preprocessing/ai_sigma0.py` module

Uses already installed PyTorch, NumPy, Rasterio, Affine, Matplotlib. No SNAP, GPU, downloads, or training is needed for inference.

The checkpoint schema, transform, fixed 0.5 threshold, event disjointness and holdout declarations are checked. Input order: pre VV, pre VH, post VV, post VH. Positive linear Sigma0 is converted once to dB, clipped to [-35,5], then scaled with `(dB+15)/20`, exactly as the saved training transform declares. Invalid/unknown inputs are zero in the model input and excluded from the saved prediction outputs.

Inference runs on CPU with 224x224 tiles, stride 112, and arithmetic averaging of overlapping sigmoid scores. Model scores are uncalibrated, not validated flood probabilities. A fixed threshold of 0.5 generates candidate pixels. There is no Trishuli/EMSR927 training, threshold fitting, terrain-based threshold tuning, or additional morphological filtering.

Outputs, kept separate from the deterministic baseline, are under `data/processed/trishuli/ai_flood_experimental/`:
- `flood_score.tif`: float model score, NaN where unknown or outside AOI
- `flood_candidates.tif`: 1=candidate, 0=below threshold in observable area, 255=unknown/outside. A 0 is a model decision, not proof of dry land.
- `flood_candidates.geojson`: candidate polygons, longitude/latitude EPSG:4326
- `preview.png`: model scores and candidate mask; grey unknown, white outside AOI
- `inference_manifest.json`: checkpoint and input hashes, fixed settings, counts, output hashes, limitations

Only run one instance at a time. Valid completed outputs are reused after checksum checks. Inputs, checkpoint, preprocessing and deterministic baseline outputs are not modified. Future flooding conclusions require separate reference evaluation and manual inspection; preprocessing differences and pilot-training limitations remain.

Tests used temporary synthetic fixtures to verify normalization, irregular tile-edge coverage, unknown-pixel preservation, geospatial output readback, checkpoint loading and caching. No fixture is delivered as a Trishuli prediction. The real trained checkpoint and real Trishuli files must be run on your laptop.
