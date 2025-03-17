import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import {Transaction, TransactionArgument} from '@mysten/sui/transactions';
import {getFullnodeUrl, SuiClient, SuiParsedData} from '@mysten/sui/client';

import {useEffect, useState} from 'react';
import { Button, TextField, Text } from "@radix-ui/themes";
import { FileTextIcon } from "@radix-ui/react-icons";

import { STAKING_OBJ, WALRUS_PKG } from "./constants.ts";
import {ObjectOwner} from "@mysten/sui/src/client/types/generated.ts";
import {Simulate} from "react-dom/test-utils";
import change = Simulate.change;

function prepareTransaction(nodeId: string) {
    if (!nodeId) {
        alert('Node ID is required');
        return
    }
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

type ObjectChangeOverride = {
    digest: string;
    objectId: string;
    objectType?: string;
    recipient?: ObjectOwner;
    sender?: string;
    type?: 'published';
    version: string;
}

type NodeInfoFieldsOverride = {
    node_info: {
        fields: {
            name: string;
            node_id: string;
        }
    }
}

function ClaimCommission() {
    const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    const [ nodes, setNodes ] = useState({});
    const [ nodeId, setNodeId ] = useState('');
    const [ digest, setDigest ] = useState('');
    const currentAccount = useCurrentAccount();


    useEffect(() => {
        const rpcUrl = getFullnodeUrl('mainnet');
        const client = new SuiClient({ url: rpcUrl });
        const fetchNodeData = async () => {
            let nextCursor = null;
            let hasNextPage = false;
            const transactions = [];
            do {
                const res = await client.queryTransactionBlocks({
                    filter: {
                        MoveFunction: {
                            function: 'new',
                            module: 'node_metadata',
                            package: WALRUS_PKG
                        }
                    },
                    cursor: nextCursor
                });
                transactions.push(...res.data);
                nextCursor = res.nextCursor;
                hasNextPage = res.hasNextPage;
            } while (hasNextPage)

            const nodesObjIds = []
            for (let i = 0; i < transactions.length; i += 50) {
                const digests = transactions.slice(i, i + 50).map(x => x.digest);
                const res = await client.multiGetTransactionBlocks({
                    digests,
                    options: {
                        showObjectChanges: true,
                    }
                });

                for (const obj of res) {
                    const objectChanges = obj.objectChanges ?? [];
                    for (const objectChange of objectChanges) {
                        if ((objectChange as unknown as ObjectChangeOverride).objectType?.endsWith('StakingPool')) {
                            nodesObjIds.push((objectChange as unknown as ObjectChangeOverride).objectId);
                        }
                    }
                }
            }

            const nodeData: Record<string, string> = {};
            for (let i = 0; i < nodesObjIds.length; i += 50) {
                const ids = nodesObjIds.slice(i, i + 50);
                const res = await client.multiGetObjects({
                    ids: ids,
                    options: {
                        showContent: true,
                        showType: true,
                    }
                });
                for (const obj of res) {
                    const data: SuiParsedData | null | undefined = obj.data?.content;
                    if (!data) continue;
                    const fields = data.dataType == 'moveObject' ? data.fields : null;
                    if (!fields) continue;
                    const nodeInfo = (fields as NodeInfoFieldsOverride).node_info.fields;
                    nodeData[nodeInfo.name] = nodeInfo.node_id;
                }
            }
            setNodes(nodeData)
        }

        fetchNodeData().catch(console.error)
    }, []);

    return (
        <div style={{ padding: 20 }}>
            {currentAccount && (
                <>
                    <div>
                        <Text as="label">Enter your node ID to claim rewards:</Text>

                        <TextField.Root
                            placeholder="Node ID"
                            onChange={(e) => setNodeId(e.target.value)}
                            value={nodeId}>
                        <TextField.Slot>
                            <FileTextIcon height="16" width="16" />
                        </TextField.Slot>
                    </TextField.Root>
                    <Button
                        style={{ marginTop: 10, marginBottom: 10 }}
                        onClick={async () => {
                            const tx = prepareTransaction(nodeId);
                            if (!tx) {
                                return;
                            }
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
                        disabled={nodeId === ''}
                        >
                            Claim Commission
                        </Button>
                    </div>
                    {digest &&
                        <div>Digest: {digest}</div>
                    }
                </>
            )}
        </div>
    );
}

export default ClaimCommission;