// src/components/TextEditor.tsx
import React, { useState, useEffect } from 'react';
import './TextEditor.css';
import { JsonEditor } from 'json-edit-react';
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import schema from '../schema.json'
import vegaLiteSchema from '../vega-lite-v5.json'

// Put these outside React components:
const ajv = new Ajv({
  allErrors: true,
  useDefaults: true,
  strict: false,         // suppress strict mode warnings
  allowUnionTypes: true, // allow JSON-Schema union types without warning
});
addFormats(ajv);
ajv.addFormat('color-hex', {
  type: 'string',
  validate: (data: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(data)
});
ajv.addSchema(vegaLiteSchema, 'https://vega.github.io/schema/vega-lite/v5.json');
const validate = ajv.compile(schema)

interface TextEditorProps {
  onApply: (spec: string) => void;
}

function displayError(opts: { title: string; description: string; status: 'error'|'info' }) {
  // e.g. React-Toastify: toast[opts.status](opts.description, { toastId: opts.title })
  alert(`${opts.title}\n\n${opts.description}`);
}

const TextEditor: React.FC<TextEditorProps> = ({ onApply }) => {
  // 1. state to hold the JSON you’ll fetch
  const [jsonData, setJsonData] = useState<any>(null);

  // 2. load it once on mount
  useEffect(() => {
    fetch('/data/Example1.json')             // public/data/jsondata.json
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(data => setJsonData(data))
      .catch(err => {
        console.error('Failed to load JSON:', err);
      });
  }, []);

  // 3. wait until it’s loaded
  if (jsonData === null) {
    return <div>Loading editor…</div>;
  }

  const handleApplyClick = () => {
    console.log('Edited JSON:', setJsonData);
    onApply(JSON.stringify(jsonData, null, 2));
  };

  return (
    <div className="text-editor">
      <JsonEditor
        data={ jsonData }
        setData={setJsonData}
        onUpdate={ ({ newData }) => {
          const valid = validate(newData)
          if (!valid) {
            console.log('Errors', validate.errors)
            const errorMessage = validate.errors
              ?.map((error) => `${error.instancePath}${error.instancePath ? ': '
                : ''}${error.message}`)
              .join('\n')
            // Send detailed error message to an external UI element,
            // such as a "Toast" notification
            displayError({
              title: 'Not compliant with JSON Schema',
              description: errorMessage,
              status: 'error',
            })
            // This string returned to and displayed in json-edit-react UI
            return 'JSON Schema error'
          }
        }}
      />

      <button onClick={handleApplyClick} className="apply-button">
        Apply
      </button>
    </div>
  );
};

export default TextEditor;