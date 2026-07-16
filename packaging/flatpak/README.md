# Taurent Flatpak Bundle

This directory contains the desktop integration files used by
`scripts/release/build-flatpak-bundle.mjs`.

The release workflow builds the normal Tauri Linux binary first, then packages
that binary into a single-file Flatpak bundle using the GNOME 50 runtime. This is
intended for GitHub Release testing on immutable Linux distributions. It is not
yet a Flathub-ready source manifest.

The bundle grants:

- network access for qBittorrent HTTP/Web API traffic
- Wayland with X11 fallback
- DRI access for WebKitGTK rendering
- notification portal access
- read/write access to `xdg-download`
