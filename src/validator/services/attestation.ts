/**
 * @module validator/attestation
 */
import {
  Attestation,
  AttestationData,
  AttestationDataAndCustodyBit,
  Fork,
  Shard,
  Slot,
  ValidatorIndex
} from "../../types";
import {RpcClient} from "../rpc";
import {PrivateKey} from "@chainsafe/bls-js/lib/privateKey";
import {hashTreeRoot} from "@chainsafe/ssz";
import {getDomainFromFork, slotToEpoch} from "../../chain/stateTransition/util";
import {Domain} from "../../constants";
import logger from "../../logger";
import {intDiv} from "../../util/math";

export class AttestationService {

  private validatorIndex: ValidatorIndex;
  private rpcClient: RpcClient;
  private privateKey: PrivateKey;

  public constructor(validatorIndex: ValidatorIndex, rpcClient: RpcClient, privateKey: PrivateKey) {
    this.validatorIndex = validatorIndex;
    this.rpcClient = rpcClient;
    this.privateKey = privateKey;
  }


  public async createAndPublishAttestation(slot: Slot, shard: Shard, fork: Fork): Promise<Attestation> {
    const attestationData = await this.rpcClient.validator.produceAttestation(slot, shard);
    if (await this.isConflictingAttestation(attestationData)) {
      logger.warn(
        `[Validator] Avoided signing conflicting attestation! `
        + `Source epoch: ${attestationData.sourceEpoch}, Target epoch: ${slotToEpoch(slot)}`
      );
      return null;
    }
    const attestationDataAndCustodyBit: AttestationDataAndCustodyBit = {
      custodyBit: false,
      data: attestationData
    };
    const attestation = await this.createAttestation(attestationDataAndCustodyBit, fork, slot);
    await this.storeAttestation(attestation);
    await this.rpcClient.validator.publishAttestation(attestation);
    logger.info(`[Validator] Signed and publish new attestation`);
    return attestation;
  }

  private async isConflictingAttestation(other: AttestationData): Promise<boolean> {
    // TODO: Fetch last signed attestation data and check
    //  if conflicting (https://github.com/ethereum/eth2.0-specs/blob/dev/specs/core/0_beacon-chain.md#is_slashable_attestation_data)
    return false;
  }

  private async storeAttestation(attestation: Attestation): Promise<void> {
    //TODO: store attestation in database
  }

  private async createAttestation(
    attestationDataAndCustodyBit: AttestationDataAndCustodyBit,
    fork: Fork,
    slot: Slot
  ): Promise<Attestation> {
    const signature = this.privateKey.signMessage(
      hashTreeRoot(attestationDataAndCustodyBit, AttestationDataAndCustodyBit),
      getDomainFromFork(
        fork,
        slotToEpoch(slot),
        Domain.ATTESTATION
      )
    ).toBytesCompressed();
    const committeeAssignment =
      await this.rpcClient.validator.getCommitteeAssignment(this.validatorIndex, slotToEpoch(slot));
    const indexInCommittee =
      committeeAssignment.validators
        .findIndex(value => value === this.validatorIndex);
    const aggregationBitfield = Buffer.alloc(committeeAssignment.validators.length + 7, 0);
    aggregationBitfield[intDiv(indexInCommittee, 8)] = Math.pow(2, indexInCommittee % 8);
    return {
      data: attestationDataAndCustodyBit.data,
      signature,
      custodyBitfield: Buffer.alloc(committeeAssignment.validators.length + 7, 0),
      aggregationBitfield
    };
  }
}
