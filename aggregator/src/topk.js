export function topK(mapLike, limit = 5, sortField = "credits") {
  return Object.entries(mapLike)
    .map(([key, value]) => ({ key, ...value }))
    .sort((left, right) => (right[sortField] ?? 0) - (left[sortField] ?? 0))
    .slice(0, limit)
}

