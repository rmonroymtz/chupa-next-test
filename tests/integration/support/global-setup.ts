import { buildNext } from './next-server';

/** Builds the app once for every integration test file. */
export default async function setup(): Promise<void> {
  await buildNext();
}
