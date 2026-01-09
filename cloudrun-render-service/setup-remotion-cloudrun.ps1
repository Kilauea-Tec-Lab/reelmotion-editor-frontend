# Script para configurar Remotion Cloud Run desde cero
# Ejecutar desde la raíz del repositorio en PowerShell

param(
    [string]$ProjectId = $env:GCP_PROJECT_ID,
    [string]$Region = "us-central1",
    [string]$SiteName = "reelmotion-editor"
)

if (-not $ProjectId) {
    Write-Host "❌ Error: GCP_PROJECT_ID no está configurado" -ForegroundColor Red
    Write-Host "   Usa: `$env:GCP_PROJECT_ID = 'tu-proyecto-id'" -ForegroundColor Yellow
    exit 1
}

Write-Host "🚀 Configurando Remotion Cloud Run" -ForegroundColor Cyan
Write-Host "   Proyecto: $ProjectId"
Write-Host "   Región: $Region"
Write-Host ""

# Step 1: Habilitar APIs necesarias
Write-Host "📦 Habilitando APIs de Google Cloud..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com --project $ProjectId
gcloud services enable storage.googleapis.com --project $ProjectId
gcloud services enable artifactregistry.googleapis.com --project $ProjectId
Write-Host "   ✅ APIs habilitadas" -ForegroundColor Green

# Step 2: Configurar permisos
Write-Host "🔐 Configurando permisos..." -ForegroundColor Yellow
Write-Host "   (Asegúrate de tener los permisos necesarios en GCP)" -ForegroundColor Gray

# Step 3: Desplegar servicio de Cloud Run
Write-Host ""
Write-Host "📦 Desplegando servicio de Remotion Cloud Run..." -ForegroundColor Yellow
Write-Host "   Esto puede tomar unos minutos..." -ForegroundColor Gray
npx remotion cloudrun services deploy --region $Region

# Step 4: Listar servicios
Write-Host ""
Write-Host "📋 Servicios disponibles:" -ForegroundColor Yellow
$services = npx remotion cloudrun services ls --region $Region
Write-Host $services

# Step 5: Desplegar sitio
Write-Host ""
Write-Host "🌐 Desplegando sitio de Remotion..." -ForegroundColor Yellow
npx remotion cloudrun sites create components/editor/version-7.0.0/remotion/index.ts --site-name=$SiteName --region $Region

# Step 6: Listar sitios
Write-Host ""
Write-Host "📋 Sitios disponibles:" -ForegroundColor Yellow
$sites = npx remotion cloudrun sites ls --region $Region
Write-Host $sites

# Resumen
Write-Host ""
Write-Host "✅ Configuración completada!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Ahora agrega estas variables a tu archivo .env.local:" -ForegroundColor Cyan
Write-Host ""
Write-Host "GCP_PROJECT_ID=$ProjectId"
Write-Host "REMOTION_GCP_SERVICE_NAME=<nombre del servicio de arriba>"
Write-Host "REMOTION_GCP_SERVE_URL=<URL del sitio de arriba>"
Write-Host ""
Write-Host "📌 Luego cambia RENDER_TYPE a 'cloudrun' en constants.ts" -ForegroundColor Yellow
