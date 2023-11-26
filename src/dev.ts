import { ApplicationCommandType, Client, GatewayDispatchEvents, InteractionType, type APIApplicationCommandInteraction, type APIUser, type LocaleString, type Permissions, type RESTPutAPIApplicationGuildCommandsJSONBody } from '@discordjs/core'
import { REST } from '@discordjs/rest'
import { WebSocketManager } from '@discordjs/ws'
import { transformFile, type Options } from '@swc/core'
import { watch } from 'chokidar'
import is_deep_eq from 'fast-deep-equal'
import { resolve } from 'node:path'
import { SourceTextModule } from 'node:vm'

type YuukiCommandType = typeof YuukiCommandType[keyof typeof YuukiCommandType]
const YuukiCommandType = {
  ChatInput: 'cmd',
  User: 'usr',
  Message: 'msg',
} as const

function get_app_id_from_token(token: string) {
  const b64 = token.slice(0, token.indexOf('.'))
  const buf = Buffer.from(b64, 'base64')
  return buf.toString()
}

function is_command_eq(a: Record<string, unknown>, b: Record<string, unknown> | null | undefined) {
  if (!b) {
    return false
  }
  if (a.name !== b.name) {
    return false
  }
  if (a.description !== b.description) {
    return false
  }
  if (Boolean(a.dm_permission) !== Boolean(b.dm_permission)) {
    return false
  }
  if (Boolean(a.nsfw) !== Boolean(b.nsfw)) {
    return false
  }
  if (!is_deep_eq(a.nameLocalizations, b.nameLocalizations)) {
    return false
  }
  if (!is_deep_eq(a.descriptionLocalizaitons, b.descriptionLocalizaitons)) {
    return false
  }
  if ((a.options as unknown[])?.length !== (b.options as unknown[])?.length) {
    return false
  }
  // @todo: deep check options
  return true
}

class CommandCache {
  #cache: Map<string, YuukiCommand>
  // @todo: cache commands in disk
  public constructor(iterable?: Iterable<readonly [string, YuukiCommand]>) {
    this.#cache = new Map(iterable)
  }
  public get(key: string) {
    return this.#cache.get(key)
  }
  public set(type: YuukiCommandType, command: YuukiCommand): this {
    if ('onExecute' in command) {
      this.#cache.set(`${type}::${command.name}`, command)
      // @todo: resolve autocomplete
    } else {
      // @todo: resolve subcommands
    }
    // @todo: disk persistence
    return this
  }
  public resolve(command: APIApplicationCommandInteraction) {
    let key: string
    switch (command.data.type) {
      case ApplicationCommandType.ChatInput:
        key = `${YuukiCommandType.ChatInput}::${command.data.name}`
        // @todo: resolve subcommands
        // @todo: resolve autocomplete
        break
      case ApplicationCommandType.User:
        key = `${YuukiCommandType.User}::${command.data.name}`
        break
      case ApplicationCommandType.Message:
        key = `${YuukiCommandType.Message}::${command.data.name}`
    }
    return this.#cache.get(key)
  }
  public is_cached(type: YuukiCommandType, command: YuukiCommand): boolean {
    switch (type) {
      case YuukiCommandType.ChatInput: {
        // @todo: resolve subcommands
        // @todo: resolve autocomplete
        const cached = this.get(`${YuukiCommandType.ChatInput}::${command.name}`)
        return is_command_eq(command, cached)
      }
      case YuukiCommandType.User: {
        const cached = this.get(`${YuukiCommandType.User}::${command.name}`)
        return is_command_eq(command, cached)
      }
      case YuukiCommandType.Message: {
        const cached = this.get(`${YuukiCommandType.Message}::${command.name}`)
        return is_command_eq(command, cached)
      }
    }
  }
  public toJSON(): RESTPutAPIApplicationGuildCommandsJSONBody {
    const data: RESTPutAPIApplicationGuildCommandsJSONBody = []
    for (const command of this.#cache.values()) {
      data.push({
        name: command.name,
        name_localizations: command.nameLocalizations,
        description: command.description,
        description_localizations: command.descriptionLocalizaitons,
        default_member_permissions: command.defaultMemberPermissions,
        options: command.options,
        nsfw: command.nsfw,
      })
    }
    return data
  }
}

const module_cache = new Map<string, SourceTextModule>()
const command_cache = new CommandCache()

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

function not_implemented(): never {
  throw new TypeError('not implemented')
}

type YuukiConfig = {
  token: string
  devGuildId: string
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
    // @todo: module linking
    importModuleDynamically: not_implemented,
  })

  module_cache.set(mod_id, mod)

  // @todo: module linking
  await mod.link(not_implemented)
  await mod.evaluate()

  return mod.namespace as T
}

class YuukiClient extends Client {
  public app_id: string
  public ready: Promise<void>
  public constructor(token: string, rest: REST, gateway: WebSocketManager) {
    super({ rest, gateway })
    this.ready = gateway.connect()
    this.app_id = get_app_id_from_token(token)
  }
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

function create_client(token: string, intents = 0) {
  const rest = new REST({ version: '10' }).setToken(token)
  const gateway = new WebSocketManager({ token, intents, rest })
  return new YuukiClient(token, rest, gateway)
}

type YuukiInteraction = APIApplicationCommandInteraction & {
  reply: (payload: { content: string }) => Promise<void>
}

type YuukiContext = {
  fetchClient: () => Promise<APIUser>
  interaction: YuukiInteraction
}

type YuukiCommand = {
  name: string
  nameLocalizations: Record<LocaleString, string>
  description: string
  descriptionLocalizaitons: Record<LocaleString, string>
  onExecute: (c: YuukiContext) => void | Promise<void>
  options?: []
  defaultMemberPermissions: Permissions
  dmPermission?: boolean
  nsfw?: boolean
}

function debouce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: T) => {
    clearTimeout(timeout)
    timeout = setTimeout(fn, ms, ...args)
  }
}

const sync_commands = debouce(async (client: YuukiClient, guild_id: string) => {
  console.info('syncing commands')
  const to_sync = command_cache.toJSON()
  await client.api.applicationCommands.bulkOverwriteGuildCommands(client.app_id, guild_id, to_sync)
  console.info('commands synced')
}, 250)

function set_command(client: YuukiClient, guild_id: string, command: YuukiCommand) {
  // @todo: user and message commands
  const is_cached = command_cache.is_cached(YuukiCommandType.ChatInput, command)

  command_cache.set(YuukiCommandType.ChatInput, command)

  if (!is_cached) {
    sync_commands(client, guild_id)
  }
}

export default async function run(): Promise<void> {
  const config = await load_config()
  const client = create_client(config.token)

  client.on(GatewayDispatchEvents.InteractionCreate, c => {
    const i = c.data
    switch (i.type) {
      case InteractionType.ApplicationCommand: {
        const command = command_cache.resolve(i)
        if (!command) {
          console.warn('unknown command')
          return
        }
        void command.onExecute({
          fetchClient: () => c.api.users.getCurrent(),
          interaction: {
            ...i,
            reply: payload => c.api.interactions.reply(i.id, i.token, payload),
          },
        })
        break
      }
      default:
        not_implemented()
    }
  })

  const watcher = watch('src/commands')
  // @todo: user and message commands

  watcher.on('add', async path => {
    const command = await fake_default_import<YuukiCommand>(path, true)
    set_command(client, config.devGuildId, command)
    console.info(`added command: ${command.name}`)
  })

  watcher.on('change', async path => {
    const command = await fake_default_import<YuukiCommand>(path, true)
    set_command(client, config.devGuildId, command)
    console.info(`updated command: ${command.name}`)
  })

  console.info('waiting for client ready')
  await client.ready
  console.info('client ready')
}
