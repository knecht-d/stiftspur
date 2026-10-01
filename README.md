# Stiftspur

Turn text into SVG pen paths with a live preview. Stiftspur is a small, static web app for pen plotters and tools such as Cricut. It runs entirely in your browser, with a German and English interface.

## Features

- Rich text input with paragraph alignment: left, center, right and justified.
- Paper sizes and margins with automatic text fitting.
- Independent automatic or manual settings for font size and line spacing.
- Font sizing relative to pen width, adjustable spacing and optical letter placement.
- Fourteen bundled fonts with visual previews, plus local TTF/OTF uploads.
- Adjustable handwriting variation: letter shape, word flow, spacing rhythm and irregularity.
- Original alternate glyphs for supported fonts, with a comparison viewer.
- Standard page SVG and a compact, single-object SVG export for Cricut.

Text and uploaded fonts are processed locally. The app has no backend, analytics or external CDN dependencies, and does not persist your text between sessions.

## Run locally

Serve the `dist/` directory with any static web server. For example, from the repository root:

```sh
python3 -m http.server 8000 --directory dist
```

Open <http://localhost:8000>. Use `?lang=en` to open the English interface.

No npm installation or build step is required to use the checked-in app.

## Usage

1. Enter your text. Enter starts a paragraph; Shift + Enter inserts a line break within a paragraph.
2. Select a font using the preview dialog, or upload a local TTF/OTF file.
3. Choose the paper size and margins, then adjust sizing and spacing.
4. Adjust naturalness and its optional fine controls. Generate a new pattern to change the deterministic variation seed.
5. Download the SVG in the format appropriate for your device.

Alignment applies to the current or selected paragraphs. Justification expands word spacing on automatically wrapped lines. Missing characters and layout overflow produce visible warnings.

For Cricut, select the **Draw/Pen** operation in Design Space. The Cricut export combines all strokes into one SVG path with separate subpaths, preserving their relative positions. It crops to the text bounds and encodes physical dimensions at 96 pixels per inch. The standard export retains the whole page and separate pen paths.

**Cricut hardware and Design Space import behavior have not yet been verified in practice.** Check the imported dimensions against the text size shown in the app before drawing. If Design Space separates the strokes into multiple layers, use Attach to preserve placement.

## Fonts and glyph variants

| Category | Fonts |
| --- | --- |
| Natural | EMS Neato, EMS Casual Hand, EMS Delight, EMS Pancakes, Mistral SingleLine, VHS Hand |
| Technical | EMS Tech, Relief SingleLine, EMS Readability, EMS Nixish |
| Creative | EMS League, EMS Capitol, EMS Allure, EMS Felix |

The EMS fonts contain one original drawing per character. Relief, Mistral and VHS Hand additionally provide selected original alternatives. The variant viewer shows the drawings actually available for each supported character; not every character has alternatives.

VHS Hand is experimental: its source contains multiple recorded forms but has limited character coverage. Missing characters are reported rather than invented or substituted from another font.

Procedural shape variation is separate from these original glyph alternatives. Smooth changes shared across each word create a writing rhythm; the app does not add independent noise to every path point. It does not reproduce a particular person's handwriting.

Uploaded outline fonts are not generally convertible into true single-line fonts. Automatic contour processing removes detected return paths; uncertain contours are retained and reported. Native OpenType alternates, ligature substitutions and kerning tables in uploaded fonts are currently not applied.

## Development

The app uses native JavaScript modules. Its main components are:

| File in `dist/` | Responsibility |
| --- | --- |
| `app.mjs`, `editor.mjs`, `i18n.mjs` | UI, text editing and translations |
| `fonts.mjs`, `font-preview.mjs`, `variant-preview.mjs` | Font loading and previews |
| `engine.mjs` | Curve sampling and contour processing |
| `layout.mjs`, `optical.mjs` | Alignment, fitting and optical spacing |
| `handwriting.mjs` | Deterministic glyph and word variation |
| `export.mjs` | SVG export and physical dimensions |

Run the committed regression tests with Node.js:

```sh
node tests/handwriting.test.mjs
node tests/native-variants.test.mjs
node tests/export.test.mjs
```

Regenerate font previews with:

```sh
node scripts/font-previews.mjs
```

Original font data and provenance are in `font-sources/`. Rebuilding the font assets requires Python and fontTools:

```sh
python3 scripts/convert-fonts.py
python3 scripts/convert-vhs.py
```

The tests cover geometry, deterministic variation, native alternates, fitting and SVG export. They do not replace browser interaction tests or physical plotter tests.

For deployment, see [GitHub Pages](GITHUB.md).

## AI disclosure

Stiftspur was developed with substantial assistance from OpenAI ChatGPT/Codex, including generated and revised code, documentation and tests, under the project owner's direction. AI-assisted output may contain mistakes. Automated tests cover selected behavior; they do not establish a comprehensive human code audit or guarantee compatibility with every font, browser or device. Review the output before using it with a physical machine.

The bundled fonts are third-party works with their own provenance and licenses; this disclosure does not imply that they were AI-generated.

## Third-party licenses

The thirteen EMS/isdaT fonts are distributed under the SIL Open Font License 1.1. VHS Hand data is distributed under AGPL-3.0. OpenType.js 1.3.4 is distributed under the MIT license. Original notices, font sources and the VHS source/converter archive are included with the project and linked from the app's [license page](dist/fonts/licenses.html).

These third-party licenses do not by themselves grant a license to the rest of the application. No separate application license has been selected yet. Preserve the bundled copyright and license notices when redistributing the assets.
