import React from 'react';

interface RichTextProps {
  content: string;
  className?: string;
}

/** Renderiza **negrito** dentro de um trecho de texto. */
const Inline: React.FC<{ text: string }> = ({ text }) => {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {segments.map((segment, idx) =>
        segment.startsWith('**') && segment.endsWith('**') && segment.length > 4 ? (
          <strong key={idx}>{segment.slice(2, -2)}</strong>
        ) : (
          <span key={idx}>{segment}</span>
        ),
      )}
    </>
  );
};

const isTableLine = (line: string) => line.includes('|') && line.split('|').length > 2;

const splitCells = (line: string) => line.split('|').map((c) => c.trim());

/** Tabela renderizada a partir de linhas separadas por "|". */
const Table: React.FC<{ lines: string[] }> = ({ lines }) => {
  const [head, ...body] = lines.map(splitCells);
  return (
    <div className="my-1 overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted">
          <tr>
            {head.map((c, i) => (
              <th key={i} className={`px-2 py-1 font-semibold ${i === 0 || i === 1 ? 'text-left' : 'text-right'}`}>
                <Inline text={c} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-t border-border">
              {row.map((c, i) => (
                <td key={i} className={`px-2 py-1 ${i === 0 || i === 1 ? 'text-left' : 'text-right whitespace-nowrap'}`}>
                  <Inline text={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const RichText: React.FC<RichTextProps> = ({ content, className }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let buffer: string[] = [];

  const flush = (key: string) => {
    if (buffer.length === 0) return;
    if (buffer.length > 1) {
      blocks.push(<Table key={key} lines={buffer} />);
    } else {
      blocks.push(
        <div key={key}>
          <Inline text={buffer[0]} />
        </div>,
      );
    }
    buffer = [];
  };

  lines.forEach((line, idx) => {
    if (isTableLine(line)) {
      buffer.push(line);
      return;
    }
    flush(`t-${idx}`);
    blocks.push(
      <div key={`l-${idx}`} className="whitespace-pre-wrap">
        <Inline text={line} />
      </div>,
    );
  });
  flush('t-end');

  return <div className={className}>{blocks}</div>;
};
