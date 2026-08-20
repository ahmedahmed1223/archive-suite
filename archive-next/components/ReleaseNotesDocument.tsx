import type { ReactNode } from "react";

type ReleaseNotesDocumentProps = {
  markdown: string;
};

function flushParagraph(lines: string[], key: number): ReactNode | null {
  return lines.length === 0 ? null : <p key={key}>{lines.join(" ")}</p>;
}

export default function ReleaseNotesDocument({ markdown }: ReleaseNotesDocumentProps) {
  const blocks: ReactNode[] = [];
  const lines = markdown.split(/\r?\n/);
  let paragraph: string[] = [];
  let list: string[] = [];
  let key = 0;

  const flush = () => {
    const paragraphBlock = flushParagraph(paragraph, key++);
    if (paragraphBlock) blocks.push(paragraphBlock);
    paragraph = [];
    if (list.length > 0) {
      blocks.push(<ul className="release-notes-list" key={key++}>{list.map((item) => <li key={item}>{item}</li>)}</ul>);
      list = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      flush();
      blocks.push(<h1 key={key++}>{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push(<h2 key={key++}>{line.slice(3)}</h2>);
    } else if (line.startsWith("- ")) {
      const paragraphBlock = flushParagraph(paragraph, key++);
      if (paragraphBlock) blocks.push(paragraphBlock);
      paragraph = [];
      list.push(line.slice(2));
    } else if (line.trim() === "") {
      flush();
    } else {
      paragraph.push(line);
    }
  }
  flush();

  return <article className="release-notes-document">{blocks}</article>;
}
