import * as v from 'valibot';

export type ParsedMemberLine = { line: number; name: string; email: string };
export type MemberLineError = { line: number; text: string; reason: string };

const ANGLE_FORMAT = /^(.+?)\s*<([^<>]+)>$/;
const COMMA_FORMAT = /^(.+?)\s*,\s*([^,]+)$/;
const QUOTES = /^["']|["']$/g;

const emailSchema = v.pipe(v.string(), v.email());

export const LINE_FORMAT_ERROR = 'Expected "Name <email>" or "Name, email"';
export const INVALID_EMAIL_ERROR = 'Invalid email address';

function splitLine(text: string) {
  return text.match(ANGLE_FORMAT) ?? text.match(COMMA_FORMAT);
}

/** Parses pasted lines of `Name <email>` or `Name, email`. Blank lines are skipped. */
export function parseMemberLines(input: string) {
  const members: ParsedMemberLine[] = [];
  const errors: MemberLineError[] = [];

  input.split(/\r?\n/).forEach((raw, index) => {
    const text = raw.trim();
    if (text === '') return;
    const line = index + 1;

    const match = splitLine(text);
    if (!match) {
      errors.push({ line, text, reason: LINE_FORMAT_ERROR });
      return;
    }

    const name = match[1].replace(QUOTES, '').trim();
    const email = match[2].trim();
    if (name === '') {
      errors.push({ line, text, reason: LINE_FORMAT_ERROR });
      return;
    }
    if (!v.is(emailSchema, email)) {
      errors.push({ line, text, reason: INVALID_EMAIL_ERROR });
      return;
    }

    members.push({ line, name, email });
  });

  return { members, errors };
}
