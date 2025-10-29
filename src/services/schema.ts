export const COLLECTIONS = {
  posts: 'posts',
  tutorials: 'tutorials',
  news: 'news'
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];

export interface PostDoc {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  provider: string;
  sourceUrl: string;
  linkedinUrn: string;
  createdAt: any;
  updatedAt: any;
}

export interface TutorialDoc {
  postId: string;
  title: string;
  content: string;
  sourceUrl: string;
  createdAt: any;
  updatedAt: any;
}

export interface NewsDoc {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  sourceUrl: string;
  source: string; // RSS-feed källa
  linkedinUrn: string;
  createdAt: any;
  updatedAt: any;
}

