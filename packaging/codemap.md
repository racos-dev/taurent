# packaging/

## Responsibility

Packaging metadata that is not owned by Tauri's `src-tauri` bundle config.
Currently this contains the Flatpak desktop integration files used by the
release workflow.

## Structure

| Path | Role |
|---|---|
| `flatpak/` | Metadata for the GitHub Release Flatpak bundle: desktop launcher, AppStream metainfo, and notes about the bundle permissions/runtime. |

## Integration

- `scripts/release/build-flatpak-bundle.mjs` copies files from `flatpak/` into
  the Flatpak build directory.
- `.github/workflows/release-build.yml` invokes that script after building the
  desktop Linux binary.
