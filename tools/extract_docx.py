# -*- coding: utf-8 -*-
"""Extract a .docx to readable Markdown, preserving document order
(headings + paragraphs + tables interleaved)."""
import sys, os
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

def iter_block_items(parent):
    """Yield Paragraph and Table objects in document order."""
    from docx.document import Document as _Doc
    if isinstance(parent, _Doc):
        parent_elm = parent.element.body
    else:
        parent_elm = parent._tc
    for child in parent_elm.iterchildren():
        if child.tag.endswith('}p'):
            yield Paragraph(child, parent)
        elif child.tag.endswith('}tbl'):
            yield Table(child, parent)

def style_to_md(style_name, text):
    s = (style_name or '').lower()
    if 'heading 1' in s or s == 'titre 1':
        return '\n# ' + text
    if 'heading 2' in s or s == 'titre 2':
        return '\n## ' + text
    if 'heading 3' in s or s == 'titre 3':
        return '\n### ' + text
    if 'heading 4' in s or s == 'titre 4':
        return '\n#### ' + text
    if 'title' in s or s == 'titre':
        return '\n# ' + text
    return text

def table_to_md(tbl):
    rows = []
    for r in tbl.rows:
        cells = [c.text.replace('\n', ' ').strip() for c in r.cells]
        rows.append('| ' + ' | '.join(cells) + ' |')
    if not rows:
        return ''
    ncol = rows[0].count('|') - 1
    sep = '| ' + ' | '.join(['---'] * ncol) + ' |'
    return rows[0] + '\n' + sep + '\n' + '\n'.join(rows[1:])

def main(path, out):
    doc = Document(path)
    lines = []
    for block in iter_block_items(doc):
        if isinstance(block, Paragraph):
            t = block.text.strip()
            if t:
                lines.append(style_to_md(block.style.name if block.style else '', t))
        elif isinstance(block, Table):
            lines.append('\n' + table_to_md(block) + '\n')
    text = '\n'.join(lines)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"OK {os.path.basename(path)} -> {out}  ({len(text)} chars, {text.count(chr(10))} lines)")

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
