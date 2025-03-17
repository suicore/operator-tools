import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction, TransactionArgument } from "@mysten/sui/transactions";
import { getFullnodeUrl, SuiClient, SuiParsedData } from "@mysten/sui/client";

import { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";

import { CommissionReceiverFields, NodeInfoFieldsOverride, NodeType, ObjectChangeOverride } from "./types.tsx";
import { STAKING_OBJ, WALRUS_PKG } from "./constants.ts";

function prepareTransaction(nodeId: string | undefined): Transaction | null {
	if (!nodeId) {
		alert("Node ID is required");
		return null;
	}
	const tx = new Transaction();
	// Step 1: Get sender
	const sender = tx.moveCall({
		target: "0x2::tx_context::sender",
	});

	// Step 2: Authenticate sender
	const authenticated_obj = tx.moveCall({
		target: `${WALRUS_PKG}::auth::authenticate_sender`,
	});

	// Step 3: Collect commission
	const commission = tx.moveCall({
		target: `${WALRUS_PKG}::staking::collect_commission`,
		arguments: [tx.object(STAKING_OBJ), tx.object(nodeId), authenticated_obj as TransactionArgument],
	});

	// Step 4: Transfer commission to sender
	tx.transferObjects([commission], sender);

	return tx;
}

function ClaimCommission() {
	const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
	const [node, setNode] = useState<NodeType | null>(null);
	const [digest, setDigest] = useState("");
	const [error, setError] = useState("");
	const [manualNodeId, setManualNodeId] = useState("");
	const currentAccount = useCurrentAccount();

	const executeTransaction = () => {
		const nodeId = node?.nodeId ?? manualNodeId;
		const tx = prepareTransaction(nodeId);
		if (!tx) {
			return;
		}

		signAndExecuteTransaction(
			{
				transaction: tx,
			},
			{
				onSuccess: (result) => {
					console.log("Executed transaction:", result);
					setDigest(result.digest);
				},
				onError: (error) => {
					setError(error.message);
					console.error("Transaction failed:", error);
				},
			},
		);
	};

	useEffect(() => {
		setNode(null);
		setDigest("");
		setError("");
		setManualNodeId("");

		const rpcUrl = getFullnodeUrl("mainnet");
		const client = new SuiClient({ url: rpcUrl });
		const fetchNodeData = async () => {
			let nextCursor = null;
			let hasNextPage = false;
			const transactions = [];
			do {
				const res = await client.queryTransactionBlocks({
					filter: {
						MoveFunction: {
							function: "new",
							module: "node_metadata",
							package: WALRUS_PKG,
						},
					},
					cursor: nextCursor,
				});
				transactions.push(...res.data);
				nextCursor = res.nextCursor;
				hasNextPage = res.hasNextPage;
			} while (hasNextPage);

			const nodesObjIds = [];
			for (let i = 0; i < transactions.length; i += 50) {
				const digests = transactions.slice(i, i + 50).map((x) => x.digest);
				const res = await client.multiGetTransactionBlocks({
					digests,
					options: {
						showObjectChanges: true,
					},
				});

				for (const obj of res) {
					const objectChanges = obj.objectChanges ?? [];
					for (const objectChange of objectChanges) {
						if ((objectChange as unknown as ObjectChangeOverride).objectType?.endsWith("StakingPool")) {
							nodesObjIds.push((objectChange as unknown as ObjectChangeOverride).objectId);
						}
					}
				}
			}

			const nodeData: Record<string, { name: string; nodeId: string }> = {};
			for (let i = 0; i < nodesObjIds.length; i += 50) {
				const ids = nodesObjIds.slice(i, i + 50);
				const res = await client.multiGetObjects({
					ids: ids,
					options: {
						showContent: true,
						showType: true,
					},
				});
				for (const obj of res) {
					const data: SuiParsedData | null | undefined = obj.data?.content;
					if (!data) continue;
					const fields = data.dataType == "moveObject" ? data.fields : null;
					if (!fields) continue;

					const commissionReceiver = (fields as CommissionReceiverFields).commission_receiver.fields.pos0;
					const nodeInfo = (fields as NodeInfoFieldsOverride).node_info.fields;
					nodeData[commissionReceiver] = {
						name: nodeInfo.name,
						nodeId: nodeInfo.node_id,
					};
				}
			}
			const activeWallet = currentAccount?.address;
			if (!activeWallet) return;

			const selectedNode = nodeData[activeWallet];
			if (!selectedNode) {
				setError("The wallet isn't associated with any node");
				console.error("Node not found");
				return;
			}

			setNode(selectedNode);
		};

		fetchNodeData().catch(console.error);
	}, [currentAccount]);

	return (
		<div style={{ padding: 20 }}>
			{currentAccount && (
				<>
					{!node && !error && <>Checking if active wallet belongs to a node...</>}
					{node && (
						<>
							<div>
								<div>Node Name: {node.name}</div>
								<div>Node ID: {node.nodeId}</div>
							</div>
							<div>
								<Button style={{ marginTop: 10, marginBottom: 10 }} onClick={executeTransaction}>
									Claim Commission
								</Button>
							</div>
						</>
					)}
					{digest && <>Digest: {digest}</>}
					{!node && error && (
						<>
							<div>Error: {error}</div>
							<div>
								Enter your Node Id to try manually:
								<input type="text" onChange={(e) => setManualNodeId(e.target.value)} />
							</div>
							<div>
								<Button
									style={{ marginTop: 10, marginBottom: 10 }}
									disabled={manualNodeId === ""}
									onClick={executeTransaction}
								>
									Claim Commission
								</Button>
							</div>
						</>
					)}
					{node && error && <div>Error: {error}</div>}
				</>
			)}
		</div>
	);
}

export default ClaimCommission;
