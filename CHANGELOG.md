# Changelog

## v2.1.0 - 2026-05-23

### Added

- App icon in the title bar and Windows portable build.
- Direct download link for the portable `.exe` in the README.

### Changed

- README, contributing guide, and crash knowledge docs rewritten in Lumin voice.
- Sidebar branding now uses text only. The icon appears in the top bar.

## v2.0.0 - 2026-05-23

Initial public Electron release of Crash Detector.

### Added

- Windows Event Viewer scanning for Application and System crash signals.
- Automatic scan of the last 30 days on launch.
- Crash grouping with explanations, evidence, follow-up checks, and raw messages.
- JSON knowledge packs for games and Windows crash signatures.
- Installed game detection for Steam, Epic, and common local markers.
- Manual executable selection for process-specific scans.
- JSON and TXT report exports.
- Public contribution docs for adding games, crash signatures, and source links.

### Changed

- Ported the previous .NET/WPF concept into a JavaScript Electron app.
- Moved game and crash-code knowledge out of compiled app logic and into documented data files.
