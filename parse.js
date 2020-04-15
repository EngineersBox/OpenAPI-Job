'use strict';

const fs = require('fs');
const OpenAPISnippet = require('openapi-snippet');
const yaml = require('js-yaml');
const clc = require('cli-color');

let isVerbose = false;

function generateTreeLines(nest) {
	return nest > 0 ? "|" + " |".repeat(Math.max(0, nest - 1)) + "-->" : "";
}

const error = function (msg, nest=0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgRed.white.bold("Error!") + "]", msg);
};
const warning = function (msg, nest=0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgYellow.white.bold("Warning") + "]", msg);
};
const progress = function (msg, nest=0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgBlue.white.bold("Info") + "]", msg);
};
const complete = function (msg, nest=0) {
	console.log(generateTreeLines(nest) + "[" + clc.bgGreen.white.bold("Completed") + "]", msg);
};
const usage = function (msg, nest=0) {
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
 * Adds specified targets to schema, returning ammended schema
 *
 * @param {any} schema 
 * @returns JSON Object scheme
 */
function enrichSchema(schema) {
	for (var path in schema.paths) {
		for (var method in schema.paths[path]) {
			var generatedCode = OpenAPISnippet.getEndpointSnippets(schema, path, method, targets);
			if (isVerbose)
				progress("Checking existance of 'x-code-samples' field in " + path + " path...");
			if (!schema.paths[path][method]["x-code-samples"]) {
				if (isVerbose)
					complete("Added 'x-code-samples' field.", 1);
				schema.paths[path][method]["x-code-samples"] = [];
			} else {
				if (isVerbose)
					warning("'x-code-samples' field already exists, skipping.", 1);
			}
			for (var snippetIdx in generatedCode.snippets) {
				var snippet = generatedCode.snippets[snippetIdx];
				if (isVerbose)
					progress("Checking existance of '" + snippet.title + "' field...", 1);
				if (!schema.paths[path][method]["x-code-samples"][snippetIdx]) {
					if (isVerbose)
						complete("Added '" + snippet.title + "' field.", 2);
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

if (process.argv[process.argv.length - 1] === "-v" || process.argv[process.argv.length - 1] === "-verbose") {
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
	warning("No targets specified, defaulting to internally specified:" + targets.map(v => ' '+ v));
}

// Check output file is in JSON format
if (process.argv[3].indexOf('json') == -1) {
	error("Only JSON format is supported for output.");
	usage("npm run add-examples <swagger/openapi specification> <output destination> {[targets]} {options}\n");
	process.exit(1);
}

const specPath = "./specification.json";

// If specification.json exists, remove it, otherwise continue
try {
	progress("Checking if specification.json exists");
	if (fs.existsSync(specPath)) {
		progress("specification.json exists, removing...", 1);
		fs.unlinkSync(specPath);
		complete("specification.json removed", 1);
	} else {
		complete("specification.json does not exist, continuing", 1);
	}
} catch(err) {
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


