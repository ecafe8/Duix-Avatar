# Duix Avatar Web

The LAN web client runs as a separate Next.js service. It receives model videos in the browser, uploads them to the host, converts them with FFmpeg, trains a voice through the existing TTS container, and submits synthesis tasks to the existing video container.

## Run locally

From the repository root:

```bash
npm --prefix src-web install
npm --prefix src-web run dev
```

The development server listens on `0.0.0.0:3000`. Set `TTS_API_URL` and `F2F_API_URL` if the Docker services are not available at `127.0.0.1` from the web server process.

## Docker Compose

The Linux Compose file adds the web client at `http://<server-lan-ip>:3000`. Copy `deploy/.env.example` to `deploy/.env` to select the host directories for avatar videos, TTS data, and the web database, or to change the published web port. The defaults preserve the existing `duix_avatar_data` folders.

Uploaded model videos are stored under the configured face2face directory. The web database and generated metadata use the configured web data directory. Keep these paths on persistent storage.

The browser UI is intended for a trusted LAN. Allow TCP port 3000 only on networks that should have access; the current web client does not include user authentication.
