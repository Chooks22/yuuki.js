/** @satisfies {import('yuuki.js').YuukiChatInputCommand} */
const cmd = {
  name: 'ping',
  description: 'Pong!',
  async onExecute(c) {
    await c.interaction.reply({ content: 'Pong!' })
  },
}

export default cmd
