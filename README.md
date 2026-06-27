# Tabular Viewing Mode

Tabular Viewing Mode is a VS Code extension for making delimiter-separated text easier to read without changing the file contents.

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
   Tabular Viewing Mode: Toggle Viewing Mode
   ```

4. Enter the delimiter when prompted.
   - Use `,` for CSV.
   - Use `\t` for tab-separated files.
   - Use `|`, `;`, or any other delimiter as needed.

The mode is enabled per file. Running the same command again in that file disables it.

When enabled, the extension recomputes column widths as the document changes.

## How to install

### Development / local testing

1. Open this folder in VS Code.
2. Go to **Run and Debug**.
3. Select **Run Extension**.
4. Press `F5`.
5. A new Extension Development Host window opens with the extension loaded.

### Install from a VSIX package

If you have a packaged `.vsix` file, install it with:

```bash
code --install-extension tabular-viewing-mode-0.0.1.vsix
```

To create a VSIX package locally, install `vsce` and package the extension:

```bash
npm install -g @vscode/vsce
vsce package
```

Then install the generated `.vsix` file using the command above.
