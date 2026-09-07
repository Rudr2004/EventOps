import { EventStatus, isValidEventTransition } from './event-status.enum.js';

describe('isValidEventTransition', () => {
  it('allows the standard forward progression through the lifecycle', () => {
    expect(isValidEventTransition(EventStatus.DRAFT, EventStatus.PLANNING)).toBe(true);
    expect(isValidEventTransition(EventStatus.PLANNING, EventStatus.APPROVAL_PENDING)).toBe(true);
    expect(isValidEventTransition(EventStatus.APPROVAL_PENDING, EventStatus.APPROVED)).toBe(true);
    expect(isValidEventTransition(EventStatus.APPROVED, EventStatus.LIVE)).toBe(true);
    expect(isValidEventTransition(EventStatus.LIVE, EventStatus.COMPLETED)).toBe(true);
    expect(isValidEventTransition(EventStatus.COMPLETED, EventStatus.ARCHIVED)).toBe(true);
  });

  it('allows a rejected approval to return to planning', () => {
    expect(isValidEventTransition(EventStatus.APPROVAL_PENDING, EventStatus.PLANNING)).toBe(true);
  });

  it('rejects skipping steps forward', () => {
    expect(isValidEventTransition(EventStatus.DRAFT, EventStatus.APPROVED)).toBe(false);
    expect(isValidEventTransition(EventStatus.PLANNING, EventStatus.LIVE)).toBe(false);
    expect(isValidEventTransition(EventStatus.DRAFT, EventStatus.LIVE)).toBe(false);
  });

  it('rejects going Live without being Approved first', () => {
    expect(isValidEventTransition(EventStatus.PLANNING, EventStatus.LIVE)).toBe(false);
    expect(isValidEventTransition(EventStatus.APPROVAL_PENDING, EventStatus.LIVE)).toBe(false);
  });

  it('rejects moving backwards outside the approval rejection loop', () => {
    expect(isValidEventTransition(EventStatus.LIVE, EventStatus.APPROVED)).toBe(false);
    expect(isValidEventTransition(EventStatus.APPROVED, EventStatus.PLANNING)).toBe(false);
    expect(isValidEventTransition(EventStatus.COMPLETED, EventStatus.LIVE)).toBe(false);
  });

  it('treats Archived as a terminal state', () => {
    expect(isValidEventTransition(EventStatus.ARCHIVED, EventStatus.DRAFT)).toBe(false);
    expect(isValidEventTransition(EventStatus.ARCHIVED, EventStatus.PLANNING)).toBe(false);
  });

  it('rejects a no-op transition to the same status', () => {
    expect(isValidEventTransition(EventStatus.PLANNING, EventStatus.PLANNING)).toBe(false);
  });
});
