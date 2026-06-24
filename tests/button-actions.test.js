'use strict';

const fs = require('fs');
const path = require('path');

const rendererDir = path.join(__dirname, '..', 'renderer');

function readRendererFiles() {
  const pageDir = path.join(rendererDir, 'pages');
  const files = [
    path.join(rendererDir, 'index.html'),
    path.join(rendererDir, 'app.js'),
    ...fs.readdirSync(pageDir)
      .filter(file => file.endsWith('.js'))
      .map(file => path.join(pageDir, file)),
  ];

  return files.map(filePath => ({
    filePath,
    relativePath: path.relative(path.join(__dirname, '..'), filePath),
    source: fs.readFileSync(filePath, 'utf8'),
  }));
}

function lineNumberFor(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function getAttr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match ? match[1] : '';
}

function getButtonText(tag) {
  return tag
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasRegisteredClickHandler(id, source) {
  const escapedId = escapeRegExp(id);
  const directEl = new RegExp(`\\bel\\(\\s*['"]${escapedId}['"]\\s*\\)\\s*\\.\\s*addEventListener\\(\\s*['"]click['"]`);
  const directDocument = new RegExp(`document\\.getElementById\\(\\s*['"]${escapedId}['"]\\s*\\)\\s*\\.\\s*addEventListener\\(\\s*['"]click['"]`);
  const optionalDocument = new RegExp(`document\\.getElementById\\(\\s*['"]${escapedId}['"]\\s*\\)[\\s\\S]{0,140}?\\.addEventListener\\(\\s*['"]click['"]`);
  const directElOnclick = new RegExp(`\\bel\\(\\s*['"]${escapedId}['"]\\s*\\)\\s*\\.\\s*onclick\\s*=`);
  const directDocumentOnclick = new RegExp(`document\\.getElementById\\(\\s*['"]${escapedId}['"]\\s*\\)\\s*\\.\\s*onclick\\s*=`);
  const assignedVariable = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:document\\.)?getElementById\\(\\s*['"]${escapedId}['"]\\s*\\)[\\s\\S]{0,1200}?\\1\\.addEventListener\\(\\s*['"]click['"]`);

  return directEl.test(source)
    || directDocument.test(source)
    || optionalDocument.test(source)
    || directElOnclick.test(source)
    || directDocumentOnclick.test(source)
    || assignedVariable.test(source);
}

function isKnownNestedClickableButton(button) {
  const text = getButtonText(button.tag);
  return button.relativePath.endsWith(path.join('renderer', 'pages', 'attendance.js'))
    && ['Check In', 'Add'].includes(text);
}

describe('Renderer button action wiring', () => {
  test('every rendered button has a click action, submit behavior, or registered click listener', () => {
    const files = readRendererFiles();
    const allSource = files.map(file => file.source).join('\n');
    const buttons = [];

    for (const file of files) {
      const matches = file.source.matchAll(/<button\b[\s\S]*?<\/button>/gi);
      for (const match of matches) {
        buttons.push({
          relativePath: file.relativePath,
          line: lineNumberFor(file.source, match.index),
          tag: match[0],
        });
      }
    }

    const unwired = buttons.filter(button => {
      const tag = button.tag;
      const id = getAttr(tag, 'id');
      const type = getAttr(tag, 'type').toLowerCase();

      if (/\bonclick\s*=/i.test(tag)) return false;
      if (type === 'submit') return false;
      if (id && hasRegisteredClickHandler(id, allSource)) return false;
      if (isKnownNestedClickableButton(button)) return false;

      return true;
    });

    expect(unwired).toEqual([]);
  });
});
