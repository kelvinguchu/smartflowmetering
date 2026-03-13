import { HTTPException } from "hono/http-exception";

export function toBetterAuthHttpException(error: object | null): HTTPException {
  if (!error) {
    return new HTTPException(500, {
      message: "User management request failed",
    });
  }

  const status =
    getNumericProperty(error, "status") ??
    getNumericProperty(error, "statusCode") ??
    500;
  const body = getObjectProperty(error, "body");
  const message =
    getStringProperty(body, "message") ??
    getStringProperty(error, "message") ??
    "User management request failed";

  return new HTTPException(normalizeHttpStatus(status), { message });
}

function normalizeHttpStatus(status: number): 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 {
  switch (status) {
    case 400:
    case 401:
    case 403:
    case 404:
    case 409:
    case 422:
    case 429:
      return status;
    default:
      return 500;
  }
}

function getNumericProperty(
  value: object | null,
  property: string,
): number | null {
  if (!value) {
    return null;
  }

  const resolvedValue = getPropertyValue(value, property);
  return typeof resolvedValue === "number" ? resolvedValue : null;
}

function getStringProperty(
  value: object | null,
  property: string,
): string | null {
  if (!value) {
    return null;
  }

  const resolvedValue = getPropertyValue(value, property);
  return typeof resolvedValue === "string" && resolvedValue.length > 0
    ? resolvedValue
    : null;
}

function getObjectProperty(
  value: object | null,
  property: string,
): object | null {
  if (!value) {
    return null;
  }

  const resolvedValue = getPropertyValue(value, property);
  return typeof resolvedValue === "object" && resolvedValue !== null
    ? resolvedValue
    : null;
}

function getPropertyValue(
  value: object,
  property: string,
): number | object | string | null | undefined {
  return (value as Record<string, number | object | string | null | undefined>)[
    property
  ];
}
