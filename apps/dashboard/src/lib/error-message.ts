interface ApiErrorResponse {
  response?: { data?: { error?: { message?: string } } };
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as ApiErrorResponse & { message?: string };
    const fromAxios = e.response?.data?.error?.message;
    if (fromAxios) return fromAxios;
    if (e.message) return e.message;
  }
  return fallback;
}
