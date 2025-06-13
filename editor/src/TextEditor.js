import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import './TextEditor.css';
const TextEditor = ({ onApply }) => {
    const [inputSpec, setInputSpec] = useState('');
    const handleInputChange = (event) => {
        setInputSpec(event.target.value);
    };
    const handleApplyClick = () => {
        onApply(inputSpec);
    };
    return (_jsxs("div", { className: "text-editor", children: [_jsx("textarea", { placeholder: "Enter rendering specification...", onChange: handleInputChange, value: inputSpec }), _jsx("button", { onClick: handleApplyClick, className: "apply-button", children: "Apply" })] }));
};
export default TextEditor;
