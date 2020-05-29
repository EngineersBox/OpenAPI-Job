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
 * @argument argv[2:n]: Languages to use for client code snippets
 *
 * @default {Targets} argv[2:n]: Client code languages
 *
 * ---- CLI flags (options) ----
 * @argument argv[n:n+1]: -v (--verbose): Whether to use verbose logging statements
 *
 * @author Jack Kilrain
 * @author Andrzej WP
 */

const fs = require('fs');
const OpenAPISnippet = require('openapi-snippet');
const yaml = require('js-yaml');
const clc = require('cli-color');

let isVerbose = false;
const specPath = process.argv[3];

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
 * Generate a nesting indicator with branch seperations of depth specified by nest
 * 
 * @param {number} nest 
 * @returns {string}
 */
function generateTreeLines(nest) {
	return nest > 0 ? "|" + " |".repeat(Math.max(0, nest - 1)) + "-->" : "";
}

/**
 * Log a message in error format with nesting
 * 
 * @param {string} msg 
 * @param {number} nest 
 */
function error(msg, nest=0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgRed.white.bold("Error!") + "]", msg);
}

/**
 * Log a message in warning format with nesting
 *
 * @param {string} msg
 * @param {number} nest
 */
function warning(msg, nest=0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgYellow.white.bold("Warning") + "]", msg);
}

/**
 * Log a message in info format with nesting
 *
 * @param {string} msg
 * @param {number} nest
 */
function progress(msg, nest=0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgBlue.white.bold("Info") + "]", msg);
}

/**
 * Log a message in completed format with nesting
 *
 * @param {string} msg
 * @param {number} nest
 */
function complete(msg, nest=0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgGreen.white.bold("Completed") + "]", msg);
}

/**
 * Log a message in usage format with nesting
 *
 * @param {string} msg
 * @param {number} nest
 */
function usage(msg, nest=0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgMagenta.white.bold("Usage") + "]", msg);
}

/**
 * Sends a message if argv parameter isVerbose is set
 *
 * @param {string} message Message to send
 * @param {number} nesting Message nesting depth
 * @param {function} message_method Type of message to send
 */
function messageIfVerbose(message, nesting, message_method=progress) {
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
			messageIfVerbose("Checking existance of 'x-code-samples' field in " + path + " path...");
			if (!schema.paths[path][method]["x-code-samples"]) {
				messageIfVerbose("Added 'x-code-samples' field.", 1, complete);
				schema.paths[path][method]["x-code-samples"] = [];
			} else {
				messageIfVerbose("'x-code-samples' field already exists, skipping.", 1, warning);
			}
			for (const snippetIdx in generatedCode.snippets) {
				const snippet = generatedCode.snippets[snippetIdx];
				messageIfVerbose("Checking existance of '" + snippet.title + "' field...", 1);
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

/**
 * Verify the integrity of CLI passed paramters against valid values
 * 
 * - Check a raw specification file name was passed
 * - Check a final specification file name was passed
 * - Set the verbosity flag if '-v' or '--verbose' is passed
 */
function checkParameters() {
	// Check the OpenAPI spec is given
	if (process.argv.length < 3) {
		error("Please pass the OpenAPI JSON raw specification file name as argument.");
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
}

/**
 * Check whether the passed client code snippet languages are valid
 * 
 * - Set targets to default list if 'default' is passed
 * - Assert each passed target is a valid language (exiting if not)
 */
function configureTargets() {
	// Configure custom targets if specified
	if (process.argv.length > 4) {
		progress("Validating targets...");
		if (process.argv[4] === "default")
			complete("Default specified, skipping.", 1);
		else {
			const targetsToCheck = process.argv.slice(4);
			for (const target of targetsToCheck) {
				if (!validTargets.includes(target)) {
					error("Target '" + target + "' is not valid");
					process.exit(1);
				}
			}
			targets = targetsToCheck;
			complete("All specified targets are valid", 1);
		}
	} else {
		warning("No targets specified, defaulting to internally specified:" + targets.map(v => ' ' + v));
	}
}

/**
 * Check the output file type is JSON
 * 
 * @param {string} final_spec_file Final specification file name (Must be JSON)
 */
function checkOutputFileType(final_spec_file) {
	if (!final_spec_file.endsWith('json')) {
		error("Only JSON format is supported for output.");
		usage("npm run add-examples <swagger/openapi specification> <output destination> {[targets]} {options}\n");
		process.exit(1);
	}
}

/**
 * Remove any existing final specification files
 * 
 * @param {string} final_spec_file Final specification file name (Must be JSON)
 */
function removeExistingFinalSpec(final_spec_file) {
	try {
		progress("Checking if specification.json exists");
		if (fs.existsSync("./" + specPath)) {
			progress(final_spec_file + " exists, removing...", 1);
			fs.unlinkSync("./" + specPath);
			complete(final_spec_file + " removed", 1);
		} else {
			complete(final_spec_file + " does not exist, continuing", 1);
		}
	} catch (err) {
		error(err);
		process.exit(1);
	}
}

/**
 * Process a YML/YAML raw specification and enrich with client code examples, exported to a given output file
 * 
 * @param {string} raw_spec_file Raw specification file name
 * @param {string} final_spec_file Final specification file name (Must be JSON)
 */
function processYAMLSpecification(raw_spec_file, final_spec_file) {
	progress("Converting YAML file...");
	let schema = yaml.safeLoad(fs.readFileSync(raw_spec_file, 'utf8'));
	complete("Converted YAML file", 1);
	progress("Adding samples for " + String(targets).replace(/,/g, ", ") + "...", 1);
	schema = enrichSchema(schema);
	fs.writeFile(final_spec_file, JSON.stringify(schema), function (err) {
		if (err) throw err;
		complete("Added samples and exported to: " + final_spec_file, 2);
	});
}

/**
 * Process a JSON raw specification and enrich with client code examples, exported to a given output file
 * 
 * @param {string} raw_spec_file Raw specification file name
 * @param {string} final_spec_file Final specification file name (Must be JSON)
 */
function processJSONSpecification(raw_spec_file, final_spec_file) {
	progress("Parsing JSON file...");
	fs.readFile(raw_spec_file, (err, data) => {
		if (err) throw err;
		let schema = JSON.parse(data);
		complete("Parsed JSON file", 1);
		progress("Adding samples for " + String(targets).replace(/,/g, ", ") + "...", 1);
		schema = enrichSchema(schema);
		fs.writeFile(final_spec_file, JSON.stringify(schema), function (err) {
			if (err) throw err;
			complete("Added samples and exported to: " + final_spec_file, 2);
		});
	});
}

/**
 * Process the raw specification by enriching with client code samples and then write to
 * final specification file. First tries to parse a YML/YAML file and if the file type
 * does not match, then tries JSON.
 * 
 * @param {string} raw_spec_file Raw specification file name
 * @param {string} final_spec_file Final specification file name (Must be JSON)
 */
function processSpecificationToFile(raw_spec_file, final_spec_file) {
	// Try to interpret as YAML first, based on file extension, alternatively parsing native JSON
	if (raw_spec_file.endsWith('yml') || raw_spec_file.endsWith('yaml')) {
		try {
			processYAMLSpecification(raw_spec_file, final_spec_file);
		} catch (e) {
			error(e);
			process.exit(1);
		}
	} else {
		try {
			processJSONSpecification(raw_spec_file, final_spec_file);
		} catch (e) {
			error(e);
			process.exit(1);
		}
	}
}

/**
 * Call order for processing a specification
 */
function processInputs() {
	let raw_spec_file = process.argv[2];
	let final_spec_file = process.argv[3];
	checkParameters();
	configureTargets();
	checkOutputFileType(final_spec_file);
	removeExistingFinalSpec(final_spec_file);
	processSpecificationToFile(raw_spec_file, final_spec_file);
}

processInputs();