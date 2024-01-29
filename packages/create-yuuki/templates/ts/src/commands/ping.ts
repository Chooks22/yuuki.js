import type { YuukiChatInputCommand } from 'yuuki.js'

export default {
  name: 'ping',
  description: 'Pong!',
  async onExecute(c) {
    await c.interaction.reply({ content: 'Pong!' })
  },
} satisfies YuukiChatInputCommand
