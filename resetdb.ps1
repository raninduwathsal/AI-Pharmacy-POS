# resetdb.ps1
# Drops and recreates the `pharmacy_pos` database.
# Configure via environment variables: DB_HOST, DB_PORT, DB_USER, DB_PASS
# Run with -Force to skip confirmation.

param(
    [switch]$Force
)

$DBHost = if ($env:DB_HOST) { $env:DB_HOST } else { '127.0.0.1' }
$DBPort = if ($env:DB_PORT) { $env:DB_PORT } else { '3306' }
$DBUser = if ($env:DB_USER) { $env:DB_USER } else { 'root' }
$DBPass = if ($env:DB_PASS) { $env:DB_PASS } else { '' }

if (-not $Force) {
    $resp = Read-Host "This will DROP and recreate database pharmacy_pos. Continue? (y/N)"
    if ($resp -notin @('y','Y','yes','Yes')) { Write-Host "Aborted."; exit 1 }
}

if ($DBPass -ne '') { $env:MYSQL_PWD = $DBPass }

$sql = "DROP DATABASE IF EXISTS pharmacy_pos; CREATE DATABASE pharmacy_pos;"
Write-Host "Running SQL on $DBHost`:$DBPort as $DBUser..."
& mysql -h $DBHost -P $DBPort -u $DBUser -e $sql
Write-Host "Done."
