/** Magento CMS block. Pure domain type: no framework imports and no I/O. */
export interface CmsBlock {
  readonly identifier: string;
  readonly title: string;
  /** Page Builder storage HTML (or plain HTML), as filtered by Magento; may be empty. */
  readonly content: string;
}
