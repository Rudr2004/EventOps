import { IncidentStatus, isValidIncidentTransition } from './incident-enums.js';

describe('isValidIncidentTransition', () => {
  it('allows the standard forward progression', () => {
    expect(isValidIncidentTransition(IncidentStatus.OPEN, IncidentStatus.INVESTIGATING)).toBe(true);
    expect(isValidIncidentTransition(IncidentStatus.INVESTIGATING, IncidentStatus.MITIGATED)).toBe(true);
    expect(isValidIncidentTransition(IncidentStatus.MITIGATED, IncidentStatus.RESOLVED)).toBe(true);
  });

  it('allows reopening a Mitigated incident back to Investigating', () => {
    expect(isValidIncidentTransition(IncidentStatus.MITIGATED, IncidentStatus.INVESTIGATING)).toBe(true);
  });

  it('rejects skipping straight from Open to Mitigated or Resolved', () => {
    expect(isValidIncidentTransition(IncidentStatus.OPEN, IncidentStatus.MITIGATED)).toBe(false);
    expect(isValidIncidentTransition(IncidentStatus.OPEN, IncidentStatus.RESOLVED)).toBe(false);
  });

  it('rejects skipping straight from Investigating to Resolved', () => {
    expect(isValidIncidentTransition(IncidentStatus.INVESTIGATING, IncidentStatus.RESOLVED)).toBe(false);
  });

  it('treats Resolved as terminal', () => {
    expect(isValidIncidentTransition(IncidentStatus.RESOLVED, IncidentStatus.MITIGATED)).toBe(false);
    expect(isValidIncidentTransition(IncidentStatus.RESOLVED, IncidentStatus.OPEN)).toBe(false);
  });

  it('rejects a no-op transition to the same status', () => {
    expect(isValidIncidentTransition(IncidentStatus.INVESTIGATING, IncidentStatus.INVESTIGATING)).toBe(
      false,
    );
  });

  it('rejects moving backwards from Investigating to Open', () => {
    expect(isValidIncidentTransition(IncidentStatus.INVESTIGATING, IncidentStatus.OPEN)).toBe(false);
  });
});
