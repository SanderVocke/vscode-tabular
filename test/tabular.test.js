const assert = require('node:assert/strict');
const { computePadding, VIRTUAL_SPACE } = require('../lib/tabular');

const lines = [
  'name,role,team,location,years',
  'Alice,Engineer,Platform,Berlin,4',
  'Bob,Designer,Product,Amsterdam,7',
  'Charlie,Engineering Manager,Infrastructure,London,12',
];

const padding = computePadding(lines, ',');

function paddingAt(lineNumber, character) {
  return padding.find((entry) => entry.lineNumber === lineNumber && entry.character === character)?.padding;
}

assert.equal(paddingAt(1, 5), 2, 'Alice should get 2 virtual spaces before the first comma');
assert.equal(paddingAt(2, 3), 4, 'Bob should get 4 virtual spaces before the first comma');
assert.equal(paddingAt(0, 9), 15, 'role header should align with Engineering Manager');
assert.equal(paddingAt(1, 14), 11, 'Engineer should align with Engineering Manager');
assert.equal(VIRTUAL_SPACE.repeat(4).length, 4, 'virtual padding must not collapse in our generated text');

console.log('tabular tests passed');
