# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Reelmotion Editor — a browser-based video editor built with **Next.js 14** (App Router), **React 18**, **TypeScript**, and **Remotion** for video composition/rendering. Uses shadcn/ui (Radix UI + Tailwind) for the component library.

## Commands

```bash
npm run dev          # Start dev server (Next.js)
npm run build        # Production build
npm run lint         # ESLint (next lint)
npm run test         # Jest tests
npm run test:watch   # Jest watch mode
npm run test:coverage # Jest with coverage
```

## Architecture

### Editor Versioning

The editor lives under `components/editor/version-7.0.0/`. This is the active version — all editor work happens here.

### State Management — React Context (no Redux)

Seven nested context providers wrap the editor (see `react-video-editor.tsx`):

| Context | Purpose |
|---------|---------|
| `EditorContext` | Overlay CRUD, player controls, undo/redo, rendering, subscriptions |
| `TimelineContext` | Zoom level (0.2x–10x), scroll position, row management |
| `SidebarContext` | Active panel selection (VIDEO, TEXT, IMAGE, SOUND, etc.) |
| `KeyframeContext` | Animation keyframe management |
| `LocalMediaContext` | User-uploaded media files |
| `AssetLoadingContext` | Asset loading indicator state |
| `ThemeProvider` | Dark mode (forced dark) |

### Core Data Model

All media on the timeline is an **Overlay** (defined in `types.ts`). Types: `TEXT`, `IMAGE`, `SHAPE`, `VIDEO`, `SOUND`, `CAPTION`, `STICKER`, `TEMPLATE`, `LIBRARY`, `LOCAL_DIR`. Each overlay has position, timing (`from`, `durationInFrames`), dimensions, and type-specific properties (e.g., `src`, `fontSize`, `volume`).

### Component Hierarchy

```
AppSidebar (icon nav + content panels)
SidebarInset
  Editor
    EditorHeader (title, save, render)
    VideoPlayer (Remotion @remotion/player wrapper)
    Timeline (frame-based multi-track timeline)
```

### Key Hooks (in `hooks/`)

- `useOverlays` — overlay add/delete/change/split/duplicate
- `useVideoPlayer` — playback controls, current frame, duration
- `useRendering` — render orchestration (SSR/Lambda/CloudRun) + progress polling
- `useAutosave` — IndexedDB auto-save every 10s + recovery dialog
- `useHistory` — undo/redo stack
- `useEditorAuth` — JWT auth via URL token, fetches user data from backend

### Rendering Pipeline

Three render modes configured in `constants.ts` (`RENDER_TYPE`):
- **SSR** (default dev): Server-side rendering with bundle caching
- **CloudRun**: Production rendering with FFmpeg
- **Lambda**: AWS Lambda (legacy/reference)

Flow: prepare overlays → convert proxy URLs to absolute → add watermark (free users) → call render endpoint → poll progress → return video URL.

### API Routes (`app/api/`)

- `latest/ssr/render`, `latest/lambda/render`, `latest/cloudrun/render` — rendering endpoints
- `latest/ssr/progress/[renderId]` — render progress
- `pexels/images`, `pexels/videos` — Pexels API proxy
- `upload-to-gcs` — Google Cloud Storage uploads
- `proxy-video` — video URL proxy for CORS

### Persistence

- **IndexedDB**: Auto-save (overlays, aspect ratio, player dimensions)
- **Backend API**: Manual save (Ctrl+S), project data, user uploads
- **URL token**: Authentication — `[token]` dynamic route

### Remotion Integration

Compositions in `remotion/` — `entry.tsx`, `main.tsx`, `root.tsx`. Video layers render using `OffthreadVideo` from Remotion. CSS filters (not WebGL) for video filter presets — compatible with both preview and render.

## Conventions

- **Path alias**: `@/*` maps to project root
- **Dark mode only**: Theme is forced dark via `next-themes`
- **UI components**: `components/ui/` contains shadcn/ui primitives — do not modify these directly
- **Tailwind custom colors**: `primarioDark` (#34373C), `darkBox` (#0E0D0D), `primarioLogo` (#DC569D)
- **FPS**: 30 frames per second (constant `FPS` in `constants.ts`)
- **ESLint**: `@typescript-eslint/no-explicit-any` is off, unused vars are warnings
- **Testing**: Jest + jsdom + @testing-library/react; mocks in `tests/mocks/`
- **Mobile**: `< 768px` detected via `use-mobile.tsx` hook; mobile-specific components in `components/mobile/`

## Environment

Key env vars: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_CDN_URL`, `NEXT_PUBLIC_CDN_ENABLED`, GCS bucket names (`NEXT_PUBLIC_GCS_BUCKET_NAME_VIDEO/IMAGE/AUDIO`), `NEXT_PUBLIC_PEXELS_API_KEY`, Remotion GCP/AWS credentials.
