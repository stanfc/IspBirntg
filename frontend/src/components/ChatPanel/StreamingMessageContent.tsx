import React from 'react';
import { useTypewriter } from '../../hooks/useTypewriter';

interface Props {
  content: string;
}

const StreamingMessageContent: React.FC<Props> = ({ content }) => {
  const displayedContent = useTypewriter(content, 10);

  // Render inside a simple div with pre-wrap to respect whitespace and newlines
  return (
    <div style={{ whiteSpace: 'pre-wrap' }}>
      {displayedContent}
    </div>
  );
};

export default StreamingMessageContent;
