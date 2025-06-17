// parser.ts
import { ParsedSpec } from './types';
import Ajv from 'ajv'; // Import Ajv

import parsedSpecSchema from './schema.json'; // Adjust path as necessary

const ajv = new Ajv({ allErrors: true, useDefaults: true }); // Initialize Ajv with allErrors option
const validate = ajv.compile(parsedSpecSchema); // Compile the schema once

export function parseSpecification(specJson: string): ParsedSpec[] {
  
  const parsedJson = JSON.parse(specJson);
  const layerSpecs = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
  console.log(layerSpecs);

  const isValidTopLevel = validate(layerSpecs);
  if (!isValidTopLevel) {
    console.error('Top-level JSON schema validation errors:', validate.errors);
    return []; // Return an empty array if the top-level structure is invalid
  }

  const parsedResults: ParsedSpec[] = [];

  for (const spec of layerSpecs) {
    const parsedSingleSpec = spec;
    if (parsedSingleSpec) {
      parsedResults.push(parsedSingleSpec);
    }
  }

  return parsedResults;
}