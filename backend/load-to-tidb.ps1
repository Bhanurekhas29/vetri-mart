# Copies your local data (products, banners, FAQs, users, orders, pictures) into TiDB Cloud.
# Run it from the backend folder:   powershell -ExecutionPolicy Bypass -File .\load-to-tidb.ps1
# It asks for the TiDB details. The password is typed hidden and is only kept in this window while the script runs.
# Your local database is only read, never changed.

$ErrorActionPreference = 'Stop'
$py = Join-Path $PSScriptRoot 'venv\Scripts\python.exe'
Set-Location $PSScriptRoot
$env:PYTHONUTF8 = '1'

Write-Host ''
Write-Host 'TiDB details (Cluster -> Connect -> Public):' -ForegroundColor Cyan
$dbHost = Read-Host 'Host (like gateway01.ap-southeast-1.prod.aws.tidbcloud.com)'
$dbPort = Read-Host 'Port [4000]'
if (-not $dbPort) { $dbPort = '4000' }
$dbUser = Read-Host 'User (like xxxx.root)'
$dbName = Read-Host 'Database [vetrimart]'
if (-not $dbName) { $dbName = 'vetrimart' }
$ca = Read-Host 'Path of the CA certificate file (isrgrootx1.pem)'
$secure = Read-Host 'Password' -AsSecureString
$dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

if (-not (Test-Path $ca)) { throw "The certificate file was not found: $ca" }

# 1. Export from the local MySQL (the settings in backend\.env)
Write-Host "`n[1/4] Exporting local data to data.json ..." -ForegroundColor Cyan
& $py manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.permission -e admin.logentry -e sessions -e token_blacklist -e siteconfig.mediafile --indent 1 -o data.json
if ($LASTEXITCODE -ne 0) { throw 'The export failed.' }

# 2. From here on, every command talks to TiDB
$env:DB_HOST = $dbHost
$env:DB_PORT = $dbPort
$env:DB_USER = $dbUser
$env:DB_PASSWORD = $dbPassword
$env:DB_NAME = $dbName
$env:DB_SSL_CA = $ca
$env:TIDB_COMPAT = 'True'   # TiDB cannot run one step of the login-token package's history; see vetrimart/tidb_migrations

Write-Host "`n[2/4] Creating the tables in TiDB ..." -ForegroundColor Cyan
& $py manage.py migrate
if ($LASTEXITCODE -ne 0) { throw 'migrate failed. Check the host, user, password and certificate.' }

Write-Host "`n[3/4] Loading the data into TiDB ..." -ForegroundColor Cyan
& $py manage.py loaddata data.json
if ($LASTEXITCODE -ne 0) { throw 'loaddata failed.' }

Write-Host "`n[4/4] Saving the pictures in TiDB ..." -ForegroundColor Cyan
& $py manage.py import_media
if ($LASTEXITCODE -ne 0) { throw 'import_media failed.' }

Write-Host "`nCounts now in TiDB:" -ForegroundColor Cyan
& $py manage.py shell -c "from catalog.models import Product, ProductVariant; from accounts.models import User; from content.models import Banner, FAQ; from siteconfig.models import MediaFile; print('products', Product.objects.count(), '| variants', ProductVariant.objects.count(), '| users', User.objects.count(), '| banners', Banner.objects.count(), '| faqs', FAQ.objects.count(), '| pictures', MediaFile.objects.count())"

Remove-Item Env:DB_PASSWORD
Write-Host "`nDone. data.json holds a copy of your data: delete it when you no longer need it. It is not in git." -ForegroundColor Green
