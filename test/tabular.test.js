const assert = require('node:assert/strict');
const {
  applyAlignmentToLines,
  compactLines,
  computePadding,
  computePostDelimiterSpacing,
  VIRTUAL_SPACE,
} = require('../lib/tabular');

function paddingAt(padding, lineNumber, character) {
  return padding.find((entry) => entry.lineNumber === lineNumber && entry.character === character)?.padding;
}

function renderWithPadding(lines, padding) {
  return lines.map((line, lineNumber) => {
    const entries = padding
      .filter((entry) => entry.lineNumber === lineNumber)
      .sort((left, right) => right.character - left.character);

    let rendered = line;
    for (const entry of entries) {
      rendered = `${rendered.slice(0, entry.character)}${' '.repeat(entry.padding)}${rendered.slice(entry.character)}`;
    }
    return rendered;
  });
}

{
  const lines = [
    'name,role,team,location,years',
    'Alice,Engineer,Platform,Berlin,4',
    'Bob,Designer,Product,Amsterdam,7',
    'Charlie,Engineering Manager,Infrastructure,London,12',
  ];

  const padding = computePadding(lines, ',');

  assert.equal(paddingAt(padding, 0, 4), 4, 'widest first-column item should still get 1 trailing virtual space');
  assert.equal(paddingAt(padding, 1, 5), 3, 'Alice should get alignment padding plus 1 trailing virtual space');
  assert.equal(paddingAt(padding, 2, 3), 5, 'Bob should get alignment padding plus 1 trailing virtual space');
  assert.equal(paddingAt(padding, 0, 9), 16, 'role header should align with Engineering Manager plus spacing');
  assert.equal(paddingAt(padding, 1, 14), 12, 'Engineer should align with Engineering Manager plus spacing');

  const postDelimiterSpacing = computePostDelimiterSpacing(lines, ',');
  assert.equal(
    paddingAt(postDelimiterSpacing, 0, 5),
    1,
    'CSV should add one virtual space after the first comma before role'
  );
  assert.equal(
    paddingAt(postDelimiterSpacing, 1, 15),
    1,
    'CSV should add one virtual space after the second comma before Platform'
  );
}

{
  const lines = [
    'name  role  team',
    'Alice  Engineer  Platform',
    'Bob   Designer  Product',
    'Charlie  Engineering  Infrastructure',
  ];

  const rendered = renderWithPadding(lines, computePadding(lines, ' '));

  assert.equal(rendered[0].indexOf('role'), rendered[1].indexOf('Engineer'));
  assert.equal(rendered[0].indexOf('role'), rendered[2].indexOf('Designer'));
  assert.equal(rendered[0].indexOf('role'), rendered[3].indexOf('Engineering'));
  assert.equal(rendered[0].indexOf('team'), rendered[1].indexOf('Platform'));
  assert.equal(rendered[0].indexOf('team'), rendered[2].indexOf('Product'));
  assert.equal(rendered[0].indexOf('team'), rendered[3].indexOf('Infrastructure'));
  assert.deepEqual(computePostDelimiterSpacing(lines, ' '), []);
}

{
  const lines = [
    'name    role    team    location        years',
    'Alice    Engineer    Platform    Berlin    4',
    'Bob       Designer    Product    Amsterdam    7',
    'Charlie    EngineeringManager    Infrastructure    London    12',
    'Dana    QA    Mobile    Paris  2',
    'Eve    DataScientist    Analytics    NewYork    5',
  ];

  const rendered = renderWithPadding(lines, [
    ...computePadding(lines, ' '),
    ...computePostDelimiterSpacing(lines, ' '),
  ]);

  assert.equal(rendered[0].indexOf('role'), rendered[1].indexOf('Engineer'));
  assert.equal(rendered[0].indexOf('role'), rendered[2].indexOf('Designer'));
  assert.equal(rendered[0].indexOf('role'), rendered[3].indexOf('EngineeringManager'));
  assert.equal(rendered[0].indexOf('team'), rendered[1].indexOf('Platform'));
  assert.equal(rendered[0].indexOf('team'), rendered[4].indexOf('Mobile'));
  assert.equal(rendered[0].indexOf('location'), rendered[3].indexOf('London'));
  assert.equal(rendered[0].indexOf('location'), rendered[5].indexOf('NewYork'));
  assert.equal(rendered[0].indexOf('years'), rendered[4].indexOf('2'));
  assert.equal(rendered[0].indexOf('years'), rendered[5].indexOf('5'));
}

{
  const lines = [
    'name, role, team',
    'Alice,Engineer , Platform',
    'Bob, Designer,Product',
  ];

  assert.deepEqual(compactLines(lines, ','), [
    'name,role,team',
    'Alice,Engineer,Platform',
    'Bob,Designer,Product',
  ]);
}

{
  const lines = [
    'name role team',
    'Alice Engineer Platform',
    'Bob Designer Product',
  ];

  const aligned = applyAlignmentToLines(lines, ' ');

  assert.equal(aligned[0].indexOf('role'), aligned[1].indexOf('Engineer'));
  assert.equal(aligned[0].indexOf('role'), aligned[2].indexOf('Designer'));
  assert.equal(aligned[0].indexOf('team'), aligned[1].indexOf('Platform'));
  assert.equal(aligned[0].indexOf('team'), aligned[2].indexOf('Product'));
  assert.deepEqual(compactLines(aligned, ' '), lines);
}

assert.equal(VIRTUAL_SPACE.repeat(4).length, 4, 'virtual padding must not collapse in our generated text');

console.log('tabular tests passed');
