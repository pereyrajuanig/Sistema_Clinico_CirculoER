import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-96x96.png', 'apple-touch-icon.png'],
      // No hay soporte offline (decisión de diseño en CLAUDE.md: el consultorio tiene
      // internet estable) — este manifest existe para poder "instalar" la app como
      // ventana propia en las computadoras del consultorio, no para que funcione sin
      // conexión. El service worker por default de vite-plugin-pwa solo precachea los
      // archivos estáticos del propio build (JS/CSS/HTML/íconos); a propósito NO se agrega
      // runtimeCaching para el dominio de Supabase, así que ninguna consulta a la base ni
      // a Auth queda cacheada — sin internet, la app abre pero no funciona, que es lo
      // correcto para datos clínicos que siempre tienen que ser los reales.
      manifest: {
        name: 'Historia Clínica — Círculo Policía',
        short_name: 'Historia Clínica',
        description:
          'Sistema de historia clínica del Círculo de Retirados y Pensionados de la Policía de Entre Ríos',
        lang: 'es-AR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#faf6ec',
        theme_color: '#2e4c7a',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
