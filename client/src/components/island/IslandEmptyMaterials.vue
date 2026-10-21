<template>
  <div class="island-empty-materials">
    <div class="material-envelope" aria-hidden="true"><IslandIcon name="Folder" :size="49" /><span><IslandIcon name="Leaf" :size="26" /></span></div>
    <h3>{{ gallery ? '暂无图库图片' : '暂无常用素材' }}</h3>
    <p>{{ gallery ? '账号 → 设置 → 导入图库，\n可添加本地图片。' : '使用过的图库图片会显示在这里，\n方便下次选择。' }}</p>
  </div>
</template>
<script setup>
import { Icon as IslandIcon } from 'animal-island-vue'
defineProps({ gallery: Boolean })
</script>
<style scoped>
.island-empty-materials{display:flex;flex-direction:column;align-items:center;padding:32px 4px;text-align:center}
.material-envelope{position:relative;display:grid;place-items:center;width:90px;height:80px;border-radius:48% 52% 55% 45%;background:var(--animal-bg-color-secondary);transform:rotate(-7deg);margin-bottom:24px}.material-envelope>span{position:absolute;right:-4px;bottom:0;transform:rotate(20deg)}
h3{color:var(--animal-text-color);font-size:12px;font-weight:600;margin-bottom:12px}p{white-space:pre-line;font-size:12px;font-weight:400;line-height:1.9;color:var(--animal-text-color-secondary)}
</style>
