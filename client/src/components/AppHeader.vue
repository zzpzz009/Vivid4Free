<template>
  <div class="bg-schemes-surface w-full h-12 absolute left-0 top-0 flex items-center justify-between px-3">
    <!-- Left side - Logo only -->
    <div class="flex items-center">
      <div class="text-schemes-on-surface-variant text-left font-m3-headline-medium-font-family text-m3-headline-medium-font-size leading-m3-headline-medium-line-height font-m3-headline-medium-font-weight" />
    </div>

    <!-- Right side - User Profile -->
    <div class="flex items-center gap-3">
      <span class="text-schemes-on-surface-variant text-xs">
        {{ username }}
      </span>

      <div class="flex items-center gap-2">
        <img
          class="rounded-full w-7 h-7"
          :src="avatarIcon"
          alt="User Avatar"
          draggable="false"
        >

        <HeadlessMenu as="div" class="relative">
          <MenuButton class="p-1 rounded-md hover:bg-schemes-surface-container-high focus:outline-none">
            <img
              class="w-4 h-4"
              :src="moreIcon"
              alt="More Options"
              draggable="false"
            >
          </MenuButton>

          <MenuItems class="absolute right-0 mt-2 w-56 origin-top-right bg-schemes-surface-container-high rounded-xl border border-schemes-outline-variant shadow-lg overflow-hidden z-50 focus:outline-none">
            <div class="px-3 py-2">
              <div class="text-xs text-schemes-on-surface-variant">
                账号详情
              </div>
              <div class="mt-1 text-sm text-schemes-on-surface">
                {{ username }}
              </div>
              <div class="mt-1 text-xs text-schemes-on-surface-variant">
                创意空间使用次数：{{ creativeUsageText }}
              </div>
            </div>
            <div class="h-px bg-schemes-outline-variant/50 mx-2"></div>
            <MenuItem v-slot="{ active }">
              <button
                class="w-full text-left px-3 py-2 text-sm transition-colors"
                :class="active ? 'bg-schemes-surface-container-highest text-schemes-on-surface' : 'text-schemes-on-surface'"
                @click="handleLogout"
              >
                登出
              </button>
            </MenuItem>
          </MenuItems>
        </HeadlessMenu>
      </div>
    </div>
  </div>
</template>

<script>
import { icons } from '../utils/assets.js'
import { useAuthStore } from '@/stores/useAuthStore.js'
import { useRouter } from 'vue-router'
import { computed } from 'vue'
import { Menu as HeadlessMenu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

export default {
  name: 'AppHeader',
  components: {
    HeadlessMenu,
    MenuButton,
    MenuItems,
    MenuItem
  },
  setup() {
    const authStore = useAuthStore()
    const router = useRouter()
    
    const avatarIcon = icons.avatar
    const moreIcon = icons.more

    const username = computed(() => authStore.user?.username || 'Admin')
    const creativeUsageText = computed(() => {
      const count = authStore.creativeUsageCount || 0
      return `${count} 次`
    })

    const handleLogout = () => {
      authStore.logout()
      router.push('/login')
    }

    return {
      authStore,
      avatarIcon,
      moreIcon,
      username,
      creativeUsageText,
      handleLogout
    }
  }
}
</script>
