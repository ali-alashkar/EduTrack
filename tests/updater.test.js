const { compareVersions } = require('../main/ipc/updater');

describe('Updater - Version Comparison', () => {
  test('returns 1 when latest version is higher than current', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.1.0', '1.0.9')).toBe(1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('v1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('v1.2.3', 'v1.2.2')).toBe(1);
  });

  test('returns -1 when latest version is lower than current', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
    expect(compareVersions('v1.0.0', '1.0.1')).toBe(-1);
  });

  test('returns 0 when versions are equal', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('v1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('v2.1.0', 'v2.1.0')).toBe(0);
  });

  test('handles uneven version segment lengths', () => {
    expect(compareVersions('1.0.1', '1.0')).toBe(1);
    expect(compareVersions('1.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.0.0.1', '1.0.0')).toBe(1);
  });
});
