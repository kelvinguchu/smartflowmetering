interface OffsetPaginationInput {
  limit?: number;
  offset?: number;
}

export function toMobileCollectionResponse<T>(
  data: T[],
  input?: OffsetPaginationInput,
) {
  const limit = input?.limit ?? null;
  const offset = input?.offset ?? 0;
  const hasMore = limit === null ? false : data.length === limit;

  return {
    count: data.length,
    data,
    pagination: {
      hasMore,
      limit,
      nextOffset: hasMore ? offset + data.length : null,
      offset,
    },
  };
}
