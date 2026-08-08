# Mediator 2

> [!CAUTION]
> **Mediator 2 is a pre-alpha prototype.** It is an experimental proof of concept, not a stable application or production-ready service. Features, data formats, setup steps, and user interfaces may change or disappear without notice. Bugs may cause data loss. Do not use the application as the only copy of important creative work, and do not rely on it for production workflows.

Mediator 2 is an experimental desktop workspace for organizing a fictional universe. It brings characters, locations, maps, artwork, creative seasons, and audiobook listening tools into a cinematic Electron interface.

The prototype explores a repository-backed workflow: a user can connect a GitHub repository as a **bridge**, and Mediator stores the universe archive and uploaded media references in that repository. A self-contained demo universe is also available for exploring the interface without connecting a repository.

## Project status: pre-alpha prototype

Mediator 2 is currently in the **pre-alpha prototyping stage**. The repository exists to test product ideas, interaction patterns, and technical approaches.

At this stage, you should expect:

- incomplete, experimental, or placeholder features;
- breaking changes with no migration guarantee;
- limited automated test coverage;
- rough error handling and unhandled edge cases;
- platform-specific behavior that has not been broadly tested;
- changes to the archive schema and local application data;
- third-party integrations that may stop working;
- no uptime, compatibility, support, or data-retention guarantees.

**Keep independent backups of every repository and media library used with Mediator 2. Use a disposable test repository when evaluating GitHub synchronization.**

## Current prototype capabilities

The current codebase demonstrates:

- a desktop Electron shell with a custom cinematic interface;
- a demo universe that can be opened without GitHub credentials;
- GitHub repository connection through a fine-grained personal access token;
- optional Google Drive API-key entry at login for Drive-backed audiobook features;
- creation and editing of universe identity, character, location, and map records;
- image compression and repository-backed artwork storage;
- nested map, zone, and location views;
- creative seasons with activity history, statistics, covers, and Streamable trailer links;
- detection of some character changes made outside the running application;
- local audiobook folder scanning and playback on desktop;
- audiobook progress, checkpoints, bookmarks, and season associations;
- optional prototype add-on states for Seasons and Audiobooks;
- an installable PROMO add-on for bridge-backed announcements with Streamable video, a latest-video banner, newest-first publishing, and automatic 90-day archiving;

These capabilities describe the current experiment, not a finalized feature set.

## How repository bridging works

When connected to GitHub, Mediator reads and writes data through the GitHub REST API. The primary universe archive is stored at:

```text
mediator/data.json
```

Compressed artwork uploaded through the application is stored beneath:

```text
mediator/assets/
```

The connected token requires **Contents: Read and write** access to the selected repository. If the user chooses to remember the bridge, the Electron application attempts to encrypt the token with the operating system's secure storage before writing it to the local application-data directory.

Because this integration is still experimental:

1. Create a dedicated test repository.
2. Grant the token access only to that repository.
3. Use the minimum required repository permissions.
4. Keep repository history and separate backups.
5. Revoke the token when testing is complete.

Never commit a personal access token to this repository or place one in screenshots, issues, or logs.

The Google Drive API key is optional. When supplied at login, Mediator uses that key directly for Google Drive requests. Remembered keys use the same operating-system encrypted credential file as the bridge token in the Electron client; browser builds store remembered values only in that browser profile.

## Run the prototype

### Prerequisites

- Node.js with npm
- A desktop environment capable of running Electron
- Internet access for Google Fonts, GitHub bridging, remote images, and external media features
- Optional: Python 3.9 or newer when using the convenience launcher

### Install and start with npm

```bash
npm install
npm start
```

### Start with the Python launcher

```bash
python main.py
```

The Python launcher checks the local Node/npm setup, installs Electron dependencies when needed, and runs `npm start`. The project currently has no third-party Python package requirements.

After launch, select **Explore the Demo Universe** for the safest way to inspect the prototype. Repository bridging should be tested only with non-critical data.

## Audiobook prototype

The desktop application can scan a selected local directory for audiobook folders. Each direct child folder is treated as a book when it contains a supported audio file. Supported extensions currently include MP3, M4A, M4B, AAC, OGG, WAV, FLAC, and Opus.

Local audiobook files are not uploaded by the folder scanner. Playback state and related archive metadata may still be stored locally or written to the connected universe archive. Cover art is served to the renderer through an application-specific protocol while the application is running.

Audiobook behavior is experimental. Do not reorganize or delete a media collection based solely on information shown in Mediator.

## Technology and repository layout

Mediator 2 intentionally has a small prototype-oriented structure:

| Path | Purpose |
| --- | --- |
| `main.js` | Electron main process and renderer prototype logic |
| `preload.js` | Restricted IPC bridge exposed to the renderer |
| `index.html` | Application markup and dialogs |
| `styles.css` | Access portal and shared visual styling |
| `workspace.css` | Main workspace and feature styling |
| `main.py` | Optional development launcher |
| `package.json` | npm metadata and Electron dependency |

The current single-file-heavy organization is a prototyping tradeoff and should not be interpreted as the intended production architecture.

## Known limitations

- There is no stable public release or packaged installer.
- The archive schema is not guaranteed to remain backward compatible.
- There is no formal migration, recovery, or conflict-resolution system.
- Simultaneous edits from multiple clients may overwrite newer repository data.
- GitHub API limits, permissions, connectivity, or service changes can interrupt saves.
- External images, fonts, Google Drive content, and Streamable media depend on third-party availability.
- Credential storage and application behavior have not received a production security audit.
- Accessibility, keyboard navigation, responsiveness, and reduced-motion behavior remain works in progress.
- Automated tests and supported-platform coverage are currently limited.
- Add-on installation is a prototype state toggle, not a production extension marketplace.

## Contributing during pre-alpha

Small, focused changes are easiest to review while the architecture is still evolving. Before opening a change:

1. Run the available syntax and whitespace checks.
2. Test the affected flow with the demo universe where possible.
3. Use disposable data for repository-bridge testing.
4. Document any archive-schema or local-storage changes clearly.
5. Avoid presenting prototype behavior as stable or production-ready.

## Release expectations

There is currently no promised release date, compatibility window, or upgrade path. A future alpha would require stronger data migrations, automated testing, security review, packaging, documentation, and recovery behavior. Until those foundations exist, every build from this repository should be treated as a development prototype.
