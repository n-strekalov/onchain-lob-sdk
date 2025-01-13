import type { Signer } from 'ethers/providers';
import { HanjiSpot } from './spot';
/**
 * The options for the HanjiClient.
 *
 * @interface HanjiClientOptions
 */
export interface HanjiClientOptions {
    /**
     * The base URL for the Hanji API.
     *
     * @type {string}
     */
    apiBaseUrl: string;
    /**
     * The base URL for the Hanji WebSocket API.
     *
     * @type {string}
     */
    webSocketApiBaseUrl: string;
    /**
     * The ethers signer used for signing transactions.
     * For only http/ws operations, you can set this to null.
     *
     * @type {Signer | null}
     */
    signer: Signer | null;
    /**
     * Whether to connect to the WebSocket immediately after creating the HanjiClient (true)
     * or when will be called the first subscription (false).
     * By default, the WebSocket is connected immediately.
     *
     * @type {boolean}
     */
    webSocketConnectImmediately?: boolean;
    /**
     * Whether to automatically wait for transactions to be confirmed.
     *
     * @type {boolean}
     * @optional
     */
    autoWaitTransaction?: boolean;
    /**
     * Whether to use a fast algorithm for waiting for transactions to be confirmed.
     *
     * @type {boolean}
     * @optional
     */
    fastWaitTransaction?: boolean;
    /**
     * Interval between requests in milliseconds when using a fast algorithm for waiting for transaction confirmations.
     *
     * @type {number}
     * @optional
     */
    fastWaitTransactionInterval?: number;
    /**
     * Timeout in milliseconds when using a fast algorithm for waiting for transaction confirmations.
     *
     * @type {number}
     * @optional
     */
    fastWaitTransactionTimeout?: number;
}
/**
 * The client for interacting with the {@link https://hanji.io/|Hanji.io} exchange.
 *
 * @class HanjiClient
 */
export declare class HanjiClient {
    /**
     * The HanjiSpot instance that provides the API functions to interact with the Hanji Spot contracts.
     *
     * @type {HanjiSpot}
     * @readonly
     */
    readonly spot: HanjiSpot;
    /**
     * Creates a new HanjiClient instance.
     *
     * @param {HanjiClientOptions} options - The options for the HanjiClient.
     */
    constructor(options: Readonly<HanjiClientOptions>);
    /**
     * Sets the signer for the HanjiClient.
     *
     * @param {Signer | null} signer - The signer to set. For only http/ws operations, you can set this to null.
     */
    setSigner(signer: Signer | null): void;
}
