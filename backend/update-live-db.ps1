# Brings the LIVE database (TiDB Cloud) up to date after a code update, in one go:
#   1. migrate              creates any new tables or columns (for example the coupon "Show in app" fields)
#   2. seed_demo_coupons    gives the demo coupons their descriptions and "Show in app" (only fills in what is empty)
#   3. import_pincodes      adds every Tamil Nadu pincode that is not in the list yet (never changes ones you edited)
# Every step is safe to run again. Run it from the backend folder:
#   powershell -ExecutionPolicy Bypass -File .\update-live-db.ps1
# It asks for the TiDB details once. The password is typed hidden and is only kept in this window while the script runs.

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
Write-Host ("Password received: {0} characters (a pasted password shows only one star, that is normal)" -f $dbPassword.Length) -ForegroundColor Yellow
if ($dbPassword.Length -lt 4) { throw 'The password looks too short, so the paste did not work. Run the script again and right-click to paste, or type the password.' }

$env:DB_HOST = $dbHost
$env:DB_PORT = $dbPort
$env:DB_USER = $dbUser
$env:DB_PASSWORD = $dbPassword
$env:DB_NAME = $dbName
$env:DB_SSL_CA = $ca
$env:TIDB_COMPAT = 'True'

foreach ($step in @(@('migrate'), @('seed_demo_coupons'), @('import_pincodes'))) {
    Write-Host "`nRunning: manage.py $($step -join ' ')  (on TiDB)" -ForegroundColor Cyan
    & $py manage.py @step
    if ($LASTEXITCODE -ne 0) { Remove-Item Env:DB_PASSWORD; throw "'$($step -join ' ')' failed. Check the TiDB details above and run the script again." }
}

Remove-Item Env:DB_PASSWORD
Write-Host "`nThe live database is up to date." -ForegroundColor Green
