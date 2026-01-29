#!/bin/bash

# Configuration
# VIDEOS_DIR matches the path used in update-nginx.sh
VIDEOS_DIR="/home/Victor/reelmotion-editor-frontend/public/rendered-videos"
DAYS_TO_KEEP=4

echo "🧹 Starting video cleanup (files older than $DAYS_TO_KEEP days)..."

if [ -d "$VIDEOS_DIR" ]; then
    # Find files older than DAYS_TO_KEEP (-mtime +4) and delete them
    # -type f: only files
    # -name "*.mp4": only mp4 files (safety)
    found_files=$(find "$VIDEOS_DIR" -type f -name "*.mp4" -mtime +$DAYS_TO_KEEP -print)
    
    if [ -n "$found_files" ]; then
        echo "Deleting the following files:"
        echo "$found_files"
        find "$VIDEOS_DIR" -type f -name "*.mp4" -mtime +$DAYS_TO_KEEP -delete
        echo "✅ Cleanup complete."
    else
        echo "✅ No files older than $DAYS_TO_KEEP days found."
    fi
else
    echo "⚠️ Directory $VIDEOS_DIR does not exist."
fi
