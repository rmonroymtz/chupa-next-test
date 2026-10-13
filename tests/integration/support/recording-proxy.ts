import { connect, createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';

export interface RecordingProxy {
  readonly baseUrl: string;
  /**
   * Event-order position of the last bytes the Next server wrote (seen on the
   * upstream socket as they leave Next, before the test client parses them).
   */
  lastUpstreamSeq(): number;
  close(): Promise<void>;
}

/**
 * TCP proxy in front of the Next server that stamps every chunk Next sends
 * with the shared event order. It observes the server side of the response:
 * `after()` callbacks start only once Next has written the whole response,
 * so their backend requests must be ordered after the last upstream chunk,
 * no matter how late the test client gets around to reading the body.
 */
export async function startRecordingProxy(
  targetBaseUrl: string,
  nextSeq: () => number,
): Promise<RecordingProxy> {
  const target = new URL(targetBaseUrl);
  const sockets = new Set<Socket>();
  let lastSeq = 0;

  const server: Server = createServer((client) => {
    const upstream = connect(Number(target.port), target.hostname);
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => {
        client.destroy();
        upstream.destroy();
      });
    }
    upstream.on('data', (chunk: Buffer) => {
      // Stamped synchronously in the socket read callback.
      lastSeq = nextSeq();
      client.write(chunk);
    });
    upstream.on('end', () => client.end());
    client.pipe(upstream);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    lastUpstreamSeq: () => lastSeq,
    close: () =>
      new Promise((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
