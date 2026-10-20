export const createHistoryLogic = (ctx) => {
  const {
    api,
    historyArchiveItems,
    historyDegraded,
    historyItems,
    normalizeJobsHistoryPayload,
    normalizeLegacyHistoryPayload,
    mergeHistoryItems,
    upsertHistoryRecord,
    patchProgressById,
    queuePositionMap,
    scheduleQueuePositionCommit
  } = ctx

  const applyHistoryRecords = (records = []) => {
    const normalizedRecords = Array.isArray(records) ? records.filter(Boolean) : []
    if (!normalizedRecords.length) return 0
    historyArchiveItems.value = mergeHistoryItems([normalizedRecords, historyArchiveItems.value])
    normalizedRecords.forEach((item) => {
      upsertHistoryRecord(item)
      if (item.status === 'completed') {
        patchProgressById(item.id, 100, '已完成', '任务已完成', { force: true })
        const nextQueue = { ...queuePositionMap.value }
        delete nextQueue[item.id]
        scheduleQueuePositionCommit(nextQueue)
      }
    })
    return normalizedRecords.length
  }

  const pullRecentHistory = async (limit = 3) => {
    try {
      const response = await api.jobs.getRecent(limit)
      const recent = normalizeJobsHistoryPayload(response, { limit })
      if (!recent.length) return { success: false, count: 0 }
      return { success: true, count: applyHistoryRecords(recent) }
    } catch (_) {
      return { success: false, count: 0 }
    }
  }

  const hydrateHistoryByIds = async (ids = []) => {
    const targetIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean)))
    if (!targetIds.length) return []

    const settled = await Promise.allSettled(targetIds.map(async (id) => {
      const response = await api.jobs.getJobResults(id)
      const normalized = normalizeJobsHistoryPayload(response)
      return normalized.filter((item) => String(item?.id || '') === id)
    }))

    const recovered = settled.flatMap((entry) => entry.status === 'fulfilled' && Array.isArray(entry.value) ? entry.value : [])
    const mergedRecovered = mergeHistoryItems([recovered])
    applyHistoryRecords(mergedRecovered)
    return mergedRecovered
  }

  const initHistory = async () => {
    historyDegraded.value = false
    let archive = []
    let loadedFromJobsApi = false

    try {
      const response = await api.jobs.getHistory(1, 50)
      archive = normalizeJobsHistoryPayload(response, { limit: 50 })
      loadedFromJobsApi = true
    } catch (_) {
      loadedFromJobsApi = false
    }

    if (!loadedFromJobsApi) {
      try {
        const legacyResponse = await api.xmAPI.gethistoryimgs({ data: 'history' }, { v: 1, limit: 50 })
        archive = normalizeLegacyHistoryPayload(legacyResponse)
        historyDegraded.value = archive.length > 0
      } catch (_) {
        archive = []
      }
    }

    historyArchiveItems.value = archive
    archive.forEach((item) => {
      upsertHistoryRecord(item)
    })
    return {
      success: true,
      degraded: historyDegraded.value,
      count: historyItems.value.length
    }
  }

  return {
    hydrateHistoryByIds,
    initHistory,
    pullRecentHistory
  }
}
