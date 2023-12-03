import { transformFile, type Options } from '@swc/core'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { YuukiConfig } from './dev-client.js'

const swc_config: Readonly<Options> = {
  isModule: true,
  jsc: {
    target: 'es2022',
    parser: {
      syntax: 'typescript',
    },
  },
}

const config_files: Readonly<string[]> = [
  'yuuki.config.dev.ts',
  'yuuki.config.dev.js',
  'yuuki.config.ts',
  'yuuki.config.js',
]

export async function transform_file(path: string): Promise<string> {
  const output = await transformFile(path, swc_config)
  return output.code
}

export async function load_config(dev = true): Promise<YuukiConfig> {
  const _config_files = dev
    ? config_files
    : config_files.slice(2)

  for (const config_file of _config_files) {
    console.debug(`reading config file: ${config_file}`)
    let code: string

    try {
      code = await transform_file(config_file)
    } catch {
      continue
    }

    const config_path = resolve('.yuuki/.yuukiconfig.js')
    await writeFile(config_path, code)

    const mod = await import(config_path) as { default: YuukiConfig }
    return mod.default
  }

  console.error(new TypeError('could not find a config file'))
  process.exit(1)
}
