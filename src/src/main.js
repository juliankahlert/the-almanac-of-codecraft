import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import 'element-plus/theme-chalk/dark/css-vars.css'

import { useDark, useToggle } from '@vueuse/core'

const isDark = useDark()
const toggleDark = useToggle(isDark)


createApp(App).mount('#app')
