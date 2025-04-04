import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
      allowedHosts: ["ec2-54-183-192-37.us-west-1.compute.amazonaws.com", "dick-knows.com", "54.183.192.37"]
  },
})
