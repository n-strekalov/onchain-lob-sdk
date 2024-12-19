import BigNumber from 'bignumber.js';
import { Contract, type Signer, ContractTransactionResponse, Signature } from 'ethers';
import { TransactionFailedError } from './errors';
import type { Market, Token } from '../models';
import { lpmAbi } from '../abi';
import { PlaceOrderSpotParams } from './params';
import { tokenUtils } from '../utils';
import { wait } from '../utils/delay';

const DEFAULT_MAX_COMMISSION = 340282366920938463463374607431768211455n; // 2^128 - 1
const DEFAULT_ASK_MARKET_PRICE = 1n;
const DEFAULT_BID_MARKET_PRICE = 999999000000000000000n;
const getExpires = () => BigInt(Math.floor(Date.now() / 1000) + 5 * 60);

export interface LPManagerContractOptions {
  market: Market;
  signer: Signer;
  transferExecutedTokensEnabled?: boolean;
  autoWaitTransaction?: boolean;
  fastWaitTransaction?: boolean;
  fastWaitTransactionInterval?: number;
  fastWaitTransactionTimeout?: number;
}

type ReadonlyMarket = Readonly<Omit<Market, 'baseToken' | 'quoteToken'>>
  & Readonly<{ baseToken: Readonly<Token>; quoteToken: Readonly<Token> }>;

export type RfqOrder = {
  lobId: number;
  qty: bigint;
  price: bigint;
  isAsk: boolean;
  postOnly: boolean;
  expires: bigint;
  userAddress: string;
  nonce: bigint;
  v: string;
  r: string;
  s: string;
  priceUpdateData: string[];
};

export type AddLiquidityParams = {
  tokenId: number;
  amount: bigint;
  minUsdValue: bigint;
  minLPMinted: bigint;
  expires: bigint;
};

export class LPManagerContract {
  static readonly defaultTransferExecutedTokensEnabled = true;
  static readonly defaultAutoWaitTransaction = true;
  static readonly defaultFastWaitTransaction = false;
  static readonly defaultFastWaitTransactionInterval = 100;

  readonly market: ReadonlyMarket;
  transferExecutedTokensEnabled: boolean;
  autoWaitTransaction: boolean;
  fastWaitTransaction: boolean;
  fastWaitTransactionInterval: number;
  fastWaitTransactionTimeout?: number;

  protected readonly signer: Signer;
  protected readonly lpmContract: Contract;
  private _chainId: bigint | undefined;
  protected get chainId(): Promise<bigint> {
    if (this._chainId === undefined) {
      return this.signer.provider!.getNetwork().then(network => {
        this._chainId = network.chainId;
        return this._chainId;
      });
    }
    return Promise.resolve(this._chainId);
  }

  constructor(options: Readonly<LPManagerContractOptions>) {
    this.market = options.market;
    this.signer = options.signer;
    this.transferExecutedTokensEnabled = options.transferExecutedTokensEnabled ?? LPManagerContract.defaultTransferExecutedTokensEnabled;
    this.autoWaitTransaction = options.autoWaitTransaction ?? LPManagerContract.defaultAutoWaitTransaction;
    this.fastWaitTransaction = options.fastWaitTransaction ?? LPManagerContract.defaultFastWaitTransaction;
    this.fastWaitTransactionInterval = options.fastWaitTransactionInterval ?? LPManagerContract.defaultFastWaitTransactionInterval;
    this.fastWaitTransactionTimeout = options.fastWaitTransactionTimeout;

    this.lpmContract = new Contract('0x3DE00C91c1584eCc0098c2f165Bd764E70D6E5E8', lpmAbi, options.signer);
  }

  async placeRfqOrder(params: PlaceOrderSpotParams, rfqOrder: RfqOrder): Promise<ContractTransactionResponse> {
    const sizeAmount = this.convertTokensAmountToRawAmountIfNeeded(params.size, this.market.tokenXScalingFactor);
    let priceAmount;
    if (params.type === 'market_execution') {
      priceAmount = params.side === 'ask' ? DEFAULT_ASK_MARKET_PRICE : DEFAULT_BID_MARKET_PRICE;
    }
    else {
      priceAmount = this.convertTokensAmountToRawAmountIfNeeded(params.price, this.market.priceScalingFactor);
    }
    const expires = getExpires();
    // const maxCommission = params.maxCommission === undefined ? DEFAULT_MAX_COMMISSION : this.convertTokensAmountToRawAmountIfNeeded(params.maxCommission, this.market.tokenYScalingFactor);
    const value = params.nativeTokenToSend === undefined
      ? 0n
      : this.convertTokensAmountToRawAmountIfNeeded(params.nativeTokenToSend,
        params.side === 'ask' ? this.market.baseToken.decimals : this.market.quoteToken.decimals);

    const tx = await this.processContractMethodCall(
      this.lpmContract,
      this.lpmContract.swapWithRfqOrder!(
        500_000n, // change me
        false,
        params.side === 'ask',
        sizeAmount,
        priceAmount,
        // maxCommission,
        expires,
        [
          rfqOrder.lobId,
          rfqOrder.qty,
          rfqOrder.price,
          rfqOrder.isAsk,
          rfqOrder.postOnly,
          rfqOrder.expires,
          rfqOrder.userAddress,
          rfqOrder.nonce,
        ],
        rfqOrder.v,
        rfqOrder.r,
        rfqOrder.s,
        rfqOrder.priceUpdateData,
        {
          value,
          gasLimit: params.gasLimit,
          nonce: params.nonce,
          maxFeePerGas: params.maxFeePerGas,
          maxPriorityFeePerGas: params.maxPriorityFeePerGas,
        }
      )
    );

    return tx;
  }

  async addLiquidity(params: AddLiquidityParams): Promise<ContractTransactionResponse> {
    return this.processContractMethodCall(
      this.lpmContract,
      this.lpmContract.addLiquidity!(
        params.tokenId,
        params.amount,
        params.minUsdValue,
        params.minLPMinted,
        params.expires
      )
    );
  }

  private convertTokensAmountToRawAmountIfNeeded(amount: BigNumber | bigint, decimals: number): bigint {
    return typeof amount === 'bigint'
      ? amount
      : tokenUtils.convertTokensAmountToRawAmount(amount, decimals);
  }

  protected async processContractMethodCall(contract: Contract, methodCall: Promise<ContractTransactionResponse>): Promise<ContractTransactionResponse> {
    try {
      const tx = await methodCall;

      if (this.autoWaitTransaction) {
        if (this.fastWaitTransaction) {
          const startingTime = Date.now();
          let receipt = await tx.provider.getTransactionReceipt(tx.hash);

          while (receipt == null) {
            if (this.fastWaitTransactionTimeout && Date.now() - startingTime >= this.fastWaitTransactionTimeout) {
              break; // timeout reached
            }

            await wait(this.fastWaitTransactionInterval);
            receipt = await tx.provider.getTransactionReceipt(tx.hash);
          }
        }
        else {
          await tx.wait();
        }
      }

      return tx;
    }
    catch (error) {
      if ((error as any).data) {
        try {
          const decodedError = contract.interface.parseError((error as any).data);
          throw new TransactionFailedError((error as any).data, decodedError, { cause: error });
        }
        catch (parseError) {
          // If error parsing fails, throw the original error
          console.error('Failed to parse contract error:', parseError);
          throw error;
        }
      }

      throw error;
    }
  }
}
