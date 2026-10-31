/**
 * Public representation of a Region.
 * `nameKey` is internal (case-insensitive uniqueness) and is never
 * returned — the schema marks it select: false, and this shape reflects
 * only what a caller should see.
 */
export type RegionView = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
