export {}
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BOT_TOKEN: string
      DEV_GUILD_ID: string
    }
  }
}
