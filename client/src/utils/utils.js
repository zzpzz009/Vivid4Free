import {BASE_URL} from '@/api/apiUtils'
// import 
function getimgurl(filename){
  return BASE_URL + '/view?type=output&filename=' + encodeURIComponent(filename)
  // http://www.manlitech.com/api/view?filename=Preview%20image_0006.jpg&type=output&subfolder=%E7%AC%AC%E4%B8%80%E9%98%B6%E6%AE%B5
  // return import.meta.env.VITE_API_BASE_URL + '/api/view?type=output&subfolder=第一阶段&filename=' +filename
}

// 上传图片后返回的对象，获取url
function objgetimgurl(obj){
  return BASE_URL+ '/view?'+obj2query(obj)
}

// 对象转query
function obj2query(obj){ 
  return Object.keys(obj).map((key) => {
    const value = obj[key]
    return `${encodeURIComponent(key)}=${encodeURIComponent(value == null ? '' : String(value))}`
  }).join('&')
}

function randomNum(){
  return +new Date() +''+ String(parseInt(Math.random()*100)).padStart(2, '0')
}

export {getimgurl,obj2query,objgetimgurl,randomNum}
