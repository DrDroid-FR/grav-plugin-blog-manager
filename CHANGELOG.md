# Changelog

All notable changes to this plugin will be documented in this file.

## [1.2.1] - 2026-04-15

### Changed
- Replaced range calendar with two date input fields (Begin Date, End Date) for date filtering. Calendar HTML commented out in template for future re-enable.

### Added
- **Language filter**: Filter posts by language (based on `item.{lang}.md` files).
- **Language display**: 2-letter language badge on card thumbnails and in list view column.

### Fixed
- Error handling around YAML parsing to gracefully handle malformed frontmatter without 500 errors.
- File existence checks to prevent crashes on unreadable post files.

## [1.2.0] - 2026-04-04

### Added
- **Export/Import**: Export all or selected posts as ZIP. Import posts from ZIP with automatic folder creation and duplicate name handling.
- Loading placeholders: replaces spinner with shimmer animation cards/list rows.
- Card view tags now render as colored pills.

### Changed
- Fixed date range filter to properly normalize `dd/mm/yyyy` dates to `yyyy-mm-dd` before comparison.

## [1.1.1] - 2026-04-02

### Added
- Complete French translation.
- File structure documentation in README.

### Changed
- All UI strings replaced with translation filter calls (Twig) and `T` helper object (JS).
- CSS extracted to external file.

### Removed
- Unused functions and `permissions` section from `blog-manager.yaml`.

### Fixed
- Missing translation key.

## [1.1.0] - 2026-03-29

### Added
- **Blog detection**: Numeric prefix folder detection (e.g. `03.blog` → `blog`), auto-detect on init with `scan_on_init` setting.
- **Language support**: `findItemFile()` locates `item.md` or `item.{lang}.md` for multilingual blogs.
- **Image detection**: Auto-detects from frontmatter (primaryImage, image, header_image_file, etc.) with fallback to first media file and Grav logo placeholder.
- **Multi-select**: Ctrl+click to toggle, Shift+click for range selection.
- **Bulk actions**: Publish, Visible, Duplicate, Delete with confirmation modals.
- **Image cache-busting**: `?v=<filemtime>` to prevent stale browser cache.

### Changed
- `setView()` now CSS-only (no DOM re-render).
- List view responsive: hides excerpt, visible, date, tags progressively on narrow viewports.
- Titlebar h1 reset `transform` to cancel Grav admin offset.

## [1.0.0] - 2026-03-27

### Added
- Blog Manager admin page with sidebar navigation.
- **Three view modes**: big cards (2-col), small cards (4-col), list view.
- **View mode persistence** via `sessionStorage`.
- **Post listing**: YAML frontmatter parsing, thumbnail display, excerpt extraction.
- **Inline status toggle**: Click Published/Visible badges to toggle without page reload.
- **Post actions**: Create new post, duplicate (copies folder, appends "- copy", unpublishes), delete with confirmation modal.
- **Filter panel**: Search, Published, Visible, Category, Tag, Date Range with range calendar widget.
- **Date formatting**: Locale-aware using `Intl.DateTimeFormat`, supports multiple formats.
- **Blog path auto-detection**: Scans `user/pages/` for folder matching configured path.
- **Numeric prefix**: New posts use numbered folder format (e.g. `08.untitled-post`).
- **Bilingual**: Full English and French support.

### Technical
- Task-based routing using Grav URI params (`/task:blogManagerList`).
- JSON API responses for all AJAX operations.
- XSS prevention via `escapeHtml` utility.

### Configuration
- Plugin Enabled toggle, Blog Path text input, Auto-detect blog on init toggle, Custom placeholder image upload.