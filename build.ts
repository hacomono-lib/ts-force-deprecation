
import { build } from 'esbuild'
import { dependencies, peerDependencies } from './package.json'

async function main() {
  await build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    outfile: 'dist/index.js',
    sourcemap: true,
    treeShaking: true,
    external: [...Object.keys(dependencies), ...Object.keys(peerDependencies)]
  })
}

main()
