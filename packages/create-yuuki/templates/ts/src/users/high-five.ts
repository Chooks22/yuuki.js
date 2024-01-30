import type { YuukiUserCommand } from 'yuuki.js'

export default {
  name: 'High Five',
  async onExecute(c) {
    const target = c.interaction.target
    const user = c.interaction.caller

    await c.interaction.reply({ content: `<@${user.id}> high fived <@${target.id}>!` })
  },
} satisfies YuukiUserCommand
