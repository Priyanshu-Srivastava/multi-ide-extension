import type { FileClassification } from '../../types/pr-review-types';

const TEST_PATTERNS: RegExp[] = [
  /(^|\/)(__tests__|tests)\//i,
  /\.(test|spec)\.[a-z0-9]+$/i,
  /^test\//i,
];

export function classifyFilePath(filePath: string): FileClassification {
  return TEST_PATTERNS.some((pattern) => pattern.test(filePath)) ? 'test' : 'code';
}
