Write-Host "Starting Setup for AI-Pharmacy-POS..." -ForegroundColor Green

Write-Host "▶ Setting up Backend (Main POS)..." -ForegroundColor Cyan
Set-Location -Path "backend"
npm install
@"
DATABASE_URL=mysql://root:root@127.0.0.1:3306/pharmacy_pos
PORT=5000
"@ | Out-File -FilePath ".env" -Encoding utf8
Set-Location -Path ".."

Write-Host "▶ Setting up Frontend (Main POS)..." -ForegroundColor Cyan
Set-Location -Path "frontend"
npm install
Set-Location -Path ".."



Write-Host "Setup Complete! All dependencies installed and .env files configured." -ForegroundColor Green
