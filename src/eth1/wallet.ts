/**
 * @module eth1
 */

import defaults from "./defaults";
import {ContractTransaction, ethers, Wallet} from "ethers";
import {Provider} from "ethers/providers";
import {bytes48, DepositData, number64} from "../types";
import BN from "bn.js";
import bls from "@chainsafe/bls-js";
import {hash} from "../util/crypto"
import {BLS_WITHDRAWAL_PREFIX_BYTE} from "../constants";
import {signingRoot} from "@chainsafe/ssz";
import {BigNumber} from "ethers/utils";

export class Eth1Wallet {

  private wallet: Wallet;

  public constructor(privateKey: string, provider?: Provider) {
    if(!provider) {
      provider = ethers.getDefaultProvider();
    }
    this.wallet = new Wallet(privateKey, provider);
  }

  /**
   * Will deposit 32 ETH to eth2.0 deposit contract.
   * @param address address of deposit contract
   * @param amount amount to wei to deposit on contract
   */
  public async createValidatorDeposit(address: string, value: BigNumber): Promise<string> {
    // Minor hack, no real performance loss
    const amount = new BN(value.toString());

    let contract = new ethers.Contract(address, defaults.depositContract.abi, this.wallet);
    const key = bls.generateKeyPair();
    const withdrawalCredentials = Buffer.concat([BLS_WITHDRAWAL_PREFIX_BYTE, hash(key.publicKey.toBytesCompressed().slice(1))]);

    // Create deposit data
    const depositData: DepositData = {
      pubkey: Buffer.from(key.publicKey.toBytesCompressed()),
      withdrawalCredentials,
      amount,
      signature: Buffer.alloc(96)
    };
    console.log({depositData});
    console.log(signingRoot(depositData.pubkey, bytes48));

  //   const signature = signingRoot(depositData, DepositData);
  //   depositData.signature = hash(signature);
  //
  //   // Send TX
  //   try {
  //     const tx: ContractTransaction = await contract.deposit(
  //       depositData.pubkey,
  //       depositData.withdrawalCredentials,
  //       depositData.signature,
  //       {value: depositData.amount});
  //     await tx.wait();
  //     return tx.hash;
  //   } catch (error) {
  //     console.log(error)
  //   }
  }

}
