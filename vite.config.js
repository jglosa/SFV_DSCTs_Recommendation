import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/SFV_DSCTs_Recommendation/',
  plugins: [react()],
  server: {
    host: true,   // 같은 wifi의 휴대폰에서 접속 가능하게
    port: 5173,
  },
})
