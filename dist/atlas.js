import { evidence } from './evidence.js';
import { EVENTS, KINDS, money, rupees, formatDate } from './model.js';
import { ATLAS_CITIES, CRITERIA, PRIORITIES, FUNCTIONS, ATLAS_METHODOLOGY, defaultAtlasPlan, normalizeAtlasPlan, evaluateAtlas } from './atlas-model.js';
import { ATLAS_PROVIDERS, ATLAS_DATA_CHECKED_ON } from './atlas-data.js';

const atlas$ = selector => document.querySelector(selector);
const atlasAll = selector => [...document.querySelectorAll(selector)];
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const external = (url, label) => `<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${safe(label)}</a>`;
const STORAGE_PLAN = 'gcc-atlas-plan-v1', STORAGE_SAVED = 'gcc-atlas-decisions-v1', STORAGE_PROVIDERS = 'gcc-atlas-providers-v1';
const CATEGORY_NAMES = { setup: 'GCC setup & operations', legal: 'Legal & entity setup', tax: 'Tax, audit & compliance', talent: 'Recruitment & talent', payroll: 'Payroll & EOR', property: 'Office space' };
const PAGE_NAMES = { decision: 'Compare cities', companies: 'Company evidence', providers: 'Find services', saved: 'Saved plans' };
const textDate = value => value ? formatDate(value) : 'Date not stated';
const checkedLabel = record => record.check === 'matched' ? 'Quote matched to source' : 'Read once; not automatically rechecked';
const currentDate = () => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date());
function readStored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
let atlasPlan = normalizeAtlasPlan(readStored(STORAGE_PLAN, null));
function cleanProviderIds(value) { return Array.isArray(value) ? [...new Set(value.filter(id => ATLAS_PROVIDERS.some(provider => provider.id === id)))] : []; }
let shortlistedProviderIds = cleanProviderIds(readStored(STORAGE_PROVIDERS, []));
let savedDecisions = readStored(STORAGE_SAVED, []);
if (!Array.isArray(savedDecisions)) savedDecisions = [];
savedDecisions = savedDecisions.filter(item => item && typeof item.id === 'string' && item.plan && typeof item.createdAt === 'string').map(item => ({ id: item.id, createdAt: item.createdAt, plan: normalizeAtlasPlan(item.plan), providerIds: cleanProviderIds(item.providerIds) })).slice(0, 50);
let atlasPage = 'decision', atlasTimer;
let storageAvailable = true;
function persist(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { storageAvailable = false; return false; } }
function atlasToast(message) { clearTimeout(atlasTimer); atlas$('#atlas-toast').textContent = message; atlas$('#atlas-toast').hidden = false; atlasTimer = setTimeout(() => { atlas$('#atlas-toast').hidden = true; }, 3800); }
function setAtlasPage(page, scroll = true, updateHistory = true) {
  atlasPage = Object.hasOwn(PAGE_NAMES, page) ? page : 'decision';
  atlasAll('.atlas-view').forEach(view => { view.hidden = view.id !== `atlas-view-${atlasPage}`; });
  atlasAll('.planner-nav [data-page]').forEach(button => { const selected = button.dataset.page === atlasPage; button.classList.toggle('selected', selected); if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  document.title = `${PAGE_NAMES[atlasPage]} | GCC Atlas`;
  if (updateHistory && location.hash !== `#${atlasPage}`) history.pushState(null, '', `#${atlasPage}`);
  if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
}
// These tags are editorial search aids inferred from the words in the existing source record.
// The UI labels that distinction; absence of a tag is not absence of the capability.
function inferredTags(text) {
  const terms = text.toLowerCase();
  const sectors = [['Financial services', /bank|insurance|financ|payments|fintech/], ['Healthcare', /medical|pharma|health|medicine/], ['Energy', /\boil\b|\bgas\b|energy/], ['Retail & consumer', /retail|consumer|fashion|beverage|beer/], ['Engineering & industrial', /manufactur|automotive|industrial|wind|turbine/], ['Technology', /software|technology|\btech\b|digital|cloud/]];
  const functions = [['technology', /software|technology|\btech\b|digital|cloud|data|analytics|\bai\b/], ['engineering', /engineering|design|product development/], ['finance', /finance|financial|account|insurance|banking/], ['operations', /operations|business services|shared services|customer service|support/], ['research', /research|\br&d\b|innovation/]].filter(([, regex]) => regex.test(terms)).map(([id]) => id);
  return { sector: sectors.find(([, regex]) => regex.test(terms))?.[0] || 'Not recorded', functions };
}
const companyGroups = new Map();
for (const record of evidence.records) {
  if (!companyGroups.has(record.company)) companyGroups.set(record.company, { id: record.id, company: record.company, records: [], cities: [], functions: [], sector: 'Not recorded' });
  const group = companyGroups.get(record.company); group.records.push(record);
}
const atlasCompanies = [...companyGroups.values()].map(group => {
  group.cities = [...new Set(group.records.flatMap(record => record.cities))];
  group.records.sort((a, b) => (b.publishedOn || '').localeCompare(a.publishedOn || ''));
  const tags = inferredTags(group.records.map(record => `${record.summary} ${record.receipt}`).join(' '));
  return { ...group, ...tags, latest: group.records[0].publishedOn || '' };
});

function fillAtlasForm() {
  const plan = atlasPlan;
  atlas$('#atlas-functions').innerHTML = Object.entries(FUNCTIONS).map(([id, label]) => `<label><input type="checkbox" name="functions" value="${id}" ${plan.functions.includes(id) ? 'checked' : ''}>${label}</label>`).join('');
  atlas$('#atlas-city-options').innerHTML = ATLAS_CITIES.map(city => `<label><input type="checkbox" name="cities" value="${city.id}" ${plan.excludedCities.includes(city.id) ? '' : 'checked'}>${city.name}</label>`).join('');
  for (const [id, key] of [['atlas-headcount', 'headcount'], ['atlas-budget', 'budget'], ['atlas-budget-scope', 'budgetScope'], ['atlas-timeline', 'timeline'], ['atlas-priority', 'priority'], ['atlas-constraints', 'constraints'], ['atlas-overhead', 'overhead']]) atlas$(`#${id}`).value = plan[key];
  atlas$('#atlas-desks').value = Math.round(plan.seatRatio * 100);
  atlas$('#atlas-weights').innerHTML = CRITERIA.map(criterion => `<label>${criterion.label} (%)<input type="number" min="0" max="100" step="0.1" required data-weight="${criterion.id}" aria-label="${criterion.label} weight" value="${plan.weights[criterion.id]}"></label>`).join('');
  atlas$('#atlas-assessments').innerHTML = ATLAS_CITIES.map(city => `<tr><td>${city.name}</td>${['talent', 'readiness', 'ecosystem', 'risk'].map(key => `<td><input type="number" min="1" max="5" step="0.1" required data-assessment="${city.id}:${key}" aria-label="${city.name} ${key} demo assessment" value="${plan.assessments[city.id][key]}"></td>`).join('')}</tr>`).join('');
  atlas$('#atlas-cost-inputs').innerHTML = ATLAS_CITIES.map(city => `<tr><td>${city.name}</td><td><input type="number" min="1" max="100" step="0.1" required data-cost="${city.id}:salary" aria-label="${city.name} annual salary in lakh" value="${plan.costs[city.id].salary}"></td><td><input type="number" min="1000" max="100000" step="1" required data-cost="${city.id}:desk" aria-label="${city.name} monthly office seat cost" value="${plan.costs[city.id].desk}"></td></tr>`).join('');
  const salarySource = ATLAS_CITIES[0].salarySource;
  atlas$('#atlas-salary-source').innerHTML = `Starting salaries: ${external(salarySource.url, salarySource.name)}, ${safe(salarySource.asOf)}. These are software-engineer medians, not quotations for all roles or seniority. Office costs are editable examples.`;
}
function syncAtlasForm(showErrors = false) {
  const form = atlas$('#atlas-plan-form');
  const functions = atlasAll('#atlas-functions input:checked').map(input => input.value);
  const cities = atlasAll('#atlas-city-options input:checked').map(input => input.value);
  const invalid = [...form.querySelectorAll('input,select,textarea')].find(input => !input.validity.valid);
  let error = !functions.length ? 'Choose at least one type of work.' : !cities.length ? 'Include at least one city.' : invalid ? `Check ${invalid.getAttribute('aria-label') || invalid.closest('label')?.childNodes[0]?.textContent?.trim() || 'your number inputs'}. Use the allowed range and a complete number.` : '';
  if (error) {
    atlas$('#atlas-input-error').textContent = error;
    atlas$('#atlas-save').disabled = true; atlas$('#atlas-report').disabled = true;
    atlas$('#atlas-results').setAttribute('data-stale', 'true');
    if (showErrors && invalid) { invalid.closest('details')?.setAttribute('open', ''); invalid.reportValidity(); }
    return false;
  }
  const next = JSON.parse(JSON.stringify(atlasPlan));
  next.functions = functions; next.excludedCities = ATLAS_CITIES.map(city => city.id).filter(id => !cities.includes(id));
  for (const [id, key] of [['atlas-headcount', 'headcount'], ['atlas-budget', 'budget'], ['atlas-timeline', 'timeline'], ['atlas-overhead', 'overhead']]) next[key] = Number(atlas$(`#${id}`).value);
  next.budgetScope = atlas$('#atlas-budget-scope').value; next.timeline = Number(atlas$('#atlas-timeline').value); next.priority = atlas$('#atlas-priority').value; next.constraints = atlas$('#atlas-constraints').value; next.seatRatio = Number(atlas$('#atlas-desks').value) / 100;
  atlasAll('[data-weight]').forEach(input => { next.weights[input.dataset.weight] = Number(input.value); });
  atlasAll('[data-assessment]').forEach(input => { const [city, criterion] = input.dataset.assessment.split(':'); next.assessments[city][criterion] = Number(input.value); });
  atlasAll('[data-cost]').forEach(input => { const [city, kind] = input.dataset.cost.split(':'); next.costs[city][kind] = Number(input.value); });
  atlasPlan = normalizeAtlasPlan(next); persist(STORAGE_PLAN, atlasPlan);
  atlas$('#atlas-input-error').textContent = ''; atlas$('#atlas-results').removeAttribute('data-stale');
  renderAtlasResults(); return true;
}
function renderAtlasResults() {
  const result = evaluateAtlas(atlasPlan), lead = result.ranked[0];
  atlas$('#atlas-weight-total').textContent = `Weight total: ${CRITERIA.reduce((sum, item) => sum + atlasPlan.weights[item.id], 0).toFixed(1)}%. ${result.weightsValid ? 'Contributions use each weight’s share of this total.' : 'Give at least one criterion a weight above zero.'}`;
  atlas$('#atlas-save').disabled = !lead; atlas$('#atlas-report').disabled = !lead;
  atlas$('#atlas-warnings').innerHTML = result.warnings.filter(warning => warning.kind !== 'assumptions').map(warning => `<div class="warning ${warning.kind.startsWith('budget') ? 'budget' : ''}">${safe(warning.message)}</div>`).join('');
  atlas$('#atlas-recommendation').innerHTML = lead ? `<strong>${lead.name} ranks first under your current assumptions.</strong><p>${atlasPlan.headcount} people · ${money(result.budgetRupees)} budget · ${atlasPlan.timeline}-month target. ${safe(result.scopeExplanation)}</p>` : '<strong>No ranking yet.</strong><p>Include a city and give at least one criterion a weight above zero.</p>';
  atlas$('#atlas-city-grid').innerHTML = result.ranked.map((city, index) => `<article class="result-card ${index === 0 ? 'lead' : ''}" data-atlas-city="${city.id}"><header><span>OPTION ${index + 1}</span><span>${index === 0 ? 'Leads this scenario' : 'Compare the trade-offs'}</span></header><div class="card-body"><h3>${city.name}</h3><div class="card-stats"><div><span>Scenario score · demo assessments</span><strong>${city.score.toFixed(1)} <small>/ 100</small></strong></div><div><span>Estimated recurring cost</span><strong>${money(city.costs.total)}</strong><small>per year · partial cost model</small></div></div><details class="result-detail"><summary>Why this city?</summary><ul>${city.reasons.slice(0, 2).map(reason => `<li>${safe(reason)}</li>`).join('')}</ul><p class="tradeoff">${safe(city.tradeoffs.slice(0, 2).join(' '))}</p></details></div><footer><button class="link-button" data-city-evidence="${city.id}">See company evidence</button><button class="link-button" data-city-score="${city.id}">Inspect the score</button></footer></article>`).join('');
  atlas$('#atlas-score-head').innerHTML = `<tr><th>Points contributed</th>${result.ranked.map(city => `<th>${city.name}</th>`).join('')}</tr>`;
  atlas$('#atlas-score-body').innerHTML = CRITERIA.map(criterion => `<tr><td>${criterion.label}<small>Weight ${atlasPlan.weights[criterion.id]}%</small></td>${result.ranked.map(city => { const component = city.components.find(item => item.id === criterion.id); return `<td><strong>${component.contribution.toFixed(1)} points</strong><small>Rating ${component.raw.toFixed(2)} / 5</small></td>`; }).join('')}</tr>`).join('') + `<tr><td><strong>Total</strong></td>${result.ranked.map(city => `<td><strong>${city.score.toFixed(1)} / 100</strong></td>`).join('')}</tr>`;
  atlas$('#atlas-roadmap').innerHTML = result.roadmap.map(stage => `<li><strong>${safe(stage.title)}</strong><p>${safe(stage.description)}</p></li>`).join('');
}
function openAtlasDetail(title, html) { atlas$('#atlas-detail-type').textContent = title; atlas$('#atlas-detail-body').innerHTML = html; atlas$('#atlas-detail-dialog').showModal(); }
function recordSource(record) {
  const parties = ['partner', 'workplace', 'government'].filter(key => record[key]);
  return `<article class="source-card"><h3>${safe(record.company)} · ${EVENTS[record.event]}</h3><p>${safe(record.summary)}</p><p>${safe(record.cities.join(', '))} · ${textDate(record.publishedOn)} · ${KINDS[record.source.kind] || 'Source'}</p>${external(record.source.url, record.source.title)}<p>${safe(record.source.publisher)} · Checked ${formatDate(evidence.checkedOn)} · ${checkedLabel(record)}</p><blockquote>${safe(record.receipt)}</blockquote>${parties.map(key => `<p><strong>${safe(record[key].name)}</strong> · ${safe(record[key].role)}</p><blockquote>${safe(record[key].quote)}</blockquote>`).join('')}${record.hiring ? `<p><strong>Headcount claim:</strong> ${safe(record.hiring.claim)}</p><blockquote>${safe(record.hiring.quote)}</blockquote>` : '<p>Headcount: not recorded in this sample.</p>'}</article>`;
}
function showCompanyProfile(id) {
  const group = atlasCompanies.find(company => company.id === id || company.records.some(record => record.id === id));
  if (!group) return;
  openAtlasDetail('GCC PROFILE', `<h2>${safe(group.company)}</h2><dl><dt>Locations in sample</dt><dd>${safe(group.cities.join(', '))}</dd><dt>Parent company</dt><dd>Not separately recorded; the announcement’s company name is shown.</dd><dt>Sector tag</dt><dd>${safe(group.sector)} · editorial interpretation</dd><dt>Work tags</dt><dd>${group.functions.length ? group.functions.map(id => FUNCTIONS[id]).join(', ') : 'Not recorded'} · editorial interpretation</dd><dt>Evidence scope</dt><dd>Historical or announced activity as stated in each source. No present headcount is inferred.</dd></dl>${group.records.length > 1 ? '<p>There are multiple announcements. Compare their dates and scope before treating different figures as a conflict.</p>' : ''}${group.records.map(recordSource).join('')}`);
}
function showCityEvidence(id) {
  const city = ATLAS_CITIES.find(entry => entry.id === id);
  const records = evidence.records.filter(record => record.cities.includes(city.name));
  openAtlasDetail('CITY SOURCE RECORD', `<h2>${city.name}: what sources say</h2><p>${records.length} announcements in this curated sample. They show precedent, not the number of GCCs in this city or people available to hire.</p><p>The city’s talent and readiness scores are demo assumptions; these announcements do not validate those scores.</p>${records.length ? records.map(recordSource).join('') : '<p>No announcement in the existing sample names this city. This does not mean it has no GCCs.</p>'}`);
}
function showCityScore(id) {
  const city = evaluateAtlas(atlasPlan).ranked.find(entry => entry.id === id); if (!city) return;
  openAtlasDetail('TRANSPARENT SCORING', `<h2>${city.name} · ${city.score.toFixed(1)} / 100</h2><p>Every non-cost rating here is an editable demo assumption. This is a scenario score, not a verified market ranking.</p><div class="table-scroll"><table class="atlas-table"><thead><tr><th>Criterion</th><th>Rating / 5</th><th>Weight</th><th>Points</th></tr></thead><tbody>${city.components.map(component => `<tr><td>${component.label}</td><td>${component.raw.toFixed(2)}</td><td>${component.weight}%</td><td>${component.contribution.toFixed(1)}</td></tr>`).join('')}</tbody></table></div><h3>Cost calculation</h3><p>Salaries: ${money(city.costs.salary)}<br>Extra people costs: ${money(city.costs.overhead)}<br>Office: ${city.costs.seats} desks × ${rupees(atlasPlan.costs[id].desk)} × 12 = ${money(city.costs.office)}<br><strong>Total: ${money(city.costs.total)} a year.</strong></p><p>Starting salary reference: ${external(city.salarySource.url, city.salarySource.name)}, ${safe(city.salarySource.asOf)}. Your current value may differ. Office and overhead inputs are examples.</p><p>${safe(ATLAS_METHODOLOGY)}</p>`);
}
function renderCompanyList() {
  const query = atlas$('#atlas-company-query').value.trim().toLowerCase().split(/\s+/).filter(Boolean), city = atlas$('#atlas-company-city').value, sector = atlas$('#atlas-company-sector').value, fn = atlas$('#atlas-company-function').value, sort = atlas$('#atlas-company-sort').value;
  const filtered = atlasCompanies.filter(company => (!city || company.cities.includes(city)) && (!sector || company.sector === sector) && (!fn || company.functions.includes(fn)) && query.every(word => `${company.company} ${company.cities.join(' ')} ${company.records.map(record => `${record.summary} ${record.partner?.name || ''} ${record.workplace?.name || ''} ${record.government?.name || ''}`).join(' ')} ${company.sector} ${company.functions.map(id => FUNCTIONS[id]).join(' ')}`.toLowerCase().includes(word))).sort((a, b) => sort === 'name' ? a.company.localeCompare(b.company) : sort === 'oldest' ? a.latest.localeCompare(b.latest) : b.latest.localeCompare(a.latest));
  atlas$('#atlas-company-count').textContent = `${filtered.length} of ${atlasCompanies.length} companies · ${evidence.records.length} total announcements`;
  atlas$('#atlas-company-empty').hidden = filtered.length > 0;
  atlas$('#atlas-company-rows').innerHTML = filtered.map(company => `<tr><td><strong>${safe(company.company)}</strong><small>${company.records.length} ${company.records.length === 1 ? 'announcement' : 'announcements'}</small></td><td>${safe(company.cities.join(', '))}</td><td>${safe(company.sector)}<small>${company.functions.length ? company.functions.map(id => FUNCTIONS[id]).join(' · ') : 'Work not recorded'}</small></td><td>${EVENTS[company.records[0].event]}</td><td>${textDate(company.latest)}<small>${checkedLabel(company.records[0])}</small></td><td><button class="link-button" data-company="${safe(company.id)}">Open profile</button></td></tr>`).join('');
}
function clearCompanies() { for (const id of ['atlas-company-query', 'atlas-company-city', 'atlas-company-sector', 'atlas-company-function']) atlas$(`#${id}`).value = ''; renderCompanyList(); }
function renderProviders() {
  const query = atlas$('#atlas-provider-query').value.trim().toLowerCase(), category = atlas$('#atlas-provider-category').value, city = atlas$('#atlas-provider-city').value, status = atlas$('#atlas-provider-evidence').value;
  atlasAll('[data-service]').forEach(button => { const selected = button.dataset.service === category; button.setAttribute('aria-pressed', String(selected)); });
  const providers = ATLAS_PROVIDERS.filter(provider => (!category || provider.category === category) && (!city || provider.cities.includes(city) || provider.cities.includes('India')) && (!status || (status === 'relationship' ? provider.announcementIds.length > 0 : provider.announcementIds.length === 0)) && `${provider.name} ${provider.description} ${provider.services.join(' ')}`.toLowerCase().includes(query));
  atlas$('#atlas-provider-count').textContent = `${providers.length} of ${ATLAS_PROVIDERS.length} providers${city ? ' · includes stated India-wide scope' : ''}`;
  atlas$('#atlas-provider-empty').hidden = providers.length > 0;
  atlas$('#atlas-provider-grid').innerHTML = providers.map(provider => `<article class="panel provider-card" data-provider-card="${provider.id}"><span class="tag">${CATEGORY_NAMES[provider.category]}</span><h2>${provider.name}</h2><p class="location">${provider.cities.includes('India') ? 'Stated country scope: India' : `Documented locations: ${safe(provider.cities.join(', '))}`}</p><div class="tags">${provider.services.slice(0, 3).map(service => `<span class="tag">${safe(service)}</span>`).join('')}</div><footer><span>${provider.verification}</span><button class="link-button" data-provider="${provider.id}">View evidence</button></footer><div class="provider-select">${providerSelectButton(provider)}</div></article>`).join('');
}
function clearProviders() { for (const id of ['atlas-provider-query', 'atlas-provider-category', 'atlas-provider-city', 'atlas-provider-evidence']) atlas$(`#${id}`).value = ''; renderProviders(); }
function providerSelectButton(provider) { const selected = shortlistedProviderIds.includes(provider.id); return `<button class="button ${selected ? 'secondary' : 'primary'}" data-shortlist-provider="${provider.id}" aria-pressed="${selected}">${selected ? 'Remove from my shortlist' : 'Add to my shortlist'}</button>`; }
function providerQuestions(provider) {
  const checks = { setup: 'Who will own the entity, contracts and IP, and how does handover work?', legal: 'Which entity, employment and cross-border obligations apply to our structure?', tax: 'What tax, transfer-pricing, audit and filing scope is included in the mandate?', talent: 'What comparable roles have you filled recently, at what pay and hiring pace?', payroll: 'Who is the legal employer, which fees apply, and how would employees transfer?', property: 'Can you provide current rent, deposit, fit-out and available-space quotations?' };
  return [`Request a relevant client reference for ${evaluateAtlas(atlasPlan).ranked[0]?.name || 'our shortlisted city'} and our function mix; public coverage does not establish local delivery.`, checks[provider.category], 'Ask for itemised costs, dependencies, exclusions and evidence of delivery. No outcome is verified by this prototype.'];
}
function providerBriefHtml() {
  const providers = shortlistedProviderIds.map(id => ATLAS_PROVIDERS.find(provider => provider.id === id));
  return providers.length ? providers.map(provider => `<article class="source-card"><h3>${safe(provider.name)}</h3><p>${safe(provider.verification)} · ${safe(provider.coverageNote)}</p><p>${safe(provider.caveat)}</p><p>${provider.sources.map(source => external(source.url, source.title)).join(' · ')}</p><h4>Questions still to answer</h4><ul>${providerQuestions(provider).map(question => `<li>${safe(question)}</li>`).join('')}</ul></article>`).join('') : '<p>No providers shortlisted yet. Add providers after inspecting their evidence.</p>';
}
function renderProviderShortlist() {
  const providers = shortlistedProviderIds.map(id => ATLAS_PROVIDERS.find(provider => provider.id === id));
  atlas$('#atlas-shortlist-summary').textContent = providers.length ? `${providers.length} provider${providers.length === 1 ? '' : 's'} chosen by you. Included when you save or export this decision.` : 'No providers yet. Browse services to start your shortlist.';
  atlas$('#atlas-shortlist-items').innerHTML = providers.map(provider => `<li><div><strong>${safe(provider.name)}</strong><small>${safe(provider.verification)} · ${safe(CATEGORY_NAMES[provider.category])}</small></div><button class="link-button" data-provider="${provider.id}">Evidence</button><button class="link-button" data-shortlist-provider="${provider.id}">Remove</button></li>`).join('');
  atlas$('#atlas-provider-selection-count').textContent = `${providers.length} provider${providers.length === 1 ? '' : 's'} in your shortlist`;
}
function toggleProvider(id) {
  if (!ATLAS_PROVIDERS.some(provider => provider.id === id)) return;
  const selected = shortlistedProviderIds.includes(id);
  shortlistedProviderIds = selected ? shortlistedProviderIds.filter(value => value !== id) : [...shortlistedProviderIds, id];
  const stored = persist(STORAGE_PROVIDERS, shortlistedProviderIds);
  renderProviders(); renderProviderShortlist();
  atlasAll(`[data-shortlist-provider="${id}"]`).forEach(button => { if (button.closest('#atlas-detail-dialog')) { const active = shortlistedProviderIds.includes(id); button.textContent = active ? 'Remove from my shortlist' : 'Add to my shortlist'; button.className = `button ${active ? 'secondary' : 'primary'}`; button.setAttribute('aria-pressed', String(active)); } });
  atlasToast(stored ? (selected ? 'Removed from your provider shortlist.' : 'Added to your shortlist. Save or export the decision to keep its context.') : 'Shortlist changed for this session. Browser storage is unavailable; download the report.');
}
function showProvider(id) {
  const provider = ATLAS_PROVIDERS.find(item => item.id === id); if (!provider) return;
  const relations = provider.announcementIds.map(announcementId => evidence.records.find(record => record.id === announcementId)).filter(Boolean);
  openAtlasDetail('PROVIDER PROFILE', `<span class="tag">${CATEGORY_NAMES[provider.category]}</span><h2>${provider.name}</h2><p>${safe(provider.description)}</p><div class="tags">${provider.services.map(service => `<span class="tag">${safe(service)}</span>`).join('')}</div><h3>Coverage and verification</h3><p>${safe(provider.coverageNote)}</p><p><strong>${safe(provider.verification)}</strong> · Checked ${formatDate(ATLAS_DATA_CHECKED_ON)}</p><p>${safe(provider.caveat)}</p><div class="action-group">${external(provider.website, 'Official website')}${external(provider.contactUrl, 'Contact / booking page')}</div><p class="scope-note">These links open the provider’s website. Nothing is sent by this prototype.</p><div class="provider-select">${providerSelectButton(provider)}</div><h3>Questions to ask</h3><ul>${providerQuestions(provider).map(question => `<li>${safe(question)}</li>`).join('')}</ul><h3>Supporting sources</h3>${provider.sources.map(source => `<article class="source-card">${external(source.url, source.title)}<p>${safe(source.publisher)} · ${textDate(source.publishedOn)} · Checked ${formatDate(source.accessedOn)}</p><p>${safe(source.claim)}</p></article>`).join('')}${relations.length ? `<h3>Named relationships in the record</h3>${relations.map(recordSource).join('')}` : '<p>No particular GCC client relationship is verified by this record. Request relevant references directly.</p>'}`);
}
function renderSaved() {
  atlas$('#atlas-save-count').textContent = savedDecisions.length;
  atlas$('#atlas-saved-empty').hidden = savedDecisions.length > 0;
  atlas$('#atlas-saved-list').innerHTML = savedDecisions.map(item => { const result = evaluateAtlas(item.plan), city = result.ranked[0]; return `<article class="panel saved-card"><span class="tag">Saved ${new Date(item.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span><h2>${item.plan.headcount} people · ${item.plan.functions.map(id => FUNCTIONS[id]).join(' / ')}</h2><p>${city ? `${city.name} led the saved scenario · ${money(city.costs.total)} yearly cost.` : 'No ranking in this saved scenario.'}</p><p>Budget ${money(result.budgetRupees)} · ${item.plan.budgetScope === 'salary' ? 'salaries only' : 'running costs'} · ${item.plan.timeline}-month target</p><p>${item.providerIds.length} shortlisted providers · evidence and open questions included.</p><footer><button class="link-button" data-reopen="${safe(item.id)}">Reopen decision</button><button class="link-button" data-remove="${safe(item.id)}">Remove</button></footer></article>`; }).join('');
}
function saveAtlasDecision() {
  if (!syncAtlasForm(true)) return;
  if (!evaluateAtlas(atlasPlan).ranked.length) return;
  const item = { id: globalThis.crypto?.randomUUID?.() || `decision-${Date.now()}`, createdAt: new Date().toISOString(), plan: JSON.parse(JSON.stringify(atlasPlan)), providerIds: [...shortlistedProviderIds] };
  const next = [item, ...savedDecisions].slice(0, 50);
  if (!persist(STORAGE_SAVED, next)) return atlasToast('Browser storage is unavailable. Download the report instead.');
  savedDecisions = next; renderSaved(); atlasToast('Decision saved in this browser.');
}
function atlasReportText() {
  const result = evaluateAtlas(atlasPlan), lead = result.ranked[0];
  const lines = ['# GCC Atlas — India decision report', '', `Created ${currentDate()}`, `Team: ${atlasPlan.headcount} people; ${atlasPlan.functions.map(id => FUNCTIONS[id]).join(', ')}`, `Budget: ${money(result.budgetRupees)}; scope: ${atlasPlan.budgetScope === 'salary' ? 'salaries only' : 'recurring running costs'}`, `Setup target: ${atlasPlan.timeline} months, not a promised schedule.`, `Priority: ${atlasPlan.priority}`, '', `First under the saved assumptions: ${lead?.name || 'No ranking'}.`, '**All non-cost city ratings are editable demo assumptions, not measured city facts.**', '', '| City | Scenario score / 100 | Estimated yearly running cost |', '| --- | --- | --- |', ...result.ranked.map(city => `| ${city.name} | ${city.score.toFixed(1)} | ${money(city.costs.total)} |`), '', '## Budget and other cautions', '', result.scopeExplanation, ...result.warnings.map(warning => `- ${warning.message}`), '', '## Weights', ...CRITERIA.map(criterion => `- ${criterion.label}: ${atlasPlan.weights[criterion.id]}%`), '', '## Exact cost and city assessment inputs', ...ATLAS_CITIES.filter(city => !atlasPlan.excludedCities.includes(city.id)).flatMap(city => [`- ${city.name}: annual salary per person ${money(atlasPlan.costs[city.id].salary * 100000)}; desk per month ${rupees(atlasPlan.costs[city.id].desk)}.`, `  - Demo assessments: ${Object.entries(atlasPlan.assessments[city.id]).map(([key, value]) => `${key} ${value}/5`).join('; ')}.`]), `- Extra people costs: ${atlasPlan.overhead}% of salaries; office seats per person ${atlasPlan.seatRatio}.`, '- Excluded: one-time setup, recruitment, tax, travel, incentives, and unmodelled operating expenses.', '', '## Scoring method', '', ATLAS_METHODOLOGY, '', '## Salary source', '', `Starting software-engineer median reference, ${ATLAS_CITIES[0].salarySource.asOf}: ${ATLAS_CITIES[0].salarySource.url}`, 'A software median does not establish salaries for your role mix, seniority, or hiring timeline. Replace it with your own evidence.', '', '## Next steps', ...result.roadmap.map(stage => `- ${stage.title}: ${stage.description}`), '', '## Your notes', atlasPlan.constraints || 'None entered.', '', '## Company evidence', '', `Curated announcement record checked ${evidence.checkedOn}; not a census, current headcount survey, or hiring-availability measure.`];
  for (const record of evidence.records.filter(record => result.ranked.some(city => record.cities.includes(city.name)))) lines.push(`- ${record.company} / ${record.cities.join(', ')} / ${EVENTS[record.event]} / source ${record.publishedOn || 'undated'}: ${record.source.url}`, `  - ${record.summary}`, `  - Evidence status: ${checkedLabel(record)}.`);
  lines.push('', '## Your provider shortlist', '', 'These are your choices, not ranked recommendations. Questions below remain unanswered.');
  for (const id of shortlistedProviderIds) { const provider = ATLAS_PROVIDERS.find(item => item.id === id); lines.push(`- ${provider.name}: ${provider.verification}. ${provider.coverageNote}`, `  - ${provider.caveat}`, ...provider.sources.map(source => `  - Evidence: ${source.claim} (${source.url})`), ...providerQuestions(provider).map(question => `  - Open question: ${question}`)); }
  if (!shortlistedProviderIds.length) lines.push('No providers selected.');
  lines.push('', '## Provider source directory', '', 'This is an alphabetical evidence directory, not a quality recommendation or paid placement.');
  for (const provider of [...ATLAS_PROVIDERS].sort((a, b) => a.name.localeCompare(b.name))) lines.push(`- ${provider.name}: ${CATEGORY_NAMES[provider.category]}. ${provider.website}`, `  - ${provider.verification}. ${provider.coverageNote}`, ...provider.sources.map(source => `  - ${source.publisher}: ${source.claim} (${source.url})`));
  lines.push('', '## Product limits', 'No live LLM is called by the Atlas engine. The separate source reader can use Claude inside its Artifact; outside it, only explicitly labelled saved sample answers work.', 'No consultation has been booked or sent. No live provider performance ranking, legal assessment, or incentive eligibility calculation is included.', 'Saved decisions stay in this browser.');
  return lines.join('\n');
}
function showAtlasReport() {
  if (!syncAtlasForm(true)) return;
  const result = evaluateAtlas(atlasPlan), lead = result.ranked[0]; if (!lead) return;
  atlas$('#atlas-report-body').innerHTML = `<article class="report-body"><p class="eyebrow">GCC ATLAS · ${currentDate()}</p><h2>Your India city comparison</h2><p>${atlasPlan.headcount} people · ${atlasPlan.functions.map(id => FUNCTIONS[id]).join(' / ')} · ${money(result.budgetRupees)} budget · ${atlasPlan.timeline}-month target.</p><div class="notice"><strong>${lead.name} leads this scenario.</strong><span>All non-cost assessments are editable demo assumptions. Check hiring, setup dependencies, and current quotations before a real decision.</span></div><div class="table-scroll"><table class="atlas-table"><thead><tr><th>City</th><th>Scenario score</th><th>Yearly estimate</th></tr></thead><tbody>${result.ranked.map(city => `<tr><td>${city.name}</td><td>${city.score.toFixed(1)} / 100</td><td>${money(city.costs.total)}</td></tr>`).join('')}</tbody></table></div><h3>Budget scope and cautions</h3><p>${safe(result.scopeExplanation)}</p><ul>${result.warnings.map(warning => `<li>${safe(warning.message)}</li>`).join('')}</ul><h3>Weights and cost inputs</h3><p>${CRITERIA.map(criterion => `${criterion.label}: ${atlasPlan.weights[criterion.id]}%`).join(' · ')}</p><ul>${ATLAS_CITIES.filter(city => !atlasPlan.excludedCities.includes(city.id)).map(city => `<li>${city.name}: ${money(atlasPlan.costs[city.id].salary * 100000)} salary per person/year; ${rupees(atlasPlan.costs[city.id].desk)} desk/month. Demo ratings: ${Object.entries(atlasPlan.assessments[city.id]).map(([key, value]) => `${key} ${value}/5`).join(', ')}.</li>`).join('')}<li>${atlasPlan.overhead}% extra people costs, ${atlasPlan.seatRatio} desks per person, rounded up.</li></ul><p>Starting salary reference: ${external(ATLAS_CITIES[0].salarySource.url, ATLAS_CITIES[0].salarySource.name)}, ${safe(ATLAS_CITIES[0].salarySource.asOf)}. These software medians are not salaries for every function.</p><h3>How the score works</h3><p>${safe(ATLAS_METHODOLOGY)}</p><h3>What to check next</h3><ul>${result.roadmap.map(stage => `<li><strong>${safe(stage.title)}</strong> ${safe(stage.description)}</li>`).join('')}</ul>${atlasPlan.constraints ? `<h3>Your notes</h3><p>${safe(atlasPlan.constraints)}</p>` : ''}<h3>Company evidence by city</h3>${result.ranked.map(city => `<h3>${city.name}</h3><ul>${evidence.records.filter(record => record.cities.includes(city.name)).map(record => `<li>${external(record.source.url, record.company)} · ${textDate(record.publishedOn)} · ${EVENTS[record.event]}</li>`).join('') || '<li>No records in this sample.</li>'}</ul>`).join('')}<p class="scope-note">Source record checked ${formatDate(evidence.checkedOn)}. Announcements reflect their stated period. The report’s text download includes provider source references too. No live LLM, provider quality ranking, or incentive amount is used.</p></article>`;
  atlas$('#atlas-report-body .report-body').insertAdjacentHTML('beforeend', `<h3>Your provider shortlist and open questions</h3><p>Chosen by you; no provider quality ranking or contact has been made.</p>${providerBriefHtml()}`);
  atlas$('#atlas-report-dialog').showModal();
}
function showAtlasMethod() {
  openAtlasDetail('HOW THIS PROTOTYPE WORKS', `<h2>Facts, estimates, and choices.</h2><ol class="method-list"><li><strong>Company facts:</strong> Claude’s existing source record, with exact quotations, dates, and check status.</li><li><strong>Provider facts:</strong> official service pages or specifically named relationships. Marketing does not establish delivery quality.</li><li><strong>Salary references:</strong> software-engineer medians published by Flexiple, August 2026. A dated reference, not a hiring quote.</li><li><strong>Your choices:</strong> team, functions, budget scope, timeline target, and priorities.</li><li><strong>Demo assessments:</strong> talent, readiness, ecosystem fit, and execution confidence use editable illustrative 1–5 ratings. They are not sourced city statistics.</li></ol><h3>The formula</h3><p>${safe(ATLAS_METHODOLOGY)}</p><h3>What is AI doing?</h3><p>The city model is deterministic. The separate source reader can call Claude inside the existing Claude Artifact and checks every proposed quotation. Outside Claude it explains its limits and replays only its three saved, checked samples.</p><h3>What stays unknown?</h3><p>Current role-specific hiring capacity, provider outcomes, exact office quotes, policy eligibility, and one-time setup costs. No incentive savings are deducted.</p><p>Sector/work tags are editorial aids inferred from source descriptions. Parent entities and current headcount stay unrecorded where the source model does not establish them.</p>`);
}
document.addEventListener('click', event => {
  const service = event.target.closest('[data-service]');
  if (service) { atlas$('#atlas-provider-category').value = atlas$('#atlas-provider-category').value === service.dataset.service ? '' : service.dataset.service; renderProviders(); return; }
  const page = event.target.closest('[data-page]'); if (page) return setAtlasPage(page.dataset.page);
  const close = event.target.closest('[data-close]'); if (close) return document.getElementById(close.dataset.close).close();
  const company = event.target.closest('[data-company]'); if (company) return showCompanyProfile(company.dataset.company);
  const shortlist = event.target.closest('[data-shortlist-provider]'); if (shortlist) return toggleProvider(shortlist.dataset.shortlistProvider);
  const provider = event.target.closest('[data-provider]'); if (provider) return showProvider(provider.dataset.provider);
  const cityEvidence = event.target.closest('[data-city-evidence]'); if (cityEvidence) return showCityEvidence(cityEvidence.dataset.cityEvidence);
  const cityScore = event.target.closest('[data-city-score]'); if (cityScore) return showCityScore(cityScore.dataset.cityScore);
  const reopen = event.target.closest('[data-reopen]'); if (reopen) { const saved = savedDecisions.find(item => item.id === reopen.dataset.reopen); if (saved) { atlasPlan = normalizeAtlasPlan(saved.plan); shortlistedProviderIds = cleanProviderIds(saved.providerIds); persist(STORAGE_PROVIDERS, shortlistedProviderIds); renderProviderShortlist(); renderProviders(); fillAtlasForm(); renderAtlasResults(); persist(STORAGE_PLAN, atlasPlan); setAtlasPage('decision'); atlasToast('Saved inputs restored.'); } return; }
  const remove = event.target.closest('[data-remove]'); if (remove) { const next = savedDecisions.filter(item => item.id !== remove.dataset.remove); if (!persist(STORAGE_SAVED, next)) return atlasToast('Could not update browser storage.'); savedDecisions = next; renderSaved(); return atlasToast('Saved decision removed.'); }
  const action = event.target.closest('[data-action]'); if (!action) return;
  if (action.dataset.action === 'method') showAtlasMethod();
  if (action.dataset.action === 'clear-company') clearCompanies();
  if (action.dataset.action === 'clear-provider') clearProviders();
  if (action.dataset.action === 'relevant-providers') { const city = evaluateAtlas(atlasPlan).ranked[0]; clearProviders(); if (city) atlas$('#atlas-provider-city').value = city.name; renderProviders(); setAtlasPage('providers'); }
});
atlas$('#atlas-plan-form').addEventListener('input', () => syncAtlasForm());
atlas$('#atlas-plan-form').addEventListener('change', event => {
  if (event.target.id === 'atlas-priority') atlasAll('[data-weight]').forEach(input => { input.value = PRIORITIES[event.target.value][input.dataset.weight]; });
  syncAtlasForm();
});
atlas$('#atlas-plan-form').addEventListener('submit', event => { event.preventDefault(); if (syncAtlasForm(true)) { atlas$('#atlas-results').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); atlas$('#atlas-results-title').focus({ preventScroll: true }); } });
atlas$('#atlas-reset').addEventListener('click', () => { atlasPlan = defaultAtlasPlan(); shortlistedProviderIds = []; persist(STORAGE_PROVIDERS, shortlistedProviderIds); renderProviderShortlist(); renderProviders(); fillAtlasForm(); renderAtlasResults(); persist(STORAGE_PLAN, atlasPlan); atlas$('#atlas-input-error').textContent = ''; atlasToast('Starting example restored.'); });
atlas$('#atlas-save').addEventListener('click', saveAtlasDecision);
atlas$('#atlas-report').addEventListener('click', showAtlasReport);
for (const id of ['atlas-company-query', 'atlas-company-city', 'atlas-company-sector', 'atlas-company-function', 'atlas-company-sort']) atlas$(`#${id}`).addEventListener(id.endsWith('query') ? 'input' : 'change', renderCompanyList);
for (const id of ['atlas-provider-query', 'atlas-provider-category', 'atlas-provider-city', 'atlas-provider-evidence']) atlas$(`#${id}`).addEventListener(id.endsWith('query') ? 'input' : 'change', renderProviders);
atlas$('#atlas-clear-company').addEventListener('click', clearCompanies); atlas$('#atlas-clear-provider').addEventListener('click', clearProviders);
atlas$('#atlas-download-report').addEventListener('click', () => { const blob = new Blob([atlasReportText()], { type: 'text/markdown;charset=utf-8' }), url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'GCC-Atlas-Decision.md'; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); atlasToast('Report downloaded.'); });
atlas$('#atlas-print-report').addEventListener('click', () => window.print());
atlasAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
});
window.addEventListener('hashchange', () => setAtlasPage(location.hash.slice(1), true, false));
window.addEventListener('popstate', () => setAtlasPage(location.hash.slice(1), true, false));
for (const [id, values] of [['atlas-company-city', [...new Set(atlasCompanies.flatMap(company => company.cities))].sort()], ['atlas-company-sector', [...new Set(atlasCompanies.map(company => company.sector))].sort()]]) atlas$(`#${id}`).insertAdjacentHTML('beforeend', values.map(value => `<option value="${safe(value)}">${safe(value)}</option>`).join(''));
atlas$('#atlas-company-function').insertAdjacentHTML('beforeend', Object.entries(FUNCTIONS).map(([id, label]) => `<option value="${id}">${label}</option>`).join(''));
const initialService = new URLSearchParams(location.search).get('service');
if (Object.hasOwn(CATEGORY_NAMES, initialService)) atlas$('#atlas-provider-category').value = initialService;
fillAtlasForm(); renderAtlasResults(); renderCompanyList(); renderProviders(); renderProviderShortlist(); renderSaved(); setAtlasPage(location.hash.slice(1), false, false);
