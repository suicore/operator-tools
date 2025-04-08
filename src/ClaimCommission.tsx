import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction, TransactionArgument } from "@mysten/sui/transactions";
import { getFullnodeUrl, SuiClient, SuiParsedData } from "@mysten/sui/client";

import { useEffect, useState } from "react";
import { Button, Table } from "@radix-ui/themes";

import { CommissionReceiverFields, NodeInfoFieldsOverride, NodeType } from "./types.tsx";
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
	const [multipleNodes, setMultipleNodes] = useState<NodeType[]>([]);
	const [allNodes, setAllNodes] = useState<Record<string, NodeType>>({});
	const [showNodeIds, setShowNodeIds] = useState(false);
	const [showNodeWallets, setShowNodeWallets] = useState(false);
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
		setMultipleNodes([]);
		setDigest("");
		setError("");
		setManualNodeId("");

		const rpcUrl = getFullnodeUrl("mainnet");
		const client = new SuiClient({ url: rpcUrl });
		const fetchNodeData = async () => {
			let hasNextPage = false;
			let cursor = null;
			const nodesObjIds: string[] = [];
			do {
				const nodeRes = await client.getDynamicFields({ parentId: '0x23ec98c791548aad0712822afab68a2a8c2a548b346193873cc80eb2f66d5b5e', cursor })
				nodesObjIds.push(...nodeRes.data.map(nodeInfo => nodeInfo.objectId));
				hasNextPage = nodeRes.hasNextPage;
				cursor = nodeRes.nextCursor;
			} while (hasNextPage)

			const nodeData: Record<string, { name: string; nodeId: string; commissionReceiver: string; type?: string }> = {};
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
					if (nodeData[commissionReceiver]) {
						console.log('1',nodeData[commissionReceiver]);
						console.log('2', {
							name: nodeInfo.name,
							nodeId: nodeInfo.node_id,
							commissionReceiver,
							type: undefined
						})
					}
					nodeData[nodeInfo.node_id] = {
						name: nodeInfo.name,
						nodeId: nodeInfo.node_id,
						commissionReceiver,
						type: undefined
					};
				}
			}

			for (let i = 0; i < Object.keys(nodeData).length; i += 50) {
				const walletIds = Object.values(nodeData).map(x => x.commissionReceiver).slice(i, i + 50);
				const uniqueWalletIds = [...new Set(walletIds)];

				const res = await client.multiGetObjects({
					ids: uniqueWalletIds,
					options: {
						showType: true,
					},
				});

				for (const obj of res) {
					const type: string | null | undefined = obj.data ? obj.data.type?.split('::')[2] : 'Wallet';
					const address: string = obj.data ? obj.data.objectId : (obj as unknown as {error: {object_id: string}}).error.object_id;
					for (const node of Object.values(nodeData)) {
						if (node.commissionReceiver === address) {
							nodeData[node.nodeId].type = type;
						}
					}
				}
			}

			const activeWallet = currentAccount?.address;
			if (!activeWallet) return;
			setAllNodes(nodeData);
			const selectedNodes = Object.values(nodeData).filter((node) => node.commissionReceiver === activeWallet);
			// find and select multiple nodes

			console.log(selectedNodes);

			if (!selectedNodes.length) {
				setError("The wallet isn't associated with any node");
				console.error("Node not found");
				return;
			}

			if (selectedNodes.length > 1) {
				setMultipleNodes(selectedNodes);
				setNode(null);
				return;
			}

			setNode(selectedNodes[0]);
			setMultipleNodes([]);
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
					{multipleNodes.length > 0 && (
							<>
								<div>Multiple nodes found for this wallet:</div>
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: 10,
									}}
								>
									{multipleNodes.map((node) => (
										<div
											key={node.nodeId}
											style={{
												display: "flex",
												flexDirection: "row",
												gap: 10,
												alignItems: "center",
											}}
										>
											<div>{`${node.name} - ${node.nodeId}`}</div>
											<Button
												onClick={() => {
													setNode(node);
													setMultipleNodes([]);
												}}
											>
												Select node
											</Button>
										</div>
									))}
								</div>
							</>
						)
					}
					{digest && (
						<>
							Digest: <a target="_blank" href={`https://suiscan.xyz/mainnet/tx/${digest}`}>{digest}</a>
						</>
					)}
					{!node && error && (
						<>
							<div>Error: {error}</div>
							<div>
								Enter your Node Id to try manually:
							</div>
							<div>
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
			{Object.keys(allNodes).length !== 0 && (
				<div style={{ marginTop: 10, marginBottom: 10 }}>
					<Button onClick={() => {
						if (showNodeWallets) setShowNodeWallets(false);
						setShowNodeIds(!showNodeIds)
					}}>
						Show all nodes
					</Button>
				</div>
			)}
			{Object.keys(allNodes).length !== 0 && (
				<div style={{ marginTop: 10, marginBottom: 10 }}>
					<Button onClick={() => {
						if (showNodeIds) setShowNodeIds(false); setShowNodeWallets(!showNodeWallets);
					}}>
						Show node commission receiver
					</Button>
				</div>
			)}
			{Object.keys(allNodes).length !== 0 && showNodeIds && (
				<>
					<div>Count: {Object.keys(allNodes).length}</div>
					<div>
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
									<Table.ColumnHeaderCell>Node ID</Table.ColumnHeaderCell>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{Object.keys(allNodes)
									.sort((a, b) => allNodes[a].name.localeCompare(allNodes[b].name)) // Sort by name
									.map((key) => (
										<Table.Row key={key}>
											<Table.Cell>{allNodes[key].name}</Table.Cell>
											<Table.Cell>{allNodes[key].nodeId}</Table.Cell>
										</Table.Row>
								))}
							</Table.Body>
						</Table.Root>
					</div>
				</>
			)}
			{Object.keys(allNodes).length !== 0 && showNodeWallets && (
				<>
					<div>Count: {Object.keys(allNodes).length}</div>
					<div>
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
									<Table.ColumnHeaderCell>Commision Wallet</Table.ColumnHeaderCell>
									<Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{Object.keys(allNodes)
									.sort((a, b) => allNodes[a].name.localeCompare(allNodes[b].name)) // Sort by name
									.map((key) => (
										<Table.Row key={key}>
											<Table.Cell>{allNodes[key].name}</Table.Cell>
											<Table.Cell>{allNodes[key].commissionReceiver}</Table.Cell>
											<Table.Cell>{allNodes[key].type}</Table.Cell>
										</Table.Row>
									))}
							</Table.Body>
						</Table.Root>
					</div>
				</>
			)}
		</div>
	);
}

export default ClaimCommission;
