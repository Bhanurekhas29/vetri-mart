# Starts the Vetri Mart backend so both this laptop and your phone can reach it.
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File backend\run-server.ps1
Set-Location $PSScriptRoot
$Host.UI.RawUI.WindowTitle = 'Vetri Mart - Backend'
.\venv\Scripts\python manage.py runserver 0.0.0.0:8000
