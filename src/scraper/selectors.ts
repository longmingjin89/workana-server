export const SELECTORS = {
  // Login detection
  auth: {
    loginUrl: '/login',
    dashboardUrl: '/dashboard',
  },

  // Dashboard
  dashboard: {
    findProjectsLink: 'a[href*="ref=menu_projects_index"]',
    findProjectsButton: 'a.btn.btn-inverse:has-text("Find projects")',
  },

  // Listing page - filters
  filters: {
    category: (cat: string) => `#category-${cat}`,
    languageAll: '#language-0',
    languageEn: '#language-1',
    languagePt: '#language-2',
    languageEs: '#language-3',
  },

  // Listing page - projects
  listing: {
    projectCard: '.project-item.js-project',
    featuredCard: '.project-item.js-project.project-item-featured',
    title: '.project-title a span[title]',
    titleLink: '.project-title a',
    date: '.project-main-details .date',
    bids: '.project-main-details .bids',
    description: '.text-expander-content span:first-child',
    skills: '.skills .skill h3',
    budget: '.project-actions .budget .values span:first-child',
    clientName: '.project-author .author-info button span',
    clientCountry: '.project-author .country .country-name a',
    paymentVerified: '.project-author .payment-verified',
    rating: '.project-author .stars-fill',
  },

  // Pagination
  pagination: {
    pages: 'ul.pagination li a',
    activePage: 'ul.pagination li.active a',
    pageOne: 'ul.pagination li a:has-text("1")',
  },

  // Detail page
  detail: {
    title: 'header#productName h1.title',
    status: 'span.pry.label.rounded',
    budget: 'h4.budget.text-right',
    description: 'div.expander',
    specification: '.specification',
    skills: 'div.skills a.skill.label.label-info',
    bidButton: 'a#bid_button',

    // Client info
    clientSection: 'aside .wk-user-info',
    clientName: '.wk-user-info a.user-name span',
    clientProfileLink: '.wk-user-info a.user-name',
    clientFlag: '.wk-user-info .flag',
    clientRating: '.wk-user-info .stars-fill',
    clientData: '.item-data',

    // Client reviews
    reviewSection: 'section.client-ratings',
    reviewList: 'section.client-ratings ul.list-border-top > li',
    reviewProjectTitle: 'p.h5.bold',
    reviewFreelancerName: '.wk-user-info.info-inline a.user-name span',
    reviewFreelancerLink: '.wk-user-info.info-inline a.user-name',
    reviewRating: '.wk-user-info.info-inline .stars-fill',
    reviewTime: '.wk-user-info.info-inline span.small',
  },
} as const;
