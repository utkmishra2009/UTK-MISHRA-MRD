// Builds a single self-contained index.html (used for the hosted demo link)
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({ plugins: [react(), viteSingleFile()], build: { outDir: 'dist-single' } })
