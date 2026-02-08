/**
 * Example command. Replace this with your own commands.
 *
 * Commands should be thin: define args and call library code.
 * Business logic belongs in src/clients/, src/lib/, etc.
 */

import chalk from "chalk";
import { command, option, optional, string } from "cmd-ts";
import { createLogger } from "../logger.ts";

const log = createLogger("hello");

export const helloCmd = command({
	name: "hello",
	description: "A sample command to verify things work",
	args: {
		name: option({
			type: optional(string),
			long: "name",
			short: "n",
			description: "Name to greet",
		}),
	},
	handler: async ({ name }) => {
		const who = name ?? "world";
		log.info({ name: who }, "Greeting user");
		console.log(`Hello, ${chalk.bold(who)}!`);
	},
});
