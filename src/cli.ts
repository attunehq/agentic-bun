#!/usr/bin/env bun

/**
 * CLI entrypoint.
 *
 * Usage: bun run src/cli.ts <command>
 *
 * Environment variables are loaded automatically by Bun from .env.
 */

import { run, subcommands } from "cmd-ts";
import { helloCmd } from "./cmd/hello.ts";

const app = subcommands({
	name: "REPLACE_ME",
	version: "0.1.0",
	description: "REPLACE_ME",
	cmds: {
		hello: helloCmd,
	},
});

await run(app, process.argv.slice(2));
