# MediaPipe Face Detector (vendored)

- `vision_bundle.mjs` e `wasm/` — @mediapipe/tasks-vision 1.2.3 (Apache-2.0, Google).
- `blaze_face_short_range.tflite` e `blaze_face_full_range.tflite` — modelos BlazeFace de perto e de longe (Apache-2.0, Google).

Usados por `src/lib/face-detect.ts` para achar rostos no enquadramento automático.
Ficam aqui (e não num CDN) para funcionar sem depender de serviço externo.
