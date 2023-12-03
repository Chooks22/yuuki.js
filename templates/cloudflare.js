import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions'
'use imports'

const commands = new Map()

// @todo: inline commands
function set_command(type, command) {
  if (typeof command.onExecute === 'function') {
    commands.set(`${InteractionType.APPLICATION_COMMAND}::${type}::${command.name}`, command.onExecute)

    if (Array.isArray(command.options)) {
      for (const option of command.options) {
        if (typeof option.autocomplete === 'function') {
          commands.set(
            `${InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE}::${type}::${command.name}::${option.name}`,
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
          commands.set(`${InteractionType.APPLICATION_COMMAND}::${type}::${command.name}::${option.name}`, option.onExecute)
          if (Array.isArray(option.options)) {
            for (const suboption of option.options) {
              if (typeof suboption.autocomplete === 'function') {
                command.set(`${InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE}::${type}::${command.name}::${option.name}::${suboption.name}`, suboption.autocomplete)
              }
            }
          }
          break
        }
        case 2: {
          for (const subcommand of option.options) {
            commands.set(`${InteractionType.APPLICATION_COMMAND}::${type}::${command.name}::${option.name}::${subcommand.name}`, subcommand.onExecute)
            if (Array.isArray(subcommand.options)) {
              for (const suboption of subcommand.options) {
                if (typeof suboption.autocomplete === 'function') {
                  command.set(`${InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE}::${type}::${command.name}::${option.name}::${subcommand.name}::${suboption.name}`, suboption.autocomplete)
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
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response(null, { status: 404 })
    }

    const signature = request.headers.get('X-Signature-Ed25519')
    const timestamp = request.headers.get('X-Signature-Timestamp')

    const isValidRequest = verifyKey(
      await request.clone().arrayBuffer(),
      signature,
      timestamp,
      'use key',
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
