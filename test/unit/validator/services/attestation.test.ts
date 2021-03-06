import {PrivateKey} from "@chainsafe/bls-js/lib/privateKey";
import {RpcClientOverInstance} from "../../../../src/validator/rpc";
import sinon from "sinon";
import {generateFork} from "../../../utils/fork";
import {expect} from "chai";
import {ValidatorApi} from "../../../../src/rpc/api/validator";
import logger from "../../../../src/logger";
import {generateAttestationData} from "../../../utils/attestation";
import {AttestationService} from "../../../../src/validator/services/attestation";
import {slotToEpoch} from "../../../../src/chain/stateTransition/util";

describe('validator attestation service', function () {

  const sandbox = sinon.createSandbox();

  let rpcClientStub;

  before(() => {
    logger.silent(true);
  });

  beforeEach(() => {
    rpcClientStub = sandbox.createStubInstance(RpcClientOverInstance);
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    logger.silent(false);
  });

  it('should not sign conflicting attestation', async function () {
    const slot = 1;
    const shard = 1;
    const attestationData = generateAttestationData(slot, 1);
    rpcClientStub.validator = sandbox.createStubInstance(ValidatorApi);
    rpcClientStub.validator.produceAttestation.withArgs(slot, shard).resolves(attestationData)

    const isConflictingAttestationStub = sandbox.stub(AttestationService.prototype, "isConflictingAttestation" as any);
    isConflictingAttestationStub.withArgs(attestationData).returns(true);
    const service = new AttestationService(
      0, rpcClientStub, PrivateKey.random()
    );
    const result = await service.createAndPublishAttestation(slot, shard, generateFork());
    expect(result).to.be.null;
  });

  it('should produce correct block', async function () {
    const slot = 1;
    const shard = 1;
    const attestationData = generateAttestationData(slot, 1);
    rpcClientStub.validator = sandbox.createStubInstance(ValidatorApi);
    rpcClientStub.validator.produceAttestation.withArgs(slot, shard).resolves(attestationData);
    rpcClientStub.validator.getCommitteeAssignment.withArgs(0, slotToEpoch(slot)).resolves({
      validators: [0]
    });
    const service = new AttestationService(
      0, rpcClientStub, PrivateKey.random()
    );
    const result = await service.createAndPublishAttestation(slot, shard, generateFork());
    expect(result).to.not.be.null;
    expect(rpcClientStub.validator.publishAttestation.withArgs(
      sinon.match.has('data', attestationData)
        .and(sinon.match.has('signature', sinon.match.defined))
    ).calledOnce).to.be.true;
    expect(
      rpcClientStub.validator.getCommitteeAssignment.withArgs(0, slotToEpoch(slot)).calledOnce
    ).to.be.true;
  });

});
