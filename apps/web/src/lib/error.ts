/**
 * Error classification for database constraints vs network/timeout failures.
 */
export function isDatabaseError(error: unknown): boolean {
  if (!error) return false;
  const msg =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code: unknown }).code
      : undefined;
  return Boolean(
    code ||
      /insufficient|not found|archived|access denied|greater than|equal to|required|authentication|already exists|cannot be|unique/i.test(
        msg
      )
  );
}

export function formatErrorMessage(error: unknown): string {
  if (!error) return '';
  if (isDatabaseError(error)) {
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'Database error occurred';
  }
  return 'Not sure if this was saved. Reload the page and check';
}
