import type { ListManagedUsersQuery } from "../validators/users";

export function buildBetterAuthListUsersQuery(query: ListManagedUsersQuery) {
  const aliasFilter = resolveAliasFilter(query);
  const searchValue = query.q ?? query.searchValue;

  return {
    filterField: aliasFilter?.field ?? query.filterField,
    filterOperator: aliasFilter?.operator ?? query.filterOperator,
    filterValue: aliasFilter?.value ?? normalizeFilterValue(query),
    limit: query.limit,
    offset: query.offset,
    searchField: query.searchField,
    searchOperator: query.searchOperator,
    searchValue,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  };
}

function normalizeFilterValue(query: ListManagedUsersQuery) {
  if (query.filterField === "banned" && query.filterValue) {
    return query.filterValue === "true";
  }

  if (
    (query.filterField === "emailVerified" ||
      query.filterField === "twoFactorEnabled") &&
    query.filterValue
  ) {
    return query.filterValue === "true";
  }

  return query.filterValue;
}

function resolveAliasFilter(query: ListManagedUsersQuery) {
  if (query.role) {
    return { field: "role", operator: "eq", value: query.role } as const;
  }
  if (typeof query.banned === "boolean") {
    return { field: "banned", operator: "eq", value: query.banned } as const;
  }
  if (typeof query.emailVerified === "boolean") {
    return {
      field: "emailVerified",
      operator: "eq",
      value: query.emailVerified,
    } as const;
  }
  if (typeof query.twoFactorEnabled === "boolean") {
    return {
      field: "twoFactorEnabled",
      operator: "eq",
      value: query.twoFactorEnabled,
    } as const;
  }

  return null;
}
