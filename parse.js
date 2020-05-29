'use strict';

/**
 * @description
 * ---- Overview ----
 * Parsing an OpenAPI v2/v3 specification to find all endpoints,
 * which are then used to generate client code examples.
 *
 * Languages are specified with inline CLI arguments, uniform across
 * all endpoints, each set of client code examples in amended to the
 * endpoint sub-structure within the OpenAPI specification
 * under the 'x-code-samples' field.
 *
 * After examples are amended the specification is exported to the specified
 * file, under subsequent directories if given.
 *
 * ---- CLI arguments ----
 * @argument argv[0]: Raw specification file name (JSON or YAML)
 * @argument argv[1]: Final specification file name (JSON or YAML)
 * @argument argv[3:n]: Languages to use for client code snippets
 *
 * @default {Targets} argv[3:n]: Client code languages
 *
 * ---- CLI flags (options) ----
 * @argument argv[n:n+1]: -v (--verbose): Whether to use verbose logging statements
 *
 * @author Jack Kilrain
 */

const fs = require('fs');
const OpenAPISnippet = require('openapi-snippet');
const yaml = require('js-yaml');
const clc = require('cli-color');

let isVerbose = false;

function generateTreeLines(nest) {
	return nest > 0 ? "|" + " |".repeat(Math.max(0, nest - 1)) + "-->" : "";
}

const error = function (msg, nest = 0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgRed.white.bold("Error!") + "]", msg);
};
const warning = function (msg, nest = 0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgYellow.white.bold("Warning") + "]", msg);
};
const progress = function (msg, nest = 0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgBlue.white.bold("Info") + "]", msg);
};
const complete = function (msg, nest = 0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgGreen.white.bold("Completed") + "]", msg);
};
const usage = function (msg, nest = 0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgMagenta.white.bold("Usage") + "]", msg);
};

const validTargets = [
	'c_libcurl',
	'csharp_restsharp',
	'go_native',
	'java_okhttp',
	'java_unirest',
	'javascript_jquery',
	'javascript_xhr',
	'node_native',
	'node_request',
	'node_unirest',
	'objc_nsurlsession',
	'ocaml_cohttp',
	'php_curl',
	'php_http1',
	'php_http2',
	'python_python3',
	'python_requests',
	'ruby_native',
	'shell_curl',
	'shell_httpie',
	'shell_wget',
	'swift_nsurlsession',
];

// Default language snippet targets
let targets = [
	'php_curl',
	'javascript_xhr',
	'java_okhttp',
	'python_requests',
	'python_python3',
	'go_native',
	'shell_curl'
];

/**
 * Sends a message if argv parameter isVerbose is set
 *
 * @param {string} message Message to send
 * @param {number} nesting Message nesting depth
 * @param {function} message_method Type of message to send
 */
function messageIfVerbose(message, nesting, message_method = progress) {
	if (isVerbose)
		message_method(message, nesting);
}

/**
 * Adds specified targets to schema, returning ammended schema
 *
 * @param {any} schema
 * @returns JSON Object scheme
 */
function enrichSchema(schema) {
	for (const path in schema.paths) {
		for (const method in schema.paths[path]) {
			const generatedCode = OpenAPISnippet.getEndpointSnippets(schema, path, method, targets);
			messageIfVerbose("Checking existance of 'x-code-samples' field in " + path + " path...", progress);
			if (!schema.paths[path][method]["x-code-samples"]) {
				messageIfVerbose("Added 'x-code-samples' field.", 1, complete);
				schema.paths[path][method]["x-code-samples"] = [];
			} else {
				messageIfVerbose("'x-code-samples' field already exists, skipping.", 1, warning);
			}
			for (const snippetIdx in generatedCode.snippets) {
				const snippet = generatedCode.snippets[snippetIdx];
				messageIfVerbose("Checking existance of '" + snippet.title + "' field...", 1, progress);
				if (!schema.paths[path][method]["x-code-samples"][snippetIdx]) {
					messageIfVerbose("Added '" + snippet.title + "' field.", 2, complete);
					schema.paths[path][method]["x-code-samples"][snippetIdx] = { "lang": snippet.title, "source": snippet.content };
				} else {
					warning("Field '" + snippet.title + "' already exists in '" + path + "' path, skipping.", 2);
				}
			}

		}
	}
	return schema;
}

// Check the OpenAPI spec is given
if (process.argv.length < 3) {
	error("Please pass the OpenAPI JSON schema as argument.");
	usage("npm run add-examples <swagger/openapi specification> <output destination> {[targets]} {options}\n");
	process.exit(1);
}

// Check an output file/destination is specified
if (process.argv.length < 4) {
	error("Please specify an output file.");
	usage("npm run add-examples <swagger/openapi specification> <output destination> {[targets]} {options}\n");
	process.exit(1);
}

if (process.argv[process.argv.length - 1] === "-v" || process.argv[process.argv.length - 1] === "--verbose") {
	progress("Switching to verbose logging");
	isVerbose = true;
}

// Configure custom targets if specified
if (process.argv.length > 4) {
	progress("Validating targets...");
	if (process.argv[4] === "default")
		complete("Default specified, skipping.", 1);
	else {
		let targetsToCheck = process.argv.slice(4);
		for (const target of targetsToCheck) {
			if (!targets.includes(target)) {
				error("Target \'" + target + "\' is not valid");
				process.exit(1);
			}
		}
		targets = targetsToCheck;
		complete("All specified targets are valid", 1);
	}
} else {
	warning("No targets specified, defaulting to internally specified:" + targets.map(v => ' ' + v));
}

// Check output file is in JSON format
if (process.argv[3].indexOf('json') == -1) {
	error("Only JSON format is supported for output.");
	usage("npm run add-examples <swagger/openapi specification> <output destination> {[targets]} {options}\n");
	process.exit(1);
}

const specPath = process.argv[3];

// If specification.json exists, remove it, otherwise continue
try {
	progress("Checking if specification.json exists");
	if (fs.existsSync("./" + specPath)) {
		progress(process.argv[3] + " exists, removing...", 1);
		fs.unlinkSync("./" + specPath);
		complete(process.argv[3] + " removed", 1);
	} else {
		complete(process.argv[3] + " does not exist, continuing", 1);
	}
} catch (err) {
	error(err);
	process.exit(1);
}

// Try to interpret as YAML first, based on file extension, alternatively parsing native JSON
if (process.argv[2].indexOf('yml') !== -1 || process.argv[2].indexOf('yaml') !== -1) {
	try {
		progress("Converting YAML file...");
		let schema = yaml.safeLoad(fs.readFileSync(process.argv[2], 'utf8'));
		complete("Converted YAML file", 1);
		progress("Adding samples for " + String(targets).replace(/,/g, ", ") + "...", 1);
		schema = enrichSchema(schema);
		fs.writeFile(process.argv[3], JSON.stringify(schema), function (err) {
			if (err) throw err;
			complete("Added samples and exported to: " + process.argv[3], 2);
		});
	} catch (e) {
		error(e);
		process.exit(1);
	}
} else {
	try {
		progress("Parsing JSON file...");
		fs.readFile(process.argv[2], (err, data) => {
			if (err) throw err;
			let schema = JSON.parse(data);
			schema = enrichSchema(schema);
			complete("Parsed JSON file", 1);
			progress("Adding samples for " + String(targets).replace(/,/g, ", ") + "...", 1);
			fs.writeFile(process.argv[3], JSON.stringify(schema), function (err) {
				if (err) throw err;
				complete("Added samples and exported to: " + process.argv[3], 2);
			});
		});
	} catch (e) {
		error(e);
		process.exit(1);
	}
}


