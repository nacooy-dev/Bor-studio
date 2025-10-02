import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// 导入全局样式
import './style.css'

// 创建应用实例
const app = createApp(App)

// 使用插件
app.use(createPinia())
app.use(router)

// 初始化主题
const initializeTheme = () => {
  const savedTheme = localStorage.getItem('bor-theme') || 'light'
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  } else {
    document.documentElement.classList.add('light')
    document.documentElement.classList.remove('dark')
  }
  document.documentElement.setAttribute('data-theme', savedTheme)
  console.log('主题已初始化:', savedTheme)
}

// 挂载应用
app.mount('#app')

// 初始化主题
initializeTheme()

// 移除加载动画
const loadingElement = document.querySelector('.loading')
if (loadingElement) {
  setTimeout(() => {
    loadingElement.remove()
  }, 500)
}