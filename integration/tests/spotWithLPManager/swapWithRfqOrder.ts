import BigNumber from 'bignumber.js';
import { Contract, ethers, verifyTypedData, TypedDataEncoder, Signature, type ContractTransactionResponse, type Provider, type Wallet, parseEther } from 'ethers';

import { OnchainLobClient } from '../../../src';
import { getTestConfig, type TestConfig } from '../../testConfig';
import { transactionRegex } from '../../testHelpers';
import { erc20Abi, lpmAbi, wdAbi } from '../../../src/abi';
import { RfqOrder } from '../../../src/spot/LPManagerContract';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';

const pythConnection = new EvmPriceServiceConnection('https://hermes.pyth.network');
const priceFeedIds = [
  '0x0affd4b8ad136a21d79bc82450a325ee12ff55a235abc242666e423b8bcffd03', // xtz
  '0xc9d8b075a5c69303365ae23633d4e085199bf5c520a3b90fed1322a0342ffc33', // wbtc
  '0x9d4294bbcd1174d6f2003ec365831e64cc31d9f6f15a2b85399db8d5000960f6', // weth
  '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', // usdc
];
// interface RfqOrder {
//   lobId: number;
//   qty: ethers.BigNumber;
//   price: ethers.BigNumber;
//   isAsk: boolean;
//   postOnly: boolean;
//   expires: ethers.BigNumber;
//   userAddress: string;
//   nonce: ethers.BigNumber;
// }

// const RFQ_ORDER_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(
//   'RfqOrder('
//   + 'uint8 lobId,'
//   + 'uint128 qty,'
//   + 'uint72 price,'
//   + 'bool isAsk,'
//   + 'bool postOnly,'
//   + 'uint256 expires,'
//   + 'address userAddress,'
//   + 'uint128 nonce'
//   + ')'
// ));

// function hash(order: RfqOrder, domainSeparator: string): string {

// const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder();
// const encodedOrder = defaultAbiCoder.encode(
//   ['bytes32', 'uint8', 'uint128', 'uint72', 'bool', 'bool', 'uint256', 'address', 'uint128'],
//   [
//     RFQ_ORDER_TYPEHASH,
//     order.lobId,
//     order.qty,
//     order.price,
//     order.isAsk,
//     order.postOnly,
//     order.expires,
//     order.userAddress,
//     order.nonce,
//   ]
// );
// const orderHash = ethers.keccak256(encodedOrder);
// return TypedDataEncoder.hash(domainSeparator, orderHash);

// "uint8 lobId,"
// "uint128 qty,"
// "uint72 price,"
// "bool isAsk,"
// "bool postOnly,"
// "uint256 expires,"
// "address userAddress,"
// "uint128 nonce"
const orderTypes = {
  RfqOrder: [
    { name: 'lobId', type: 'uint8' },
    { name: 'qty', type: 'uint128' },
    { name: 'price', type: 'uint72' },
    { name: 'isAsk', type: 'bool' },
    { name: 'postOnly', type: 'bool' },
    { name: 'expires', type: 'uint256' },
    { name: 'userAddress', type: 'address' },
    { name: 'nonce', type: 'uint128' },
  ],
};
const domain = {
  name: 'LP Manager',
  version: '4',
  chainId: 128123n,
  verifyingContract: '0x3DE00C91c1584eCc0098c2f165Bd764E70D6E5E8',
  // salt: '0x0000000000000000000000000000000000000000000000000000000000000000',
};

async function hash(order: RfqOrder): Promise<Promise<Promise<string>>> {
  return TypedDataEncoder.hash(domain, orderTypes, {
    lobId: order.lobId,
    qty: order.qty,
    price: order.price,
    isAsk: order.isAsk,
    postOnly: order.postOnly,
    expires: order.expires,
    userAddress: order.userAddress,
    nonce: order.nonce,
  });
}

async function signRfqOrder(order: RfqOrder, signer: Wallet) {
  // const orderHash = await hash(order);
  // const signature = await signer.signMessage(ethers.getBytes(orderHash));

  // console.log('TypedDataEncoder.hash(populated.domain, types, populated.value)',
  //   TypedDataEncoder.hash(domain, orderTypes, {
  //     lobId: order.lobId,
  //     qty: order.qty,
  //     price: order.price,
  //     isAsk: order.isAsk,
  //     postOnly: order.postOnly,
  //     expires: order.expires,
  //     userAddress: order.userAddress,
  //     nonce: order.nonce,
  //   })
  // );
  const signature = await signer.signTypedData(domain, orderTypes, {
    lobId: order.lobId,
    qty: order.qty,
    price: order.price,
    isAsk: order.isAsk,
    postOnly: order.postOnly,
    expires: order.expires,
    userAddress: order.userAddress,
    nonce: order.nonce,
  });
  const splitSig = Signature.from(signature);

  return [{
    ...order,
    v: splitSig.v.toString(),
    r: splitSig.r,
    s: splitSig.s,
  }, signature] as const;
};

describe('Onchain LOB Spot Client Contract API', () => {
  let testConfig: TestConfig;
  let provider: Provider;
  let traderWallet: Wallet;
  let mmSigner: Wallet;
  let onchainLobClient: OnchainLobClient;
  let lpTokenContract: Contract;
  let wxtzContract: Contract;
  let wethContract: Contract;
  let wbtcContract: Contract;
  let usdcContract: Contract;
  let lpManagerContract: Contract;
  let watchDogContract: Contract;

  beforeAll(async () => {
    testConfig = getTestConfig();
    provider = new ethers.JsonRpcProvider(testConfig.rpcUrl);
    traderWallet = new ethers.Wallet(testConfig.accountPrivateKey, provider);
    mmSigner = new ethers.Wallet(testConfig.mmPrivateKey, provider);
    // check if user has 1 unit of each token for interacting
    let contract = new ethers.Contract(testConfig.testMarkets.btcUsd.baseToken.contractAddress, erc20Abi, provider);
    let balance = await contract.balanceOf!(traderWallet.address);
    if (balance < 1n * (10n ** BigInt(testConfig.testMarkets.btcUsd.baseToken.decimals))) {
      throw new Error('User does not have 1 unit of base token');
    }
    contract = new ethers.Contract(testConfig.testMarkets.btcUsd.quoteToken.contractAddress, erc20Abi, provider);
    balance = await contract.balanceOf!(traderWallet.address);
    if (balance < 1n * (10n ** BigInt(testConfig.testMarkets.btcUsd.quoteToken.decimals))) {
      throw new Error('User does not have 1 unit of quote token');
    }
    onchainLobClient = new OnchainLobClient({
      apiBaseUrl: testConfig.onchainLobApiBaseUrl,
      webSocketApiBaseUrl: testConfig.onchainLobWebsocketBaseUrl,
      signer: traderWallet,
      webSocketConnectImmediately: false,
    });
    lpTokenContract = new Contract(
      '0x342E4F7467D434CC73cC8316eE727b09617183c4',
      erc20Abi,
      mmSigner
    );
    wxtzContract = new Contract(
      '0xB1Ea698633d57705e93b0E40c1077d46CD6A51d8',
      erc20Abi,
      mmSigner
    );
    wethContract = new Contract(
      '0x8DEF68408Bc96553003094180E5C90d9fe5b88C1',
      erc20Abi,
      mmSigner
    );
    wbtcContract = new Contract(
      '0x92d81a25F6f46CD52B8230ef6ceA5747Bc3826Db',
      erc20Abi,
      mmSigner
    );
    usdcContract = new Contract(
      '0x9626cC8790c547779551B5948029a4f646853F91',
      erc20Abi,
      mmSigner
    );
    lpManagerContract = new Contract(
      '0x3DE00C91c1584eCc0098c2f165Bd764E70D6E5E8',
      lpmAbi,
      mmSigner
    );
    watchDogContract = new Contract(
      '0xBe63b36599Ab2BAc2b85c0bc0439282837aEf604',
      wdAbi,
      mmSigner
    );
  }, 15_000);

  test('Send rfq order', async () => {
    const market = testConfig.testMarkets.btcUsd.id;
    // let tx: ContractTransactionResponse;

    // const ts = (await provider.getBlock('latest'))!.timestamp;
    // console.log('ts', ts);

    // check and add liquidity in LPManager
    const separator = await lpManagerContract.DOMAIN_SEPARATOR!();
    console.log('separator', separator);
    const eip712Domain = await lpManagerContract.eip712Domain!();
    console.log('eip712Domain', eip712Domain);

    // check LPToken balance
    const balance = await lpTokenContract.balanceOf!(mmSigner.address);
    console.log('balance', balance);
    const wbtcBalance = await wbtcContract.balanceOf!(mmSigner.address);
    console.log('wbtcBalance', wbtcBalance);
    const usdcBalance = await usdcContract.balanceOf!(mmSigner.address);
    console.log('usdcBalance', usdcBalance);
    const lpmManagerContractAddress = await lpManagerContract.getAddress();
    const balanceLpLpm = await lpTokenContract.balanceOf!(lpmManagerContractAddress);
    console.log('balanceLpLpm', balanceLpLpm);
    const wbtcBalanceLpm = await wbtcContract.balanceOf!(lpmManagerContractAddress);
    console.log('wbtcBalanceLpm', wbtcBalanceLpm);
    const usdcBalanceLpm = await usdcContract.balanceOf!(lpmManagerContractAddress);
    console.log('usdcBalanceLpm', usdcBalanceLpm);

    // add liquidity
    // const price = await lpManagerContract.getPriceOf!(0);
    // console.log('price', price);
    const tokens: any[] = [];
    tokens.push(await lpManagerContract.tokens!(0));
    tokens.push(await lpManagerContract.tokens!(1));
    tokens.push(await lpManagerContract.tokens!(2));
    tokens.push(await lpManagerContract.tokens!(3));
    console.log('tokens', tokens);
    const lobs: any[] = [];
    lobs.push(await lpManagerContract.lobs!(0));
    lobs.push(await lpManagerContract.lobs!(1));
    lobs.push(await lpManagerContract.lobs!(2));
    console.log('lobs', lobs);

    // await usdcContract.approve!(lpmManagerContractAddress, 1_000n * 1_000_000n);
    // await new Promise(resolve => setTimeout(resolve, 500));
    // await wbtcContract.approve!(lpmManagerContractAddress, 1n * 100_000_000n / 100n);
    // await new Promise(resolve => setTimeout(resolve, 500));
    const priceFeedUpdateData = await pythConnection.getPriceFeedsUpdateData(priceFeedIds);
    // let priceFeedUpdateData: string[] = [];
    // priceFeedUpdateData = priceFeedUpdateData.concat(await pythConnection.getPriceFeedsUpdateData([priceFeedIds[0]!]));
    // priceFeedUpdateData = priceFeedUpdateData.concat(await pythConnection.getPriceFeedsUpdateData([priceFeedIds[1]!]));
    // priceFeedUpdateData = priceFeedUpdateData.concat(await pythConnection.getPriceFeedsUpdateData([priceFeedIds[2]!]));
    // priceFeedUpdateData = priceFeedUpdateData.concat(await pythConnection.getPriceFeedsUpdateData([priceFeedIds[3]!]));
    // console.log('priceFeedUpdateData', priceFeedUpdateData);
    // let tx = await lpManagerContract.addLiquidity!(
    //   1,
    //   1n * 100_000_000n / 100n,
    //   1n,
    //   1n,
    //   BigInt(Math.floor(Date.now() / 1000) + 60),
    //   priceFeedUpdateData,
    //   // { value: parseEther('0.1'), gasLimit: 30000000, gasPrice: 1000000000n }
    //   { value: parseEther('0.1') }
    // );
    // console.log('tx addLiquidity 1', tx);
    // await new Promise(resolve => setTimeout(resolve, 1500));
    // tx = await lpManagerContract.addLiquidity!(
    //   3,
    //   1_000n * 1_000_000n,
    //   1n,
    //   1n,
    //   BigInt(Math.floor(Date.now() / 1000) + 60),
    //   priceFeedUpdateData,
    //   { value: parseEther('0.1') }
    // );
    // console.log('tx addLiquidity 2', tx);
    // expect(tx.hash).toMatch(transactionRegex);
    // await new Promise(resolve => setTimeout(resolve, 500));

    const info = await onchainLobClient.spot.getMarket({ market });
    expect(info).toBeDefined();
    expect(info?.rawBestBid).not.toBeNull();
    console.log('info.rawBestBid', info!.rawBestBid);

    // let tx = await watchDogContract.touch!();
    // console.log('wd tx', tx);
    // await new Promise(resolve => setTimeout(resolve, 500));
    // const tx = await lpManagerContract.placeOrder!(
    //   1, // BTCUSDC
    //   true,
    //   1000000n,
    //   info!.rawBestBid! - 1n,
    //   parseEther('1'),
    //   false,
    //   false,
    //   BigInt(Math.floor(Date.now() / 1000) + 5),
    //   priceFeedUpdateData,
    //   { value: parseEther('0.1') }
    //   // { value: parseEther('0.1'), gasLimit: 30000000, gasPrice: 1000000000n }
    // );
    // console.log('tx', tx);
    const rfqOrder = {
      lobId: 1,
      qty: 10000n,
      price: info!.rawBestBid! + 1n,
      isAsk: false,
      postOnly: false,
      expires: BigInt(Math.floor(Date.now() / 1000) + 30),
      userAddress: traderWallet.address,
      nonce: BigInt(7),
      v: '0x1b',
      r: '0x2c',
      s: '0x3d',
      priceUpdateData: priceFeedUpdateData,
    };
    const [signedRfqOrder, signature] = await signRfqOrder(rfqOrder, mmSigner);
    const expectedSignerAddress = mmSigner.address;
    const recoveredAddress = verifyTypedData(domain, orderTypes, {
      lobId: rfqOrder.lobId,
      qty: rfqOrder.qty,
      price: rfqOrder.price,
      isAsk: rfqOrder.isAsk,
      postOnly: rfqOrder.postOnly,
      expires: rfqOrder.expires,
      userAddress: rfqOrder.userAddress,
      nonce: rfqOrder.nonce,
    }, signature);
    console.log('signedRfqOrder.v', signedRfqOrder.v);
    console.log('signedRfqOrder.r', signedRfqOrder.r);
    console.log('signedRfqOrder.s', signedRfqOrder.s);
    console.log(recoveredAddress === expectedSignerAddress, expectedSignerAddress);
    console.log('TypedDataEncoder.hashDomain(domain)', TypedDataEncoder.hashDomain(domain));

    await (new Contract(
      '0x92d81a25F6f46CD52B8230ef6ceA5747Bc3826Db',
      erc20Abi,
      traderWallet
    )).approve!(lpmManagerContractAddress, 1n * 500_000n);
    await new Promise(resolve => setTimeout(resolve, 500));
    const tx = await onchainLobClient.spot.placeOrder({
      market,
      type: 'ioc',
      side: 'ask',
      price: info!.rawBestBid! + 1n,
      maxCommission: BigNumber(1),
      size: BigNumber(0.005),
      nativeTokenToSend: parseEther('0.1'),
      transferExecutedTokens: true,
      withVirtualLevels: true,
      // gasLimit: 30000000n,
      // maxFeePerGas: 1000000000n,
    }, signedRfqOrder);
    console.log('tx', tx);
    expect(tx.hash).toMatch(transactionRegex);
  }, 60_000);
});
