import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outcomeAgreement, citationFaithfulness } from './scorers.ts';

test('outcomeAgreement: exact match scores 1', () => {
  assert.equal(outcomeAgreement('disagree_decline', 'disagree_decline', false), 1);
});

test('outcomeAgreement: half credit for abstaining on a borderline case', () => {
  assert.equal(outcomeAgreement('disagree_decline', 'cannot_determine', true), 0.5);
  assert.equal(outcomeAgreement('disagree_decline', 'cannot_determine', false), 0);
});

test('outcomeAgreement: missing verdict scores 0', () => {
  assert.equal(outcomeAgreement('agree_decline', undefined, false), 0);
});

test('citationFaithfulness: subset passes, fabrication fails', () => {
  assert.equal(citationFaithfulness(['DRN-1'], ['DRN-1', 'DRN-2']).score, 1);
  const bad = citationFaithfulness(['DRN-9'], ['DRN-1']);
  assert.equal(bad.score, 0);
  assert.deepEqual(bad.offending, ['DRN-9']);
});
