export function buildHistoryJobsResponse(files, basePath = '/gallery/history', maxCount = 50) {
  const count = Number.isFinite(Number(maxCount)) && Number(maxCount) > 0 ? Math.min(files.length, Number(maxCount), 50) : Math.min(files.length, 50)
  const slice = files.slice(0, count)
  const now = Date.now()
  const images = slice.map((name, index) => ({
    id: index + 1,
    name,
    status: 'completed',
    url: `${basePath}/${encodeURIComponent(name)}`,
    timestamp: now - index * 60000
  }))
  return { success: true, images }
}
