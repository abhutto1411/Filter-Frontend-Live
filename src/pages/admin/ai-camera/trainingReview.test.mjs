import assert from 'node:assert/strict';
import {
  defaultLabelForCrop,
  exportStatusParam,
  nextReviewIndex,
  normalizeCharBoxes,
  normalizeTrainingLabel,
  trainingImageSrc,
} from './trainingReview.js';

assert.equal(normalizeTrainingLabel(' zv j 7857 '), 'ZVJ7857');
assert.equal(normalizeTrainingLabel('ab'), 'AB');
assert.equal(defaultLabelForCrop({ labelText: 'txa 1', predictedText: 'ZZZ' }), 'TXA1');
assert.equal(defaultLabelForCrop({ predictedText: 'zvj7857' }), 'ZVJ7857');

const boxes = normalizeCharBoxes([
  { char: 'Z', conf: 0.9, x: 10, y: 2, w: 8, h: 12 },
  { cls: 1, x: 20, y: 2, width: 7, height: 11 },
  { bad: true },
]);
assert.equal(boxes.length, 2);
assert.equal(boxes[0].char, 'Z');
assert.equal(boxes[1].w, 7);

assert.equal(trainingImageSrc('/ai-camera/training/files/a.jpg', 'http://localhost:3000'), 'http://localhost:3000/ai-camera/training/files/a.jpg');
assert.equal(trainingImageSrc('https://cdn.example/a.jpg', 'http://localhost:3000'), 'https://cdn.example/a.jpg');

assert.equal(nextReviewIndex(0, 3), 0);
assert.equal(nextReviewIndex(2, 2), 1);
assert.equal(nextReviewIndex(0, 0), 0);

assert.equal(exportStatusParam('pending'), 'verified,auto_labeled');
assert.equal(exportStatusParam('verified'), 'verified');
assert.equal(exportStatusParam(''), 'verified,auto_labeled');

console.log('trainingReview.test.mjs: ok');
