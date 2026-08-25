import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

let workerConfigured = false;

const ensureWorker = () => {
  if (workerConfigured) return;

  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  workerConfigured = true;
};

const normalizeLine = (value: string) => value.replace(/\s+/g, ' ').trim();

const groupItemsIntoLines = (items: any[]) => {
  const positionedItems = items
    .filter(item => typeof item?.str === 'string' && item.str.trim())
    .map(item => ({
      text: item.str as string,
      x: Number(item.transform?.[4] ?? 0),
      y: Number(item.transform?.[5] ?? 0)
    }))
    .sort((left, right) => right.y - left.y || left.x - right.x);

  const lines: { y: number; items: { x: number; text: string }[] }[] = [];

  positionedItems.forEach(item => {
    const existingLine = lines.find(line => Math.abs(line.y - item.y) < 2);
    if (existingLine) {
      existingLine.items.push({ x: item.x, text: item.text });
      return;
    }

    lines.push({ y: item.y, items: [{ x: item.x, text: item.text }] });
  });

  return lines
    .sort((left, right) => right.y - left.y)
    .map(line => line.items.sort((left, right) => left.x - right.x).map(item => item.text).join(' '))
    .map(normalizeLine)
    .filter(Boolean);
};

export const extractDragonConScheduleTextFromPdf = async (file: File) => {
  ensureWorker();

  const data = await file.arrayBuffer();
  const document = await getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines = groupItemsIntoLines(textContent.items as any[]);
    pages.push(lines.join('\n'));
  }

  return pages.join('\n');
};