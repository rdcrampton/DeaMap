# Face-API Models

This directory contains the pre-trained models for face detection using `@vladmandic/face-api`.

## Required Models

The application requires the following models for automatic face detection:

- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1`

## Automatic Loading

The application will automatically try to load models from:

1. **Local**: `/public/models` (this directory)
2. **CDN Fallback**: `https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model`

If models are not available locally, they will be loaded from the CDN automatically.

## Manual Installation (Optional)

If you want to host the models locally for better performance, download them from:

```bash
# Download models from the official repository
cd public/models

# Tiny Face Detector
wget https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/tiny_face_detector_model-weights_manifest.json
wget https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/tiny_face_detector_model-shard1

# Face Landmarks 68
wget https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_landmark_68_model-weights_manifest.json
wget https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_landmark_68_model-shard1
```

## Alternative: Using npm

You can also copy models from the installed npm package:

```bash
cp -r node_modules/@vladmandic/face-api/model/* public/models/
```

## Note

The face detection feature will work without local models by using the CDN fallback, but having them locally provides:

- Faster loading times
- Offline capability
- No external dependencies during runtime
