import { describe, expect, it } from 'vitest';
import { INVALID_EMAIL_ERROR, LINE_FORMAT_ERROR, parseMemberLines } from './member_lines';

describe('parseMemberLines', () => {
  it('parses the angle bracket format', () => {
    expect(parseMemberLines('Ada Lovelace <ada@example.com>').members).toEqual([
      { line: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
    ]);
  });

  it('parses the comma format', () => {
    expect(parseMemberLines('Ada Lovelace, ada@example.com').members).toEqual([
      { line: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
    ]);
  });

  it('strips surrounding quotes from names', () => {
    expect(parseMemberLines('"Lovelace, Ada" <ada@example.com>').members).toEqual([
      { line: 1, name: 'Lovelace, Ada', email: 'ada@example.com' },
    ]);
  });

  it('skips blank lines and keeps original line numbers', () => {
    const { members, errors } = parseMemberLines(
      '\nAda <ada@example.com>\r\n   \nGrace, grace@example.com\n',
    );

    expect(errors).toEqual([]);
    expect(members.map((member) => member.line)).toEqual([2, 4]);
  });

  it('reports lines without a name', () => {
    expect(parseMemberLines('ada@example.com\n<ada@example.com>').errors).toEqual([
      { line: 1, text: 'ada@example.com', reason: LINE_FORMAT_ERROR },
      { line: 2, text: '<ada@example.com>', reason: LINE_FORMAT_ERROR },
    ]);
  });

  it('reports invalid emails', () => {
    expect(parseMemberLines('Ada, not-an-email').errors).toEqual([
      { line: 1, text: 'Ada, not-an-email', reason: INVALID_EMAIL_ERROR },
    ]);
  });

  it('returns valid lines alongside errors', () => {
    const { members, errors } = parseMemberLines('Ada <ada@example.com>\ngarbage');

    expect(members).toHaveLength(1);
    expect(errors).toEqual([{ line: 2, text: 'garbage', reason: LINE_FORMAT_ERROR }]);
  });
});
