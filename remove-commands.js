const { Client } = require("discord-slash-commands-client");
const { clientId, guildId, token } = require('./config.json');

const client = new Client(
    token,
    clientId,
  );

  // list all your existing commands.
//   client.getCommands().then(console.log).catch(console.error);

  // will create a new command and log its data. If a command with this name already exist will that be overwritten.
//   client
//     .createCommand({
//       name: "unique command name",
//       description: "description for this unique command",
//     })
//     .then(console.log)
//     .catch(console.error);

//   // will edit the details of a command.
//   client
//     .editCommand(
//       { name: "new command name", description: "new command description" },
//       "id of the command you wish to edit"
//     )
//     .then(console.log)
//     .catch(console.error);

//   // will delete a command
  client
    .deleteCommand("1024886389503950859")
    .then(console.log)
    .catch(console.error);