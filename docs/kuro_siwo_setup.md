# Kuro Siwo setup — data only, no model training

## Selected release and subset

Use the authors' **labeled GRD** WebDataset release:
https://huggingface.co/datasets/orion-ai-lab/Kuro-Siwo-Webdataset
at revision `e8e61b7b1254b04bfa2b5e26d43db90cb86b5004`.
The GitHub revision and metadata hashes are saved in
`data/kuro_siwo/metadata/source_snapshot.json`.

Do not download SLC, unlabeled data, full event GeoTIFFs, pretrained weights or
whole tar shards for this loading test. The first train shard alone reports
10,914,969,600 bytes. Only an 8 MiB HTTP range was fetched here; two complete
real samples were extracted and validated. The remaining prefix is a temporary
cache, not a complete tar file. Samples have 224x224 pixels at the source 10 m
grid. No interpolation, augmentation or normalization fitting is performed.

## Verified inventory and event-level partition

The authors' complete GRD metadata index
`pickle/KuroV2_grid_dict_test_0_100.gz` contains 67,490 samples from 43 events.
Its name does not mean every record belongs to the test partition: it is an
all-water-percentage metadata index. The smaller training pickle filters out
some dry examples and is not used as the complete inventory here.

We use the assignments in the authors' `configs/train/data_config.json`,
grouping on `info.actid`. Every AOI, capture and patch with that event ID goes
to one partition. No random patch split is used.

| Partition | Events with released data | Indexed samples | Currently downloaded |
| --- | ---: | ---: | ---: |
| Train | 27 | 48,768 | 2 from event 470 |
| Validation | 6 | 2,826 | 0 |
| Test | 10 | 15,896 | 0 |
| Total | 43 | 67,490 | 2 |

The config also lists validation event 514, but that event is absent from the
actual GRD release index. This is recorded as a configured empty event and
does not contribute fabricated samples or a seventh nonempty validation event.
Assignments and per-sample rows are in `splits/events.json`, `train.jsonl`,
`validation.jsonl` and `test.jsonl`. Checksums, duplicate IDs and event overlap
are checked before loading. These are full-release **metadata** counts, not
downloads and not claimed training-set readiness for all samples.

## Source fields and loader inputs

Each source sample has post-event VV/VH, two pre-event VV/VH pairs, DEM, labels,
validity and JSON metadata. Each `.npy` array is float32 `[1,224,224]`.

For our first pair-based model input, the loader selects the nearest capture
strictly before the recorded flood date, and validates the post date. It returns:

| Field | One sample | One demonstrated batch |
| --- | --- | --- |
| `sar_linear` | `[4,224,224]` float32 | `[2,4,224,224]` |
| `dem_m` | `[1,224,224]` float32 | `[2,1,224,224]` |
| `labels` | `[224,224]` int64 | `[2,224,224]` |
| `flood_target` | `[224,224]` int64 | `[2,224,224]` |
| `valid_mask` | `[224,224]` bool | `[2,224,224]` |

SAR channel order is pre-VV, pre-VH, post-VV, post-VH. DEM is a separate meter
channel: four SAR plus one terrain feature if later concatenated. The original
second reference is retained in the cache but not fed to this first pair-based
input. Source label 0=no water, 1=permanent water, 2=flood. Invalid pixels use
ignore value **255**, including any original invalid label 3, source validity
zero, nonfinite/nonpositive selected SAR or missing DEM. Zero-filled input
values at these pixels are only tensor placeholders; the valid mask and ignored
labels must be used during any future loss calculation.

The binary target is 1 only for new flood class 2, 0 for valid no-water or
permanent-water classes, and 255 for ignored pixels. The original three-class
labels are preserved. No-water is not confused with permanent water.

## Exact local smoke test

The delivered snapshot contains the two real sample directories and split
indices, so no new data download is required. From TRINETRA on Windows:

```powershell
.\.venv\Scripts\python.exe scripts\prepare_kuro_siwo.py
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_kuro_siwo.py -v
.\.venv\Scripts\python.exe scripts\smoke_kuro_siwo.py --engine torch
```

PyTorch is already part of the earlier ML environment setup. This command uses
one CPU DataLoader batch with `num_workers=0`, not a GPU or training loop. If
Torch is unavailable, `--engine numpy` verifies the same real arrays without
installing a large dependency. No new GDAL or geospatial dependencies are needed
for `.npy` loading.

The NumPy test executed here loaded event IDs `[470,470]`, 100,352 valid pixels,
77,603 no-water labels and 22,749 flood labels. No permanent-water pixels occur
in these two specific samples; the loader supports that class. Torch was not
installed in this runtime, so the CPU Torch DataLoader check remains to be run
on Anvi's existing environment. The report explicitly records the engine.

If the tiny sample files were removed, optionally run
`scripts/prepare_kuro_siwo.py --download-smoke`. This fetches at most 8 MiB from
the pinned official shard and only retains two complete samples. Rerunning with
valid cached samples skips the download. A Hugging Face account/token is not
required for this public source.

## Domain compatibility before future training

Kuro Siwo's prepared GRD inputs and our operational terrain-flattened Gamma0
at 20 m are different representations. A successful loading test does **not**
establish that a trained model can be applied directly to Trishuli. Before
training/inference, choose consistent radiometry, resolution and normalization,
fit any statistics on training events only, and evaluate that choice on held-out
events. No such fit or model run is performed in this stage.

The current data card identifies the distributed dataset as CC BY 4.0. Keep the
paper citation and authors' data-source attribution. Source references:
- https://github.com/Orion-AI-Lab/KuroSiwo
- https://arxiv.org/html/2311.12056v3
- https://huggingface.co/datasets/orion-ai-lab/Kuro-Siwo-Webdataset/blob/main/README.md
