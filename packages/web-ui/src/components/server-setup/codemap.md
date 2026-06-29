# packages/web-ui/src/components/server-setup/

## Responsibility

Server connection and onboarding flow components for adding, logging into, and testing qBittorrent server connections.

## Design

- **ServerConnectionFields**: Shared form fields (name, URL, username, password, remember checkbox) used by both login and add-server forms. Accepts validation errors per field.
- **LoginFormBody**: Login form with URL, username, password fields and a Connect button. Shows location and connection errors. Detects CORS errors for browser mode.
- **AddServerFormBody**: Two-step add server form with name, URL, username, password fields, test connection, and add button. Desktop variant shows `StepIndicator` and separate test/add buttons. Mobile variant shows a single "Add & Connect" button.
- **AddTorrentScreenBody**: Full add-torrent form with magnet link/file upload modes, destination settings (save path, category, tags), and advanced options (sequential, skip hash, paused, root folder, rate limits, content layout, stop condition). Desktop variant shows all options in a unified form. Mobile variant shows collapsible sections.
- **AuthLoadingScreen**: Full-screen loading spinner with customizable text for authentication/connection states.
- **StepIndicator**: Horizontal step progress indicator with active/completed/pending states.
- **TestConnectionFeedback**: Inline feedback banner for connection test states (idle, testing, success, error with optional suggestion).

## Flow

Components are fully controlled — they receive all form state and callbacks from the parent controller (e.g., `useAddServerScreenController` from `@taurent/web-core`). Form validation, test connection, and submit are all driven by parent callbacks.

## Integration

Consumed by app shells in server setup screens. `AddTorrentScreenBody` is exported from `src/index.ts` for both desktop and mobile apps. `ServerConnectionFields` is shared between login and add-server flows.
