import { apiGet, apiPost } from './apiUtils.js'

// Desktop-only APIs are same-origin proxies provided by the Electron host.
const xmAPI = {
  async uploadimgapi(file) {
    const formdata = new FormData()
    formdata.append('image', file)
    formdata.append('type', 'input')
    formdata.append('overwrite', 'true')
    return apiPost('/upload/image', formdata)
  },
  async getbdimgs(params) {
    return { data: await apiGet('/img/images', params) }
  },
  async gethistoryimgs(data, params) {
    return { data: await apiGet('/api/history', params) }
  },
  async filterfiles(data) {
    return { data: await apiPost('/img/filter-by-urls', data) }
  },
  async getimgmeta(items, params) {
    return { data: await apiPost('/img/meta', items) }
  },
  async geturl(id) {
    return { data: await apiGet(`/history/${encodeURIComponent(id)}`) }
  }
}

export { xmAPI }
export default xmAPI
