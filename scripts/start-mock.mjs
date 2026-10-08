import { existsSync } from 'node:fs';
import { Server } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const mockEntry = fileURLToPath(new URL('../frontendchallengeserver/index.js', import.meta.url));
const mockGraph = fileURLToPath(new URL('../frontendchallengeserver/graph.json', import.meta.url));
const mockPackage = fileURLToPath(
  new URL('../frontendchallengeserver/package.json', import.meta.url),
);

if (!existsSync(mockEntry) || !existsSync(mockGraph) || !existsSync(mockPackage)) {
  console.error(
    'The official Avantos mock server is missing or incomplete. From the app directory, run:\n' +
      'git clone https://github.com/mosaic-avantos/frontendchallengeserver.git frontendchallengeserver',
  );
  process.exitCode = 1;
} else {
  const listen = Server.prototype.listen;

  /**
   * Adds a loopback host to the official mock's listen(port, callback) call.
   * This adapter runs only in the mock process; the nested server files stay untouched.
   */
  Server.prototype.listen = function listenOnLoopback(port, callback) {
    return listen.call(this, port, '127.0.0.1', callback);
  };

  createRequire(import.meta.url)(mockEntry);
}
