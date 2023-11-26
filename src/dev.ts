import { Client, GatewayDispatchEvents, InteractionType, type APIApplicationCommandInteraction, type LocaleString, type Permissions, type RESTPutAPIApplicationGuildCommandsJSONBody } from '@discordjs/core'
import { REST } from '@discordjs/rest'
import { WebSocketManager } from '@discordjs/ws'
import { transformFile, type Options } from '@swc/core'
import { watch } from 'chokidar'
import { resolve } from 'node:path'
import { SourceTextModule } from 'node:vm'

function get_app_id_from_token(token: string) {
  const b64 = token.slice(0, token.indexOf('.'))
  const buf = Buffer.from(b64, 'base64')
  return buf.toString()
}

const module_cache = new Map<string, SourceTextModule>()
const command_cache = new Map<string, YuukiCommand>()

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

async function sync_commands(client: YuukiClient, guild_id: string) {
  console.info('syncing commands')
  const to_sync: RESTPutAPIApplicationGuildCommandsJSONBody = []

  // @todo: diff command changes
  for (const command of command_cache.values()) {
    to_sync.push({
      name: command.name,
      name_localizations: command.nameLocalizations,
      description: command.description,
      description_localizations: command.descriptionLocalizaitons,
      default_member_permissions: command.defaultMemberPermissions,
      options: command.options,
      nsfw: command.nsfw,
    })
  }

  await client.api.applicationCommands.bulkOverwriteGuildCommands(client.app_id, guild_id, to_sync)
  console.info('commands synced')
}

export default async function run(): Promise<void> {
  const config = await load_config()
  const client = create_client(config.token)

  client.on(GatewayDispatchEvents.InteractionCreate, c => {
    const i = c.data
    switch (i.type) {
      case InteractionType.ApplicationCommand: {
        const command = command_cache.get(i.data.name)
        if (!command) {
          console.warn('unknown command')
          return
        }
        void command.onExecute({
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

  watcher.on('add', async path => {
    const command = await fake_default_import<YuukiCommand>(path, true)
    command_cache.set(command.name, command)
    console.info(`added command: ${command.name}`)
    await sync_commands(client, config.devGuildId)
  })

  watcher.on('change', async path => {
    const command = await fake_default_import<YuukiCommand>(path, true)
    command_cache.set(command.name, command)
    console.info(`updated command: ${command.name}`)
    await sync_commands(client, config.devGuildId)
  })

  console.info('waiting for client ready')
  await client.ready
  console.info('client ready')
}
