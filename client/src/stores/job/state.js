import { reactive, ref } from 'vue'

export const createJobStoreState = () => {
  const jobs = reactive([])
  const historyArchiveItems = ref([])
  const historyDegraded = ref(false)
  const progressMap = ref({})
  const queuePositionMap = ref({})
  const historySyncHint = ref('')
  const comfyWsConnected = ref(false)
  const liveSyncEnabled = ref(false)
  const isGenerating = ref(false)
  const currentJobId = ref(null)
  const previewUpscaleRunState = ref('idle')
  const prompt = ref('')
  const advancedParameters = ref({
    strength: 0.8,
    steps: 20,
    guidance: 7.5,
    seed: -1
  })
  const statusMessage = ref('Ready')
  const statusType = ref('info')
  return {
    jobs,
    historyArchiveItems,
    historyDegraded,
    progressMap,
    queuePositionMap,
    historySyncHint,
    comfyWsConnected,
    liveSyncEnabled,
    isGenerating,
    currentJobId,
    previewUpscaleRunState,
    prompt,
    advancedParameters,
    statusMessage,
    statusType
  }
}
