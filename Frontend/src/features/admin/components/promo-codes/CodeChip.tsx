import { useState } from 'react';
import { Clipboard, ClipboardCheck } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';

interface CodeChipProps {
  code: string;
}

export function CodeChip({ code }: CodeChipProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="rounded-lg bg-gray-100 px-2 py-1 font-mono text-xs font-bold tracking-widest text-navy-800">
        {code}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-lg transition-all duration-150',
          copied
            ? 'bg-success-50 text-success-500'
            : 'text-gray-500 hover:bg-cyan-50 hover:text-cyan-500',
        )}
      >
        {copied ? <ClipboardCheck size={13} /> : <Clipboard size={13} />}
      </button>
    </div>
  );
}
