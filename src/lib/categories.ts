export const CATEGORIES = ["All", "Development", "Design", "AI & ML", "Business", "Marketing"] as const;
export type Category = (typeof CATEGORIES)[number];

export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SORTS = [
  { value: "popular", label: "Most Popular" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Highest Rated" },
  { value: "price_asc", label: "Price: Low to High" },
] as const;
