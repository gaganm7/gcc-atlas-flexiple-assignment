// Decision calculations only. Source records and UI live in separate modules.
import { CITIES as REFERENCE_CITIES, SALARY_SOURCE as ATLAS_SALARY_SOURCE, costs as referenceCosts, money, rupees } from './model.js';

export const FUNCTIONS = {
  technology: 'Technology',
  engineering: 'Engineering',
  finance: 'Finance',
  operations: 'Operations',
  research: 'R&D'
};

export const CRITERIA = [
  { id: 'talent', label: 'Talent and hiring', weight: 30 },
  { id: 'readiness', label: 'Setup readiness', weight: 25 },
  { id: 'cost', label: 'Operating cost', weight: 20 },
  { id: 'ecosystem', label: 'Fit for your work', weight: 15 },
  { id: 'risk', label: 'Execution confidence', weight: 10 }
];

export const PRIORITIES = {
  balanced: { talent: 30, readiness: 25, cost: 20, ecosystem: 15, risk: 10 },
  cost: { talent: 10, readiness: 10, cost: 60, ecosystem: 10, risk: 10 },
  talent: { talent: 65, readiness: 10, cost: 5, ecosystem: 15, risk: 5 },
  speed: { talent: 15, readiness: 60, cost: 5, ecosystem: 10, risk: 10 },
  ecosystem: { talent: 20, readiness: 5, cost: 5, ecosystem: 65, risk: 5 }
};

export const ATLAS_CITIES = ['bengaluru', 'hyderabad', 'pune', 'chennai'].map(id => {
  const city = REFERENCE_CITIES.find(entry => entry.id === id);
  return { id, name: city.name, referenceSalary: city.salary, salarySource: ATLAS_SALARY_SOURCE };
});

// Cost per person per year in Indian GCCs: EY's GCC Cost and Operations Benchmarking Study 2023,
// section 3, 2022 costs across 60+ GCCs. Recruitment is EY's cost per new hire; in a centre's first
// year every hire is new. Salaries, benefits and rent come from the city inputs instead, so EY's
// workforce and rental figures are not reused. Office running costs are EY's facility essentials
// (₹0.2 lakh) plus other building costs (₹0.2 lakh).
export const BENCHMARK_SOURCE = { name: 'EY, GCC Cost and Operations Benchmarking Study 2023', asOf: '2022 costs', url: 'https://www.ey.com/content/dam/ey-unified-site/ey-com/en-in/insights/consullting/global-capability-centers/documents/ey-gcc-cost-report-2023.pdf' };
export const COST_BENCHMARKS = [
  { id: 'building', label: 'Office running costs', perPerson: 40000 },
  { id: 'technology', label: 'Technology and communications', perPerson: 160000 },
  { id: 'travel', label: 'Travel', perPerson: 20000 },
  { id: 'admin', label: 'Admin and other costs', perPerson: 50000 },
  { id: 'training', label: 'Training', perPerson: 20000 },
  { id: 'recruitment', label: 'Recruiting the team', perPerson: 60000, perHire: true }
];
export const COST_SOURCES = {
  salary: `Flexiple software-engineer median, ${ATLAS_SALARY_SOURCE.asOf}`,
  assumption: 'GCC Atlas planning assumption',
  benchmark: `EY GCC benchmark, ${BENCHMARK_SOURCE.asOf}`
};

// What the annual budget is compared with. Each scope adds up a subset of the cost lines.
// The cost rating always uses salaries, benefits and office rent, so the scope never changes the ranking.
export const BUDGET_SCOPES = {
  salary: {
    label: 'Salaries only', heading: 'Salaries', lines: ['salary'],
    hint: 'Pay only. Benefits and office are not included.',
    explanation: 'The budget covers annual salaries only. Benefits, office, other operating costs and one-time setup expenses need a separate budget.',
    excluded: 'benefits, office, technology, travel, admin, training, recruitment and one-time setup'
  },
  all: {
    label: 'Salaries, benefits and office', heading: 'Salaries, benefits and office', lines: ['salary', 'benefits', 'office'],
    hint: 'Pay, benefits and office rent.',
    explanation: 'The budget is compared with salaries, benefits and office rent. One-time setup expenses and other operating costs, such as technology and travel, are excluded.',
    excluded: 'technology, office running costs, travel, admin, training, recruitment and one-time setup'
  },
  total: {
    label: 'Total operating cost', heading: 'Total operating cost', lines: ['salary', 'benefits', 'office', ...COST_BENCHMARKS.map(item => item.id)],
    hint: 'Year one, everything except one-time setup.',
    explanation: 'The budget is compared with the year-one operating cost: salaries, benefits, office, technology, travel, admin, training and recruiting the team. One-time setup expenses, such as entity, legal and fit-out costs, are excluded.',
    excluded: 'one-time entity, legal and advisory fees, office fit-out and deposits, and incentives'
  }
};

export const ATLAS_METHODOLOGY = 'This is a scenario comparison, not a measured city ranking. Talent, readiness, fit and execution confidence are illustrative assessments from 1 to 5; higher is better. Weights come from the priority you choose and are product assumptions. Running cost is salaries + 20% for benefits and employer costs + occupied desks × monthly desk rent × 12. Total operating cost adds EY per-person benchmarks for office running costs, technology, travel, admin and training, plus recruiting every year-one hire. The lowest running-cost included city gets a cost rating of 5; each other cost rating is 5 × lowest running cost ÷ its running cost, so what your budget covers changes the budget check, not the ranking. Each contribution is rating ÷ 5 × weight ÷ total weights × 100; contributions add to the score out of 100. Scores compare only the included cities and do not prove feasibility. No incentives or one-time establishment expenses are included. Function selections change the due-diligence checklist; they do not create hidden city score adjustments.';

const ASSESSMENTS = {
  bengaluru: { talent: 5, readiness: 3.5, ecosystem: 5, risk: 2.5 },
  hyderabad: { talent: 4, readiness: 4.5, ecosystem: 4.5, risk: 3.5 },
  pune: { talent: 4, readiness: 4, ecosystem: 3.5, risk: 4 },
  chennai: { talent: 3.5, readiness: 3.5, ecosystem: 3.5, risk: 4 }
};

const FUNCTION_CHECKS = {
  technology: 'Check software roles, seniority, competing employers and expected hiring pace.',
  engineering: 'Check the required engineering disciplines, equipment and specialist hiring pool.',
  finance: 'Check accounting roles, financial controls, language needs and reporting obligations.',
  operations: 'Check process skills, shift coverage, language needs and service continuity.',
  research: 'Check specialist researchers, intellectual-property requirements and lab facilities.'
};

export function defaultAtlasPlan() {
  return {
    functions: ['technology'], headcount: 40, budget: 6, budgetScope: 'all', timeline: 6,
    priority: 'balanced', constraints: '', excludedCities: [],
    weights: { ...PRIORITIES.balanced },
    costs: Object.fromEntries(ATLAS_CITIES.map(city => [city.id, { salary: city.referenceSalary, desk: 10000 }])),
    overhead: 20, seatRatio: 0.6,
    assessments: Object.fromEntries(ATLAS_CITIES.map(city => [city.id, { ...ASSESSMENTS[city.id] }]))
  };
}

const numeric = (value, min, max, fallback, decimals = 0) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Number(Math.min(max, Math.max(min, value)).toFixed(decimals)) : fallback;

export function normalizeAtlasPlan(value) {
  const plan = defaultAtlasPlan();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return plan;
  if (Array.isArray(value.functions)) {
    const selected = Object.keys(FUNCTIONS).filter(key => value.functions.includes(key));
    if (selected.length) plan.functions = selected;
  }
  plan.headcount = numeric(value.headcount, 5, 2000, plan.headcount);
  plan.budget = numeric(value.budget, 0.01, 10000, plan.budget, 2);
  plan.timeline = numeric(value.timeline, 1, 24, plan.timeline);
  plan.budgetScope = Object.hasOwn(BUDGET_SCOPES, value.budgetScope) ? value.budgetScope : 'all';
  plan.priority = Object.hasOwn(PRIORITIES, value.priority) ? value.priority : 'balanced';
  plan.constraints = typeof value.constraints === 'string' ? value.constraints.trim().slice(0, 1000) : '';
  plan.excludedCities = ATLAS_CITIES.map(city => city.id).filter(id => Array.isArray(value.excludedCities) && value.excludedCities.includes(id));
  plan.overhead = numeric(value.overhead, 0, 100, plan.overhead, 1);
  plan.seatRatio = numeric(value.seatRatio, 0.1, 1, plan.seatRatio, 2);
  for (const criterion of CRITERIA) {
    plan.weights[criterion.id] = numeric(value.weights?.[criterion.id], 0, 100, PRIORITIES[plan.priority][criterion.id], 1);
  }
  for (const city of ATLAS_CITIES) {
    plan.costs[city.id].salary = numeric(value.costs?.[city.id]?.salary, 1, 100, city.referenceSalary, 1);
    plan.costs[city.id].desk = numeric(value.costs?.[city.id]?.desk, 1000, 100000, 10000);
    for (const key of Object.keys(ASSESSMENTS[city.id])) {
      plan.assessments[city.id][key] = numeric(value.assessments?.[city.id]?.[key], 1, 5, ASSESSMENTS[city.id][key], 1);
    }
  }
  return plan;
}

// The inputs a buyer controls. Weights follow the chosen priority, and city ratings and cost
// assumptions are the product's own, so values saved by an earlier assumptions editor are dropped.
const CUSTOMER_FIELDS = ['functions', 'headcount', 'budget', 'budgetScope', 'timeline', 'priority', 'constraints', 'excludedCities'];
export function customerAtlasPlan(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultAtlasPlan();
  return normalizeAtlasPlan(Object.fromEntries(CUSTOMER_FIELDS.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]])));
}

const currency = rupees => `₹${(rupees / 10000000).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} crore`;
const cityNames = cities => new Intl.ListFormat('en-IN', { type: 'conjunction' }).format(cities.map(city => city.name));

function roadmapFor(plan) {
  const functions = new Intl.ListFormat('en-IN', { type: 'conjunction' }).format(plan.functions.map(id => FUNCTIONS[id]));
  return [
    { stage: '01', title: 'Define the work and team', description: `Confirm the ${functions.toLowerCase()} roles, seniority and ${plan.headcount}-person hiring plan. ${plan.functions.map(id => FUNCTION_CHECKS[id]).join(' ')}` },
    { stage: '02', title: 'Validate the city shortlist', description: 'Check the demonstration ratings against role-specific hiring evidence and current office quotes. Check the announcements and source dates; a peer company does not prove available talent.' },
    { stage: '03', title: 'Choose the setup approach', description: 'Compare an owned entity, a setup partner and interim employment options with qualified advisers. Validate compliance, tax obligations and any applicable incentives against current official sources.' },
    { stage: '04', title: 'Build the launch plan', description: `Ask providers for documented experience, quotes and a hiring sequence. Treat ${plan.timeline} months as your target, then validate dependencies and one-time setup costs before approving a launch.` }
  ];
}

// Every cost line for one city, in display order. `running` is the salary, benefits and desk sum from model.js.
function costLinesFor(plan, city, running) {
  const lakh = value => money(value, 1, 'lakh');
  return [
    { id: 'salary', label: 'Salaries', source: 'salary', amount: running.salary, detail: `${plan.headcount} people × ${lakh(plan.costs[city.id].salary * 100000)}` },
    { id: 'benefits', label: 'Benefits and employer costs', source: 'assumption', amount: running.overhead, detail: `${plan.overhead}% of salaries` },
    { id: 'office', label: 'Office rent', source: 'assumption', amount: running.office, detail: `${running.seats} desks × ${rupees(plan.costs[city.id].desk)} a month` },
    ...COST_BENCHMARKS.map(item => ({ id: item.id, label: item.label, source: 'benchmark', amount: plan.headcount * item.perPerson, detail: `${plan.headcount} ${item.perHire ? 'new hires' : 'people'} × ${lakh(item.perPerson)}` }))
  ];
}

export function evaluateAtlas(value) {
  const plan = normalizeAtlasPlan(value);
  const budgetRupees = Math.round(plan.budget * 10000000);
  const weightTotal = CRITERIA.reduce((sum, criterion) => sum + plan.weights[criterion.id], 0);
  const weightsValid = weightTotal > 0;
  const scope = BUDGET_SCOPES[plan.budgetScope];
  const scopeExplanation = scope.explanation;
  const warnings = [{ kind: 'assumptions', message: 'City assessments and the benefits and office rent figures are illustrative planning assumptions. This shortlist is a starting point for due diligence.' }];
  if (plan.functions.some(id => id !== 'technology')) {
    warnings.push({ kind: 'salary-reference', message: 'Starting salaries are Flexiple software-engineer medians, not benchmarks for your full mix of functions or seniority. Get role-specific quotes before relying on the budget comparison.' });
  }
  if (plan.timeline < 4) {
    warnings.push({ kind: 'timeline', message: 'Your target is under four months. This is a planning flag chosen for the prototype, not a researched minimum setup time. Validate hiring, entity and office dependencies with providers.' });
  }
  if (plan.constraints) {
    warnings.push({ kind: 'constraints', message: 'Your preferences are saved for the decision brief. Free-text preferences do not automatically change ratings or costs; apply them through city exclusions.' });
  }
  if (!weightsValid) warnings.push({ kind: 'weights', message: 'Give at least one criterion a weight above zero to generate a ranking.' });
  const candidates = ATLAS_CITIES.filter(city => !plan.excludedCities.includes(city.id)).map(city => {
    const costs = referenceCosts(city.id, {
      team: plan.headcount, overhead: plan.overhead, seatRatio: plan.seatRatio,
      desk: plan.costs[city.id].desk,
      salaries: Object.fromEntries(ATLAS_CITIES.map(entry => [entry.id, plan.costs[entry.id].salary]))
    });
    const costLines = costLinesFor(plan, city, costs).filter(line => scope.lines.includes(line.id));
    return { ...city, costs, costLines, budgetCost: costLines.reduce((sum, line) => sum + line.amount, 0) };
  });
  if (!candidates.length) warnings.push({ kind: 'cities', message: 'Include at least one city to generate a shortlist.' });
  const salaryMismatch = candidates.filter(city => city.costs.salary > budgetRupees);
  const scopeMismatch = candidates.filter(city => city.costs.salary <= budgetRupees && city.budgetCost > budgetRupees);
  if (salaryMismatch.length) {
    warnings.push({ kind: 'budget-salary', cityIds: salaryMismatch.map(city => city.id), message: `The annual budget is below the salary estimate for ${cityNames(salaryMismatch)} at ${plan.headcount} people. Review headcount or budget.` });
  }
  if (plan.budgetScope === 'all' && scopeMismatch.length) {
    warnings.push({ kind: 'budget-total', cityIds: scopeMismatch.map(city => city.id), message: `Salaries fit the entered budget in ${cityNames(scopeMismatch)}, but benefits and office rent take the annual estimate above it.` });
  }
  if (plan.budgetScope === 'total' && scopeMismatch.length) {
    warnings.push({ kind: 'budget-operating', cityIds: scopeMismatch.map(city => city.id), message: `Salaries fit the entered budget in ${cityNames(scopeMismatch)}, but benefits, office and other operating costs take the year-one total above it.` });
  }
  const lowest = Math.min(...candidates.map(city => city.costs.total));
  const lowestBudgetCost = Math.min(...candidates.map(city => city.budgetCost));
  const ranked = weightsValid ? candidates.map(city => {
    const components = CRITERIA.map(criterion => {
      const raw = criterion.id === 'cost' ? 5 * lowest / city.costs.total : plan.assessments[city.id][criterion.id];
      const weight = plan.weights[criterion.id];
      return { id: criterion.id, label: criterion.label, raw, weight, contribution: raw / 5 * weight / weightTotal * 100 };
    });
    const strongest = [...components].sort((a, b) => b.contribution - a.contribution)[0];
    const weakest = [...components].filter(component => component.id !== 'cost' && component.weight > 0).sort((a, b) => a.raw - b.raw)[0];
    const reasons = [
      `${strongest.label} contributes ${strongest.contribution.toFixed(1)} points under your priority. Its ${strongest.raw.toFixed(1)}/5 rating is ${strongest.id === 'cost' ? 'calculated from salaries, benefits and office rent' : 'a demonstration assumption'}.`,
      `Salaries, benefits and office rent come to ${currency(city.costs.total)} a year for ${plan.headcount} people.`,
      `For your ${plan.functions.map(id => FUNCTIONS[id].toLowerCase()).join(' / ')} plan: ${plan.functions.map(id => FUNCTION_CHECKS[id]).join(' ')}`
    ];
    const tradeoffs = [];
    if (city.budgetCost > lowestBudgetCost) tradeoffs.push(`${currency(city.budgetCost - lowestBudgetCost)} a year more than the lowest-cost city here.`);
    if (weakest) tradeoffs.push(`${weakest.label} is assumed at ${weakest.raw.toFixed(1)}/5. Validate that assessment for your requirements.`);
    if (city.budgetCost > budgetRupees) tradeoffs.push(plan.budgetScope === 'salary' ? 'The entered salary budget is below this salary estimate.' : `The entered budget is below this estimate of ${scope.heading.toLowerCase()}.`);
    tradeoffs.push('Current incentives, specialist talent availability and one-time setup expenses have not been factored into the score.');
    return {
      ...city, score: components.reduce((sum, component) => sum + component.contribution, 0), components, reasons, tradeoffs,
      budgetStatus: { withinBudget: city.budgetCost <= budgetRupees, difference: budgetRupees - city.budgetCost }
    };
  }).sort((a, b) => b.score - a.score || a.costs.total - b.costs.total || a.name.localeCompare(b.name)) : [];
  return { ranked, warnings, roadmap: roadmapFor(plan), budgetRupees, weightsValid, scopeExplanation, plan };
}
