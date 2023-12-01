import { GatewayDispatchEvents, InteractionType } from '@discordjs/core'
import { transformFile, type Options } from '@swc/core'
import { watch } from 'chokidar'
import { resolve } from 'node:path'
import { SourceTextModule, SyntheticModule, type Module } from 'node:vm'
import { CommandTypeMap, create_client, type YuukiAutocompleteControl, type YuukiBaseContext, type YuukiChatInputCommand, type YuukiConfig, type YuukiInteractionControl, type YuukiMessageCommand, type YuukiUserCommand } from './dev-client.js'

const module_cache = new Map<string, SourceTextModule>()
const fake_mod_cache = new Map<string, SyntheticModule>()

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

async function link_module(spec: string, parent: Module): Promise<Module> {
  if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) {
    const target = resolve(parent.identifier, '..', spec)
    let fake_mod = module_cache.get(target)

    if (!fake_mod) {
      let mod_code: string

      try {
        const res = await transformFile(target, swc_config)
        mod_code = res.code
      } catch {
        const res = await transformFile(target.replace(/\.js$/, '.ts'), swc_config)
        mod_code = res.code
      }

      fake_mod = new SourceTextModule(mod_code, {
        identifier: target,
        initializeImportMeta: meta => {
          meta.url = target
        },
        // @ts-expect-error: see below
        importModuleDynamically: link_module,
      })

      module_cache.set(target, fake_mod)

      await fake_mod.link(link_module)
      await fake_mod.evaluate()
    }

    return fake_mod
  }

  let fake_mod = fake_mod_cache.get(spec)

  if (!fake_mod) {
    const resolved = await import(spec) as Record<string, unknown>
    const target = import.meta.resolve(spec)

    fake_mod = new SyntheticModule(
      Object.keys(resolved),
      function() {
        for (const prop in resolved) {
          // eslint-disable-next-line @typescript-eslint/no-invalid-this
          this.setExport(prop, resolved[prop])
        }
      },
      { identifier: target },
    )

    fake_mod_cache.set(target, fake_mod)

    await fake_mod.link(link_module)
    await fake_mod.evaluate()
  }

  return fake_mod
}

async function fake_import<T extends object = object>(path: string, should_fail: true): Promise<T>
async function fake_import<T extends object = object>(path: string, should_fail?: false): Promise<T | null>
async function fake_import<T extends object = object>(path: string, should_fail = false): Promise<T | null> {
  // @todo: module source code tracking
  let code!: string

  try {
    console.debug(`transforming file: ${path}`)
    const result = await transformFile(path, swc_config)
    code = result.code
  } catch (e) {
    if (should_fail) {
      console.error(e)
      process.exit(1)
    }
    return null
  }

  const mod_id = resolve(path)
  const mod = new SourceTextModule(code, {
    identifier: mod_id,
    initializeImportMeta: meta => {
      meta.url = mod_id
    },
    // @ts-expect-error SourceTextModule's importModuleDynamically incorrectly extends Script
    importModuleDynamically: link_module,
  })

  module_cache.set(mod_id, mod)

  await mod.link(link_module)
  await mod.evaluate()

  return mod.namespace as T
}

async function fake_default_import<T extends object = object>(path: string, should_fail: true): Promise<T>
async function fake_default_import<T extends object = object>(path: string, should_fail?: false): Promise<T | null>
async function fake_default_import<T extends object = object>(path: string, should_fail = false) {
  const mod = await fake_import<{ default: T }>(path, should_fail as false)
  return mod?.default ?? null
}

async function load_config() {
  for (const config_file of config_files) {
    console.debug(`reading config file: ${config_file}`)
    const config = await fake_import<{ default: YuukiConfig }>(config_file)
    if (config?.default) {
      console.info(`found config: ${config_file}`)
      return config.default
    }
  }
  console.error(new TypeError('could not find a config file'))
  process.exit(1)
}

export default async function run(): Promise<void> {
  const config = await load_config()
  const client = await create_client(config)

  client.on(GatewayDispatchEvents.InteractionCreate, c => {
    const i = c.data
    switch (i.type) {
      case InteractionType.ApplicationCommand:
      case InteractionType.ApplicationCommandAutocomplete: {
        const handler = client.get_handler(i)

        if (!handler) {
          console.warn('unknown command')
          return
        }

        if (i.type === InteractionType.ApplicationCommand) {
          void handler({
            fetchClient: () => c.api.users.getCurrent(),
            interaction: { ...i, reply: p => c.api.interactions.reply(i.id, i.token, p) },
          } satisfies YuukiBaseContext<YuukiInteractionControl>)
        } else {
          void handler({
            fetchClient: () => c.api.users.getCurrent(),
            interaction: { ...i, respond: p => c.api.interactions.createAutocompleteResponse(i.id, i.token, p) },
          } satisfies YuukiBaseContext<YuukiAutocompleteControl>)
        }

        break
      }
    }
  })

  const w_commands = watch('src/commands')
  const w_user_commands = watch('src/users')
  const w_msg_commands = watch('src/messages')

  w_commands.on('add', async path => {
    const command = await fake_default_import<YuukiChatInputCommand>(path, true)
    client.add_command(CommandTypeMap.ChatInput, command)
    console.info(`added command: ${command.name}`)
  })

  w_commands.on('change', async path => {
    const command = await fake_default_import<YuukiChatInputCommand>(path, true)
    client.add_command(CommandTypeMap.ChatInput, command)
    console.info(`updated command: ${command.name}`)
  })

  w_user_commands.on('add', async path => {
    const command = await fake_default_import<YuukiUserCommand>(path, true)
    client.add_command(CommandTypeMap.User, command)
    console.info(`added user command: ${command.name}`)
  })

  w_user_commands.on('change', async path => {
    const command = await fake_default_import<YuukiUserCommand>(path, true)
    client.add_command(CommandTypeMap.User, command)
    console.info(`updated user command: ${command.name}`)
  })

  w_msg_commands.on('add', async path => {
    const command = await fake_default_import<YuukiMessageCommand>(path, true)
    client.add_command(CommandTypeMap.Message, command)
    console.info(`added message command: ${command.name}`)
  })

  w_msg_commands.on('change', async path => {
    const command = await fake_default_import<YuukiMessageCommand>(path, true)
    client.add_command(CommandTypeMap.Message, command)
    console.info(`updated message command: ${command.name}`)
  })

  console.info('waiting for client ready')
  await client.ready
  console.info('client ready')
}
