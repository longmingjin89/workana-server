export interface ProjectSummary {
  url: string;
  slug: string;
  title: string;
  budget: string;
  bidsCount: number;
  interestedCount: number;
  publishedAt: string;
  descriptionPreview: string;
  skills: string[];
  clientName: string;
  clientCountry: string;
  clientProfileUrl: string;
  paymentVerified: boolean;
  isFeatured: boolean;
}

export interface ClientReview {
  projectTitle: string;
  freelancerName: string;
  freelancerProfileUrl: string;
  rating: number;
  timeAgo: string;
  comment: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  fullDescription: string;
  category: string;
  subcategory: string;
  status: string;
  clientRating: number;
  clientProjectsPublished: number;
  clientProjectsPaid: number;
  clientMemberSince: string;
  clientReviews: ClientReview[];
}

export interface ClientJob {
  slug: string;
  title: string;
  url: string;
  budget: string;
  publishedAt: string;
}

export interface FreelancerReview {
  jobTitle: string;
  jobUrl: string;
  freelancerName: string;
  freelancerUrl: string;
  rating: number;
  comment: string;
  timeAgo: string;
}

export interface ClientProfile {
  profileUrl: string;
  name: string;
  countryCode: string;
  paymentVerified: boolean;
  rating: number;
  projectsPublished: number;
  projectsPaid: number;
  memberSince: string;
  lastLogin: string;
  openJobs: ClientJob[];
  reviews: FreelancerReview[];
}

export interface Reply {
  telegramMsgId: number;
  projectUrl: string;
  fromId: number;
  fromName: string;
  text: string;
  repliedAt: string;
  processed: boolean;
}
