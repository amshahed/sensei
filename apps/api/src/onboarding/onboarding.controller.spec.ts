import { isAgeAnswerRequest } from './onboarding.controller';

describe('isAgeAnswerRequest', () => {
  it.each([{ answer: 'ADULT' }, { answer: 'UNDER_18' }])('accepts %j', (body) =>
    expect(isAgeAnswerRequest(body)).toBe(true),
  );

  it.each([
    null,
    'ADULT',
    {},
    { answer: 'adult' },
    { answer: 'OVER_18' },
    { answer: true },
    { answer: 18 },
  ])('rejects %j', (body) => expect(isAgeAnswerRequest(body)).toBe(false));
});
