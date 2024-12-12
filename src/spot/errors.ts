import type { ErrorDescription } from 'ethers';

import { OnchainLobError } from '../common';

export class TransactionFailedError extends OnchainLobError {
  constructor(
    readonly encodedError: string,
    readonly error: ErrorDescription | null,
    options?: ErrorOptions
  ) {
    super(`${error ? `${error.name} [${error.selector}]` : `Unknown error: [${encodedError}]`}`, options);
  }
}
