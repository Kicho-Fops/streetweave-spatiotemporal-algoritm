import React, { useState } from 'react';

interface TextEditorProps {
  onApply: (spec: string) => void;
}

const TextEditor: React.FC<TextEditorProps> = ({ onApply }) => {
  const [inputSpec, setInputSpec] = useState<string>('');

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputSpec(event.target.value);
  };

  const handleApplyClick = () => {
    onApply(inputSpec); // Pass the current input spec to the parent component
  };

  return (
    <div className="text-editor">
      <textarea 
        placeholder="Enter rendering specification..."
        onChange={handleInputChange}
        value={inputSpec}
      />
      <button onClick={handleApplyClick} className="apply-button">Apply</button>
    </div>
  );
};

export default TextEditor;

//Last works