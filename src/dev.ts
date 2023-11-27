import { ApplicationCommandType, Client, GatewayDispatchEvents, InteractionType, type APIApplicationCommandInteraction, type APIMessageApplicationCommandInteraction, type APIUser, type APIUserApplicationCommandInteraction, type LocaleString, type RESTPutAPIApplicationGuildCommandsJSONBody } from '@discordjs/core'
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
  // @todo: refactor this out
  cmd: 1,
  usr: 2,
  msg: 3,
} as const

type IntentString = keyof Intents
type Intents = typeof Intents
const Intents = {
  GUILDS: 1n << 0n,
  GUILD_MEMBERS: 1n << 1n,
  GUILD_MODERATION: 1n << 2n,
  GUILD_EMOJIS_AND_STICKERS: 1n << 3n,
  GUILD_INTEGRATIONS: 1n << 4n,
  GUILD_WEBHOOKS: 1n << 5n,
  GUILD_INVITES: 1n << 6n,
  GUILD_VOICE_STATES: 1n << 7n,
  GUILD_PRESENCES: 1n << 8n,
  GUILD_MESSAGES: 1n << 9n,
  GUILD_MESSAGE_REACTIONS: 1n << 10n,
  GUILD_MESSAGE_TYPING: 1n << 11n,
  DIRECT_MESSAGES: 1n << 12n,
  DIRECT_MESSAGE_REACTIONS: 1n << 13n,
  DIRECT_MESSAGE_TYPING: 1n << 14n,
  MESSAGE_CONTENT: 1n << 15n,
  GUILD_SCHEDULED_EVENTS: 1n << 16n,
  AUTO_MODERATION_CONFIGURATION: 1n << 17n,
  AUTO_MODERATION_EXECUTION: 1n << 18n,
} as const

type PermissionString = keyof Permissions
type Permissions = typeof Permissions
const Permissions = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBER: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTOR: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_GUILD_EXPRESSIONS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_EMBEDDED_ACTIVITIES: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n,
  VIEW_CREATOR_MONETIZAION_ANALYTICS: 1n << 41n,
  USE_SOUNDBOARD: 1n << 42n,
  CREATE_GUILD_EXPRESSION: 1n << 43n,
  CREATE_EVENTS: 1n << 44n,
  USE_EXTERNAL_SOUNDS: 1n << 45n,
  SEND_VOICE_MESSAGES: 1n << 46n,
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

type YuukiBaseCommand = {
  name: string
  onExecute: (context: any) => void | Promise<void>
}

// @todo: keep track of individual modules
class CommandCache {
  #cache: Map<string, YuukiBaseCommand>
  // @todo: cache commands in disk
  public constructor(iterable?: Iterable<readonly [string, YuukiBaseCommand]>) {
    this.#cache = new Map(iterable)
  }
  public get<T extends YuukiBaseCommand = YuukiBaseCommand>(key: string) {
    return this.#cache.get(key) as T
  }
  public set(type: YuukiCommandType, command: YuukiBaseCommand): this {
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
  public is_cached(type: YuukiCommandType, command: YuukiBaseCommand): boolean {
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
      // @todo: remove
      default: return false
    }
  }
  public toJSON(): RESTPutAPIApplicationGuildCommandsJSONBody {
    const data: RESTPutAPIApplicationGuildCommandsJSONBody = []
    // @todo: keep track of types
    for (const [key, command] of this.#cache as Iterable<[string, YuukiCommand]>) {
      const type = key.slice(0, key.indexOf('::')) as 'cmd' | 'usr' | 'msg'
      data.push({
        type: YuukiCommandType[type],
        name: command.name,
        name_localizations: command.nameLocalizations,
        description: command.description,
        description_localizations: command.descriptionLocalizations,
        default_member_permissions: command.defaultMemberPermissions
          ?.reduce((acc, p) => acc & Permissions[p], 0n)
          .toString(),
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
  intents: IntentString[]
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

function create_client(config: YuukiConfig) {
  const token = config.token
  const intents = config.intents.reduce((i, intent) => i & Intents[intent], 0n).toString() as unknown as 0

  const rest = new REST({ version: '10' }).setToken(config.token)
  const gateway = new WebSocketManager({ token, intents, rest })

  return new YuukiClient(config.token, rest, gateway)
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
  nameLocalizations?: Record<LocaleString, string>
  description: string
  descriptionLocalizations?: Record<LocaleString, string>
  onExecute: (c: YuukiContext) => void | Promise<void>
  options?: []
  defaultMemberPermissions?: PermissionString[]
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

function set_command(client: YuukiClient, guild_id: string, command: YuukiBaseCommand, type: YuukiCommandType) {
  // @todo: user and message commands
  const is_cached = command_cache.is_cached(type, command)

  command_cache.set(type, command)

  if (!is_cached) {
    sync_commands(client, guild_id)
  }
}

export default async function run(): Promise<void> {
  const config = await load_config()
  const client = create_client(config)

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
            // @todo: fix types
            reply: (payload: object) => c.api.interactions.reply(i.id, i.token, payload),
          },
        })
        break
      }
      default:
        not_implemented()
    }
  })

  type YuukiUserInteraction = APIUserApplicationCommandInteraction & {
    reply: (payload: { content: string }) => Promise<void>
  }

  type YuukiUserCommandContext = {
    fetchClient: () => APIUser
    interaction: YuukiUserInteraction
  }

  type YuukiUserCommand = {
    name: string
    name_localizations?: Record<LocaleString, string>
    onExecute: (context: YuukiUserCommandContext) => void | Promise<void>
  }

  type YuukiMessageInteraction = APIMessageApplicationCommandInteraction & {
    reply: (payload: { content: string }) => Promise<void>
  }

  type YuukiMessageCommandContext = {
    fetchClient: () => APIUser
    interaction: YuukiMessageInteraction
  }

  type YuukiMessageCommand = {
    name: string
    name_localizations?: Record<LocaleString, string>
    onExecute: (context: YuukiMessageCommandContext) => void | Promise<void>
  }

  const w_commands = watch('src/commands')
  const w_user_commands = watch('src/users')
  const w_msg_commands = watch('src/messages')

  w_commands.on('add', async path => {
    const command = await fake_default_import<YuukiCommand>(path, true)
    set_command(client, config.devGuildId, command, YuukiCommandType.ChatInput)
    console.info(`added command: ${command.name}`)
  })

  w_commands.on('change', async path => {
    const command = await fake_default_import<YuukiCommand>(path, true)
    set_command(client, config.devGuildId, command, YuukiCommandType.ChatInput)
    console.info(`updated command: ${command.name}`)
  })

  w_user_commands.on('add', async path => {
    const command = await fake_default_import<YuukiUserCommand>(path, true)
    set_command(client, config.devGuildId, command, YuukiCommandType.User)
    console.info(`added user command: ${command.name}`)
  })

  w_user_commands.on('change', async path => {
    const command = await fake_default_import<YuukiUserCommand>(path, true)
    set_command(client, config.devGuildId, command, YuukiCommandType.User)
    console.info(`updated user command: ${command.name}`)
  })

  w_msg_commands.on('add', async path => {
    const command = await fake_default_import<YuukiMessageCommand>(path, true)
    set_command(client, config.devGuildId, command, YuukiCommandType.User)
    console.info(`added user command: ${command.name}`)
  })

  w_msg_commands.on('change', async path => {
    const command = await fake_default_import<YuukiMessageCommand>(path, true)
    set_command(client, config.devGuildId, command, YuukiCommandType.User)
    console.info(`updated user command: ${command.name}`)
  })

  console.info('waiting for client ready')
  await client.ready
  console.info('client ready')
}
