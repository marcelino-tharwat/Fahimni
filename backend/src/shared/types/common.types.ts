export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface ApiError extends Error {
  status?: number;
}
