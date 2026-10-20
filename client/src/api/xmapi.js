import axios from 'axios'
import { COMFY_URL, BASE_BDURL } from './apiUtils.js'

// Desktop-only APIs are same-origin proxies provided by the Electron host.
const xmAPI = {
  async uploadimgapi(file) {
    const formdata = new FormData()
    formdata.append('image', file)
    formdata.append('type', 'input')
    formdata.append('overwrite', 'true')
    const response = await axios.post(`${COMFY_URL}/upload/image`, formdata)
    return response.data
  },
  async getbdimgs(params) {
    return axios.get(`${BASE_BDURL}/img/images`, params ? { params } : undefined)
  },
  async gethistoryimgs(data, params) {
    return axios.post(`${BASE_BDURL}/img/history`, data, params ? { params } : undefined)
  },
  async filterfiles(data) {
    return axios.post(`${BASE_BDURL}/img/filter-by-urls`, data)
  },
  async getimgmeta(items, params) {
    return axios.post(`${BASE_BDURL}/img/meta`, items, params ? { params } : undefined)
  },
  async geturl(id) {
    return axios.get(`${COMFY_URL}/history/${encodeURIComponent(id)}`)
  }
}

export { xmAPI }
export default xmAPI
