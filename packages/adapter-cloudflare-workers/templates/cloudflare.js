import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions'
'use imports'

const commands = new Map()

// @todo: inline commands
function set_command(command, type) {
  const base_key = `${type}::${command.name}`
  if (typeof command.onExecute === 'function') {
    commands.set(`${InteractionType.APPLICATION_COMMAND}::${base_key}`, command.onExecute)

    if (Array.isArray(command.options)) {
      for (const option of command.options) {
        if (typeof option.autocomplete === 'function') {
          commands.set(
            `${InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE}::${base_key}::${option.name}`,
            option.autocomplete,
          )
        }
      }
    }

    return
  }

  if (Array.isArray(command.options)) {
    for (const option of command.options) {
      switch (option.type) {
        case 1: {
          const subcommand_key = `${base_key}::${option.name}`
          commands.set(`${InteractionType.APPLICATION_COMMAND}::${subcommand_key}`, option.onExecute)

          if (Array.isArray(option.options)) {
            for (const suboption of option.options) {
              if (typeof suboption.autocomplete === 'function') {
                command.set(
                  `${InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE}::${subcommand_key}::${suboption.name}`,
                  suboption.autocomplete,
                )
              }
            }
          }
          break
        }
        case 2: {
          for (const subcommand of option.options) {
            const subcommand_key = `${base_key}::${option.name}::${subcommand.name}`
            commands.set(`${InteractionType.APPLICATION_COMMAND}::${subcommand_key}`, subcommand.onExecute)

            if (Array.isArray(subcommand.options)) {
              for (const suboption of subcommand.options) {
                if (typeof suboption.autocomplete === 'function') {
                  command.set(
                    `${InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE}::${subcommand_key}::${suboption.name}`,
                    suboption.autocomplete,
                  )
                }
              }
            }
          }
        }
      }
    }
  }
}

'use setters'

export default {
  /**
   * @param {Request} request
   * @param {Record<string, string>} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(null, { status: 404 })
    }

    const signature = request.headers.get('X-Signature-Ed25519')
    const timestamp = request.headers.get('X-Signature-Timestamp')

    const isValidRequest = verifyKey(
      await request.clone().arrayBuffer(),
      signature,
      timestamp,
      env.YUUKI_PUBLIC_KEY,
    )

    if (!isValidRequest) {
      console.debug('rejected request')
      return new Response(null, { status: 403 })
    }

    const interaction = await request.json()
    console.info(interaction)

    let handler

    switch (interaction.type) {
      case InteractionType.PING:
        return new Response('{"type":1}')
      case InteractionType.APPLICATION_COMMAND: {
        const root_key = `${interaction.type}::${interaction.data.type}::${interaction.data.name}`

        if (!Array.isArray(interaction.data.options)) {
          handler = commands.get(root_key)
          break
        }

        const option = interaction.data.options[0]

        switch (option.type) {
          case 1: {
            handler = commands.get(`${root_key}::${option.name}`)
            break
          }
          case 2: {
            const subcommand = option.options[0]
            handler = commands.get(`${root_key}::${option.name}::${subcommand.name}`)
          }
        }

        break
      }
      case InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE: {
        const root_key = `${interaction.type}::${interaction.data.type}::${interaction.data.name}`
        console.debug(root_key, JSON.stringify(interaction, null, 4))
        throw new Error('not implemented')
      }
    }

    const result = await new Promise(res => {
      handler({
        async fetchClient() {
          if (!env.YUUKI_BOT_TOKEN) {
            throw new TypeError('bot token was not defined')
          }
          // @todo: caching
          const response = await fetch('https://discord.com/api/v10/applications/@me', {
            headers: [
              ['Authorization', `Bot ${env.YUUKI_BOT_TOKEN}`],
            ],
          })
          // @todo: rate limit
          return response.json()
        },
        interaction: {
          ...interaction,
          reply: data => res({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data }),
        },
      })
    })

    console.info(result)
    return new Response(JSON.stringify(result), {
      headers: [['Content-Type', 'application/json']],
    })
  },
}
