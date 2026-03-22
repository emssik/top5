#!/usr/bin/env node

import { Command } from 'commander'
import { register as registerHealth } from './commands/health.js'
import { register as registerProjects } from './commands/projects.js'
import { register as registerTasks } from './commands/tasks.js'
import { register as registerQuickTasks } from './commands/quick-tasks.js'
import { register as registerConfig } from './commands/config.js'
import { register as registerNotes } from './commands/notes.js'
import { register as registerFocus } from './commands/focus.js'
import { register as registerToday } from './commands/today.js'

const program = new Command()

program
  .name('top5')
  .description('CLI for top5 task manager')
  .version('0.1.0')
  .option('--api-key <key>', 'API key for authentication')
  .option('--port <port>', 'API port')
  .option('--json', 'Output as JSON')

registerHealth(program)
registerProjects(program)
registerTasks(program)
registerQuickTasks(program)
registerConfig(program)
registerNotes(program)
registerFocus(program)
registerToday(program)

program.parse()
