import { ApplicationCommandType, Client, InteractionType, type APIApplicationCommandOption, type APIInteraction, type APIUser, type LocaleString, type RESTPostAPIChatInputApplicationCommandsJSONBody, type RESTPutAPIApplicationCommandsJSONBody } from '@discordjs/core'
import { ApplicationCommandOptionType, type APIApplicationCommandAutocompleteInteraction, type APIChatInputApplicationCommandInteraction, type APIMessageApplicationCommandInteraction, type APIUserApplicationCommandInteraction, type InteractionsAPI } from '@discordjs/core/http-only'
import { REST } from '@discordjs/rest'
import { WebSocketManager } from '@discordjs/ws'
import is_deep_eq from 'fast-deep-equal'

type CommandPayload = RESTPutAPIApplicationCommandsJSONBody[number]

type OptionType = keyof typeof OptionType
const OptionType = {
  SUB_COMMAND: 1,
  SUB_COMMAND_GROUP: 2,
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  USER: 6,
  CHANNEL: 7,
  ROLE: 8,
  MENTIONABLE: 9,
  NUMBER: 10,
  ATTACHMENT: 11,
} as const

type ChannelType = keyof typeof ChannelType
const ChannelType = {
  GUILD_TEXT: 0,
  DM: 1,
  GUILD_VOICE: 2,
  GROUP_DM: 3,
  GUILD_CATEGORY: 4,
  GUILDE_ANNOUNCEMENT: 5,
  ANNOUNCEMENT_THREAD: 10,
  PUBLIC_THREAD: 11,
  PRIVATE_THREAD: 12,
  GUILD_STAGE_VOICE: 13,
  GUILD_DIRECTORY: 14,
  GUILD_FORUM: 15,
  GUILD_MEDIA: 16,
} as const

type Choice<T> = {
  name: string
  nameLocalizations?: Partial<Record<LocaleString, string>>
  value: T
}

export type YuukiOption = NonCommandOption | SubcommandGroupOption | SubcommandOption

type SubcommandOption = {
  type: 'SUB_COMMAND'
  name: string
  nameLocalizations?: Partial<Record<LocaleString, string>>
  description: string
  descriptionLocalizations?: Partial<Record<LocaleString, string>>
  onExecute: YuukiHandler<APIChatInputApplicationCommandInteraction & YuukiInteractionControl>
  required?: boolean
  options?: NonCommandOption[]
}

type SubcommandGroupOption = {
  type: 'SUB_COMMAND_GROUP'
  name: string
  nameLocalizations?: Partial<Record<LocaleString, string>>
  description: string
  descriptionLocalizations?: Partial<Record<LocaleString, string>>
  required?: boolean
  options: SubcommandOption[]
}

type StringOption = {
  type: 'STRING'
  name: string
  nameLocalizations?: Partial<Record<LocaleString, string>>
  description: string
  descriptionLocalizations?: Partial<Record<LocaleString, string>>
  required?: boolean
  minLength?: number
  maxLength?: number
} & (
  | { choices?: Choice<string>[] }
  | { autocomplete?: YuukiHandler<APIApplicationCommandAutocompleteInteraction> }
)

type NumberOption = {
  type: 'INTEGER' | 'NUMBER'
  name: string
  nameLocalizations?: Partial<Record<LocaleString, string>>
  description: string
  descriptionLocalizations?: Partial<Record<LocaleString, string>>
  required?: boolean
  minValue?: number
  maxValue?: number
} & (
  | { choices?: Choice<number>[] }
  | { autocomplete?: YuukiHandler<APIApplicationCommandAutocompleteInteraction> }
)

type ChannelOption = {
  type: 'CHANNEL'
  name: string
  nameLocalizations?: Partial<Record<LocaleString, string>>
  description: string
  descriptionLocalizations?: Partial<Record<LocaleString, string>>
  required?: boolean
  channelTypes?: ChannelType[]
}

type NonCommandOption = StringOption | NumberOption | ChannelOption | {
  type: 'BOOLEAN' | 'USER' | 'ROLE' | 'MENTIONABLE' | 'ATTACHMENT'
  name: string
  nameLocalizations?: Partial<Record<LocaleString, string>>
  description: string
  descriptionLocalizations?: Partial<Record<LocaleString, string>>
  required?: boolean
}

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

function did_option_change(a: APIApplicationCommandOption, b: APIApplicationCommandOption): boolean {
  if (a.type !== b.type) {
    return true
  }

  if (a.name !== b.name) {
    return true
  }

  if (!is_deep_eq(a.name_localizations, b.name_localizations)) {
    return true
  }

  if (a.description !== b.description) {
    return true
  }

  if (!is_deep_eq(a.description_localizations, b.description_localizations)) {
    return true
  }

  if (Boolean(a.required) !== Boolean(b.required)) {
    return true
  }

  switch (a.type) {
    case ApplicationCommandOptionType.Subcommand:
    case ApplicationCommandOptionType.SubcommandGroup: {
      const _a = a
      const _b = b as typeof _a

      if (_a.options?.length !== _b.options?.length) {
        return true
      }

      if (_a.options && _b.options) {
        for (let i = 0; i < _a.options.length; i++) {
          const __a = _a.options[i]
          const __b = _b.options[i]

          if (did_option_change(__a, __b)) {
            return true
          }
        }
      }

      break
    }
    case ApplicationCommandOptionType.String:
    case ApplicationCommandOptionType.Integer:
    case ApplicationCommandOptionType.Number: {
      const _a = a

      if (_a.type === ApplicationCommandOptionType.String) {
        const _b = b as typeof _a
        if (Number(_a.min_length) !== Number(_b.min_length)) {
          return true
        }

        if (Number(_a.max_length) !== Number(_b.max_length)) {
          return true
        }
      } else {
        const _b = b as typeof _a
        if (Number(_a.min_value) !== Number(_b.min_value)) {
          return true
        }

        if (Number(_a.max_value) !== Number(_b.max_value)) {
          return true
        }
      }

      const _b = b as typeof _a

      if (_a.choices?.length !== _b.choices?.length) {
        return true
      }

      if (_a.choices && _b.choices) {
        for (let i = 0; i < _a.choices.length; i++) {
          const __a = _a.choices[i]
          const __b = _b.choices[i]

          if (__a.name !== __b.name) {
            return true
          }

          if (!is_deep_eq(__a.name_localizations, __b.name_localizations)) {
            return true
          }

          if (__a.value !== __b.value) {
            return true
          }
        }
      }

      if (Boolean(_a.autocomplete) !== Boolean(_b.autocomplete)) {
        return true
      }

      break
    }
    case ApplicationCommandOptionType.Channel: {
      const _a = a
      const _b = b as typeof _a

      if (_a.channel_types?.length !== _b.channel_types?.length) {
        return true
      }

      if (_a.channel_types && _b.channel_types) {
        const __a = _a.channel_types.toSorted((a_, b_) => a_ - b_)
        const __b = _b.channel_types.toSorted((a_, b_) => a_ - b_)

        if (!is_deep_eq(__a, __b)) {
          return true
        }
      }
    }
  }

  return false
}

function did_command_change(a: CommandPayload, b: CommandPayload | undefined) {
  if (!b) {
    return true
  }

  if (a.type !== b.type) {
    return true
  }

  if (a.name !== b.name) {
    return true
  }

  if (!is_deep_eq(a.name_localizations, b.name_localizations)) {
    return true
  }

  if (!a.type || a.type === ApplicationCommandType.ChatInput) {
    const _a = a
    const _b = b as RESTPostAPIChatInputApplicationCommandsJSONBody
    if (_a.description !== _b.description) {
      return true
    }

    if (!is_deep_eq(_a.description_localizations, b.description_localizations)) {
      return true
    }

    if (Array.isArray(_a.options) !== Array.isArray(_b.options)) {
      return true
    }

    if (_a.options && _b.options) {
      if (Number(_a.options?.length) !== Number(_b.options?.length)) {
        return true
      }

      for (let i = 0; i < _a.options.length; i++) {
        const __a = _a.options[i]
        const __b = _b.options[i]
        if (did_option_change(__a, __b)) {
          return true
        }
      }
    }
  }

  if (Boolean(a.dm_permission) !== Boolean(b.dm_permission)) {
    return true
  }

  if (Boolean(a.nsfw) !== Boolean(b.nsfw)) {
    return true
  }

  if (a.default_member_permissions !== b.default_member_permissions) {
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

export interface YuukiBaseContext<T = unknown> {
  fetchClient: () => Promise<APIUser>
  interaction: T
}

export interface YuukiInteractionControl {
  reply: (payload: Parameters<InteractionsAPI['reply']>[2]) => Promise<void>
}

export interface YuukiAutocompleteControl {
  respond: (payload: Parameters<InteractionsAPI['createAutocompleteResponse']>[2]) => Promise<void>
}

export type YuukiCommand = YuukiChatInputCommand | YuukiUserCommand | YuukiMessageCommand

export type YuukiChatInputCommand = {
  name: string
  nameLocalizations?: Partial<Record<LocaleString, string>>
  description: string
  descriptionLocalizations?: Partial<Record<LocaleString, string>>
  defaultMemberPermissions?: PermissionString[]
  dmPermission?: boolean
  nsfw?: boolean
} & (
  | {
    onExecute: YuukiHandler<APIChatInputApplicationCommandInteraction & YuukiInteractionControl>
    options?: NonCommandOption[]
  }
  | {
    options: (SubcommandOption | SubcommandGroupOption)[]
  }
)

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

function convert_option(option: YuukiOption): APIApplicationCommandOption {
  return {
    type: OptionType[option.type],
    name: option.name,
    name_localizations: option.nameLocalizations,
    description: option.description,
    description_localizations: option.descriptionLocalizations,
    required: option.required,
    options: 'options' in option
      ? option.options?.map(convert_option)
      : undefined,
    choices: 'choices' in option
      ? option.choices?.map(choice => ({
        name: choice.name,
        name_localizations: choice.nameLocalizations,
        value: choice.value as number,
      }))
      : undefined,
    min_length: (option as StringOption).minLength,
    max_length: (option as StringOption).maxLength,
    max_value: (option as NumberOption).maxValue,
    min_value: (option as NumberOption).minValue,
    channel_types: (option as ChannelOption).channelTypes?.map(key => ChannelType[key]),
    autocomplete: 'autocomplete' in option
      ? typeof option.autocomplete === 'function'
      : undefined,
  } as APIApplicationCommandOption
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
      case InteractionType.ApplicationCommand:
      case InteractionType.ApplicationCommandAutocomplete: {
        const c = interaction.data

        switch (c.type) {
          case ApplicationCommandType.ChatInput: {
            let resolved_key!: string
            let root_key = `${CommandTypeMap.ChatInput}::${c.name}`

            if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
              root_key = `cmp::${root_key}`
            }

            if (c.options) {
              for (const option of c.options) {
                switch (option.type) {
                  case ApplicationCommandOptionType.Subcommand: {
                    const subcommand = option
                    resolved_key = `${root_key}::${subcommand.name}`
                    break
                  }
                  case ApplicationCommandOptionType.SubcommandGroup: {
                    const group = option
                    const key = `${root_key}::${group.name}`
                    const subcommand = group.options[0]
                    resolved_key = `${key}::${subcommand.name}`
                  }
                }
              }
            }
            return this.#handler_cache.get(resolved_key)
          }
          case ApplicationCommandType.User:
          case ApplicationCommandType.Message:
            return this.#handler_cache.get(`${CommandTypeMap[c.type]}::${c.name}`)
        }
      }
    }
  }
  public add_command(type: YuukiCommandType, command: YuukiCommand): void {
    const root_key = `${type}::${command.name}`
    const cmp_key = `cmp::${root_key}`

    for (const key of this.#handler_cache.keys()) {
      if (key.startsWith(root_key) || key.startsWith(cmp_key)) {
        this.#handler_cache.delete(key)
      }
    }

    if ('onExecute' in command) {
      this.#handler_cache.set(root_key, command.onExecute)
      if ('options' in command && Array.isArray(command.options)) {
        for (const option of command.options) {
          if ('autocomplete' in option && typeof option.autocomplete === 'function') {
            const key = `${cmp_key}::${option.name}`

            this.#handler_cache.set(key, option.autocomplete)
          }
        }
      }
    } else {
      for (const option of command.options) {
        switch (option.type) {
          case 'SUB_COMMAND': {
            const subcommand = option
            const key = `${root_key}::${subcommand.name}`

            this.#handler_cache.set(key, subcommand.onExecute)

            if (subcommand.options) {
              for (const suboption of subcommand.options) {
                if ('autocomplete' in suboption && suboption.autocomplete) {
                  const sub_key = `${cmp_key}::${subcommand.name}::${suboption.name}`

                  this.#handler_cache.set(sub_key, suboption.autocomplete)
                }
              }
            }
            break
          }
          case 'SUB_COMMAND_GROUP': {
            const group = option
            for (const subcommand of group.options) {
              const key = `${root_key}::${group.name}::${subcommand.name}`

              this.#handler_cache.set(key, subcommand.onExecute)

              if (subcommand.options) {
                for (const suboption of subcommand.options) {
                  if ('autocomplete' in suboption && suboption.autocomplete) {
                    const sub_key = `${cmp_key}::${group.name}::${subcommand.name}::${suboption.name}`

                    this.#handler_cache.set(sub_key, suboption.autocomplete)
                  }
                }
              }
            }
          }
        }
      }
    }

    const payload: CommandPayload = {
      type: CommandTypeMap[type],
      name: command.name,
      name_localizations: command.nameLocalizations,
      description: (command as YuukiChatInputCommand).description,
      description_localizations: (command as YuukiChatInputCommand).descriptionLocalizations,
      options: (command as YuukiChatInputCommand).options?.map(convert_option),
      default_member_permissions:
        command.defaultMemberPermissions &&
        resolve_bitfield(Permissions, command.defaultMemberPermissions),
      dm_permission: command.dmPermission,
      nsfw: command.nsfw,
    }

    const should_sync = did_command_change(payload, this.#command_cache.get(root_key))

    this.#command_cache.set(root_key, payload)

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
