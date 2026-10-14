// The record as a document: built once as a list of [type, content] blocks,
// then written out as Markdown (copy, download) or HTML (print).
import { EVENTS, KINDS, LINKS, coverage, formatDate, players } from './model.js';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The record tracks three relationships only, so the finding never claims that other roles went unnamed.
export function findingSentence(records) {
  const [first, ...rest] = coverage(records);
  return `Of ${records.length} announcements, ${first.named} name ${first.one}, ${rest.map(row => `${row.named} name ${row.one}`).join(' and ')}. These are the relationships the record tracks; a missing mention does not show that a service was unused.`;
}

export function buildReport(evidence) {
  const { records } = evidence;
  const sources = new Set(records.map(record => record.source.url)).size;
  return [
    ['h1', 'Who helped set up India’s newest GCCs?'],
    ['p', `${records.length} announcements from ${sources} sources, last checked on ${formatDate(evidence.checkedOn)}. The sources are the ones cited on Flexiple’s list of new and upcoming GCCs in India (${evidence.listUrl}).`],
    ['lead', findingSentence(records)],
    ['p', 'Named means only that the source says so. This is not a rating of any firm.'],
    ['h2', 'Who is named'],
    ['table', {
      head: ['Named party', 'As', 'Announcements', 'Companies'],
      rows: players(records).map(player => [player.name, LINKS[player.kind].label, String(player.records.length), player.records.map(record => record.company).join(', ')])
    }],
    ['h2', 'Every announcement'],
    ['sources', records.map(record => ({
      title: `${record.company}, ${record.cities.join(' and ')}: ${record.source.title}`,
      url: record.source.url,
      notes: [
        `${EVENTS[record.event]}${record.publishedOn ? `, ${formatDate(record.publishedOn)}` : ', no date on the page'}. ${KINDS[record.source.kind]}, ${record.source.publisher}. ${record.summary}`,
        ...Object.keys(LINKS).filter(key => record[key]).map(key => `${LINKS[key].label}: ${record[key].name}. “${record[key].quote}”`),
        ...(record.hiring ? [`Hiring: ${record.hiring.claim}. “${record.hiring.quote}”`] : []),
        `The centre: “${record.receipt}”`
      ]
    }))],
    ['h2', 'How this was made'],
    ['list', [
      'AI read each source and proposed the company, the city and any state government, setup partner or building named, each with one quoted sentence.',
      'A program then looked for every quoted sentence on the page itself. A quote that was not there word for word was thrown away.',
      `${records.filter(record => record.check === 'matched').length} of ${records.length} entries were matched against their source pages, checked ${formatDate(evidence.checkedOn)}. ${records.filter(record => record.check !== 'matched').length} came from a site that blocks automated checks; it was read separately and is labelled.`,
      ...evidence.unreadable.map(item => `Left out: ${item.company}. ${item.reason}`)
    ]]
  ];
}

const markdownRow = cells => `| ${cells.join(' | ')} |`;
const asMarkdown = {
  h1: text => `# ${text}`,
  h2: text => `## ${text}`,
  lead: text => `**${text}**`,
  p: text => text,
  list: items => items.map(item => `- ${item}`).join('\n'),
  table: ({ head, rows }) => [head, head.map(() => '---'), ...rows].map(markdownRow).join('\n'),
  sources: items => items.map(item => [`- [${item.title}](${item.url})`, ...item.notes.map(note => `  - ${note}`)].join('\n')).join('\n')
};
export const toMarkdown = blocks => blocks.map(([type, content]) => asMarkdown[type](content)).join('\n\n') + '\n';

const htmlRow = (tag, cells) => `<tr>${cells.map(cell => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('')}</tr>`;
const asHtml = {
  h1: text => `<h1>${escapeHtml(text)}</h1>`,
  h2: text => `<h2>${escapeHtml(text)}</h2>`,
  lead: text => `<p class="lead">${escapeHtml(text)}</p>`,
  p: text => `<p>${escapeHtml(text)}</p>`,
  list: items => `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`,
  table: ({ head, rows }) => `<table><thead>${htmlRow('th', head)}</thead><tbody>${rows.map(row => htmlRow('td', row)).join('')}</tbody></table>`,
  sources: items => `<ul class="sources">${items.map(item => `<li><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a>${item.notes.map(note => `<p>${escapeHtml(note)}</p>`).join('')}</li>`).join('')}</ul>`
};
export const toHtml = blocks => blocks.map(([type, content]) => asHtml[type](content)).join('');
