/**
 * Shared canonical ranking utility to determine the display rank
 * of leaderboard entries based on pagination, filters, and custom sorting.
 */
export function getDisplayRank(
  entryRank: number,
  index: number,
  page: number,
  limit: number,
  hasFiltersOrCustomSort: boolean
): number {
  return (page - 1) * limit + index + 1;
}
