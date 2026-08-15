import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'VITE_SUPABASE_'],
  define: {
    'import.meta.env.VITE_COMMIT_HASH': JSON.stringify(
      (() => {
        try {
          return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
        } catch {
          return ''
        }
      })()
    ),
  },
})
