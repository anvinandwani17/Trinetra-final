# Trishuli: selected Sentinel-1 raw downloads

This step adds only two authenticated raw product downloads and validation.
It does not calibrate SAR, crop/process imagery, train a model, segment flooding,
download DEM/OSM, or modify the frontend.

## Windows setup

Copy the updated source files into your existing TRINETRA project, preserving
your `.venv`, `.env`, and existing `data/` cache. The archive includes no credentials
or satellite files and does not replace your local data.

From the project root:

```powershell
.\.venv\Scripts\python.exe -m pip install --only-binary=:all: -e ".[dev,discovery,download]"
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_s1_*.py" -v
```

The dependencies are the existing backend packages plus Shapely/pyproj for
discovery and Rasterio for raw TIFF validation. PyTorch is not used. No new
system-level GDAL, GPU, CUDA, database, or cloud service is introduced.

Set your registered Copernicus Data Space login in local root `.env`:

```text
CDSE_USERNAME=your_registered_email
CDSE_PASSWORD=your_password
```

Environment variables override `.env`. These values are masked in settings and
never saved to product metadata, run manifests, caches, or logs. Tokens remain
in memory. Do not commit or share `.env`.

## Run

The requested command is supported after installing the editable package:

```powershell
python scripts/run_case.py --aoi examples/trishuli.geojson --date 2026-08-26
```

To avoid ambiguity about which Python is running, use:

```powershell
.\.venv\Scripts\python.exe scripts\run_case.py --aoi examples\trishuli.geojson --date 2026-08-26
```

If your account has two-factor authentication, add `--two-factor`. The command
privately prompts for a current one-time code when requesting a token. The code
is not stored in `.env` or in output files.

This first runner accepts only the date `2026-08-26` and a local Trishuli-area AOI
bounded by longitude 84.5–85.6 and latitude 27.6–28.8. The example polygon is the
same small illustrative AOI used for discovery, not an official event footprint.

The first run discovers and pins the pair, resolves only those two product names
through the official OData catalog, and downloads the matching SAFE or COG_SAFE
archives through `download.dataspace.copernicus.eu/.../$value`. No additional
products, training datasets, thumbnails, DEM, or orbit files are requested.
Subsequent runs use the pinned pair and resolved metadata for this same AOI/date.
An existing run with a different AOI/date is preserved and rejected.

Each complete scene can be hundreds of MB or over 1 GB. A small AOI does
not make a SAFE archive small. The full two SAFE products retain the
measurement, annotation, and calibration files needed for a later SAR step; no
extra extracted copy is created. AOI cropping is deferred to preprocessing.

Default safety bound: **3 GiB per archive**, at most two archives. Actual transfer
headers are checked when available, streams are always bounded, and free disk
space is checked. `--max-product-gib` changes the per-scene limit up to 6 GiB.
Catalog `ContentLength` is printed as an estimate; it is not assumed to be the
exact dynamically generated ZIP size. No download is labeled complete just
because it matches that metadata field.

## Storage

```text
data/
  raw/sentinel1/<OData UUID>/
    <product name>.SAFE.zip
    metadata.json
    transfer.json
  processed/                   # untouched by this command
  cache/s1_metadata/           # acquisition discovery metadata
  runs/trishuli/
    s1_pair.json
    download_manifest.json
```

During a transfer, the archive ends in `.zip.part`. It is renamed atomically only
after all validation passes. An exclusive product lock prevents two simultaneous
runs from appending to/downloading the same file. A process killed without cleanup
may leave `.download.lock`; remove that lock only after confirming the old process
has stopped. Normal errors and Ctrl+C release the lock and retain partial bytes.

## Cache and resume

Rerun the same command after an interruption. Completed products with matching
local SHA-256 verification are reused without another image download or login.
An existing final archive lacking a marker is validated locally rather than
automatically fetched again. A successfully transferred partial awaiting
validation is also validated locally without a second transfer.

For incomplete transfers, resume requires a stable ETag or Last-Modified value,
an `If-Range` request, an HTTP 206 response, and matching Content-Range offsets and
total size. Changed validators are rejected. If the server returns HTTP 200
instead, the code preserves the partial file and refuses to append a whole
archive to it. CDSE dynamically generated archives may not support stable ranges;
resumability is conditional, not guaranteed.

If the error explicitly says resume is unsupported, restart partial files with:

```powershell
.\.venv\Scripts\python.exe scripts\run_case.py --aoi examples\trishuli.geojson --date 2026-08-26 --restart-partial
```

This flag discards incomplete files only; verified final archives remain cached.
Automatic retries are bounded and never silently restart a partial transfer.
Authentication is refreshed on HTTP 401. Temporary HTTP 429/500/502/503/504
errors and interrupted connections retry up to five attempts, with waits of
10, 20, 40, and 60 seconds. Numeric/date Retry-After can increase each wait up
to the 60-second cap. Retry progress is printed without credentials. Other
failures retain bytes and record a failed run. Offline products are rejected;
no archive ordering or alternative-scene download is performed.

## Validation

A successful archive must pass:

1. Full ZIP integrity/CRC scan of every member.
2. A single expected SAFE product root, safe unique member paths, readable
   `manifest.safe`, and presence of all referenced data-object files.
3. Readable annotation XML.
4. One expected IW GRD measurement TIFF for VV and one for VH.
5. Rasterio/GDAL opening each TIFF directly inside the ZIP, valid dimensions and
   driver, and small pixel reads at three positions in each measurement.
6. A recorded local SHA-256 and actual archive byte count.

Raw GRD TIFFs do not necessarily have a conventional map CRS, so absent CRS is
not used as a failure condition. Validation proves file integrity and sampled
readability; it does not prove geocoding, calibration, terrain correction, or flood
accuracy. Provider OData checksums are retained as metadata but are not compared
blindly to a dynamically generated ZIP whose representation may differ.

Only after both products pass does `download_manifest.json` say `status: complete`.
Each product record includes path, cache use, UUID/name, verification, byte count,
hash, and raster read details. If post-event download fails, the valid pre-event
product remains cached and the manifest says `failed`.

Inspect the result:

```powershell
Get-Content data\runs\trishuli\download_manifest.json
```

An optional `.zip` extraction is not needed for this step. Do not add generated
archives, partials, caches, or credentials to Git.

## Verification at authoring time

The combined discovery/downloader suite ran 51 tests: 48 passed and 3 were skipped
because actual Shapely/pyproj/Rasterio dependencies cannot be installed in the
restricted authoring workspace. Downloader-specific results were 20 passed and
one real Rasterio ZIP-read test skipped. Test archives and HTTP streams are clearly
synthetic, temporary unit fixtures, never demo scenes.

The actual Trishuli scenes have **not** been downloaded or validated in this
workspace. It has no user CDSE credentials and catalog/package access is blocked.
The real transfer and validation must run on Anvi's Windows laptop. Successful
unit fixtures are not presented as evidence that real satellite downloads worked.

## Official references

- [CDSE OData download documentation](https://documentation.dataspace.copernicus.eu/APIs/OData.html#product-download)
- [CDSE token generation](https://documentation.dataspace.copernicus.eu/APIs/Token.html)
- [Current download service](https://dataspace.copernicus.eu/news/2025-4-15-new-version-download-service-available-under-downloaddataspacecopernicuseu)

The separate `$zip` representation has a documented limited availability window;
this implementation uses `$value` rather than relying on that representation for
August scenes downloaded in October.

## HTTP 502 troubleshooting

A failed download is not a verified scene. Rerun the same command later and
keep the pinned manifest and raw cache; do not delete them or use
`--restart-partial` for a 502 alone. Backoff helps temporary service errors but
cannot repair an unavailable remote service. If 502 persists, check the selected
product in Copernicus Browser and contact CDSE support with its UUID and the UTC
failure time. Do not share credentials or tokens.

Names ending in `_COG.SAFE` are official CDSE GRD products: measurement TIFFs
are converted to cloud optimized GeoTIFFs and the manifest is adjusted. They
remain distinct representations and are recorded with their exact catalog name
and UUID. This runner accepts them and validates their ZIP/manifest and Rasterio
reads using the same checks. It does not convert COG_SAFE back to original SAFE.
The suffix itself does not establish the cause of HTTP 502. See the official
[COG_SAFE documentation](https://documentation.dataspace.copernicus.eu/Data/Others/Sentinel1_COG.html).

## Official S3 route when the archive service fails

The OData archive route remains the default. The explicit `--transport s3`
option uses the same pinned pair and catalog `S3Path` for each product through
`https://eodata.dataspace.copernicus.eu`. It does not rediscover a different pair,
request the OData archive service, list the global bucket, or preprocess pixels.
Public catalog discovery/lookup still runs if no pair/metadata has been pinned.

Generate credentials at the official
[CDSE S3 Keys Manager](https://eodata-s3keysmanager.dataspace.copernicus.eu).
Add these two values to your existing local `.env`, keeping the existing values:

```dotenv
CDSE_S3_ACCESS_KEY=your_access_key
CDSE_S3_SECRET_KEY=your_secret_key
```

Keys load via Settings (explicit `.env` path); no stdin auto-discovery is used.
No AWS account or AWS CLI is required. S3 here means Copernicus object storage.
The keys are separate from your CDSE login and are never recorded in outputs.

After overlaying the updated source on your existing project:

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev,discovery,download,s3]"
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_s1_*.py" -v
.\.venv\Scripts\python.exe scripts\run_case.py --aoi examples\trishuli.geojson --date 2026-08-26 --transport s3
```

Only each selected SAFE prefix is listed (maximum 500 objects). Total object
bytes plus conservative ZIP overhead must fit the configured 3 GiB bound.
Every object request includes its ETag in `IfMatch`; resumed requests require
HTTP 206 and exact size/range headers. Complete object caches carry local
SHA-256 checks and avoid repeated GETs. Partial objects remain in
`data/raw/sentinel1/<UUID>/s3_objects/` across interrupted runs. Listings are
checked again before packaging to reject changes to the selected product.
ETags are identity validators, not assumed to be MD5 checksums.

Received raw files are packaged with ZIP_STORED, preserving their bytes and
SAFE directory structure. This is a local archive representation, not a claim
of byte-for-byte identity with an OData ZIP. The same full ZIP CRC, manifest,
annotation, and real VV/VH Rasterio validation runs before a final `.zip` is
marked valid. Staged objects are removed after successful final validation;
interrupted or failed products retain their staging cache. Existing verified
final archives are reused across transports without S3 login or image requests.

Allow temporary free disk space of about twice one scene's size, in addition
to any previously saved scene. The code checks space before downloading.
A 502 with zero archive bytes saved can switch to S3 without a restart flag.
An existing nonempty OData `.zip.part` is preserved and switching transport is
rejected until you explicitly use `--restart-partial`; bytes from the two
representations are never mixed. Interrupted packaging also needs this flag
(to rebuild from the cached objects, not redownload them). It discards only
incomplete objects/archives; completed object caches remain intact.

Metadata listing success alone does not prove imagery download/readability.
Only a run manifest with `status: complete` and both product validation records
proves that both raw scenes were received and checked. No ML, preprocessing,
OSM, or frontend work is introduced.

Official references:
[CDSE S3 access](https://documentation.dataspace.copernicus.eu/APIs/S3.html) and
[Boto3 conditional/range reads](https://docs.aws.amazon.com/boto3/latest/reference/services/s3/client/get_object.html).

## Interrupted stream handler fix

A botocore `ResponseStreamingError` can carry `response=None`. The S3 handler
now checks the metadata type before reading an error code, so this interruption
retries instead of raising AttributeError. Persisted object bytes are retained;
the next request uses their exact length plus the original ETag in IfMatch.
After five unsuccessful attempts it reports a controlled failure and retains
partials for a later rerun. Completed object caches and final archives are reused.

Apply `TRINETRA_S3_Stream_Fix.zip` over your existing project, keeping local data
and credentials. Then rerun the same `run_case.py --transport s3` command without
`--restart-partial`. No new installation or credential change is required.
