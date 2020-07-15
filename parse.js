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
const hash = require('object-hash');

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

class PropertyError extends Error {

	constructor(property) {
		super("Non-existent property: " + property);
		this.name = "PropertyError";
		this.property = property;
	}
	
}

/**
 * Enum of message types usable with logMessage
 */
const MessageType = {
	Progress: clc.bgBlue.white.bold("Info"),
	Usage: clc.bgMagenta.white.bold("Usage"),
	Complete: clc.bgGreen.white.bold("Completed"),
	Warning: clc.bgYellow.white.bold("Warning"),
	Erroneous: clc.bgRed.white.bold("Error!"),
};

/**
 * Generate a nesting indicator with branch seperations of depth specified by nest
 *
 * @param {number} nesting
 * @returns {string}
 */
function generateTreeLines(nesting) {
	return nesting > 0 ? "|" + " |".repeat(Math.max(0, nesting - 1)) + "-->" : "";
}

/**
 * Log nested message with specified message method
 *
 * @param {string} msg
 * @param {number} nesting
 * @param {MessageType} message_method
 */
function logMessage(msg, nesting=0, message_method=MessageType.Progress) {
	console.log(generateTreeLines(nesting) + "[" + message_method + "]", msg);
}

/**
 * Sends a message if argv parameter isVerbose is set
 *
 * @param {string} msg Message to send
 * @param {number} nesting Message nesting depth
 * @param {function} message_method Type of message to send
 */
function messageIfVerbose(msg, nesting=0, message_method=MessageType.Progress) {
	if (isVerbose)
		logMessage(msg, nesting, message_method);
}


/**
 * Adds specified targets to schema, returning ammended schema
 *
 * @param {any} schema
 * @returns JSON Object scheme
 */
function enrichSchema(schema) {
	if (!schema.hasOwnProperty("paths")) {
		throw new PropertyError("paths");
	}
	for (const path in schema.paths) {
		for (const method in schema.paths[path]) {
			const generatedCode = OpenAPISnippet.getEndpointSnippets(schema, path, method, targets);
			messageIfVerbose("Checking existance of 'x-code-samples' field in " + path + " path...", 1);
			if (!schema.paths[path][method]["x-code-samples"]) {
				messageIfVerbose("Added 'x-code-samples' field.", 1, MessageType.Complete);
				schema.paths[path][method]["x-code-samples"] = [];
			} else {
				messageIfVerbose("'x-code-samples' field already exists, skipping.", 1, MessageType.Warning);
			}
			for (const snippetIdx in generatedCode.snippets) {
				const snippet = generatedCode.snippets[snippetIdx];
				messageIfVerbose("Checking existance of '" + snippet.title + "' field...", 1);
				if (!schema.paths[path][method]["x-code-samples"][snippetIdx]) {
					messageIfVerbose("Added '" + snippet.title + "' field.", 2, MessageType.Complete);
					schema.paths[path][method]["x-code-samples"][snippetIdx] = { "lang": snippet.title, "source": snippet.content };
				} else {
					logMessage("Field '" + snippet.title + "' already exists in '" + path + "' path, skipping.", 2, MessageType.Warning);
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
		logMessage("Please pass the OpenAPI JSON raw specification file name as argument.", 0, MessageType.Erroneous);
		logMessage("npm run add-examples <swagger/openapi specification> <output destination> {[targets]} {options}\n", 0, MessageType.Usage);
		process.exit(1);
	}

	// Check an output file/destination is specified
	if (process.argv.length < 4) {
		logMessage("Please specify an output file.", 0, MessageType.Erroneous);
		logMessage("npm run add-examples <swagger/openapi specification> <output destination> {[targets]} {options}\n", 0, MessageType.Usage);
		process.exit(1);
	}

	if (process.argv[process.argv.length - 1] === "-v" || process.argv[process.argv.length - 1] === "--verbose") {
		logMessage("Switching to verbose logging");
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
		logMessage("Validating targets...");
		if (process.argv[4] === "default")
			logMessage("Default specified, skipping.", 1, MessageType.Complete);
		else {
			const targetsToCheck = process.argv.slice(4, isVerbose ? process.argv.length - 1 : process.argv.length);
			for (const target of targetsToCheck) {
				if (!validTargets.includes(target)) {
					logMessage("Target '" + target + "' is not valid", 0, MessageType.Erroneous);
					process.exit(1);
				}
			}
			targets = targetsToCheck;
			logMessage("All specified targets are valid", 1, MessageType.Complete);
		}
	} else {
		logMessage("No targets specified, defaulting to internally specified:" + targets.map(v => ' ' + v), 0, MessageType.Warning);
	}
}

/**
 * Check the output file type is JSON
 *
 * @param {string} final_spec_file Final specification file name (Must be JSON)
 */
function checkOutputFileType(final_spec_file) {
	if (!final_spec_file.endsWith('json')) {
		logMessage("Only JSON format is supported for output.", 0, MessageType.Erroneous);
		logMessage("npm run add-examples <swagger/openapi specification> <output destination> {[targets]} {options}\n", 0, MessageType.Usage);
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
		logMessage("Checking if specification.json exists");
		if (fs.existsSync("./" + specPath)) {
			logMessage(final_spec_file + " exists, removing...", 1);
			fs.unlinkSync("./" + specPath);
			logMessage(final_spec_file + " removed", 1, MessageType.Complete);
		} else {
			logMessage(final_spec_file + " does not exist, continuing", 1, MessageType.Complete);
		}
	} catch (err) {
		logMessage(err, 0, MessageType.Erroneous);
		process.exit(1);
	}
}

/**
 * Adds client code samples to schema and exports to provided file
 * 
 * @param {any} schema OpenAPI Schema
 * @param {string} final_spec_file Final specification file name (Must be JSON)
 */
function addSamplesExport(schema, final_spec_file) {
	logMessage("Adding samples for " + String(targets).replace(/,/g, ", ") + "...", 1);
	schema = enrichSchema(schema);
	let filename_with_hash = final_spec_file.replace("[contenthash]", hash(schema));
	fs.writeFile(filename_with_hash, JSON.stringify(schema), function (err) {
		if (err) throw err;
		logMessage("Added samples and exported to: " + final_spec_file, 2, MessageType.Complete);
	});
}

/**
 * Process a YML/YAML raw specification and enrich with client code examples, exported to a given output file
 *
 * @param {string} raw_spec_file Raw specification file name
 * @param {string} final_spec_file Final specification file name (Must be JSON)
 */
function processYAMLSpecification(raw_spec_file, final_spec_file) {
	logMessage("Converting YAML file...");
	let schema = yaml.safeLoad(fs.readFileSync(raw_spec_file, 'utf8'));
	logMessage("Converted YAML file", 1, MessageType.Complete);
	addSamplesExport(schema, targets, final_spec_file);
}

/**
 * Process a JSON raw specification and enrich with client code examples, exported to a given output file
 *
 * @param {string} raw_spec_file Raw specification file name
 * @param {string} final_spec_file Final specification file name (Must be JSON)
 */
function processJSONSpecification(raw_spec_file, final_spec_file) {
	logMessage("Parsing JSON file...");
	fs.readFile(raw_spec_file, (err, data) => {
		if (err) throw err;
		let schema = JSON.parse(data);
		logMessage("Parsed JSON file", 1, MessageType.Complete);
		addSamplesExport(schema, final_spec_file);
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
			logMessage(e, 0, MessageType.Erroneous);
			process.exit(1);
		}
	} else {
		try {
			processJSONSpecification(raw_spec_file, final_spec_file);
		} catch (e) {
			logMessage(e, 0, MessageType.Erroneous);
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