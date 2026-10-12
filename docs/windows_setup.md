# Anvi's Windows development environment

Scope: local installation and environment verification only. No datasets,
satellite processing, training, pretrained weights, or map results are produced.

Assumption: Windows 10/11 on an Intel/AMD x64 laptop. If Settings > System > About
says ARM-based processor, stop before using this x64 setup; use the appropriate
architecture and verify wheel availability separately.

## 1. Install the local tools

1. Install **64-bit Python 3.12**. If you already have a Python 3.12 x64
   interpreter, keep it. For a conventional installer, the official
   [Python 3.12.10 release page](https://www.python.org/downloads/release/python-31210/)
   offers a Windows installer (64-bit). Choose that installer, enable the Python
   launcher (`py`) and Add Python to PATH, and install for your user. This setup
   accepts any 3.12 patch release; do not use a source archive or 32-bit build.
2. Install **Node.js 22 LTS, version 22.12 or newer**, using the Windows x64 MSI
   from [Node.js](https://nodejs.org/en/download). Keep npm and PATH enabled.
   Node 24 also satisfies this project's minimum. No optional native build-tools
   bundle is needed for the current frontend.
3. Install [Git for Windows](https://git-scm.com/downloads/win) if you will push
   changes. Git is not required merely to run the extracted ZIP.
4. VS Code is optional. If used, install Microsoft's Python extension and later
   select the interpreter `.venv\Scripts\python.exe`.
5. Close existing terminals and open a fresh, normal PowerShell window.

Confirm:

```powershell
py -3.12 --version
py -3.12 -c "import struct; print(struct.calcsize('P') * 8)"
node --version
npm.cmd --version
```

Expected: Python 3.12.x, `64`, Node >=22.12, and an npm version. Using `npm.cmd`
avoids PowerShell blocking the separate `npm.ps1` shim.

## 2. Put the project in a simple folder

Download/extract the updated project ZIP. Use a folder such as
`C:\Projects\TRINETRA`, containing `pyproject.toml`, `src`, `web`, and `scripts`.
Open PowerShell there:

```powershell
Set-Location C:\Projects\TRINETRA
Get-ChildItem
```

The GitHub repository was empty when the scaffold was created and publication was
denied by the integration. Use the ZIP unless you have since pushed the scaffold.

## 3. Recommended: run the setup script

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup_windows.ps1
```

The policy option applies only to this launched PowerShell process; it does not
change the machine's persistent execution policy. If an organization forbids
scripts, use the manual native commands below instead.

The script validates Python/Node, creates `.venv`, upgrades pip/build tooling,
installs API/test/geospatial packages, installs CPU-only PyTorch, runs `pip check`,
installs frontend dependencies, preserves an existing `.env`, runs the API tests,
and runs the complete environment smoke test. It stops with an error on any failed
command. It does not install system tools or use administrator privileges.

Package downloads are needed. PyTorch itself can be a substantial download;
it is a software dependency, not a dataset. Nothing downloads imagery or weights.

## 4. Manual equivalent

Use these commands in order from the project root. If a command fails, fix that
failure before running the next command. Explicit interpreter paths avoid mixing
this project with another Python/Conda environment.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r requirements-anvi.txt
.\.venv\Scripts\python.exe -m pip install -r requirements-ml-cpu.txt
.\.venv\Scripts\python.exe -m pip check
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Set-Location web
npm.cmd install --no-audit --no-fund
Set-Location ..
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe scripts\smoke_env.py --report artifacts\reports\environment-smoke.json
```

Activation is optional because the commands directly use the virtual environment.
For an interactive activated session, use `.\.venv\Scripts\Activate.ps1` when
your normal policy permits it. You do not need to relax policy to run Python.

`requirements-anvi.txt` installs the editable package with `dev` and `geo` extras;
`requirements-ml-cpu.txt` selects CPU-only PyTorch from its official index. Avoid
plain `pip install torch` when following this CPU environment. Use a fresh venv
if you already installed a CUDA-enabled torch into this project's environment.

`npm install` generates `web/package-lock.json` after its first successful run.
Commit that file and use `npm.cmd ci` on subsequent clean setups. Python packages
currently use compatible version ranges; this is not a fully locked environment.
The setup script saves resolved versions after successful validation.

## 5. What is installed

| Package | Purpose | Definition |
| --- | --- | --- |
| FastAPI | API and OpenAPI | `fastapi>=0.115,<1` |
| Uvicorn | ASGI server | `uvicorn>=0.32,<1` |
| pydantic-settings | Environment and `.env` | `pydantic-settings>=2.6,<3` |
| pytest, HTTPX | Offline API tests | `pytest>=8,<10`, `httpx>=0.27,<1` |
| NumPy | Arrays and PyTorch interoperability | `numpy>=2,<3` |
| Rasterio | Raster/GeoTIFF I/O | `rasterio>=1.4,<2` |
| GeoPandas | Geospatial tables and vectors | `geopandas>=1.1,<2` |
| Shapely | Geometry operations | `shapely>=2.1,<3` |
| pyproj | CRS transformations | `pyproj>=3.7,<4` |
| pyogrio | Vector file I/O | `pyogrio>=0.11,<1` |
| PyTorch | CPU tensor operations; future model work | `torch>=2.6,<3`, CPU index |
| pandas | GeoPandas dependency, installed transitively | Resolved by GeoPandas |
| React, React DOM | Frontend | React 19 compatible range |
| Vite, React plugin | Frontend development and build | Vite 7, plugin 5 compatible ranges |

No torchvision, torchaudio, transformers, CUDA stack, notebook server, or additional
ML framework is needed for these checks. Add new tools only when a concrete later
task needs them. `requirements.txt` remains the lightweight API/test install.

## 6. GDAL and system dependencies

**Do not install standalone GDAL, `pip install GDAL`, OSGeo4W, QGIS, or a compiler
for this setup.** Rasterio and GeoPandas' compiled dependencies provide prebuilt
wheels containing the required GDAL/GEOS/PROJ libraries for supported platforms.
`--only-binary=:all:` makes a missing wheel fail clearly instead of starting a
native source build. Do not manually set `GDAL_DATA` or `PROJ_LIB` for these wheels.

If a native Python import fails with a missing DLL, install/repair Microsoft's
[latest supported Visual C++ v14 Redistributable x64](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist/)
and reopen PowerShell. This runtime is different from Visual Studio Build Tools;
the latter are unnecessary for the wheel route. Use the Microsoft installer only,
not individual DLLs from third-party websites.

SNAP or another SAR-processing toolchain is **not required now**. Later raw
Sentinel-1 calibration/terrain correction will need a deliberate tool choice;
Rasterio by itself does not perform that entire SAR workflow.

## 7. GPU and later training

No local GPU is needed. CPU-only PyTorch is intentional; `torch.cuda.is_available()`
returning `False` is healthy for this setup. The smoke test checks tensor math,
autograd, and NumPy interoperability, not model training.

Later use an available Kaggle or Google Colab free GPU runtime for substantial
training. Their GPU environment is separate from this Windows CPU venv, and free
GPU availability/quotas are not guaranteed. A browser account is enough to start;
no Kaggle token or Google credential is required in the local project today.

## 8. Environment variables

| Variable | Current use | Future use |
| --- | --- | --- |
| `TRINETRA_APP_NAME` | Optional API title/service name; default `TRINETRA` | Same |
| `CDSE_USERNAME` | Empty reserved placeholder, unused | Copernicus login if username/password authentication is selected |
| `CDSE_PASSWORD` | Empty reserved placeholder, unused | Copernicus password for that authentication flow |

Exact future authentication requirements depend on the selected download API.
CDSE documents username/password token generation and a one-time code when 2FA is
enabled. Access tokens, refresh tokens, and one-time codes must not be committed
or treated as permanent `.env` settings. OAuth/S3 client credentials would only
be added if that interface is later chosen.

No local GPU variable, map-service key, paid LLM key, or frontend secret is needed.
The frontend currently uses the Vite `/api` proxy. Any future `VITE_*` value is
public browser configuration. `.env` is ignored by Git; the example file has no
real credentials. Run the API from the project root to load its `.env`.

## 9. What the smoke test proves

It prints one PASS/FAIL per check and exits nonzero if any check fails:

1. Python: version 3.12, 64-bit, virtual environment active through the interpreter.
2. Imports: API, test, numerical, geospatial, and local package imports.
3. PyTorch: CPU tensor arithmetic, gradients, and NumPy interchange.
4. Geospatial: real geometry intersection, CRS reprojection, temporary vector
   write/read, and an in-memory GeoTIFF write/read with CRS preservation.
5. FastAPI: real HTTP-contract handling via TestClient, including health and OpenAPI.
6. Frontend: Node requirement, actual React rendering, Vite/plugin imports, and an
   actual production build of this project's frontend.

The tiny raster/vector fixtures are discarded. They are unit-test inputs and
never satellite products. The script does not fetch packages or datasets; setup
must install packages first. The JSON report records versions/results, not secrets.

The TestClient checks the API in-process; check the live servers next:

Terminal 1, from the root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn trinetra.api.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2, from the root:

```powershell
Set-Location web
npm.cmd run dev
```

Open <http://127.0.0.1:8000/api/v1/health> and <http://127.0.0.1:5173>.
Click Check API health. Stop the servers with Ctrl+C after verification.
Static `npm run preview` does not provide the development API proxy.

## 10. Fixes before proceeding

| Failure | Action |
| --- | --- |
| `py` not recognized or no Python 3.12 found | Install/repair the x64 Python launcher and 3.12 interpreter; reopen PowerShell |
| Existing `.venv` uses another Python | Rename `.venv` as a backup and rerun setup with Python 3.12 |
| `npm.ps1` execution-policy error | Use `npm.cmd`, as these instructions do |
| No wheel / no matching distribution | Confirm Python 3.12 x64 and current pip; inspect whether registry access is blocked; do not install system GDAL as a guessed fix |
| Native DLL import failure | Repair the Microsoft v14 x64 runtime; confirm x64 interpreter; retry in a clean venv |
| pip/npm 403, proxy, or TLS failure | Resolve the network/proxy access with your network administrator or use an authorized network; keep TLS verification enabled |
| `trinetra` import fails | Install `requirements-anvi.txt` from the folder containing `pyproject.toml` |
| Frontend cannot reach API | Start the backend on port 8000 and use the Vite dev server on port 5173 |

## Verification at authoring time

The authoring workspace is Linux, not Anvi's laptop. Python 3.12 x64 in its venv
passed. Package installs were blocked: pip could not retrieve dependencies and npm
returned HTTP 403. Consequently imports, PyTorch, geospatial, FastAPI, and frontend
checks failed due to missing installations. Python syntax and configuration parsing
passed. PowerShell execution has not been tested on Windows here.

**This is not a claim that the environment is working.** Readiness requires all six
PASS results on Anvi's computer, successful API tests, and the live health check.
Stop at environment verification; do not start the satellite pipeline.

## Official references

- [Python 3.12.10 Windows installer](https://www.python.org/downloads/release/python-31210/)
- [PyTorch local installation](https://docs.pytorch.org/get-started/locally/)
- [PyTorch CPU package commands](https://pytorch.org/get-started/previous-versions/)
- [PyTorch Windows FAQ](https://docs.pytorch.org/docs/stable/notes/windows.html)
- [Rasterio installation](https://rasterio.readthedocs.io/en/stable/installation.html)
- [GeoPandas installation](https://geopandas.org/en/stable/getting_started/install.html)
- [Vite prerequisites](https://vite.dev/guide/)
- [Copernicus token generation](https://documentation.dataspace.copernicus.eu/APIs/Token.html)
