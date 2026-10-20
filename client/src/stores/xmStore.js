// 项目上使用到的store内容
import { defineStore } from 'pinia'
import { ref } from 'vue'
import {randomNum} from '@/utils/utils'

export const useXMStore = defineStore('xm', () => {
  // ===== UI 状态 =====

  // 保存待处理图片的地址
  const dclimg = ref('')//待处理图片
  const ckimg = ref('')//参考图片
  const dclimgurl = ref('')//待处理图片url
  const ckimgurl = ref('')//参考图片url
  const successimgid = ref('')//生成成功后的图片流id
  const successimgurl = ref('')//生成成功后的图片url
  const tsc = ref('')//提示词
  const size = ref('4096')//size设置
  const seed = ref(randomNum())// 种子  609186753563074
  const xl = ref('')// 下拉 描述：天气，场景
  const tq = ref('')// 下拉 描述：天气，场景
  const cj = ref('')// 下拉 描述：天气，场景
  const tp64 = ref('')//图片base64数据
  const ft = ref('')// 图片反推数据
  const promptid = ref('')// 生成的id保存下，用于取消

  const jx = ref(false)// 镜像
  const chfd = ref(0.2)// 重绘幅度
  const referenceStrength = ref(0.8)
  const colorMatchStrength = ref(0.8)
  const addScene = ref(true)

  const savedAddScene = localStorage.getItem('xm-addScene')
  if (savedAddScene === 'true' || savedAddScene === 'false') {
    addScene.value = savedAddScene === 'true'
  }

  const savedReferenceStrength = Number.parseFloat(localStorage.getItem('xm-referenceStrength') || '')
  if (Number.isFinite(savedReferenceStrength)) {
    referenceStrength.value = Math.min(1, Math.max(0, savedReferenceStrength))
  }

  const savedColorMatchStrength = Number.parseFloat(localStorage.getItem('xm-colorMatchStrength') || '')
  if (Number.isFinite(savedColorMatchStrength)) {
    colorMatchStrength.value = Math.min(1, Math.max(0, savedColorMatchStrength))
  }

  // const clearyl = ()=>{// 清空预览
  //   dclimg.value = ''
  //   ckimg.value = ''
  //   successimgid.value = ''
  //   successimgurl.value = ''
  //   tsc.value = ''
  //   size.value = ''
  //   seed.value = ''
  //   xl.value = ''
  //   tq.value = ''
  //   cj.value = ''
  // }
  // const clearsc = ()=>{// 清空生成
  //   dclimg.value = ''
  //   ckimg.value = ''
  //   successimgid.value = ''
  //   successimgurl.value = ''
  //   tsc.value = ''
  //   size.value = ''
  //   seed.value = ''
  //   xl.value = ''
  //   tq.value = ''
  //   cj.value = ''
  // }
  const clearthis = ()=>{ 
    dclimg.value = ''
    ckimg.value = ''
    successimgid.value = ''
    successimgurl.value = ''
    tsc.value = ''
    size.value = '4096'
    seed.value = randomNum()
    xl.value = ''
    tq.value = ''
    cj.value = ''
    jx.value = false
    // ft.value = ''
    chfd.value = 0.2
    referenceStrength.value = 0.8
    colorMatchStrength.value = 0.8
    addScene.value = true
  }


  const deldcl = ()=>{
    dclimg.value = ''
    dclimgurl.value = ''
  }
  const delck = ()=>{
    ckimg.value = ''
    ckimgurl.value = ''
  }
  const savesize = (v)=>{
    size.value = v
  }
  // 保存重回幅度
  const savechsize = (v)=>{
    chfd.value = v
  }
  // 保存种子
  const saveseed = (v)=>{
    seed.value = v
  }
  // 保存下拉描述
  const savexl = (v)=>{
    xl.value = v
  }
  // 保存天气描述
  const savetq = (v)=>{
    tq.value = v
  }
  // 保存场景描述
  const savecj = (v)=>{
    cj.value = v
  }
  // 保存镜像值
  const savejx = (v)=>{
    jx.value = v
  }
  const saveReferenceStrength = (v) => {
    referenceStrength.value = v
    localStorage.setItem('xm-referenceStrength', String(v))
  }
  const saveColorMatchStrength = (v) => {
    colorMatchStrength.value = v
    localStorage.setItem('xm-colorMatchStrength', String(v))
  }
  const saveAddScene = (v) => {
    addScene.value = v
    localStorage.setItem('xm-addScene', String(v))
  }

  // 保存提示词
  const savetsc = (v)=>{
    tsc.value = v
  }
  // 保存成功图片的url
  const savesuccessimgurl = (url)=>{
    successimgurl.value = url
  }
  // 保存待处理图片的url
  const savedclimg = (dclurl)=>{
    dclimg.value = dclurl
  }
  // 保存待处理url
  const savedclimgurl = (dclurl)=>{
    dclimgurl.value = dclurl
  }
  // 保存成功图片的id
  const savesuccessimgid = (id)=>{
    successimgid.value = id
  }

  const saveckimg = (dclurl)=>{
    ckimg.value = dclurl
  }
  // 保存参考url
  const saveckimgurl = (dclurl)=>{
    ckimgurl.value = dclurl
  }

  return {
    // clearyl,
    // clearsc,
    dclimgurl,
    ckimgurl,
    savedclimgurl,
    saveckimgurl,
    clearthis,
    // State
    dclimg,
    ckimg,
    // methods
    savedclimg,
    saveckimg,
    successimgid,
    savesuccessimgid,
    successimgurl,
    savesuccessimgurl,
    tsc,
    savetsc,
    size,
    savesize,
    deldcl,
    savechsize,
    saveseed,
    savexl,
    savejx,
    saveReferenceStrength,
    saveColorMatchStrength,
    saveAddScene,
    savetq,
    savecj,
    tq,
    cj,
    seed,
    xl,
    jx,
    chfd,
    referenceStrength,
    colorMatchStrength,
    addScene,
    delck 
  }
})
