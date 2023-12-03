import { transformFile, type Options } from '@swc/core'
import { mkdir, opendir, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { load_config } from './utils'

export type CommandList = {
  chatInput: string[]
  user: string[]
  message: string[]
  all: string[]
}

export type Builder = {
  mktemp: (name: string) => Promise<string>
  commands: CommandList
}

export type Adapter = {
  name: string
  capabilities: ('serverless' | 'self-hosted')[]
  adapt: (builder: Builder) => void | Promise<void>
}

const swc_config: Readonly<Options> = {
  isModule: true,
  jsc: {
    target: 'es2022',
    parser: {
      syntax: 'typescript',
    },
  },
}

async function* walk_dir(root_path: string): AsyncGenerator<string> {
  try {
    const dir = await opendir(root_path)

    for await (const e of dir) {
      const file_path = resolve(root_path, e.name)
      if (e.isDirectory()) {
        yield* walk_dir(file_path)
      } else {
        yield file_path
      }
    }
  } catch {
    //
  }
}

async function mktemp(path: string): Promise<string> {
  await rm(path, { recursive: true, force: true })
  await mkdir(path, { recursive: true })
  return path
}

export default async function run(): Promise<void> {
  console.info('generating production build')
  const start = Date.now()
  const base_dir = resolve('src')

  const out_dir = await mktemp(resolve('.yuuki/generated'))
  const config = await load_config()


  for await (const file_path of walk_dir('src')) {
    const rel_path = relative(base_dir, file_path)

    if (file_path.endsWith('.js') || file_path.endsWith('.ts')) {
      const out_path = resolve(out_dir, rel_path).replace(/\.ts$/, '.js')
      const { code } = await transformFile(file_path, swc_config)

      await mkdir(dirname(out_path), { recursive: true })
      await writeFile(out_path, code, 'utf-8')

      console.info(`compiled: ${out_path}`)
    }
  }

  const chat_input_commands: string[] = []
  const user_commands: string[] = []
  const message_commands: string[] = []

  for await (const file_path of walk_dir(resolve(out_dir, 'commands'))) {
    chat_input_commands.push(file_path)
  }

  for await (const file_path of walk_dir(resolve(out_dir, 'users'))) {
    user_commands.push(file_path)
  }

  for await (const file_path of walk_dir(resolve(out_dir, 'messages'))) {
    message_commands.push(file_path)
  }

  // @todo: handle adapter capabilities
  await config.adapter.adapt({
    mktemp: name => mktemp(`.yuuki/${name}`),
    commands: {
      chatInput: chat_input_commands,
      user: user_commands,
      message: message_commands,
      all: [
        ...chat_input_commands,
        ...user_commands,
        ...message_commands,
      ],
    },
  })

  console.info(`finished build. time took: ${Date.now() - start}ms`)
}
