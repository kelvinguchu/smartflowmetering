const TOKEN_PATTERN = /\d{20}/g;

export function maskToken(token: string): string {
  const digitsOnly = token.replaceAll(/\D/g, "");
  if (digitsOnly.length < 4) {
    return "*".repeat(token.length);
  }

  return `${"*".repeat(Math.max(digitsOnly.length - 4, 0))}${digitsOnly.slice(-4)}`;
}

export function redactTokensInText(value: string): string {
  return value.replace(TOKEN_PATTERN, (match) => maskToken(match));
}
