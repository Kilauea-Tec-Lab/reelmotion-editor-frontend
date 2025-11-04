# Local Video Upload System

## Overview

This implementation handles video uploads differently from images and audio files to avoid the 5MB Netlify serverless function limit.

## How It Works

### Videos (Large Files)
- **No server upload**: Videos are NOT uploaded to the server
- **Blob URLs**: Uses `URL.createObjectURL()` to create local blob URLs
- **Client-side only**: Videos stay on the user's computer
- **Instant**: No upload time required

### Images & Audio (Small Files)
- **Server upload**: Files are uploaded to the server as before
- **Persistent**: Files remain available after page reload
- **Traditional approach**: Standard file upload workflow

## Technical Details

### Backend (`/api/latest/local-media/upload/route.ts`)
```typescript
// Detects if file is a video
const isVideo = VIDEO_MIME_TYPES.includes(file.type);

// Returns metadata without uploading
if (isVideo) {
  return {
    success: true,
    id: fileId,
    isLocalFile: true,
    // ... other metadata
  };
}
```

### Frontend (`utils/media-upload.ts`)
```typescript
// Creates blob URL for videos
if (uploadResult.isLocalFile) {
  const blobUrl = URL.createObjectURL(file);
  serverPath = blobUrl;
}

// Stores in IndexedDB
const mediaItem: UserMediaItem = {
  serverPath, // blob:http://localhost:3000/abc-123 for videos
  isLocalFile: true,
  // ... other properties
};
```

## Usage in Components

### Adding Videos
```typescript
import { uploadMediaFile } from './utils/media-upload';

// Upload will be instant for videos
const mediaItem = await uploadMediaFile(videoFile);
// mediaItem.serverPath = "blob:http://localhost:3000/abc-123"
// mediaItem.isLocalFile = true
```

### Cleanup
```typescript
import { cleanupLocalMediaFiles } from './utils/media-upload';

// In useEffect cleanup
useEffect(() => {
  return () => {
    cleanupLocalMediaFiles(mediaItems);
  };
}, [mediaItems]);
```

### Deleting Videos
```typescript
import { deleteMediaFile } from './utils/media-upload';

// Automatically detects and revokes blob URLs
await deleteMediaFile(userId, mediaItem.serverPath);
```

## Benefits

1. **No Size Limits**: Videos can be any size
2. **Instant Upload**: No network transfer required
3. **Better Performance**: Reduces server load
4. **Cost Effective**: No storage or bandwidth costs for videos
5. **Works in Production**: Compatible with Netlify's limitations

## Limitations

1. **Session Only**: Videos are lost on page reload
2. **Browser Memory**: Large videos use browser memory
3. **No Sharing**: Videos can't be shared between devices/sessions
4. **Manual Re-selection**: Users must re-select videos after refresh

## Future Improvements

- Implement proper video upload to cloud storage (S3, Cloudinary)
- Add IndexedDB File storage for persistence
- Implement chunked uploads for large files
- Add video compression before upload

## Environment Variables

No additional environment variables needed for local video handling.
For backend uploads (images/audio):
- `NEXT_PUBLIC_BACKEND_URL`: Backend API URL (optional)
