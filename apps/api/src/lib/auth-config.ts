export function shouldDisablePublicSignUp(nodeEnv: string): boolean {
  return nodeEnv !== "test";
}
