export type CallbackTokenTransport = "query" | "header" | "query_or_header";

export function normalizeCallbackTokenTransport(
  value: string | undefined
): CallbackTokenTransport {
  const candidate = value?.toLowerCase();
  if (
    candidate === "query" ||
    candidate === "header" ||
    candidate === "query_or_header"
  ) {
    return candidate;
  }

  return "header";
}
