import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface MarkdownFieldProps {
  content: string;
  className?: string;
}

export const MarkdownField: React.FC<MarkdownFieldProps> = ({ content, className }) => {
  if (!content) {
    return null;
  }

  return (
    <div className={`llm-schema-markdown ${className ?? ''}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
};
