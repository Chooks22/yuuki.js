import { ApplicationCommandType, Client, InteractionType, type APIInteraction, type APIUser, type LocaleString, type RESTPutAPIApplicationCommandsJSONBody } from '@discordjs/core'
import type { APIChatInputApplicationCommandInteraction, APIMessageApplicationCommandInteraction, APIUserApplicationCommandInteraction, InteractionsAPI } from '@discordjs/core/http-only'
import { REST } from '@discordjs/rest'
import { WebSocketManager } from '@discordjs/ws'
import is_deep_eq from 'fast-deep-equal'

export type YuukiCommandType = 'cmd' | 'usr' | 'msg'
export const CommandTypeMap = {
  ChatInput: 'cmd',
  User: 'usr',
  Message: 'msg',
  [ApplicationCommandType.ChatInput]: 'cmd',
  [ApplicationCommandType.User]: 'usr',
  [ApplicationCommandType.Message]: 'msg',
  cmd: ApplicationCommandType.ChatInput,
  usr: ApplicationCommandType.User,
  msg: ApplicationCommandType.Message,
} as const

export type PermissionString = keyof Permissions
export type Permissions = typeof Permissions
export const Permissions = {
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

export type IntentString = keyof Intents
export type Intents = typeof Intents
export const Intents = {
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

function resolve_bitfield<T extends Record<string, bigint>>(bitfield: T, fields: (keyof T)[]) {
  return fields
    .reduce((bits, field) => bits | bitfield[field], 0n)
    .toString()
}

function get_app_id_from_token(token: string) {
  const b64 = token.slice(0, token.indexOf('.'))
  const buf = Buffer.from(b64, 'base64')
  return buf.toString()
}

function did_command_change(a: YuukiCommand, b: RESTPutAPIApplicationCommandsJSONBody[number] | undefined) {
  if (!b) {
    return true
  }

  if (a.name !== b.name) {
    return true
  }

  if (!is_deep_eq(a.nameLocalizations, b.name_localizations)) {
    return true
  }

  if (!b.type || b.type === ApplicationCommandType.ChatInput) {
    const _a = a as YuukiChatInputCommand
    if (_a.description !== b.description) {
      return true
    }

    if (!is_deep_eq(_a.descriptionLocalizations, b.description_localizations)) {
      return true
    }

    if (Number(_a.options?.length) !== Number(b.options?.length)) {
      return true
    }

    // @todo: check options
  }

  if (Boolean(a.dmPermission) !== Boolean(b.dm_permission)) {
    return true
  }

  if (Boolean(a.nsfw) !== Boolean(b.nsfw)) {
    return true
  }

  if (resolve_bitfield(Permissions, a.defaultMemberPermissions ?? []) !== String(b.default_member_permissions)) {
    return true
  }

  return false
}

export type YuukiConfig = {
  token: string
  devGuildId: string
  intents: IntentString[]
}

type YuukiHandler<T> = (context: YuukiBaseContext<T>) => void | Promise<void>

interface YuukiBaseContext<T = unknown> {
  fetchClient: () => Promise<APIUser>
  interaction: T
}

export interface YuukiInteractionControl {
  reply: (payload: Parameters<InteractionsAPI['reply']>[2]) => Promise<void>
}

export type YuukiCommand = YuukiChatInputCommand | YuukiUserCommand | YuukiMessageCommand

// @todo: options
export type YuukiChatInputCommand = {
  name: string
  nameLocalizations?: Partial<Record<LocaleString, string>>
  description: string
  descriptionLocalizations?: Partial<Record<LocaleString, string>>
  onExecute: YuukiHandler<APIChatInputApplicationCommandInteraction & YuukiInteractionControl>
  options?: any[]
  defaultMemberPermissions?: PermissionString[]
  dmPermission?: boolean
  nsfw?: boolean
}

export type YuukiUserCommand = {
  name: string
  nameLocalizations?: Partial<Record<LocaleString, string>>
  onExecute: YuukiHandler<APIUserApplicationCommandInteraction & YuukiInteractionControl>
  defaultMemberPermissions?: PermissionString[]
  dmPermission?: boolean
  nsfw?: boolean
}

export type YuukiMessageCommand = {
  name: string
  nameLocalizations?: Partial<Record<LocaleString, string>>
  onExecute: YuukiHandler<APIMessageApplicationCommandInteraction & YuukiInteractionControl>
  defaultMemberPermissions?: PermissionString[]
  dmPermission?: boolean
  nsfw?: boolean
}

function debounce<T extends unknown[]>(cb: (...args: T) => void | Promise<void>, ms: number) {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: T) => {
    clearTimeout(timeout)
    timeout = setTimeout(cb, ms, ...args)
  }
}

export class DevClient extends Client {
  // @todo: cache commands in disk
  #handler_cache = new Map<string, YuukiHandler<any>>()
  #command_cache = new Map<string, RESTPutAPIApplicationCommandsJSONBody[number]>()
  public app_id: string
  public ready: Promise<void>
  public constructor(private config: YuukiConfig) {
    const token = config.token
    const intents = 0

    const rest = new REST({ version: '10' }).setToken(token)
    const gateway = new WebSocketManager({ token, rest, intents })

    super({ rest, gateway })

    this.ready = gateway.connect()
    this.app_id = get_app_id_from_token(token)
    this.sync_commands = debounce(this.sync_commands.bind(this), 250) as () => Promise<void>
  }
  public get_handler<T = unknown>(interaction: APIInteraction): YuukiHandler<T> | undefined {
    switch (interaction.type) {
      case InteractionType.ApplicationCommand: {
        const c = interaction.data
        switch (c.type) {
          case ApplicationCommandType.ChatInput:
            console.log(c)
            // @todo: subcommands
            return this.#handler_cache.get(`${CommandTypeMap.ChatInput}::${c.name}`)
          case ApplicationCommandType.User:
          case ApplicationCommandType.Message:
            return this.#handler_cache.get(`${CommandTypeMap[c.type]}::${c.name}`)
        }
      }
      // @todo: autocomplete
    }
  }
  public add_command(type: YuukiCommandType, command: YuukiCommand): void {
    const root_key = `${type}::${command.name}`

    if ('onExecute' in command) {
      this.#handler_cache.set(root_key, command.onExecute)
      // @todo: autocomplete
    } else {
      // @todo: subcommands
    }

    const should_sync = did_command_change(command, this.#command_cache.get(root_key))

    this.#command_cache.set(root_key, {
      type: CommandTypeMap[type],
      name: command.name,
      name_localizations: command.nameLocalizations,
      description: (command as YuukiChatInputCommand).description,
      description_localizations: (command as YuukiChatInputCommand).descriptionLocalizations,
      options: (command as YuukiChatInputCommand).options,
      default_member_permissions: command.defaultMemberPermissions && resolve_bitfield(Permissions, command.defaultMemberPermissions),
      dm_permission: command.dmPermission,
      nsfw: command.nsfw,
    })

    if (should_sync) {
      void this.sync_commands()
    }
  }
  private async sync_commands() {
    const to_sync = [...this.#command_cache.values()]
    console.info(`syncing ${to_sync.length} commands`)
    await this.api.applicationCommands.bulkOverwriteGuildCommands(this.app_id, this.config.devGuildId, to_sync)
    console.log(`synced ${to_sync.length} commands`)
  }
}
