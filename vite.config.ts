import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Sillage/',
  build: {
    rollupOptions: {
      output: {
        // Keep Three / globe.gl off the Fil initial path; Monde loads them on demand.
        manualChunks(id) {
          if (
            id.includes('node_modules/three/') ||
            id.includes('node_modules/three-globe/') ||
            id.includes('node_modules/three-render-objects/') ||
            id.includes('node_modules/three-conic-polygon-geometry/') ||
            id.includes('node_modules/three-geojson-geometry/') ||
            id.includes('node_modules/three-slippy-map-globe/') ||
            id.includes('node_modules/globe.gl/') ||
            id.includes('node_modules/@tweenjs/') ||
            id.includes('node_modules/kapsule/') ||
            id.includes('node_modules/accessor-fn/')
          ) {
            return 'globe'
          }
        },
      },
    },
  },
})
