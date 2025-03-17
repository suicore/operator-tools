import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import {Transaction, TransactionArgument} from '@mysten/sui/transactions';
import { useState } from 'react';
import { STAKING_OBJ, WALRUS_PKG } from "./constants.ts";
import { Button, TextField } from "@radix-ui/themes";
import { FileTextIcon } from "@radix-ui/react-icons";

function prepareTransaction(nodeId: string) {
    const tx = new Transaction();
    // Step 1: Get sender
    const sender = tx.moveCall({
        target: "0x2::tx_context::sender"
    });

    // Step 2: Authenticate sender
    const authenticated_obj = tx.moveCall({
        target: `${WALRUS_PKG}::auth::authenticate_sender`,
    });

    // Step 3: Collect commission
    const commission = tx.moveCall({
        target: `${WALRUS_PKG}::staking::collect_commission`,
        arguments: [
            tx.object(STAKING_OBJ),
            tx.object(nodeId),
            authenticated_obj as TransactionArgument,
        ],
    });

    // Step 4: Transfer commission to sender
    tx.transferObjects([commission], sender);

    return tx;
}

function ClaimCommission() {
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const [ nodeId, setNodeId ] = useState('');
    const [digest, setDigest] = useState('');
    const currentAccount = useCurrentAccount();

    return (
        <div style={{ padding: 20 }}>
            {currentAccount && (
                <>
                    <div>
                    <TextField.Root placeholder="Node ID" onChange={(e) => setNodeId(e.target.value)} value={nodeId}>
                        <TextField.Slot>
                            <FileTextIcon height="16" width="16" />
                        </TextField.Slot>
                    </TextField.Root>
                    <Button
                            onClick={async () => {
                                const tx = prepareTransaction(nodeId);
                                console.log(await tx.toJSON())

                                signAndExecuteTransaction(
                                    {
                                        transaction: tx,
                                    },
                                    {
                                        onSuccess: (result) => {
                                            console.log('Executed transaction:', result);
                                            setDigest(result.digest);
                                        },
                                        onError: (error) => {
                                            console.error('Transaction failed:', error);
                                        },
                                    }
                                );
                            }}
                        >
                            Claim Commission
                        </Button>
                    </div>
                    <div>Digest: {digest}</div>
                </>
            )}
        </div>
    );
}

export default ClaimCommission;