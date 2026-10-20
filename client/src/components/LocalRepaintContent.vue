<template>
  <div class="flex flex-1">
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
  name: 'LocalRepaintContent',
  setup() {
    function formatKeysToKeyValuePairs(keysArray) {
      if (!Array.isArray(keysArray)) {
        return ''
      }
      const keyValuePairs = keysArray.map(obj => {
        const keyName = obj.keyName
        const keyValue = obj.keyValue
        if (keyName && keyValue) {
          return `${encodeURIComponent(keyName)}=${encodeURIComponent(keyValue)}`
        }
        return null
      }).filter(pair => pair !== null)
      return keyValuePairs.join('&')
    }
    let keystr = ''
    try {
      const loginData = JSON.parse(localStorage.getItem('logindata'))
      keystr = formatKeysToKeyValuePairs(loginData?.data?.apiKeys || [])
    } catch {
      keystr = ''
    }
    const separator = config.creativeIframeUrl.includes('?') ? '&' : '?'
    const query = [keystr, String(+new Date())].filter(Boolean).join('&')
    const iframeurl1 = ref(config.creativeIframeUrl + separator + query)

    return {
      iframeurl1
    }
  }
}
</script>
