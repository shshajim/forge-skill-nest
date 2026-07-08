// Category → cover image. Unsplash CDN, safe to hotlink.
const IMAGES: Record<string, string> = {
  Development: "https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?auto=format&fit=crop&w=1200&q=70",
  Design: "https://images.unsplash.com/photo-1561070791-2526d30994b8?auto=format&fit=crop&w=1200&q=70",
  "AI & ML": "https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=70",
  Business: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=70",
  Marketing: "https://images.unsplash.com/photo-1611926653458-09294b3142bf?auto=format&fit=crop&w=1200&q=70",
};
const FALLBACK = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=70";

export function courseImage(category?: string | null) {
  if (!category) return FALLBACK;
  return IMAGES[category] ?? FALLBACK;
}
