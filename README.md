# OpenAPI-Job
OpenAPI specification retrieval, verification and push.

---
## Valid language targets
Valid languages to specify that client code examples are generated for, are:

    c_libcurl
    csharp_restsharp
    go_native
    java_okhttp
    java_unirest
    javascript_jquery
    javascript_xhr
    node_native
    node_request
    node_unirest
    objc_nsurlsession
    ocaml_cohttp
    php_curl
    php_http1
    php_http2
    python_python3
    python_requests
    ruby_native
    shell_curl
    shell_httpie
    shell_wget
    swift_nsurlsession
    default

If `default` is specified as the language then the following list will be used:

    php_curl
    javascript_xhr
    java_okhttp
    python_requests
    python_python3
    go_native
    shell_curl
---
## Environment Variables

| Variable             | Value                                                                                                                                    |
|----------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| RAW_SPEC_FILE_NAME   | JSON or YAML file to store the raw specification data from SPECURL e.g: "raw-spec.json"                                                  |
| FINAL_SPEC_FILE_NAME | JSON file e.g: "specification.json"                                                                                                      |
| CODE_TARGETS         | A set of space-seperated values from the valid targets e.g: "go_native javascript_xhr python_python3 shell_curl"                         |
| SPECURL              | URL to retrieve the raw specification from e.g: [http://petstore.swagger.io/v2/swagger.json](http://petstore.swagger.io/v2/swagger.json) |

---
## Command Formatting
Basic command format:

```bash
<Environment Variables> <Command> <Parameters>
```

Below are all of the commands listed out with formatting:

| Command           | npm form                                                                                                          | Bash form                                                                                                                                                                                     |
|-------------------|-------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| add-examples      | ``` FINAL_SPEC_FILE_NAME="..." RAW_SPEC_FILE_NAME="..." CODE_TARGETS="..." npm run add-examples ```               | ``` FINALSPEC_FILE_NAME="..." RAW_SPEC_FILE_NAME="..." CODE_TARGETS="..." rm -rf $FINAL_SPEC_FILE_NAME && node parse.js $RAW_SPEC_FILE_NAME $FINAL_SPEC_FILE_NAME $CODE_TARGETS -v ```        |
| verify-raw-spec   | ``` RAW_SPEC_FILE_NAME="..." npm run verify-raw-spec ```                                                          | ``` RAW_SPEC_FILE_NAME="..." swagger-cli validate $RAW_SPEC_FILE_NAME ```                                                                                                                     |
| verify-final-spec | ``` FINAL_SPEC_FILE_NAME="..." npm run verify-final-spec ```                                                      | ``` FINAL_SPEC_FILE_NAME="..."swagger-cli validate $FINAL_SPEC_FILE_NAME ```                                                                                                                  |
| get-spec          | ``` RAW_SPEC_FILE_NAME="..." SPECURL="..." npm run get-spec ```                                                   | ``` RAW_SPEC_FILE_NAME="..." rm -rf $RAW_SPEC_FILE_NAME && curl $SPECURL > $RAW_SPEC_FILE_NAME ```                                                                                            |
| remove-specs      | ``` FINAL_SPEC_FILE_NAME="..." RAW_SPEC_FILE_NAME="..." npm run remove-specs ```                                  | ``` FINAL_SPEC_FILE_NAME="..." RAW_SPEC_FILE_NAME="..." rm -rf $RAW_SPEC_FILE_NAME && rm -rf $FINAL_SPEC_FILE_NAME ```                                                                        |
| process-spec      | ``` FINAL_SPEC_FILE_NAME="..." RAW_SPEC_FILE_NAME="..." CODE_TARGETS="..." SPECURL="..." npm run process-spec ``` | ``` FINAL_SPEC_FILE_NAME="..." RAW_SPEC_FILE_NAME="..." CODE_TARGETS="..." SPECURL="..." npm run get-spec && npm run verify-raw-spec && npm run add-examples && npm run verify-final-spec ``` |

## Example usage

```bash
RAW_SPEC_FILE_NAME="raw-spec.json"
FINAL_SPEC_FILE_NAME="specification"
CODE_TARGETS="default"
SPECURL="https://raw.githubusercontent.com/networknt/model-config/master/rest/openapi/petstore/1.0.0/openapi.json"
npm run process-spec
```

---
## Testing endpoints

Below are endpoints for different forms of OpenAPI and Swagger specifications to test against.
| Specification Type | Endpoint                                                                                                                                                                                                             |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Swagger v2         | [http://petstore.swagger.io/v2/swagger.json](http://petstore.swagger.io/v2/swagger.json)                                                                                                                             |
| OpenAPI v3         | [https://raw.githubusercontent.com/networknt/model-config/master/rest/openapi/petstore/1.0.0/openapi.json](https://raw.githubusercontent.com/networknt/model-config/master/rest/openapi/petstore/1.0.0/openapi.json) |