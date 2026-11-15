import { tamanoLegible } from './tamano.util';

describe('tamanoLegible', () => {
  it('bytes, KB redondeados y MB con un decimal y coma', () => {
    expect(tamanoLegible(0)).toBe('0 B');
    expect(tamanoLegible(null)).toBe('0 B');
    expect(tamanoLegible(900)).toBe('900 B');
    expect(tamanoLegible(1536)).toBe('2 KB');
    expect(tamanoLegible(150 * 1024)).toBe('150 KB');
    expect(tamanoLegible(1.4 * 1024 * 1024)).toBe('1,4 MB');
    expect(tamanoLegible(20 * 1024 * 1024)).toBe('20,0 MB');
  });
});
