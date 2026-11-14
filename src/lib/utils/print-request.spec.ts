import { describe, expect, it } from 'vitest';
import {
  BYTES_PER_MB,
  MAX_PRINT_REQUEST_FILES,
  PRINT_SUBMISSION_PROBLEM,
  parseFileExtensions,
  printSubmissionProblem,
} from './print-request';

const OPEN = { isOpen: true, maxUploadMB: 1, allowedFileTypes: '.stl, .3MF' };

function upload(filename: string, size = 1) {
  return { filename, file: { size } };
}

describe('parseFileExtensions', () => {
  it('normalizes a comma separated list', () => {
    expect(parseFileExtensions(' .STL, 3mf ,, .step, *.obj')).toEqual([
      'stl',
      '3mf',
      'step',
      'obj',
    ]);
  });
});

describe('printSubmissionProblem', () => {
  it('accepts allowed files within the size limit', () => {
    expect(printSubmissionProblem(OPEN, [upload('arm.STL'), upload('base.3mf')])).toBeUndefined();
  });

  it('rejects submissions while the form is closed', () => {
    expect(printSubmissionProblem({ ...OPEN, isOpen: false }, [upload('arm.stl')])).toBe(
      PRINT_SUBMISSION_PROBLEM.CLOSED,
    );
  });

  it('requires at least one file', () => {
    expect(printSubmissionProblem(OPEN, [])).toBe(PRINT_SUBMISSION_PROBLEM.NO_FILES);
  });

  it('caps the number of files', () => {
    const files = Array.from({ length: MAX_PRINT_REQUEST_FILES + 1 }, () => upload('a.stl'));
    expect(printSubmissionProblem(OPEN, files)).toBe(PRINT_SUBMISSION_PROBLEM.TOO_MANY_FILES);
  });

  it('rejects files over the total size limit', () => {
    expect(printSubmissionProblem(OPEN, [upload('a.stl', BYTES_PER_MB), upload('b.stl', 1)])).toBe(
      PRINT_SUBMISSION_PROBLEM.TOO_LARGE,
    );
  });

  it.each(['payload.exe', 'stl', 'arm.stl.html'])('rejects disallowed file %s', (filename) => {
    expect(printSubmissionProblem(OPEN, [upload(filename)])).toBe(
      PRINT_SUBMISSION_PROBLEM.FILE_TYPE,
    );
  });
});
