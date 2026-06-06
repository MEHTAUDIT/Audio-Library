export function getApiErrorMessage(error: unknown, fallback = 'Request failed. Please try again.'): string {
  const maybeError = error as {
    response?: {
      status?: number;
      data?: {
        error?: string;
        code?: string;
        message?: string;
        existingTitle?: string;
        existingAudioId?: string;
      };
    };
    message?: string;
  };

  const status = maybeError.response?.status;
  const data = maybeError.response?.data;

  if (status === 409 && data?.error === 'DUPLICATE_FILE') {
    return data.existingTitle
      ? `Duplicate file detected. This file already exists as "${data.existingTitle}".`
      : data.message || 'Duplicate file detected. This file already exists in the library.';
  }

  if (data?.message) {
    return data.message;
  }

  return maybeError.message || fallback;
}

export function isDuplicateUploadError(error: unknown): boolean {
  const maybeError = error as { response?: { status?: number; data?: { error?: string } } };
  return maybeError.response?.status === 409 && maybeError.response?.data?.error === 'DUPLICATE_FILE';
}
