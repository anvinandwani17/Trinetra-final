# Sentinel-1 before/after acquisition discovery

Implemented entry point:

```python
from trinetra.discovery import select_s1_pair
pair = select_s1_pair(aoi, "2026-08-26")
print(pair.to_dict())
```

No manually selected product IDs are accepted by this function. It queries real
Copernicus Data Space STAC metadata and returns an `S1Pair` or fails explicitly.
The CLI is available as `python -m trinetra.discovery` or `trinetra-discover-s1`.
No API routes, frontend features, OSM, training, or flood segmentation were added.

## Source and dependencies

Official source: <https://stac.dataspace.copernicus.eu/v1/search>.
Collection: `sentinel-1-grd`. Search uses the documented `product:type`,
`sar:instrument_mode`, `sat:relative_orbit`, `sat:orbit_state`, `platform`,
`sar:polarizations`, acquisition timestamps, and product geometry.

Public catalog metadata is queried without credentials. `CDSE_USERNAME` and
`CDSE_PASSWORD` remain reserved for future authenticated downloads; they are not
sent, printed, or cached by discovery. No Sentinel Hub processing endpoint is used.
The optional discovery extra requires Shapely and pyproj, not PyTorch/Rasterio.

## Run on Anvi's Windows laptop

Use the project root that contains `pyproject.toml`; substitute your actual path.
Copy the updated project files into that root, preserving your existing `.venv`
and `.env`. Do not replace your project with a different Python environment.

```powershell
Set-Location "C:\Users\Arun Kumar\OneDrive\Desktop\TRINETRA"
.\.venv\Scripts\python.exe -m pip install --only-binary=:all: -e ".[dev,discovery]"
.\.venv\Scripts\python.exe -c "import shapely, pyproj; print(shapely.__version__, pyproj.__version__)"
.\.venv\Scripts\python.exe -m unittest discover -s tests -p test_s1_discovery.py -v
.\.venv\Scripts\python.exe -m trinetra.discovery --aoi examples\trishuli_aoi.geojson --date 2026-08-26 --refresh --output data\runs\trishuli\s1_pair.json
```

The unit suite should have no skipped geometry tests when both discovery
dependencies are installed. `--refresh` forces a live search, making this the
demonstration that IDs are discovered automatically rather than manually supplied.
On success, the last command prints a complete JSON pair and saves the same JSON.
On failure it exits with code 1, prints the reason, and does not write new results.
An existing output file from a prior run is not proof that a failed new run worked;
use the command's exit status and printed result.

Then repeat without `--refresh` to exercise the metadata cache:

```powershell
.\.venv\Scripts\python.exe -m trinetra.discovery --aoi examples\trishuli_aoi.geojson --date 2026-08-26
```

The second successful call should return `cache_hit: true` within the cache TTL.
If no suitable pair exists, metadata still caches, and repeated selection fails
with the same eligibility checks rather than inventing IDs.

## Trishuli example assumptions

`examples/trishuli_aoi.geojson` is a small local bbox polygon at
85.10–85.20 degrees longitude, 27.90–28.00 degrees latitude, near Trishuli Bazaar.
It is an illustrative discovery AOI, **not an official flood/damage extent**.
No claim is made that this polygon covers the entire event. Replace it with your
actual AOI for another part of the river. The example date is supplied by the user.

For a bare date, `2026-08-26` means the whole **UTC** day. Before scenes must end
strictly before midnight starting that day. After scenes must start on or after
midnight starting the next day. Event-day acquisitions are excluded because the
flood's time is unknown. For a known event instant, supply a timezone-aware
timestamp, such as `2026-08-26T06:00:00+05:45`; this example illustrates Nepal's
timezone and does not assert the actual flood time. Naive timestamps are rejected.

## Suitability rules

- Search only this collection, AOI polygon, and bounded time interval. Default
  search is 30 days before and 30 days after the event boundary. `--search-days`
  accepts 1–90; changing it is explicit.
- Require IW high-resolution GRD (`IW_GRDH_1S`) and VV/VH dual polarization.
- Require real relative orbit 1–175, ascending/descending direction, recognized
  Sentinel-1 platform, start/end times, and valid scene footprint. Missing orbit
  metadata is never guessed from absolute orbit or filenames.
- Require **the same relative orbit and orbit direction** in the selected pair.
  There is no cross-orbit fallback.
- Require at least **99%** of the AOI in each scene and at least **99% common
  before/after coverage**. `--min-coverage 1.0` explicitly requests full coverage.
  Merely intersecting the AOI is insufficient.
- Clip actual footprints to the AOI, densify edges, and measure area in a local
  Lambert azimuthal equal-area CRS. Do not measure coverage as degree-square area
  or scene bbox overlap. This is catalog-footprint coverage, not usable-radar
  observability or valid-pixel coverage; those require later preprocessing.
- Among eligible pairs, prefer the same platform, then the earliest post-event
  acquisition, then the latest pre-event acquisition. Different platforms may
  pair only when orbit/direction and all other criteria agree; platform fields
  make this visible. Same orbit is necessary, not proof of calibrated alignment.
- Limit AOIs to valid WGS84 Polygon/MultiPolygon/Feature or `[west,south,east,north]`,
  positive area <=10,000 km², <=2 degrees per axis, <=5,000 vertices, within +/-80
  latitude. Dateline-crossing/global AOIs are explicitly unsupported for this MVP.
- Limit pagination to ten pages of 100 items; exceeding it fails instead of
  returning a pair from a silently incomplete search. HTTP 429/temporary server
  failures retry with bounded delays. HTTP 403 is reported immediately.

A catalog pair means acquisitions are available and geographically plausible;
it does not prove a flood is visible, terrain is observable, or assets are damaged.

## Result fields

| Field | Meaning |
| --- | --- |
| `pre_id`, `post_id` | Catalog item/product identifiers, automatically retrieved |
| `pre_datetime`, `post_datetime` | Acquisition start timestamps in UTC |
| `pre_end_datetime`, `post_end_datetime` | Acquisition end timestamps |
| `relative_orbit`, `orbit_direction` | Shared orbit geometry |
| `platform_pre`, `platform_post` | Satellite for each observation |
| `delta_days` | Difference between acquisition start times |
| `pre_age_days`, `post_delay_days` | Time from the relevant event boundary |
| `coverage_pre`, `coverage_post`, `coverage_common` | AOI coverage fractions, 0–1 |
| `aoi_area_km2` | AOI area measured in the equal-area CRS |
| `event_start_utc`, `event_end_utc`, `date_policy` | Explicit event-date interpretation |
| `source`, `collection` | Official metadata provenance |
| `metadata_fetched_at`, `cache_hit` | Metadata age and cache use |
| `candidate_count`, `rejected` | Catalog result count and rejected metadata/coverage reasons |
| `search_days`, `minimum_coverage` | Active selection constraints |
| `instrument_mode`, `product_type`, `polarizations` | Required SAR product characteristics |

## Metadata cache and environment

Default location: `data/cache/s1_metadata/`, ignored by Git. Optional setting:

```text
TRINETRA_METADATA_CACHE_DIR=data/cache/s1_metadata
```

This setting is loaded from environment variables or root `.env`; start the CLI
from the project root. Cache keys include the official source, AOI, collection,
time interval, and search query. Complete successful metadata responses are cached
atomically. Raster assets and asset URLs are excluded. Default TTL is 24 hours;
the Python function accepts `cache_ttl_hours` (0–168), `cache_dir`, and `refresh`.
Stale/corrupt cache entries trigger a live search, not a silent offline fallback.
No raster asset is opened and no global catalog is downloaded.

## Verification status

At authoring time, 28 dependency-independent tests passed. Two tests exercising
actual Shapely/pyproj geometry were skipped because package registry access is
blocked in the authoring workspace. Unit tests use explicitly synthetic metadata
fixtures only; they are not live satellite results.

A direct query through the implemented catalog client was attempted for the
Trishuli AOI/date. The workspace returned HTTP 403. The complete CLI also stopped
because geometry packages could not be installed. **No live product pair has been
verified, and no demonstration result was fabricated.** See
`docs/discovery_verification.json` for the actual failed live-request record.
Successful live verification must occur on Anvi's network using the command above.

## Official schema references

- [CDSE STAC catalog documentation](https://documentation.dataspace.copernicus.eu/APIs/STAC.html)
- [CDSE Sentinel-1 filter/metadata examples](https://documentation.dataspace.copernicus.eu/notebook-samples/geo/migration_of_opensearch_to_stac_guide.html)
