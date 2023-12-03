import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Adapter } from 'yuuki.js'

export type AdapterConfig = {
  env?: {
    token?: string
    publicKey?: string
  }
}

export default function adapter(config?: AdapterConfig): Adapter {
  return {
    name: '@yuukijs/adapter-cloudflare-workers',
    capabilities: ['serverless'],
    async adapt(builder) {
      const tmp_dir = await builder.mktemp('cloudflare-workers')
      const template = await readFile(fileURLToPath(import.meta.resolve('../templates/cloudflare.js')), 'utf-8')

      const imports = [
        ...builder.commands.chatInput.map((path, i) => `import chat_input$${i} from '${path}'`),
        ...builder.commands.user.map((path, i) => `import user$${i} from '${path}'`),
        ...builder.commands.message.map((path, i) => `import message$${i} from '${path}'`),
      ].join('\n')

      const setters = [
        ...builder.commands.chatInput.map((_, i) => `set_command(chat_input$${i}, 1)`),
        ...builder.commands.user.map((_, i) => `set_command(user$${i}, 2)`),
        ...builder.commands.message.map((_, i) => `set_command(message$${i}, 3)`),
      ].join('\n')

      const code = template
        .replaceAll('\'use imports\'', imports)
        .replaceAll('\'use setters\'', setters)
        .replaceAll('\'use pubkey\'', `env['${config?.env?.publicKey ?? 'PUBLIC_KEY'}']`)

      const tmp_out = resolve(tmp_dir, 'index.js')
      await writeFile(tmp_out, code)

      await build({
        entryPoints: [tmp_out],
        write: true,
        bundle: true,
        outfile: 'dist/index.js',
        format: 'esm',
      })
    },
  }
}
