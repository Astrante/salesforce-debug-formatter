import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Copy, Trash2, Upload, Download } from 'lucide-react';

const SalesforceDebugFormatter = () => {
    const [inputLog, setInputLog] = useState('');
    const [parsedLogs, setParsedLogs] = useState([]);
    const [expandedItems, setExpandedItems] = useState(new Set());

    const parseLogEntry = (logLine) => {
        // Parse standard Salesforce debug log format
        const logPattern = /^(\d{2}:\d{2}:\d{2}\.\d{3})\s+\((\d+)\)\|([^|]+)\|(?:\[(\d+)\]\|)?(?:([^|]+)\|)?(.*)$/;
        const match = logLine.match(logPattern);

        if (!match) {
            return {
                type: 'unparsed',
                content: logLine,
                timestamp: null
            };
        }

        const [, timestamp, executionTime, logType, lineNumber, level, content] = match;

        return {
            type: 'parsed',
            timestamp,
            executionTime,
            logType,
            lineNumber,
            level,
            content: content.trim(),
            parsedContent: parseContent(content.trim())
        };
    };

    const parseContent = (content) => {
        // Try to parse different types of content

        // Handle object-like structures
        if (content.includes(':[') || content.includes(':{')) {
            return parseObjectStructure(content);
        }

        // Handle simple key-value pairs
        if (content.includes('=') && !content.includes('(') && !content.includes('[')) {
            return parseKeyValuePairs(content);
        }

        // Handle complex nested structures
        if (content.includes('(') && content.includes(')')) {
            return parseComplexStructure(content);
        }

        return { type: 'text', value: content };
    };

    const parseObjectStructure = (content) => {
        try {
            const colonIndex = content.indexOf(':');
            if (colonIndex === -1) return { type: 'text', value: content };

            const objectName = content.substring(0, colonIndex).trim();
            const objectContent = content.substring(colonIndex + 1).trim();

            if (objectContent.startsWith('{') && objectContent.endsWith('}')) {
                const innerContent = objectContent.slice(1, -1);
                const fields = parseFields(innerContent);
                return {
                    type: 'object',
                    name: objectName,
                    fields: fields
                };
            }

            if (objectContent.startsWith('[') && objectContent.endsWith(']')) {
                const innerContent = objectContent.slice(1, -1);
                const items = parseArrayItems(innerContent);
                return {
                    type: 'array',
                    name: objectName,
                    items: items
                };
            }

            return { type: 'text', value: content };
        } catch (e) {
            return { type: 'text', value: content };
        }
    };

    const parseComplexStructure = (content) => {
        try {
            const parenIndex = content.indexOf('(');
            if (parenIndex === -1) return { type: 'text', value: content };

            const name = content.substring(0, parenIndex).trim();
            const innerContent = content.substring(parenIndex + 1);

            // Find matching closing parenthesis
            let depth = 0;
            let endIndex = -1;
            for (let i = 0; i < innerContent.length; i++) {
                if (innerContent[i] === '(') depth++;
                else if (innerContent[i] === ')') {
                    if (depth === 0) {
                        endIndex = i;
                        break;
                    }
                    depth--;
                }
            }

            if (endIndex === -1) return { type: 'text', value: content };

            const params = innerContent.substring(0, endIndex);
            const fields = parseFields(params);

            return {
                type: 'complex',
                name: name,
                fields: fields
            };
        } catch (e) {
            return { type: 'text', value: content };
        }
    };

    const parseFields = (content) => {
        const fields = [];
        let current = '';
        let depth = 0;
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < content.length; i++) {
            const char = content[i];

            if (!inQuotes && (char === '"' || char === "'")) {
                inQuotes = true;
                quoteChar = char;
                current += char;
            } else if (inQuotes && char === quoteChar) {
                inQuotes = false;
                current += char;
            } else if (!inQuotes) {
                if (char === '(' || char === '[' || char === '{') {
                    depth++;
                    current += char;
                } else if (char === ')' || char === ']' || char === '}') {
                    depth--;
                    current += char;
                } else if (char === ',' && depth === 0) {
                    if (current.trim()) {
                        fields.push(parseField(current.trim()));
                    }
                    current = '';
                    continue;
                } else {
                    current += char;
                }
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            fields.push(parseField(current.trim()));
        }

        return fields;
    };

    const parseField = (fieldContent) => {
        const equalIndex = fieldContent.indexOf('=');
        if (equalIndex === -1) {
            return { type: 'value', content: fieldContent };
        }

        const key = fieldContent.substring(0, equalIndex).trim();
        const value = fieldContent.substring(equalIndex + 1).trim();

        return {
            type: 'keyValue',
            key: key,
            value: parseContent(value)
        };
    };

    const parseArrayItems = (content) => {
        if (!content.trim()) return [];

        const items = [];
        let current = '';
        let depth = 0;
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < content.length; i++) {
            const char = content[i];

            if (!inQuotes && (char === '"' || char === "'")) {
                inQuotes = true;
                quoteChar = char;
                current += char;
            } else if (inQuotes && char === quoteChar) {
                inQuotes = false;
                current += char;
            } else if (!inQuotes) {
                if (char === '(' || char === '[' || char === '{') {
                    depth++;
                    current += char;
                } else if (char === ')' || char === ']' || char === '}') {
                    depth--;
                    current += char;
                } else if (char === ',' && depth === 0) {
                    if (current.trim()) {
                        items.push(parseContent(current.trim()));
                    }
                    current = '';
                    continue;
                } else {
                    current += char;
                }
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            items.push(parseContent(current.trim()));
        }

        return items;
    };

    const parseKeyValuePairs = (content) => {
        const pairs = content.split(',').map(pair => {
            const equalIndex = pair.indexOf('=');
            if (equalIndex === -1) return { type: 'value', content: pair.trim() };

            const key = pair.substring(0, equalIndex).trim();
            const value = pair.substring(equalIndex + 1).trim();

            return {
                type: 'keyValue',
                key: key,
                value: { type: 'text', value: value }
            };
        });

        return {
            type: 'keyValueList',
            pairs: pairs
        };
    };

    const formatLog = () => {
        if (!inputLog.trim()) return;

        const lines = inputLog.split('\n').filter(line => line.trim());
        const parsed = lines.map((line, index) => ({
            id: index,
            original: line,
            parsed: parseLogEntry(line)
        }));

        setParsedLogs(parsed);
        setExpandedItems(new Set());
    };

    const toggleExpanded = (id) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedItems(newExpanded);
    };

    const clearLogs = () => {
        setInputLog('');
        setParsedLogs([]);
        setExpandedItems(new Set());
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const renderValue = (value, parentId, depth = 0) => {
        if (!value) return null;

        const indent = depth * 20;

        switch (value.type) {
            case 'text':
                return (
                    <span className="text-gray-800 font-mono text-sm">{value.value}</span>
                );

            case 'object':
                const objectId = `${parentId}-obj-${value.name}`;
                const isObjectExpanded = expandedItems.has(objectId);

                return (
                    <div style={{ marginLeft: `${indent}px` }}>
                        <div
                            className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded"
                            onClick={() => toggleExpanded(objectId)}
                        >
                            {isObjectExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span className="font-semibold text-blue-600 ml-1">{value.name}</span>
                            <span className="text-gray-500 ml-2">({value.fields.length} fields)</span>
                        </div>
                        {isObjectExpanded && (
                            <div className="ml-4 border-l-2 border-gray-200 pl-3">
                                {value.fields.map((field, index) => (
                                    <div key={index} className="py-1">
                                        {renderField(field, `${objectId}-field-${index}`, depth + 1)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 'complex':
                const complexId = `${parentId}-complex-${value.name}`;
                const isComplexExpanded = expandedItems.has(complexId);

                return (
                    <div style={{ marginLeft: `${indent}px` }}>
                        <div
                            className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded"
                            onClick={() => toggleExpanded(complexId)}
                        >
                            {isComplexExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span className="font-semibold text-purple-600 ml-1">{value.name}</span>
                            <span className="text-gray-500 ml-2">({value.fields.length} fields)</span>
                        </div>
                        {isComplexExpanded && (
                            <div className="ml-4 border-l-2 border-gray-200 pl-3">
                                {value.fields.map((field, index) => (
                                    <div key={index} className="py-1">
                                        {renderField(field, `${complexId}-field-${index}`, depth + 1)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 'array':
                const arrayId = `${parentId}-array-${value.name}`;
                const isArrayExpanded = expandedItems.has(arrayId);

                return (
                    <div style={{ marginLeft: `${indent}px` }}>
                        <div
                            className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded"
                            onClick={() => toggleExpanded(arrayId)}
                        >
                            {isArrayExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span className="font-semibold text-green-600 ml-1">{value.name}</span>
                            <span className="text-gray-500 ml-2">[{value.items.length} items]</span>
                        </div>
                        {isArrayExpanded && (
                            <div className="ml-4 border-l-2 border-gray-200 pl-3">
                                {value.items.map((item, index) => (
                                    <div key={index} className="py-1">
                                        <span className="text-gray-400 mr-2">[{index}]</span>
                                        {renderValue(item, `${arrayId}-item-${index}`, depth + 1)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 'keyValueList':
                const kvListId = `${parentId}-kvlist`;
                const isKvListExpanded = expandedItems.has(kvListId);

                return (
                    <div style={{ marginLeft: `${indent}px` }}>
                        <div
                            className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded"
                            onClick={() => toggleExpanded(kvListId)}
                        >
                            {isKvListExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span className="font-semibold text-orange-600 ml-1">Key-Value Pairs</span>
                            <span className="text-gray-500 ml-2">({value.pairs.length} pairs)</span>
                        </div>
                        {isKvListExpanded && (
                            <div className="ml-4 border-l-2 border-gray-200 pl-3">
                                {value.pairs.map((pair, index) => (
                                    <div key={index} className="py-1">
                                        {renderField(pair, `${kvListId}-pair-${index}`, depth + 1)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            default:
                return <span className="text-gray-800 font-mono text-sm">{JSON.stringify(value)}</span>;
        }
    };

    const renderField = (field, parentId, depth = 0) => {
        if (field.type === 'keyValue') {
            return (
                <div className="flex items-start">
                    <span className="font-medium text-indigo-600 mr-2 min-w-0">{field.key}:</span>
                    <div className="flex-1">
                        {renderValue(field.value, `${parentId}-value`, depth)}
                    </div>
                </div>
            );
        } else if (field.type === 'value') {
            return (
                <div className="text-gray-700 font-mono text-sm">
                    {field.content}
                </div>
            );
        }

        return null;
    };

    const renderLogEntry = (logEntry) => {
        const { parsed } = logEntry;

        if (parsed.type === 'unparsed') {
            return (
                <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                    <div className="font-mono text-sm text-gray-700">{parsed.content}</div>
                </div>
            );
        }

        const contentId = `log-${logEntry.id}-content`;
        const isContentExpanded = expandedItems.has(contentId);

        return (
            <div className="bg-white border rounded-lg shadow-sm mb-4 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <span className="font-mono text-sm text-gray-600">{parsed.timestamp}</span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                {parsed.logType}
              </span>
                            {parsed.level && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                  {parsed.level}
                </span>
                            )}
                            {parsed.lineNumber && (
                                <span className="text-sm text-gray-500">Line {parsed.lineNumber}</span>
                            )}
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => copyToClipboard(logEntry.original)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Copy original log"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4">
                    <div
                        className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
                        onClick={() => toggleExpanded(contentId)}
                    >
                        {isContentExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span className="font-semibold text-gray-700 ml-2">Content</span>
                    </div>

                    {isContentExpanded && (
                        <div className="mt-3 ml-4">
                            {renderValue(parsed.parsedContent, contentId)}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-6xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Salesforce Debug Log Formatter</h1>
                    <p className="text-gray-600 mb-6">
                        Paste your Salesforce debug logs below to format them with expandable sections and better readability.
                    </p>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Debug Log Input
                        </label>
                        <textarea
                            value={inputLog}
                            onChange={(e) => setInputLog(e.target.value)}
                            className="w-full h-40 p-3 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                            placeholder="Paste your Salesforce debug logs here..."
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={formatLog}
                            disabled={!inputLog.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            Format Log
                        </button>
                        <button
                            onClick={clearLogs}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2"
                        >
                            <Trash2 size={16} />
                            Clear
                        </button>
                    </div>
                </div>

                {parsedLogs.length > 0 && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">
                                Formatted Logs ({parsedLogs.length} entries)
                            </h2>
                            <button
                                onClick={() => setExpandedItems(new Set())}
                                className="text-sm text-blue-600 hover:text-blue-800"
                            >
                                Collapse All
                            </button>
                        </div>

                        <div className="space-y-4">
                            {parsedLogs.map((logEntry) => (
                                <div key={logEntry.id}>
                                    {renderLogEntry(logEntry)}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesforceDebugFormatter;