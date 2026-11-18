# Runs one manage.py command against the LIVE database (TiDB Cloud), for example adding all Tamil Nadu pincodes:
#   powershell -ExecutionPolicy Bypass -File .\run-on-tidb.ps1 import_pincodes
# It asks for the TiDB details. The password is typed hidden and is only kept in this window while the script runs.

param([Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$ManageArgs)

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

Write-Host "`nRunning: manage.py $($ManageArgs -join ' ')  (on TiDB)" -ForegroundColor Cyan
& $py manage.py @ManageArgs
if ($LASTEXITCODE -ne 0) { Remove-Item Env:DB_PASSWORD; throw 'The command failed. Check the details above.' }

Remove-Item Env:DB_PASSWORD
Write-Host "`nDone." -ForegroundColor Green
