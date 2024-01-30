import type { YuukiMessageCommand } from 'yuuki.js'

export default {
  name: 'First Word',
  async onExecute(c) {
    const message = c.interaction.target
    const firstWord = message.content.split(' ')[0]

    await c.interaction.reply({ content: `The first word is: \`${firstWord}\`!` })
  },
} satisfies YuukiMessageCommand
