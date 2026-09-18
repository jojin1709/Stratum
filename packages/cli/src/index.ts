import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { devCommand, logsCommand, startCommand, statusCommand, stopCommand } from './commands/dev.js';
import { dbMigrate, dbMigrationCreate, dbPull, dbReset, dbRollback, dbStatus } from './commands/db.js';
import { functionsDeploy, functionsDev, functionsList, functionsNew } from './commands/functions.js';
import { typesGenerate } from './commands/types.js';
import { fail } from './ui.js';

const program = new Command();

program
  .name('stratum')
  .description('Stratum — Build. Store. Scale. Developed by Jojin John.')
  .version('0.1.0')
  .showHelpAfterError();

program
  .command('init [directory]')
  .description('Create a new Stratum project')
  .option('-n, --name <name>', 'project name')
  .action((directory = '.', opts) => initCommand(directory, opts));

program.command('dev').description('Start local services and print the project URLs').action(devCommand);
program.command('start').description('Start all Docker services in the background').action(startCommand);
program.command('stop').description('Stop all Docker services').action(stopCommand);
program.command('status').description('Show project, Docker and API health').action(statusCommand);

program
  .command('logs')
  .description('Tail request or function logs')
  .option('-n, --limit <count>', 'how many entries to show', '50')
  .option('-t, --type <type>', 'requests | functions', 'requests')
  .action(logsCommand);

const db = program.command('db').description('Database and migration commands');
db.command('status').description('Show migration state').action(dbStatus);
db.command('migrate').description('Apply pending migrations').option('--dry-run', 'show what would run').action(dbMigrate);
db.command('rollback').description('Roll back the most recent migration').action(dbRollback);
db.command('pull').description('Print the live schema').action(dbPull);
db.command('push').description('Alias for `db migrate`').action(() => dbMigrate({}));
db.command('reset').description('Drop the public schema and re-apply migrations').option('-y, --yes', 'skip confirmation').action(dbReset);

const migration = db.command('migration').description('Manage migration files');
migration.command('create <name>').description('Create a new migration file').action(dbMigrationCreate);

const functions = program.command('functions').description('Server function commands');
functions.command('list', { isDefault: true }).description('List discovered functions').action(functionsList);
functions.command('new <name>').description('Scaffold a new function').action(functionsNew);
functions.command('dev').description('Show local function endpoints').action(functionsDev);
functions
  .command('deploy <name>')
  .description('Bundle a function for deployment')
  .option('-t, --target <target>', 'deployment target', 'cloudflare')
  .action(functionsDeploy);

program
  .command('types')
  .description('Type generation')
  .command('generate')
  .description('Generate TypeScript types from the live schema')
  .option('-o, --output <path>', 'output file', 'stratum.generated.ts')
  .option('-s, --schema <schema>', 'schema to introspect', 'public')
  .action(typesGenerate);

program.parseAsync(process.argv).catch((e) => fail(e instanceof Error ? e.message : String(e)));
