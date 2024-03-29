import { ApplicationCommandType, GatewayDispatchEvents, InteractionType } from '@discordjs/core'
import { watch } from 'chokidar'
import { resolve } from 'node:path'
import { SourceTextModule, SyntheticModule, type Module } from 'node:vm'
import { CommandTypeMap, create_client, type YuukiAutocompleteControl, type YuukiBaseContext, type YuukiChatInputCommand, type YuukiInteractionControl, type YuukiMessageCommand, type YuukiUserCommand } from './dev-client.js'
import { load_config, transform_file } from './utils.js'
import { mkdir } from 'node:fs/promises'

type CachedModule<T extends Module> = {
  id: string
  module: T
  code: string
}

const module_cache = new Map<string, CachedModule<SourceTextModule>>()
const fake_mod_cache = new Map<string, SyntheticModule>()

async function link_module(spec: string, parent: Module): Promise<Module> {
  if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) {
    const target = resolve(parent.identifier, '..', spec)
    const cached = module_cache.get(target)
    let code: string

    try {
      code = await transform_file(target)
    } catch {
      code = await transform_file(target.replace(/\.js$/, '.ts'))
    }

    if (cached && cached.code === code) {
      return cached.module
    }

    const fake_mod = new SourceTextModule(code, {
      identifier: target,
      initializeImportMeta: meta => {
        meta.url = target
      },
      // @ts-expect-error: see below
      importModuleDynamically: link_module,
    })

    module_cache.set(target, {
      id: target,
      module: fake_mod,
      code,
    })

    await fake_mod.link(link_module)
    await fake_mod.evaluate()

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

type FakeImport<T> = {
  is_cached: boolean
  data: T
}

async function fake_import<T extends object = object>(path: string, should_fail: true): Promise<FakeImport<T>>
async function fake_import<T extends object = object>(path: string, should_fail?: false): Promise<FakeImport<T> | null>
async function fake_import<T extends object = object>(path: string, should_fail = false): Promise<FakeImport<T> | null> {
  let code!: string

  try {
    console.debug(`transforming file: ${path}`)
    code = await transform_file(path)
  } catch (e) {
    if (should_fail) {
      console.error(e)
      process.exit(1)
    }

    return null
  }

  const cached = module_cache.get(path)

  if (cached && cached.code === code) {
    return {
      is_cached: true,
      data: cached.module.namespace as T,
    }
  }

  // @todo: cascade update to all dependent module
  const mod_id = resolve(path)
  const mod = new SourceTextModule(code, {
    identifier: mod_id,
    initializeImportMeta: meta => {
      meta.url = mod_id
    },
    // @ts-expect-error SourceTextModule's importModuleDynamically incorrectly extends Script
    importModuleDynamically: link_module,
  })

  module_cache.set(mod_id, {
    id: mod_id,
    module: mod,
    code,
  })

  await mod.link(link_module)
  await mod.evaluate()

  return {
    is_cached: false,
    data: mod.namespace as T,
  }
}

export default async function run(): Promise<void> {
  await mkdir('.yuuki', { recursive: true })
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
          let interaction_data
          switch (i.data.type) {
            case ApplicationCommandType.User:
              interaction_data = {
                target: i.data.resolved.users[i.data.target_id],
                caller: i.member?.user ?? i.user,
              }
              break
            case ApplicationCommandType.Message:
              interaction_data = {
                target: i.data.resolved.messages[i.data.target_id],
                caller: i.member?.user ?? i.user,
              }
          }
          void handler({
            fetchClient: () => c.api.users.getCurrent(),
            interaction: { ...i, ...interaction_data, reply: p => c.api.interactions.reply(i.id, i.token, p) },
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
    const command = await fake_import<{ default: YuukiChatInputCommand }>(path, true)
    client.add_command(CommandTypeMap.ChatInput, command.data.default)
    console.info(`added command: ${command.data.default.name}`)
  })

  w_commands.on('change', async path => {
    const command = await fake_import<{ default: YuukiChatInputCommand }>(path, true)
    if (!command.is_cached) {
      client.add_command(CommandTypeMap.ChatInput, command.data.default)
      console.info(`updated command: ${command.data.default.name}`)
    }
  })

  w_commands.on('unlink', path => {
    const mod_id = resolve(path)
    const cached = module_cache.get(mod_id)

    if (cached) {
      const command = cached.module.namespace as { default: YuukiChatInputCommand }
      client.remove_command(CommandTypeMap.ChatInput, command.default)
      console.info(`deleted command: ${command.default.name}`)
    }
  })

  w_user_commands.on('add', async path => {
    const command = await fake_import<{ default: YuukiUserCommand }>(path, true)
    client.add_command(CommandTypeMap.User, command.data.default)
    console.info(`updated user command: ${command.data.default.name}`)
  })

  w_user_commands.on('change', async path => {
    const command = await fake_import<{ default: YuukiUserCommand }>(path, true)
    if (!command.is_cached) {
      client.add_command(CommandTypeMap.User, command.data.default)
      console.info(`updated user command: ${command.data.default.name}`)
    }
  })

  w_user_commands.on('unlink', path => {
    const mod_id = resolve(path)
    const cached = module_cache.get(mod_id)

    if (cached) {
      const command = cached.module.namespace as { default: YuukiUserCommand }
      client.remove_command(CommandTypeMap.User, command.default)
      console.info(`deleted user command: ${command.default.name}`)
    }
  })

  w_msg_commands.on('add', async path => {
    const command = await fake_import<{ default: YuukiMessageCommand }>(path, true)
    client.add_command(CommandTypeMap.Message, command.data.default)
    console.info(`updated message command: ${command.data.default.name}`)
  })

  w_msg_commands.on('change', async path => {
    const command = await fake_import<{ default: YuukiMessageCommand }>(path, true)
    if (!command.is_cached) {
      client.add_command(CommandTypeMap.Message, command.data.default)
      console.info(`updated message command: ${command.data.default.name}`)
    }
  })

  w_msg_commands.on('unlink', path => {
    const mod_id = resolve(path)
    const cached = module_cache.get(mod_id)

    if (cached) {
      const command = cached.module.namespace as { default: YuukiMessageCommand }
      client.remove_command(CommandTypeMap.Message, command.default)
      console.info(`deleted message command: ${command.default.name}`)
    }
  })

  console.info('waiting for client ready')
  await client.ready
  console.info('client ready')
}
