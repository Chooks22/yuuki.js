/** @satisfies {import('yuuki.js').YuukiMessageCommand} */
const cmd = {
  name: 'First Word',
  async onExecute(c) {
    const message = c.interaction.target
    const firstWord = message.content.split(' ')[0]

    await c.interaction.reply({ content: `The first word is: \`${firstWord}\`!` })
  },
}

export default cmd
