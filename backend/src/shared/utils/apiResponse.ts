export function okResponse<T>(message: string, data?: T) {
  return {
    success: true,
    message,
    data,
  };
}

export function errorResponse(message: string, status = 400) {
  return {
    success: false,
    message,
    status,
  };
}
