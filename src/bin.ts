#! /usr/bin/env -S node --experimental-vm-modules
import { program } from 'commander'
import { description, name, version } from '../package.json'

program.name(name)
  .description(description)
  .version(version, '-v, --version')

if (process.argv.length > 2) {
  program.parse()
} else {
  program.help()
}
