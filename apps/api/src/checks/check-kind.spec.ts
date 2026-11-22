import { isOpenCheck } from './check-kind';

describe('isOpenCheck (B.2.d)', () => {
  it.each([
    ['a typed check with no answer', 'TYPED', { exemplar: 'はじめまして' }],
    ['a typed check with an empty answer', 'TYPED', { answer: '' }],
    ['a typed check with no data', 'TYPED', null],
    ['a spoken check with no answer', 'SPOKEN', {}],
  ])('is open for %s', (_name, format, data) => {
    expect(isOpenCheck(format, data)).toBe(true);
  });

  it.each([
    ['a typed check with a fixed answer', 'TYPED', { answer: 'きっぷ' }],
    ['multiple choice', 'MULTIPLE_CHOICE', { answer: 'あ' }],
    ['multiple choice with its answer mis-stored', 'MULTIPLE_CHOICE', {}],
  ])('is closed for %s', (_name, format, data) => {
    expect(isOpenCheck(format, data)).toBe(false);
  });
});
