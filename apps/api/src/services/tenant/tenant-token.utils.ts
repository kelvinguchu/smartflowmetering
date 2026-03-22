export interface TenantCreditTokenLike {
  createdAt: Date;
  token: string;
  tokenType:
    | "clear_credit"
    | "clear_tamper"
    | "credit"
    | "key_change"
    | "set_power_limit";
}

export function findLatestTenantCreditToken<T extends TenantCreditTokenLike>(
  items: T[],
): T | null {
  return items.reduce<T | null>((current, item) => {
    if (item.tokenType !== "credit") {
      return current;
    }
    if (current === null || item.createdAt.getTime() > current.createdAt.getTime()) {
      return item;
    }
    return current;
  }, null);
}
