# Starts the Expo app and shows the QR code for Expo Go.
# 192.168.1.5 is this laptop's Wi-Fi address. Change it here if your Wi-Fi address changes.
# Run from the frontend folder:  .\run-app.ps1
Set-Location $PSScriptRoot
$Host.UI.RawUI.WindowTitle = 'Vetri Mart - Expo app'
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '192.168.1.5'

# CI=1 turns off Metro's file watcher. On Node 26 the watcher hangs for minutes and then fails.
# The cost: no automatic reload, so shake the phone and tap Reload after code changes.
# Installing Node 22 LTS would let us remove this line.
$env:CI = '1'

npm start
