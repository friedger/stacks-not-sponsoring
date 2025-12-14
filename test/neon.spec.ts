import { StacksNetworkName } from '@stacks/network';
import { getAddressFromPrivateKey, makeContractCall } from '@stacks/transactions';
import { describe, expect, it } from 'vitest';
import { isNeonSponsorable, sponsoredContracts, sponsoredContractsDeployer } from '../src/lib/neon';

const network: StacksNetworkName = 'mainnet';
const privateKey = '753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601';

describe('Sponsoring worker - Neon', () => {
    it('accepts supported contracts', async () => {
        const tx = await makeContractCall({
            contractAddress: sponsoredContractsDeployer,
            contractName: sponsoredContracts[0],
            functionName: 'test',
            functionArgs: [],
            sponsored: true,
            senderKey: privateKey,
        });
        expect(isNeonSponsorable(tx)).toBeTruthy();
    });

    it('rejects not supported contracts', async () => {
        let tx = await makeContractCall({
            contractAddress: 'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ',
            contractName: sponsoredContracts[0],
            functionName: 'test',
            functionArgs: [],
            sponsored: true,
            senderKey: privateKey,
        });
        expect(isNeonSponsorable(tx).isSponsorable).toBeFalsy();

        tx = await makeContractCall({
            contractAddress: sponsoredContractsDeployer,
            contractName: 'testName',
            functionName: 'testFunction',
            functionArgs: [],
            sponsored: true,
            senderKey: privateKey,
        });
        expect(isNeonSponsorable(tx).isSponsorable).toBeFalsy();
    });
});