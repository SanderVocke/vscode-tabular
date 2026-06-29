# vscode-tabular: Tools for Tabular Editing in VSCode

A VS Code extension for making delimiter-separated text easier to read without changing the file contents.

It is useful for files such as CSV, TSV, pipe-separated data, log-like tables, or any other plain-text format where columns are separated by a delimiter.

## Purpose

Delimiter-separated files can be hard to scan when cell contents have different lengths:

```csv
name,role,team,location,years
Alice,Engineer,Platform,Berlin,4
Charlie,Engineering Manager,Infrastructure,London,12
```

This extension adds virtual padding spaces before delimiters so the separators line up visually. The added spaces are editor decorations only; they are not inserted into the file and will not be saved.

## How to use

1. Open a delimiter-separated text file.
2. Open the Command Palette with `Ctrl+Shift+P`.
3. Run:

   ```text
   Tabular: Edit As Aligned
   ```

4. Enter the delimiter when prompted.
   - Use `,` for CSV.
   - Use `\t` for tab-separated files.
   - Use `|`, `;`, or any other delimiter as needed.

The mode is enabled per file. Running the same command again in that file disables it.

When enabled, the extension recomputes column widths as the document changes.

Additional commands:

- `Tabular: Align Content` inserts the visible alignment as real spaces in the file.
- `Tabular: Compact Content` trims leading and trailing whitespace in every cell. For space-delimited files, separator runs are compacted to a single space.
- `Tabular: Open Transposed View` opens a read-only snapshot where rows and columns are swapped. The snapshot uses the active file contents at the time the command is run and does not update if the source file changes.

If tabular view is already enabled for the active file, these commands reuse that file's delimiter. Otherwise, they ask for a delimiter.

## How to install

### Development / local testing

1. Open this folder in VS Code.
2. Go to **Run and Debug**.
3. Select **Run Extension**.
4. Press `F5`.
5. A new Extension Development Host window opens with the extension loaded.

### Build and install a VSIX package

This repo includes a canonical npm script for building the extension package. From the repo root, run:

```bash
npm install
npm run build:vsix
```

The build script runs the syntax checks, tests, and then creates a `.vsix` file using the local `@vscode/vsce` dev dependency.

Install the generated package with:

```bash
code --install-extension vscode-tabular-0.0.1.vsix
```

The exact `.vsix` filename includes the version from `package.json`.
