# Reelmotion Cloud Run Render Service

Este proyecto usa el paquete oficial `@remotion/cloudrun` para renderizar videos en Google Cloud Run, reemplazando AWS Lambda.

## Arquitectura

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Frontend (Next.js)│────▶│  Remotion Cloud Run  │────▶│   Google Cloud      │
│   /api/cloudrun/*   │     │  (Service oficial)   │     │   Storage (GCS)     │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

## Ventajas sobre Lambda

1. **Sin límites de concurrencia estrictos** - Cloud Run escala automáticamente
2. **Mayor tiempo de ejecución** - Hasta 60 minutos vs 15 minutos en Lambda
3. **Más memoria/CPU disponible** - Hasta 32GB RAM y 8 vCPUs
4. **Precios más predecibles** - Pago por segundo de uso
5. **Mejor integración con GCS** - Ya usamos GCS para almacenamiento

## Configuración Rápida

### 1. Instalar Remotion Cloud Run

El paquete ya está instalado en el proyecto (`@remotion/cloudrun`).

### 2. Configurar GCP

```bash
# Autenticarse con Google Cloud
gcloud auth login

# Configurar el proyecto
gcloud config set project YOUR_PROJECT_ID

# Habilitar APIs necesarias
gcloud services enable run.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 3. Desplegar el servicio de Remotion

```bash
# Desplegar el servicio de Cloud Run
npx remotion cloudrun services deploy

# Ver los servicios disponibles
npx remotion cloudrun services ls
```

### 4. Desplegar el sitio de Remotion

```bash
# Desplegar el bundle de Remotion a Cloud Storage
npx remotion cloudrun sites create components/editor/version-7.0.0/remotion/index.ts --site-name=reelmotion-editor

# Ver los sitios disponibles
npx remotion cloudrun sites ls
```

### 5. Configurar variables de entorno

Copia `.env.cloudrun.example` a `.env.local` y completa:

```env
GCP_PROJECT_ID=tu-proyecto-id
REMOTION_GCP_SERVICE_NAME=remotion-render-4-0-272-mem2048mb-cpu2-t900
REMOTION_GCP_SERVE_URL=https://storage.googleapis.com/remotioncloudrun-xxxxx/sites/reelmotion-editor/index.html
GCS_RENDERED_VIDEOS_BUCKET=reelmotion-rendered-videos
```

### 6. Cambiar el tipo de renderizado

En `components/editor/version-7.0.0/constants.ts`:

```typescript
export const RENDER_TYPE: "ssr" | "lambda" | "cloudrun" = "cloudrun";
```

## Comandos útiles de Remotion Cloud Run

```bash
# Ver servicios desplegados
npx remotion cloudrun services ls

# Ver sitios desplegados
npx remotion cloudrun sites ls

# Renderizar un video de prueba
npx remotion cloudrun render --service-name=remotion-render-xxx --composition=TestComponent

# Ver ayuda
npx remotion cloudrun --help
```

## Permisos necesarios

El Service Account usado debe tener los siguientes roles:

- `roles/run.invoker` - Para invocar Cloud Run
- `roles/storage.objectAdmin` - Para leer/escribir en GCS
- `roles/artifactregistry.reader` - Para descargar la imagen de Remotion

## Costos estimados

- Cloud Run: ~$0.00002400 por vCPU-segundo, ~$0.00000250 por GiB-segundo
- Un video de 1 minuto (~2 min de render): ~$0.01-0.05 USD
- GCS: ~$0.023 por GB/mes para almacenamiento

## Troubleshooting

### Error: "Service not found"

- Verifica que `REMOTION_GCP_SERVICE_NAME` está correcto
- Ejecuta `npx remotion cloudrun services ls` para ver los servicios disponibles

### Error: "Site not found"

- Verifica que `REMOTION_GCP_SERVE_URL` está correcto
- Ejecuta `npx remotion cloudrun sites ls` para ver las URLs

### El renderizado es muy lento

#### Solución 1: Redesplegar con más recursos (RECOMENDADO)

```bash
# Desplegar con máximo rendimiento (4 vCPUs, 8GB RAM)
npx remotion cloudrun services deploy --memory=8192 --cpu=4 --timeout=900

# O para balance costo/velocidad (2 vCPUs, 4GB RAM)
npx remotion cloudrun services deploy --memory=4096 --cpu=2 --timeout=900
```

**Tabla de rendimiento estimado:**

| Configuración | Tiempo ~30s video | Costo estimado |
| ------------- | ----------------- | -------------- |
| 2 vCPU, 2GB   | 60-90 segundos    | ~$0.02         |
| 2 vCPU, 4GB   | 40-60 segundos    | ~$0.03         |
| 4 vCPU, 8GB   | 20-35 segundos    | ~$0.05         |

#### Solución 2: Ajustar configuración de encoding

En `app/api/latest/cloudrun/render/route.ts`, modifica `RENDER_CONFIG`:

```typescript
const RENDER_CONFIG = {
  CODEC: "h264" as const,
  CRF: 28, // Mayor = más rápido, menor calidad (rango: 18-28)
  X264_PRESET: "veryfast" as const, // Opciones: ultrafast, superfast, veryfast, faster, fast
  FRAMES_CONCURRENCY: 8, // Más frames en paralelo (requiere más CPU/RAM)
} as const;
```

#### Solución 3: Usar región más cercana

Cambia `GCP_REGION` en `.env.local` a la región más cercana a tus usuarios:

- `us-central1` - Centro de USA
- `us-east1` - Este de USA
- `europe-west1` - Europa
- `southamerica-east1` - São Paulo

### Timeout en renderizados largos

- Aumenta el timeout: `npx remotion cloudrun services deploy --timeout=1800` (30 min)

## Links útiles

- [Documentación oficial de @remotion/cloudrun](https://www.remotion.dev/docs/cloudrun)
- [Configuración de región](https://www.remotion.dev/docs/cloudrun/region-selection)
- [Quotas y límites](https://cloud.google.com/run/quotas)
