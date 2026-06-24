const { AppError } = require('../domain/errors');

function pdfSafeText(value) {
  return String(value ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '?');
}

function wrapText(text, font, fontSize, maxWidth) {
  const paragraphs = pdfSafeText(text).split('\n');
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        throw new AppError(
          `O trecho "${word.slice(0, 30)}" é longo demais para o template. Insira espaços ou abrevie.`,
          'TEXT_OVERFLOW'
        );
      }
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

function fitFontSize(text, font, maxWidth, preferred = 9, minimum = 6) {
  const safe = pdfSafeText(text);
  for (let size = preferred; size >= minimum; size -= 0.5) {
    if (font.widthOfTextAtSize(safe, size) <= maxWidth) return size;
  }
  throw new AppError(
    `O texto "${safe.slice(0, 35)}" não cabe no campo do template.`,
    'TEXT_OVERFLOW'
  );
}

function drawAtTop(page, text, options) {
  const safe = pdfSafeText(text);
  const size = options.size ?? 9;
  page.drawText(safe, {
    x: options.x,
    y: page.getHeight() - options.topY - size,
    size,
    font: options.font,
    color: options.color
  });
}

module.exports = { pdfSafeText, wrapText, fitFontSize, drawAtTop };
