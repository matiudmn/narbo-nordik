import { useState } from 'react';

interface Props {
  text: string;
  maxLines?: 1 | 2 | 3;
  className?: string;
}

export default function ExpandableText({ text, maxLines = 2, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false);

  const clampClass = maxLines === 1 ? 'line-clamp-1' : maxLines === 3 ? 'line-clamp-3' : 'line-clamp-2';

  return (
    <div className={className}>
      <p className={expanded ? '' : clampClass}>{text}</p>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-primary text-[10px] font-medium mt-0.5 hover:underline"
      >
        {expanded ? 'Moins' : 'Lire plus'}
      </button>
    </div>
  );
}
