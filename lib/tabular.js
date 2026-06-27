const VIRTUAL_SPACE = '\u00a0';

/**
 * Computes zero-width insertion points for virtual padding before delimiters.
 *
 * @param {string[]} lines
 * @param {string} delimiter
 * @returns {{ lineNumber: number, character: number, padding: number }[]}
 */
function computePadding(lines, delimiter) {
  const rows = [];
  const maxColumnWidths = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const cells = lines[lineNumber].split(delimiter);
    rows.push({ lineNumber, cells });

    for (let column = 0; column < cells.length - 1; column += 1) {
      maxColumnWidths[column] = Math.max(maxColumnWidths[column] || 0, visibleWidth(cells[column]));
    }
  }

  const padding = [];

  for (const row of rows) {
    let character = 0;

    for (let column = 0; column < row.cells.length - 1; column += 1) {
      const cell = row.cells[column];
      const amount = (maxColumnWidths[column] || 0) - visibleWidth(cell);

      if (amount > 0) {
        padding.push({
          lineNumber: row.lineNumber,
          character: character + cell.length,
          padding: amount,
        });
      }

      character += cell.length + delimiter.length;
    }
  }

  return padding;
}

/**
 * @param {string} text
 */
function visibleWidth(text) {
  return text.length;
}

module.exports = {
  VIRTUAL_SPACE,
  computePadding,
  visibleWidth,
};
