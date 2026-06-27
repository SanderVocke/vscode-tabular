const VIRTUAL_SPACE = '\u00a0';

/**
 * Computes zero-width insertion points for virtual padding before delimiters.
 *
 * For most delimiters, every literal delimiter occurrence separates cells.
 * For a single-space delimiter, each run of one or more spaces separates cells.
 *
 * @param {string[]} lines
 * @param {string} delimiter
 * @returns {{ lineNumber: number, character: number, padding: number }[]}
 */
function computePadding(lines, delimiter) {
  if (delimiter === ' ') {
    return computeSpacePadding(lines);
  }

  const rows = parseRows(lines, delimiter);

  const maxColumnWidths = [];

  for (const row of rows) {
    for (let column = 0; column < row.columns.length; column += 1) {
      const entry = row.columns[column];
      maxColumnWidths[column] = Math.max(
        maxColumnWidths[column] || 0,
        visibleWidth(entry.content)
      );
    }
  }

  const padding = [];

  for (const row of rows) {
    for (let column = 0; column < row.columns.length; column += 1) {
      const entry = row.columns[column];
      const amount = (maxColumnWidths[column] || 0) - visibleWidth(entry.content) - entry.existingPadding + 1;

      if (amount > 0) {
        padding.push({
          lineNumber: row.lineNumber,
          character: entry.delimiterCharacter,
          padding: amount,
        });
      }
    }
  }

  return padding;
}

/**
 * Computes one virtual space after each delimiter, before the next cell content.
 *
 * @param {string[]} lines
 * @param {string} delimiter
 * @returns {{ lineNumber: number, character: number, padding: number }[]}
 */
function computePostDelimiterSpacing(lines, delimiter) {
  if (delimiter === ' ') {
    return [];
  }

  return parseRows(lines, delimiter).flatMap((row) => row.columns.flatMap((entry) => {
    const amount = Math.max(0, 1 - entry.existingPostDelimiterPadding);

    if (amount === 0) {
      return [];
    }

    return [{
      lineNumber: row.lineNumber,
      character: entry.delimiterCharacter + entry.delimiterLength,
      padding: amount,
    }];
  }));
}

/**
 * Returns new lines with the same alignment currently shown by decorations
 * committed as real spaces.
 *
 * @param {string[]} lines
 * @param {string} delimiter
 */
function applyAlignmentToLines(lines, delimiter) {
  const insertions = [
    ...computePadding(lines, delimiter),
    ...computePostDelimiterSpacing(lines, delimiter),
  ];

  return insertPadding(lines, insertions, ' ');
}

/**
 * Returns new lines with leading/trailing whitespace removed from every cell.
 * For a space delimiter, runs of spaces are compacted to one space.
 *
 * @param {string[]} lines
 * @param {string} delimiter
 */
function compactLines(lines, delimiter) {
  return lines.map((line) => {
    if (delimiter === ' ') {
      return parseSpaceCells(line).map((cell) => cell.content.trim()).join(' ');
    }

    return line.split(delimiter).map((cell) => cell.trim()).join(delimiter);
  });
}

/**
 * @param {string[]} lines
 * @param {{ lineNumber: number, character: number, padding: number }[]} insertions
 * @param {string} text
 */
function insertPadding(lines, insertions, text) {
  const insertionsByLine = new Map();

  for (const insertion of insertions) {
    const lineInsertions = insertionsByLine.get(insertion.lineNumber) || [];
    lineInsertions.push(insertion);
    insertionsByLine.set(insertion.lineNumber, lineInsertions);
  }

  return lines.map((line, lineNumber) => {
    const lineInsertions = insertionsByLine.get(lineNumber) || [];
    let result = line;

    for (const insertion of lineInsertions.sort((left, right) => right.character - left.character)) {
      result = `${result.slice(0, insertion.character)}${text.repeat(insertion.padding)}${result.slice(insertion.character)}`;
    }

    return result;
  });
}

/**
 * @param {string[]} lines
 * @param {string} delimiter
 */
function parseRows(lines, delimiter) {
  return lines.map((line, lineNumber) => ({
    lineNumber,
    columns: parseColumns(line, delimiter),
  }));
}

/**
 * @param {string} line
 * @param {string} delimiter
 * @returns {{ content: string, delimiterCharacter: number, delimiterLength: number, existingPadding: number, existingPostDelimiterPadding: number }[]}
 */
function parseColumns(line, delimiter) {
  if (delimiter === ' ') {
    return parseSpaceDelimitedColumns(line);
  }

  const columns = [];
  let cellStart = 0;
  let delimiterCharacter = line.indexOf(delimiter, cellStart);

  while (delimiterCharacter !== -1) {
    const rawCell = line.slice(cellStart, delimiterCharacter);
    const nextCellStart = delimiterCharacter + delimiter.length;

    columns.push({
      content: rawCell.trim(),
      delimiterCharacter,
      delimiterLength: delimiter.length,
      existingPadding: trailingWhitespaceLength(rawCell),
      existingPostDelimiterPadding: leadingWhitespaceLength(line.slice(nextCellStart)),
    });

    cellStart = nextCellStart;
    delimiterCharacter = line.indexOf(delimiter, cellStart);
  }

  return columns;
}

/**
 * Parses space-delimited text by treating every run of one or more spaces as a
 * separator. Spaces inside cell contents are not supported when the delimiter is
 * a space.
 *
 * @param {string} line
 * @returns {{ content: string, delimiterCharacter: number, delimiterLength: number, existingPadding: number, existingPostDelimiterPadding: number }[]}
 */
function parseSpaceDelimitedColumns(line) {
  const cells = parseSpaceCells(line);

  return cells.slice(0, -1).map((cell) => ({
    content: cell.content,
    delimiterCharacter: cell.end,
    delimiterLength: 1,
    existingPadding: 0,
    existingPostDelimiterPadding: 0,
  }));
}

/**
 * @param {string[]} lines
 */
function computeSpacePadding(lines) {
  const rows = lines.map((line, lineNumber) => ({
    lineNumber,
    cells: parseSpaceCells(line),
  }));
  const maxColumnWidths = [];
  const targetStarts = [0];

  for (const row of rows) {
    for (let column = 0; column < row.cells.length; column += 1) {
      const cell = row.cells[column];
      maxColumnWidths[column] = Math.max(maxColumnWidths[column] || 0, visibleWidth(cell.content));
    }
  }

  const columnCount = maxColumnWidths.length;

  for (let column = 1; column < columnCount; column += 1) {
    let maxCurrentStart = 0;

    for (const row of rows) {
      if (row.cells[column]) {
        maxCurrentStart = Math.max(
          maxCurrentStart,
          row.cells[column].start + insertedBeforeColumn(row, column, targetStarts)
        );
      }
    }

    targetStarts[column] = Math.max(
      maxCurrentStart,
      (targetStarts[column - 1] || 0) + (maxColumnWidths[column - 1] || 0) + 3
    );
  }

  const padding = [];

  for (const row of rows) {
    let inserted = 0;

    for (let column = 1; column < row.cells.length; column += 1) {
      const cell = row.cells[column];
      const amount = (targetStarts[column] || 0) - cell.start - inserted;

      if (amount > 0) {
        padding.push({
          lineNumber: row.lineNumber,
          character: cell.start,
          padding: amount,
        });
        inserted += amount;
      }
    }
  }

  return padding;
}

/**
 * @param {{ cells: { start: number }[] }} row
 * @param {number} column
 * @param {number[]} targetStarts
 */
function insertedBeforeColumn(row, column, targetStarts) {
  let inserted = 0;

  for (let previousColumn = 1; previousColumn < column; previousColumn += 1) {
    const cell = row.cells[previousColumn];
    if (!cell) {
      continue;
    }

    inserted += Math.max(0, (targetStarts[previousColumn] || 0) - cell.start - inserted);
  }

  return inserted;
}

/**
 * @param {string} line
 * @returns {{ content: string, start: number, end: number }[]}
 */
function parseSpaceCells(line) {
  const separatorPattern = / +/g;
  const cells = [];
  let contentStart = line.search(/\S/);

  if (contentStart === -1) {
    return cells;
  }

  for (const separator of line.matchAll(separatorPattern)) {
    const separatorStart = separator.index;
    const separatorEnd = separatorStart + separator[0].length;

    if (separatorStart <= contentStart || !/\S/.test(line.slice(separatorEnd))) {
      continue;
    }

    cells.push({
      content: line.slice(contentStart, separatorStart),
      start: contentStart,
      end: separatorStart,
    });

    contentStart = line.slice(separatorEnd).search(/\S/) + separatorEnd;
  }

  cells.push({
    content: line.slice(contentStart),
    start: contentStart,
    end: line.length,
  });

  return cells;
}

/**
 * @param {string} text
 */
function trailingWhitespaceLength(text) {
  return text.length - text.trimEnd().length;
}

/**
 * @param {string} text
 */
function leadingWhitespaceLength(text) {
  return text.length - text.trimStart().length;
}

/**
 * @param {string} text
 */
function visibleWidth(text) {
  return text.length;
}

module.exports = {
  VIRTUAL_SPACE,
  applyAlignmentToLines,
  compactLines,
  computePadding,
  computePostDelimiterSpacing,
  visibleWidth,
};
