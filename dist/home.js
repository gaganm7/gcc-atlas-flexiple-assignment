import { evidence } from './evidence.js';
import { ATLAS_CITIES, BENCHMARK_SOURCE, defaultAtlasPlan } from './atlas-model.js';
import { ATLAS_PROVIDERS } from './atlas-data.js';
import { coverage, formatDate } from './model.js';

const homeSafe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const homeExternal = (url, title) => `<a href="${homeSafe(url)}" target="_blank" rel="noopener noreferrer">${homeSafe(title)} ↗</a>`;
const homeCategories = { legal:'Law & entity setup', property:'Office space', talent:'Hiring & talent', payroll:'Payroll & EOR', tax:'Tax & compliance', setup:'GCC setup partners' };
const unnamedRecords = evidence.records.filter(record => !record.partner && !record.workplace && !record.government);
const researchReports = [
  { id:'provider-proof', category:'Provider research', title:'Who actually helped set up these GCCs?', description:`What ${evidence.records.length} announcements tell us.`, art:`<div class="report-art art-proof" aria-hidden="true"><div class="proof-number">${unnamedRecords.length}<span>/${evidence.records.length}</span></div><div class="proof-caption">announcements name<br>no outside party</div><div class="proof-lines"><i></i><i></i><i></i></div></div>` },
  { id:'city-costs', category:'City costs', title:'What changes when you change cities?', description:'Salary references for your first estimate.', art:'<div class="report-art art-cities" aria-hidden="true"><span class="art-caption">FOUR CITIES. DIFFERENT COSTS.</span><div class="city-bars"><div><i style="height:100%"></i><span>BLR</span></div><div><i style="height:66.2%"></i><span>HYD</span></div><div><i style="height:60.5%"></i><span>PUN</span></div><div><i style="height:48.4%"></i><span>CHE</span></div></div></div>' },
  { id:'setup-services', category:'Setup services', title:'The services behind your India team.', description:'Nine providers. Their sources. Your questions.', art:'<div class="report-art art-services" aria-hidden="true"><div class="service-tiles"><span>LAW</span><span>TALENT</span><span>SPACE</span><span>PAYROLL</span></div><span class="art-caption">BUILD YOUR SETUP TEAM</span></div>' }
];

document.querySelectorAll('[data-record-count]').forEach(el => { el.textContent = evidence.records.length; });
document.querySelectorAll('[data-provider-count]').forEach(el => { el.textContent = ATLAS_PROVIDERS.length; });
const reportList = document.querySelector('#reports-list');
const reportContent = document.querySelector('#report-content');
function researchHeading(report) {
  return `<a id="reports-back" href="#">← All reports</a><header class="report-heading"><p class="eyebrow">${report.category.toUpperCase()}</p><h1 id="report-title">${report.title}</h1><p>${report.description}</p></header><p class="report-meta">GCC Atlas research · Sources checked ${formatDate(evidence.checkedOn)} · Curated sample</p>`;
}
function researchAction(title, label, url) { return `<div class="report-action"><h2>${title}</h2><a class="button button-dark" href="${url}">${label} ↗</a></div>`; }
function providerProofReport() {
  const counts = coverage(evidence.records);
  return `<div class="report-highlights"><div class="report-highlight"><strong>${evidence.records.length}</strong><span>announcements reviewed</span></div><div class="report-highlight"><strong>${unnamedRecords.length}</strong><span>have no tracked relationship</span></div><div class="report-highlight"><strong>${counts.find(item=>item.key==='partner').named}</strong><span>name a setup partner</span></div></div>
  <div class="report-callout"><h2>An opening announcement tells only part of the story.</h2><p>The sources name ${counts.find(item=>item.key==='government').named} government relationships, ${counts.find(item=>item.key==='partner').named} setup partners and ${counts.find(item=>item.key==='workplace').named} buildings or landlords. A record can name more than one.</p></div>
  <section class="report-section"><h2>What is missing?</h2><p>No article names a separate outside firm hired for the centre’s legal, audit or payroll work, and none names a recruitment agency hired for it. Some name related partners: GSPANN manages Carlsberg’s talent ramp-up, and SAP names EduBridge as a training partner. A missing mention does not show that a service was unused.</p><p>For a company entering India, the next step is to request client references, scope and delivery evidence directly.</p></section>
  <section class="report-section"><h2>Inspect the source record</h2><label for="report-search">Find a company or city<input id="report-search" type="search" placeholder="For example: Abercrombie or Hyderabad"></label><p id="report-record-count" class="report-results-count" role="status"></p><div class="report-table-wrap table-scroll"><table><thead><tr><th>Company & location</th><th>Parties named</th><th>Evidence</th></tr></thead><tbody id="report-records"></tbody></table></div></section>
  <section class="report-section"><h2>How we read it</h2><ul><li>The sample follows sources behind Flexiple’s new-centre list. It is not a random survey or an India-wide census.</li><li>Quotations are matched to the recorded source. One source was read once and is labelled separately.</li><li>A named relationship shows involvement. It does not establish price, performance or a current contract.</li></ul></section>
  ${researchAction('Keep the sources with your shortlist.', 'Find setup services', './planner.html#providers')}`;
}
function cityCostsReport() {
  const ref = ATLAS_CITIES[0].salarySource;
  return `<div class="report-callout"><h2>Start with the role. Then compare the city.</h2><p>These are dated software-engineer salary medians. They are a starting reference, not a quote for your team.</p></div><section class="report-section"><h2>Annual salary references</h2><div class="report-table-wrap table-scroll"><table><thead><tr><th>City</th><th>₹ lakh / person / year</th><th>Reference period</th></tr></thead><tbody>${ATLAS_CITIES.map(city=>`<tr><td><strong>${homeSafe(city.name)}</strong></td><td>${city.referenceSalary.toFixed(1)}</td><td>${homeSafe(ref.asOf)}</td></tr>`).join('')}</tbody></table></div><p class="report-limit">Source: ${homeExternal(ref.url, ref.name)}. City comparisons use the same software role reference; seniority and your actual role mix can change the result.</p></section><section class="report-section"><h2>What goes into the planning estimate?</h2><ul><li><strong>People:</strong> headcount × annual salary, plus ${defaultAtlasPlan().overhead}% for benefits and employer costs.</li><li><strong>Office:</strong> desks × monthly rent × 12.</li><li><strong>Total operating cost:</strong> adds per-person benchmarks for office running costs, technology, travel, admin, training and recruitment, from ${homeExternal(BENCHMARK_SOURCE.url, BENCHMARK_SOURCE.name)} (${homeSafe(BENCHMARK_SOURCE.asOf)}).</li><li><strong>Your priority:</strong> sets the weights for cost, talent, readiness, ecosystem fit and execution confidence.</li></ul><p>The benefits share, office rent and non-cost city scores are planning assumptions. Check them against your own quotations and research.</p></section><section class="report-section"><h2>What is outside the estimate?</h2><p>One-time setup such as entity, legal and fit-out costs, taxes and incentive savings. The tool does not assess legal requirements or incentive eligibility.</p></section>${researchAction('See the effect on your own team.', 'Compare cities', './planner.html#decision')}`;
}
function setupServicesReport() {
  return `<section class="report-section"><h2>Six kinds of help. Different questions to ask.</h2><p>Service pages explain what a firm offers. Named GCC relationships show a specific involvement. Neither alone proves delivery quality.</p></section><div class="report-provider-list">${ATLAS_PROVIDERS.map(provider=>`<section class="report-provider"><p class="eyebrow">${homeSafe(homeCategories[provider.category])}</p><h3>${homeSafe(provider.name)}</h3><p>${homeSafe(provider.services.slice(0,3).join(' · '))}</p><p><strong>${homeSafe(provider.verification)}</strong></p><p>${homeSafe(provider.coverageNote)}</p>${homeExternal(provider.sources[0].url, provider.sources[0].title)}</section>`).join('')}</div><section class="report-section"><h2>Three questions before you choose</h2><ol><li>Have you delivered a similar project in our shortlisted city?</li><li>What does the fee cover, and what is excluded?</li><li>Can we speak to a relevant client about the outcome?</li></ol><p>This nine-provider sample is a research starting point. It is not a quality ranking or a complete market directory.</p></section>${researchAction('Build your own provider shortlist.', 'Explore services', './planner.html#providers')}`;
}
function renderReportRecords() {
  const query = document.querySelector('#report-search').value.trim().toLowerCase();
  const records = evidence.records.filter(record => `${record.company} ${record.cities.join(' ')} ${['partner','government','workplace'].map(key=>record[key]?.name||'').join(' ')}`.toLowerCase().includes(query));
  document.querySelector('#report-record-count').textContent = `${records.length} of ${evidence.records.length} announcements`;
  document.querySelector('#report-records').innerHTML = records.map(record => `<tr><td><strong>${homeSafe(record.company)}</strong><small>${homeSafe(record.cities.join(', '))}</small></td><td>${['partner','government','workplace'].filter(key=>record[key]).map(key=>`<div>${homeSafe(record[key].name)}<small>${homeSafe(record[key].role)}</small></div>`).join('')||'No outside party named'}</td><td>${homeExternal(record.source.url,record.source.publisher)}<small>${record.publishedOn ? formatDate(record.publishedOn) : 'Date not stated'} · ${record.check==='matched'?'Quote matched':'Read once'}</small><details><summary>Read the source excerpt</summary><blockquote>${homeSafe(record.receipt)}</blockquote></details></td></tr>`).join('');
}
function renderResearchReport() {
  if (!reportList) return;
  const report = researchReports.find(item=>item.id===location.hash.slice(1));
  reportList.hidden = !!report; reportContent.hidden = !report;
  document.title = report ? `${report.title} | GCC Atlas` : 'Reports | GCC Atlas';
  if (report) {
    const body = report.id==='provider-proof' ? providerProofReport() : report.id==='city-costs' ? cityCostsReport() : setupServicesReport();
    reportContent.innerHTML = researchHeading(report) + body;
    if (report.id==='provider-proof') { renderReportRecords(); document.querySelector('#report-search').addEventListener('input',renderReportRecords); }
  }
  window.scrollTo(0,0);
}
if (reportList) {
  document.querySelector('#reports-cards').innerHTML = researchReports.map(report=>`<a class="report-card" href="#${report.id}">${report.art}<div class="report-card-body"><p class="eyebrow">${report.category.toUpperCase()}</p><h3>${report.title}</h3><p>${report.description}</p><span class="read-link">Read report <span aria-hidden="true">↗</span></span></div></a>`).join('');
  window.addEventListener('hashchange',renderResearchReport);
  renderResearchReport();
}
