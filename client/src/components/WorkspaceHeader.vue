<template>
  <nav class="workspace-header" aria-label="工作区与资源面板">
    <div class="workspace-navigation">
      <IconButton type="button" size="sm" :active="sidebarOpen" :aria-expanded="sidebarOpen" aria-controls="workspace-inputs" aria-label="切换输入面板" @click="$emit('toggle-tabs')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </IconButton>
      <div class="workspace-tabs" role="tablist" aria-label="工作区">
        <Button v-for="tab in navigationTabs" :id="`tab-${tab.id}`" :key="tab.id" variant="ghost" size="sm" role="tab" :aria-selected="activeWorkspaceTab === tab.id" :aria-controls="`view-${tab.id}`" :class="{ selected: activeWorkspaceTab === tab.id }" :data-testid="`workspace-tab-${tab.id}`" @click="$emit('tab-change', tab.id)" @keydown.right.prevent="nextWorkspace(tab.id)" @keydown.left.prevent="nextWorkspace(tab.id)">
          {{ tab.name }}<span v-if="tab.id === 'creative-workshop'" class="unavailable-label">未开放</span>
        </Button>
      </div>
    </div>
    <div class="resource-tabs" data-testid="toolbar-right-tabs" aria-label="资源面板">
      <Button v-for="tab in rightTabs" :key="tab.id" variant="ghost" size="sm" :class="{ selected: activeRightTab === tab.id && rightPanelVisible }" :aria-pressed="activeRightTab === tab.id && rightPanelVisible" :data-testid="`right-tab-${tab.id}`" @click="$emit('right-tab-change', tab.id)">{{ tab.name }}</Button>
      <Button v-if="rightPanelVisible" variant="ghost" size="xs" :aria-label="isRightPanelExpanded ? '紧凑资源面板' : '展开资源面板'" @click="$emit('resize-right-panel')">{{ isRightPanelExpanded ? '紧凑' : '展开' }}</Button>
      <IconButton type="button" size="sm" :aria-expanded="rightPanelVisible" aria-controls="desktop-resources" :aria-label="rightPanelVisible ? '收起资源面板' : '展开资源面板'" data-testid="btn-expand-panel" @click="$emit('toggle-right-panel')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path :d="rightPanelVisible ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'"/></svg>
      </IconButton>
    </div>
  </nav>
</template>
<script setup>
import { nextTick } from 'vue'
import Button from '@/ui/Button.vue'
import IconButton from '@/ui/IconButton.vue'
const props = defineProps({ activeWorkspaceTab: { type: String, default: 'workspace' }, activeRightTab: { type: String, default: 'common' }, isRightPanelExpanded: Boolean, sidebarOpen: { type: Boolean, default: true }, rightPanelVisible: { type: Boolean, default: true } })
const emit = defineEmits(['tab-change', 'toggle-tabs', 'right-tab-change', 'toggle-right-panel', 'resize-right-panel'])
const navigationTabs = [{ id: 'workspace', name: '工作区' }, { id: 'creative-workshop', name: '创意工坊' }]
const rightTabs = [{ id: 'common', name: '常用' }, { id: 'gallery', name: '图库' }]
async function nextWorkspace(id) { const next = id === 'workspace' ? 'creative-workshop' : 'workspace'; emit('tab-change', next); await nextTick(); document.getElementById(`tab-${next}`)?.focus() }
</script>
<style scoped>
.workspace-header{display:flex;align-items:center;justify-content:space-between;gap:var(--space-4);padding:var(--space-2) var(--space-4);border-bottom:1px solid var(--border-color);flex:none}
.workspace-navigation,.workspace-tabs,.resource-tabs{display:flex;align-items:center;gap:var(--space-1);min-width:0}
.workspace-tabs,.resource-tabs{background:var(--workspace-bg-header);border:1px solid var(--border-color);border-radius:var(--border-radius-base);padding:var(--space-1)}
.selected{background:var(--brand-solid);color:var(--brand-primary)}
.unavailable-label{font-size:11px;color:var(--text-secondary)}
@media(max-width:768px){.workspace-header{gap:var(--space-2);padding:var(--space-2)}.workspace-tabs>button,.resource-tabs>button{padding:var(--space-2)}.unavailable-label{display:none}}
</style>
