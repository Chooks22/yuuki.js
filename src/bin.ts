#! /usr/bin/env -S node --experimental-vm-modules
import { program } from 'commander'
import { config } from 'dotenv'
import { description, name, version } from '../package.json'

program.name(name)
  .description(description)
  .version(version, '-v, --version')

program.command('dev')
  .description('start a dev server')
  .action(() => {
    void import('./dev.js').then(mod => mod.default())
  })

if (process.argv.length > 2) {
  config({ path: '.env.local' })
  config()
  program.parse()
} else {
  program.help()
}
