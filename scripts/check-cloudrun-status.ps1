# Script para verificar estado de Cloud Run

Write-Host "🔍 Verificando servicio de Cloud Run..." -ForegroundColor Cyan
Write-Host ""

# Verificar variables de entorno
$serviceName = $env:REMOTION_GCP_SERVICE_NAME
$region = "us-central1" # Ajusta según tu región

if (-not $serviceName) {
    Write-Host "❌ ERROR: Variable REMOTION_GCP_SERVICE_NAME no está definida" -ForegroundColor Red
    Write-Host "Define la variable con el nombre de tu servicio de Cloud Run" -ForegroundColor Yellow
    exit 1
}

Write-Host "Service Name: $serviceName" -ForegroundColor Green
Write-Host "Region: $region" -ForegroundColor Green
Write-Host ""

# Listar servicios de Cloud Run
Write-Host "📋 Listando servicios de Cloud Run..." -ForegroundColor Cyan
gcloud run services list --platform managed --region $region

Write-Host ""
Write-Host "📊 Detalles del servicio $serviceName..." -ForegroundColor Cyan
gcloud run services describe $serviceName --platform managed --region $region

Write-Host ""
Write-Host "📜 Últimos logs del servicio..." -ForegroundColor Cyan
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$serviceName" --limit 20 --format json
