import { createRouter, createWebHashHistory,RouteLocationNormalized, NavigationGuardNext } from 'vue-router';
// import NProgress from 'nprogress';

export const router = createRouter({
	history: createWebHashHistory(),
	routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/login/index.vue'),
      meta: {
        title: '登录',
        requiresAuth: false, // 登录页面不需要认证
      },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/App/App.vue'),
      meta: {
        title: '首页',
        requiresAuth: true, // 主页需要认证
      },
    },
    
  ],
});

// 路由加载前
router.beforeEach(async (to:RouteLocationNormalized, from:RouteLocationNormalized, next:NavigationGuardNext) => {
  // 动态导入认证 store（避免循环依赖）
  const { useAuthStore } = await import('@/stores/useAuthStore.js')
  const authStore = useAuthStore()
  
  // 检查是否需要认证
  const requiresAuth = to.meta.requiresAuth !== false
  
  if (requiresAuth) {
    // 需要认证的页面
    const isAuthenticated = authStore.checkAuthStatus()
    
    if (!isAuthenticated) {
      // 未认证或会话过期，跳转到登录页
      next('/login')
      return
    }
  } else if (to.name === 'login') {
    // 访问登录页面时，如果已认证则跳转到主页
    const isAuthenticated = authStore.checkAuthStatus()
    
    if (isAuthenticated) {
      next('/')
      return
    }
  }
  
  next();
});


// 路由加载后
// router.afterEach(() => {
// 	// NProgress.done();
// });

// 导出路由
export default router;