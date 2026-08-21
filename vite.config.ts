import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/rrhh-pwa/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'RH Industrial PWA',
        short_name: 'RH App',
        description: 'Sistema de Gestión de Personal, Asistencia, Vacantes y Capacitación',
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/rrhh-pwa/',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/912/912318.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/912/912318.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/912/912318.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});
