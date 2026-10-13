// Curated provider facts for GCC Atlas. Service descriptions are provider statements,
// not an assessment of delivery quality. Announcement links reuse the checked corpus.
// Sources were inspected on the date below; undated service pages retain null dates.
export const ATLAS_DATA_CHECKED_ON = '2026-10-13';

/**
 * @typedef {'setup'|'legal'|'tax'|'talent'|'payroll'|'property'} ProviderCategory
 * @typedef {{id:string,title:string,publisher:string,url:string,publishedOn:string|null,
 * accessedOn:string,claim:string}} ProviderSource
 * @typedef {{id:string,name:string,category:ProviderCategory,services:string[],cities:string[],
 * coverageNote:string,description:string,website:string,contactUrl:string,
 * verification:'Provider-stated services'|'Source-named relationship',
 * sources:ProviderSource[],announcementIds:string[],caveat:string}} AtlasProvider
 */

/** @type {AtlasProvider[]} */
export const ATLAS_PROVIDERS = [
  {
    id: 'ansr', name: 'ANSR', category: 'setup',
    services: ['GCC strategy and design', 'Entity setup coordination', 'Talent acquisition', 'Workspace setup', 'GCC operations'],
    cities: ['Bengaluru', 'Hyderabad'],
    coverageNote: 'Bengaluru and Hyderabad offices are listed by ANSR. The Bengaluru announcement names a specific engagement; office presence does not prove every service is delivered locally.',
    description: 'Offers an operating model for building and managing company-owned GCCs, including talent, workplace and operations.',
    website: 'https://ansr.com/global-capability-center/',
    contactUrl: 'https://ansr.com/contact-us/',
    verification: 'Source-named relationship',
    sources: [
      { id: 'ansr-services', title: 'Global Capability Center-as-a-Service', publisher: 'ANSR', url: 'https://ansr.com/global-capability-center/', publishedOn: null, accessedOn: '2026-10-13', claim: 'Lists GCC design, legal entity, talent acquisition, workspace setup and ongoing operations services.' },
      { id: 'ansr-offices', title: 'Contact Us', publisher: 'ANSR', url: 'https://ansr.com/contact-us/', publishedOn: null, accessedOn: '2026-10-13', claim: 'Lists ANSR India offices in Bengaluru and Hyderabad.' },
      { id: 'ansr-abercrombie', title: 'Abercrombie & Fitch Co. Opens Global Capability Center in Bengaluru', publisher: 'Abercrombie & Fitch Co. via PR Newswire', url: 'https://www.prnewswire.com/in/news-releases/abercrombie--fitch-co-opens-global-capability-center-in-bengaluru-to-support-continued-global-growth-and-strengthen-enterprise-capabilities-302843492.html', publishedOn: '2026-08-06', accessedOn: '2026-10-13', claim: 'The existing checked announcement names ANSR as an adviser on establishing and scaling the Bengaluru GCC.' }
    ],
    announcementIds: ['abercrombie-bengaluru'],
    caveat: 'A named engagement establishes that relationship only. Provider marketing, setup timing and outcome claims are not independently validated here.'
  },
  {
    id: 'flexiple', name: 'Flexiple', category: 'setup',
    services: ['GCC planning', 'Entity setup coordination', 'Talent hiring', 'Managed employment', 'Payroll and HR operations', 'Workspace coordination'],
    cities: ['India'],
    coverageNote: 'The official offering describes building teams and company-owned centres in India. City-by-city delivery capacity is not established in this record.',
    description: 'Offers India GCC setup and hiring support, including an employment bridge while a company-owned entity is established.',
    website: 'https://flexiple.com/gcc',
    contactUrl: 'https://cal.com/suvansh-bansal/hiring-needs-with-flexiple-us',
    verification: 'Provider-stated services',
    sources: [
      { id: 'flexiple-gcc-services', title: 'GCC | Build Your Own India Entity', publisher: 'Flexiple', url: 'https://flexiple.com/gcc', publishedOn: null, accessedOn: '2026-10-13', claim: 'Lists planning, entity and compliance coordination, hiring, managed employment, infrastructure and HR operations; links to a strategy call.' }
    ],
    announcementIds: [],
    caveat: 'The assignment was set by Flexiple. Inclusion is transparent; this directory has no paid placement or quality ranking. Client logos do not establish a GCC setup relationship in this dataset.'
  },
  {
    id: 'trilegal', name: 'Trilegal', category: 'legal',
    services: ['India-entry legal strategy', 'Cross-border corporate transactions', 'Corporate governance', 'Employment law advisory'],
    cities: ['Bengaluru', 'Chennai', 'Pune', 'Mumbai', 'New Delhi', 'Gurugram', 'GIFT City'],
    coverageNote: 'These are offices explicitly listed on the firm contact page. That page states the firm serves clients across India; an office is not evidence of a particular GCC mandate.',
    description: 'An India law firm with corporate, governance and employment practices relevant to establishment and ongoing operations.',
    website: 'https://trilegal.com/',
    contactUrl: 'https://trilegal.com/contact-us/',
    verification: 'Provider-stated services',
    sources: [
      { id: 'trilegal-corporate', title: 'Corporate', publisher: 'Trilegal', url: 'https://trilegal.com/expertises/corporate/', publishedOn: null, accessedOn: '2026-10-13', claim: 'Describes corporate advice for India-entry strategy, cross-border transactions, joint ventures and regulatory issues.' },
      { id: 'trilegal-practices', title: 'Expertise - Practices', publisher: 'Trilegal', url: 'https://trilegal.com/expertise/', publishedOn: null, accessedOn: '2026-10-13', claim: 'Lists corporate, employment, risk and compliance practices for domestic and multinational clients.' },
      { id: 'trilegal-offices', title: 'Contact Us', publisher: 'Trilegal', url: 'https://trilegal.com/contact-us/', publishedOn: null, accessedOn: '2026-10-13', claim: 'States India-wide service scope and lists offices in Bengaluru, Chennai, Pune, Mumbai, Delhi, Gurugram and GIFT City.' }
    ],
    announcementIds: [],
    caveat: 'No named GCC engagement is established by these service pages. Request relevant references and confirm the engagement scope directly.'
  },
  {
    id: 'ey', name: 'EY', category: 'tax',
    services: ['Corporate tax advisory', 'Tax compliance and reporting', 'Transfer pricing advisory', 'Indirect tax and GST advisory'],
    cities: ['India'],
    coverageNote: 'The India tax offering establishes country scope. The linked Mumbai GCC announcement documents an advisory relationship, not a city-wide tax delivery claim.',
    description: 'Its India tax practice lists corporate tax, compliance, indirect tax and transfer pricing services.',
    website: 'https://www.ey.com/en_in/services/tax',
    contactUrl: 'https://www.ey.com/en_in/locations',
    verification: 'Source-named relationship',
    sources: [
      { id: 'ey-tax-services', title: 'Tax Consulting & Advisory Services', publisher: 'EY India', url: 'https://www.ey.com/en_in/services/tax', publishedOn: null, accessedOn: '2026-10-13', claim: 'Describes corporate tax, tax compliance, tax and finance operations, and transfer pricing services in India.' },
      { id: 'ey-indirect-tax', title: 'Indirect Tax Compliance Services', publisher: 'EY India', url: 'https://www.ey.com/en_in/services/tax/indirect-tax-compliance', publishedOn: null, accessedOn: '2026-10-13', claim: 'Describes indirect-tax advisory and compliance services, including GST.' },
      { id: 'ey-bms-advisory', title: 'BMS Opens Global Capability Centre in Mumbai', publisher: 'Insurance Edge (secondary reporting)', url: 'https://insurance-edge.net/2026/06/23/bms-opens-global-capability-centre-in-mumbai/', publishedOn: '2026-06-23', accessedOn: '2026-10-13', claim: 'The existing checked announcement reports EY advising on feasibility, design, build and required skills for the BMS Mumbai centre; it does not establish a tax mandate.' }
    ],
    announcementIds: ['bms-mumbai'],
    caveat: 'EY is a network of separate member firms. The BMS relationship is secondary reporting from the checked corpus and concerns GCC advice; no BMS tax or audit engagement is claimed.'
  },
  {
    id: 'randstad', name: 'Randstad India', category: 'talent',
    services: ['Permanent recruitment', 'Technology staffing', 'Executive search', 'Temporary staffing', 'Talent acquisition'],
    cities: ['Bengaluru', 'Hyderabad', 'Pune', 'Chennai'],
    coverageNote: 'The official branch locator lists recruitment offices in these four comparison cities. These are documented offices, not client project references.',
    description: 'Offers recruitment and staffing services for employers, including technology hiring and executive search.',
    website: 'https://www.randstad.in/',
    contactUrl: 'https://www.randstad.in/contact-us/',
    verification: 'Provider-stated services',
    sources: [
      { id: 'randstad-employer-services', title: 'Common questions employers / clients ask', publisher: 'Randstad India', url: 'https://www.randstad.in/contact-us/faq/', publishedOn: null, accessedOn: '2026-10-13', claim: 'Lists executive search, permanent recruitment, technology staffing, temporary staffing and talent acquisition services.' },
      { id: 'randstad-offices', title: 'Recruitment & Staffing Agencies in India', publisher: 'Randstad India', url: 'https://www.randstad.in/our-offices/', publishedOn: null, accessedOn: '2026-10-13', claim: 'Lists Bengaluru, Chennai, Hyderabad and Pune branches among its India recruitment offices.' }
    ],
    announcementIds: [],
    caveat: 'The branch locator includes GCC as a specialism. It does not name a client GCC delivery relationship or establish hiring speed and quality.'
  },
  {
    id: 'deel', name: 'Deel', category: 'payroll',
    services: ['Employer of Record', 'Employee onboarding', 'Payroll administration', 'Benefits administration'],
    cities: ['India'],
    coverageNote: 'The official India hiring page states an India EOR and payroll offering. It does not establish city-specific delivery teams.',
    description: 'Offers an employment and payroll route for hiring people in India, with onboarding and benefits administration.',
    website: 'https://www.deel.com/hiring/employees/india/',
    contactUrl: 'https://www.deel.com/request-a-demo/',
    verification: 'Provider-stated services',
    sources: [
      { id: 'deel-india-employment', title: 'Hire Employees in India - EOR & Payroll', publisher: 'Deel', url: 'https://www.deel.com/hiring/employees/india/', publishedOn: null, accessedOn: '2026-10-13', claim: 'States that Deel offers India EOR, payroll, onboarding and benefits management.' }
    ],
    announcementIds: [],
    caveat: 'The page is provider marketing. Fees, local entity arrangements, service eligibility and compliance responsibilities require direct due diligence; no legal outcome is guaranteed.'
  },
  {
    id: 'jll', name: 'JLL India', category: 'property',
    services: ['Tenant representation', 'Location strategy', 'Office sourcing', 'Lease negotiation', 'Occupancy and space planning'],
    cities: ['India'],
    coverageNote: 'The India tenant-services page establishes country scope. No local office list or project-specific city coverage is asserted in this record.',
    description: 'Offers tenant representation to help businesses select locations, find office space and negotiate commercial leases.',
    website: 'https://www.jll.com/en-in/services/leasing-for-tenants',
    contactUrl: 'https://www.jll.com/en-in/contact',
    verification: 'Provider-stated services',
    sources: [
      { id: 'jll-tenant-services', title: 'Leasing for tenants', publisher: 'JLL India', url: 'https://www.jll.com/en-in/services/leasing-for-tenants', publishedOn: null, accessedOn: '2026-10-13', claim: 'Describes tenant representation, sourcing locations, negotiating leases, location strategy and space planning.' }
    ],
    announcementIds: [],
    caveat: 'JLL also appears in the GCC corpus as an operator of its own centre. That is not evidence that JLL provided property services to any other GCC in the corpus.'
  },
  {
    id: 'hcltech', name: 'HCLTech', category: 'setup',
    services: ['GCC design and advisory', 'GCC setup support', 'Talent acquisition', 'Engineering and technology transformation', 'Build-operate-transfer models'],
    cities: ['Hyderabad'],
    coverageNote: 'Hyderabad is a documented Western Union GCC collaboration location. This record does not claim that Hyderabad is its only service location.',
    description: 'Offers GCC setup and transformation services. Its official release names collaboration on Western Union\'s Hyderabad centre.',
    website: 'https://www.hcltech.com/global-capability-center',
    contactUrl: 'https://www.hcltech.com/en-us/contact-us/request-for-services',
    verification: 'Source-named relationship',
    sources: [
      { id: 'hcltech-gcc-services', title: 'Solutions for Global Capability Centers: GCC Transformation', publisher: 'HCLTech', url: 'https://www.hcltech.com/global-capability-center', publishedOn: null, accessedOn: '2026-10-13', claim: 'Lists GCC design, setup, advisory, talent and transformation services, with several engagement models.' },
      { id: 'hcltech-western-union', title: 'Western Union and HCLTech expand Global Capability Center to Hyderabad', publisher: 'HCLTech', url: 'https://www.hcltech.com/press-releases/western-union-and-hcltech-expand-global-capability-center-hyderabad-accelerating', publishedOn: '2026-01-27', accessedOn: '2026-10-13', claim: 'Names the launch of Western Union\'s Hyderabad GCC in collaboration with HCLTech.' }
    ],
    announcementIds: ['western-union-hyderabad'],
    caveat: 'The named relationship is documented in the provider\'s announcement. It establishes participation, without independently assessing outcomes or quality.'
  },
  {
    id: 'gspann', name: 'GSPANN', category: 'setup',
    services: ['GCC establishment', 'Managed IT services', 'Infrastructure operations', 'Application support'],
    cities: ['Gurugram', 'Hyderabad'],
    coverageNote: 'These are the cities explicitly named for the Carlsberg GCC project, rather than a complete list of GSPANN service locations.',
    description: 'Its official Carlsberg announcement describes establishing and managing an IT GCC anchored in Gurugram, with a Hyderabad team.',
    website: 'https://www.gspann.com/',
    contactUrl: 'https://www.gspann.com/contact',
    verification: 'Source-named relationship',
    sources: [
      { id: 'gspann-carlsberg', title: 'Carlsberg Group launches its first-ever IT Global Capability Centre in Gurugram', publisher: 'GSPANN', url: 'https://www.gspann.com/insights/newsroom/carlsberg-group-launches-its-first-ever-it-global-capability-centre-in-gurugram', publishedOn: '2025-09-03', accessedOn: '2026-10-13', claim: 'Names GSPANN as establishment and management partner for Carlsberg\'s IT GCC and identifies Gurugram and Hyderabad as project locations.' }
    ],
    announcementIds: ['carlsberg-gurugram'],
    caveat: 'The named project supports those specific roles. It does not establish a performance rating, all-city coverage or the suitability of GSPANN for another buyer.'
  }
];

// Company sectors and functions are derived separately from the preserved announcement
// text. No unsupported company parent, headcount or industry is filled in here.
export const ATLAS_COMPANY_TAGS = {};
