#!/usr/bin/env node
// Runs a Blender Python script headless. Usage:
//   node scene/blender.mjs [--blend file.blend] script.py [--force] [-- args for the script]
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PATHS = [
	"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe",
	"/Applications/Blender.app/Contents/MacOS/Blender",
];
const BLEND = "scene/poolrooms.blend";

/**
 * @param {Record<string, string | undefined>} env
 * @param {(path: string) => boolean} exists
 * @returns {string}
 */
export function resolveBlender(env = process.env, exists = existsSync) {
	if (env.BLENDER) {
		if (!exists(env.BLENDER)) {
			throw new Error(`BLENDER is set to "${env.BLENDER}", but no file exists there.`);
		}
		return env.BLENDER;
	}
	return DEFAULT_PATHS.find((path) => exists(path)) ?? "blender";
}

/**
 * Refuse to regenerate over a .blend that may hold hand edits.
 * @param {string} target
 * @param {boolean} force
 * @param {(path: string) => boolean} exists
 * @returns {string | null}
 */
export function overwriteError(target, force, exists = existsSync) {
	if (force || !exists(target)) return null;
	return `${target} already exists and may contain hand edits. Re-run with --force to regenerate it.`;
}

/**
 * @param {string[]} argv
 * @returns {{ blend: string | undefined, script: string | undefined, force: boolean, passthrough: string[] }}
 */
export function parseArgs(argv) {
	const sep = argv.indexOf("--");
	const own = sep === -1 ? argv : argv.slice(0, sep);
	const passthrough = sep === -1 ? [] : argv.slice(sep + 1);
	const blendAt = own.indexOf("--blend");
	const blend = blendAt === -1 ? undefined : own[blendAt + 1];
	const rest = own.filter(
		(arg, i) => arg !== "--force" && (blendAt === -1 || (i !== blendAt && i !== blendAt + 1)),
	);
	return { blend, script: rest[0], force: own.includes("--force"), passthrough };
}

function main() {
	const { blend, script, force, passthrough } = parseArgs(process.argv.slice(2));
	if (!script) {
		console.error(
			"usage: node scene/blender.mjs [--blend file.blend] script.py [--force] [-- args]",
		);
		process.exit(2);
	}
	if (script.endsWith("generate.py")) {
		const error = overwriteError(BLEND, force);
		if (error) {
			console.error(error);
			process.exit(1);
		}
	}
	if (blend && !existsSync(blend)) {
		console.error(`${blend} not found. Run "npm run scene:gen" first.`);
		process.exit(1);
	}
	let blender;
	try {
		blender = resolveBlender();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
	const args = [
		"--background",
		...(blend ? [blend] : ["--factory-startup"]),
		"--python-exit-code",
		"1",
		"--python",
		script,
		"--",
		...passthrough,
	];
	const result = spawnSync(blender, args, { stdio: "inherit" });
	if (result.error) {
		console.error(
			`Could not start Blender at "${blender}": ${result.error.message}. Set BLENDER to your blender executable.`,
		);
		process.exit(1);
	}
	process.exit(result.status ?? 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
