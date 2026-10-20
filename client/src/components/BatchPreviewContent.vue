<template>
  <div class="flex flex-1 min-h-0">
    <iframe
      :src="iframeurl1"
      width="100%"
      height="100%"
      frameborder="0"
    />
  </div>
</template>

<script>
import { ref } from 'vue'
import config from '../config/config.js'

export default {
  name: 'BatchPreviewContent',
  setup() {
    const formatKeysToKeyValuePairs = (keysArray) => {
      if (!Array.isArray(keysArray)) return ''
      return keysArray
        .map((obj) => {
          const keyName = obj?.keyName
          const keyValue = obj?.keyValue
          if (!keyName || !keyValue) return null
          return `${encodeURIComponent(keyName)}=${encodeURIComponent(keyValue)}`
        })
        .filter(Boolean)
        .join('&')
    }
    const loginDataRaw = localStorage.getItem('logindata')
    let keystr = ''
    try {
      const loginData = loginDataRaw ? JSON.parse(loginDataRaw) : null
      keystr = formatKeysToKeyValuePairs(loginData?.data?.apiKeys || [])
    } catch {
      keystr = ''
    }
    const separator = config.iframeurl.includes('?') ? '&' : '?'
    const query = [keystr, String(Date.now())].filter(Boolean).join('&')
    const iframeurl1 = ref(`${config.iframeurl}${separator}${query}`)

    return {
      iframeurl1
    }
  }
}
</script>
