// Extensão do Owlbear Rodeo do West Marches. Sai no MESMO deploy do hub, em
// /owlbear/ (npm run build gera dist/owlbear depois do portal), para o mestre
// instalar colando https://dragonbane-west-marches.web.app/owlbear/manifest.json.
//
// Dev: npm run owlbear:dev e, no Owlbear, Add Extension →
// http://localhost:5174/owlbear/manifest.json
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const aqui = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  root: aqui('.'),
  base: '/owlbear/',
  plugins: [react()],
  // carimbo do build: o fundo anuncia no console qual versão está rodando (o
  // navegador pode segurar uma cópia antiga da extensão em cache)
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16)) },
  build: {
    outDir: aqui('../dist/owlbear'),
    emptyOutDir: true,
    rollupOptions: { input: { popover: aqui('index.html'), background: aqui('background.html') } },
  },
  server: {
    port: 5174,
    // O Owlbear (https) busca o manifest do dev server: libera a origem dele.
    cors: { origin: [/\.owlbear\.rodeo$/, 'https://owlbear.rodeo'] },
  },
})
