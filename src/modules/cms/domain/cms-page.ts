/** Magento CMS page. Pure domain type: no framework imports and no I/O. */
export interface CmsPage {
  readonly identifier: string;
  readonly urlKey: string | null;
  /** Url path relative to the site root (no leading slash). */
  readonly relativeUrl: string;
  readonly title: string;
  /** Visible page heading; null when the admin left it empty. */
  readonly contentHeading: string | null;
  /** Page Builder storage HTML (or plain HTML), as filtered by Magento. */
  readonly content: string;
  readonly metaTitle: string | null;
  readonly metaDescription: string | null;
  readonly metaKeywords: string | null;
  readonly pageLayout: string | null;
}
