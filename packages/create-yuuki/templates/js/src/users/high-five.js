/** @satisfies {import('yuuki.js').YuukiUserCommand} */
const cmd = {
  name: 'High Five',
  async onExecute(c) {
    const target = c.interaction.target
    const user = c.interaction.caller

    await c.interaction.reply({ content: `<@${user.id}> high fived <@${target.id}>!` })
  },
}

export default cmd
