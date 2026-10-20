<template>
  <div
    class="h-full flex flex-col overflow-x-hidden transition-all duration-200 ease-out"
    :class="variant === 'docked' ? 'mx-4' : 'w-full'"
    :style="variant === 'docked' ? { width: isExpanded ? '360px' : 'var(--right-toolbar-controls-width)', maxWidth: isExpanded ? '90vw' : undefined } : undefined"
  >
    <div
      class="rounded-lg flex flex-col gap-2.5 items-start justify-start w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      :class="isExpanded ? 'p-0 bg-transparent' : (variant === 'docked' ? 'pt-4 pb-8 px-0 bg-transparent' : 'py-4 px-0 bg-transparent')"
      :style="isExpanded ? undefined : { width: 'calc(100% + var(--scrollbar-size))', marginRight: 'calc(var(--scrollbar-size) * -1)' }"
    >
      <FavoritesPanel
        v-if="activeTab === 'common'"
        class="w-full"
        :is-expanded="isExpanded"
        @image-select="selectImage"
      />
      <GalleryPanel
        v-else-if="activeTab === 'gallery'"
        class="w-full"
        :is-expanded="isExpanded"
        @image-select="selectImage"
      />
    </div>
  </div>
</template>

<script>
import GalleryPanel from './GalleryPanel.vue'
import FavoritesPanel from './FavoritesPanel.vue'

export default {
  name: 'RightPanel',
  components: {
    GalleryPanel,
    FavoritesPanel
  },
  props: {
    variant: {
      type: String,
      default: 'docked'
    },
    activeTab: {
      type: String,
      default: 'common'
    },
    isExpanded: {
      type: Boolean,
      default: false
    }
  },
  emits: ['image-select'],
  setup(props, { emit }) {
    const normalizeSelection = (payload) => {
      if (!payload) return { image: null, type: 'ck' }
      if (payload.image) return { image: payload.image, type: payload.type || 'ck' }
      return { image: payload, type: 'ck' }
    }
    const savebd = async (image)=>{
      if (!image) return
      const url = image.url || image.path || ''
      if (!url) return
      // 获取本地存的常用数据
      const bddata = JSON.parse(localStorage.getItem('cyimg')) || []
      if(bddata){
        const findobjindex = bddata.findIndex(e=>e.url==url);
        const findobj = bddata[findobjindex];
        if(findobjindex==-1){
          bddata.push({
            url,
            count:1
          })
        }else{
          findobj.count++;
          bddata[findobjindex] = findobj;
        }
        bddata.sort((a,b)=>b.count-a.count)
        localStorage.setItem('cyimg',JSON.stringify(bddata))
      }
    }
    const selectImage = (payload, fn) => {
      const imageobj = normalizeSelection(payload)
      const image = imageobj.image
      if (!image) return
      savebd(image)
      emit('image-select', imageobj, fn)
    }

    return {
      selectImage,
    }
  }
}
</script>
