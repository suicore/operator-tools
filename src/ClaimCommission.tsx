import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction, TransactionArgument } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";

import { useEffect, useState } from "react";
import { Badge, Box, Button, Callout, Card, Code, DataList, Flex, Grid, Heading, Link, Spinner, Strong, Text, TextField } from "@radix-ui/themes";
import { CheckCircledIcon, CrossCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";

import { StakingPoolJson, NodeType } from "./types.tsx";
import { BLOCKED_COMMISSION_KEY_TYPE, STAKING_OBJ, WALRUS_PKG } from "./constants.ts";
import { formatRelative, formatWal, shortId, votingEndMs, WalrusState } from "./walrus.ts";
import { EpochInfo } from "./EpochInfo.tsx";
import { NodesTable } from "./NodesTable.tsx";

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
		arguments: [tx.object(STAKING_OBJ), tx.pure.id(nodeId), authenticated_obj as TransactionArgument],
	});

	// Step 4: Transfer commission to sender
	tx.transferObjects([commission], sender);

	return tx;
}

const toWal = (amount: bigint) => Number((Number(amount) / 10**9).toFixed(2));

function ClaimCommission({ walrus }: { walrus: WalrusState | null }) {
	const dAppKit = useDAppKit();
	const currentAccount = useCurrentAccount();
	const [loading, setLoading] = useState(true);
	const [node, setNode] = useState<NodeType | null>(null);
	const [walletNodes, setWalletNodes] = useState<NodeType[]>([]);
	const [allNodes, setAllNodes] = useState<Record<string, NodeType>>({});
	const [claiming, setClaiming] = useState(false);
	const [digest, setDigest] = useState("");
	const [error, setError] = useState("");
	const [manualNodeId, setManualNodeId] = useState("");
	const [refreshKey, setRefreshKey] = useState(0);

	const executeTransaction = () => {
		const tx = prepareTransaction(node?.nodeId ?? manualNodeId.trim());
		if (!tx) {
			return;
		}

		setClaiming(true);
		setError("");
		setDigest("");
		dAppKit
			.signAndExecuteTransaction({ transaction: tx })
			.then((result) => {
				console.log("Executed transaction:", result);
				if (result.FailedTransaction) {
					setDigest(result.FailedTransaction.digest);
					throw new Error(result.FailedTransaction.status.error?.message ?? "Transaction failed");
				}
				setDigest(result.Transaction.digest);
				// Re-read balances only once the fullnode has indexed the claim, or we'd show the old amount.
				return dAppKit
					.getClient("mainnet")
					.core.waitForTransaction({ digest: result.Transaction.digest })
					.then(() => setRefreshKey((k) => k + 1));
			})
			.catch((error) => {
				setError(error.message);
				console.error("Transaction failed:", error);
			})
			.finally(() => setClaiming(false));
	};

	const selectNode = (selected: NodeType | null) => {
		setNode(selected);
		setDigest("");
		setError("");
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	useEffect(() => {
		setLoading(true);
		setNode(null);
		setWalletNodes([]);
		setDigest("");
		setError("");
		setManualNodeId("");
		setRefreshKey(0);
	}, [currentAccount]);

	useEffect(() => {
		let cancelled = false;
		const client = dAppKit.getClient("mainnet");
		const totalCommission: Record<string, bigint> = {};

		// Commission added at epoch change stays locked until voting ends, and
		// collect_commission only pays out the rest.
		const resolveLockedCommission = (nodes: NodeType[]) => Promise.all(nodes.map(async (node) => {
			if (!node.extraFieldsId) return;
			try {
				const { dynamicField } = await client.core.getDynamicField({
					parentId: node.extraFieldsId,
					// Empty Move structs get a `dummy_field: bool`, so the key's BCS is a single false byte.
					name: { type: BLOCKED_COMMISSION_KEY_TYPE, bcs: new Uint8Array([0]) },
				});
				const total = totalCommission[node.nodeId];
				const locked = BigInt(bcs.u64().parse(dynamicField.value.bcs));
				node.lockedCommission = toWal(locked > total ? total : locked);
				node.commission = toWal(locked > total ? 0n : total - locked);
			} catch {
				// No blocked-commission key means everything is collectable.
			}
		}));

		const fetchNodeData = async () => {
			let cursor: string | null = null;
			const nodesObjIds: string[] = [];
			do {
				const nodeRes: Awaited<ReturnType<typeof client.core.listDynamicFields>> = await client.core.listDynamicFields({ parentId: '0x23ec98c791548aad0712822afab68a2a8c2a548b346193873cc80eb2f66d5b5e', cursor })
				nodesObjIds.push(...nodeRes.dynamicFields.map(field => field.childId ?? field.fieldId));
				cursor = nodeRes.hasNextPage ? nodeRes.cursor : null;
			} while (cursor)

			const nodeData: Record<string, NodeType> = {};
			// getObjects batches requests internally, so no manual chunking is needed.
			const { objects: pools } = await client.core.getObjects({
				objectIds: nodesObjIds,
				include: { json: true },
			});

			for (const obj of pools) {
				if (obj instanceof Error || !obj.json) continue;
				const fields = obj.json as unknown as StakingPoolJson;
				const nodeInfo = fields.node_info;

				totalCommission[nodeInfo.node_id] = BigInt(fields.commission);
				const pending = fields.pending_commission_rate.pos0.contents;
				const pendingRate = pending[pending.length - 1];
				nodeData[nodeInfo.node_id] = {
					name: nodeInfo.name,
					nodeId: nodeInfo.node_id,
					commission: toWal(BigInt(fields.commission)),
					poolCommission: toWal(BigInt(fields.commission)),
					lockedCommission: 0,
					commissionRateBps: fields.commission_rate,
					pendingCommissionRate: pendingRate ? { epoch: pendingRate.key, bps: Number(pendingRate.value) } : null,
					stakedWal: toWal(BigInt(fields.wal_balance)),
					state: fields.state["@variant"],
					extraFieldsId: fields.extra_fields.size === '0' ? null : fields.extra_fields.id,
					commissionReceiver: fields.commission_receiver.pos0,
					type: '',
				};
			}

			const walletIds = [...new Set(Object.values(nodeData).map(x => x.commissionReceiver))];
			const { objects: wallets } = await client.core.getObjects({ objectIds: walletIds });

			for (const [idx, obj] of wallets.entries()) {
				// Plain addresses aren't objects, so the lookup errors.
				const type = obj instanceof Error ? 'Wallet' : obj.type.split('::')[2];
				for (const node of Object.values(nodeData)) {
					if (node.commissionReceiver === walletIds[idx]) {
						node.type = type;
					}
				}
			}

			const activeWallet = currentAccount?.address;
			const selectedNodes = activeWallet ? Object.values(nodeData).filter((node) => node.commissionReceiver === activeWallet) : [];
			await resolveLockedCommission(selectedNodes);
			if (cancelled) return;
			setAllNodes(nodeData);
			setWalletNodes(selectedNodes);
			// Keep the user's selection across refreshes, pointing it at the fresh data.
			setNode((prev) => (prev ? nodeData[prev.nodeId] ?? prev : selectedNodes.length === 1 ? selectedNodes[0] : null));
			setLoading(false);

			// The rest only feed the all-nodes table, so fill them in without blocking the claim UI.
			resolveLockedCommission(Object.values(nodeData).filter((node) => !selectedNodes.includes(node)))
				.then(() => !cancelled && setAllNodes({ ...nodeData }))
				.catch(console.error);
		};

		fetchNodeData().catch((e) => {
			console.error(e);
			if (!cancelled) {
				setError(`Couldn't load node data: ${e.message}`);
				setLoading(false);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [currentAccount, dAppKit, refreshKey]);

	const account = currentAccount?.address;

	return (
		<Flex direction="column" gap="4">
			<Card size="3">
				{!account ? (
					<Flex direction={{ initial: "column", sm: "row" }} justify="between" align={{ sm: "center" }} gap="4">
						<Box>
							<Heading size="5" mb="1">Claim your node commission</Heading>
							<Text color="gray">Connect the wallet that is set as your node's commission receiver.</Text>
						</Box>
						<ConnectButton />
					</Flex>
				) : loading ? (
					<Flex align="center" gap="3">
						<Spinner size="3" />
						<Text color="gray">Looking up nodes for this wallet…</Text>
					</Flex>
				) : node ? (
					<ClaimPanel
						node={node}
						walrus={walrus}
						isManual={node.commissionReceiver !== account}
						claiming={claiming}
						onClaim={executeTransaction}
						onSwitch={walletNodes.length > 1 || !walletNodes.includes(node) ? () => selectNode(walletNodes.length === 1 ? walletNodes[0] : null) : undefined}
					/>
				) : walletNodes.length > 1 ? (
					<NodePicker nodes={walletNodes} onSelect={selectNode} />
				) : (
					<Flex direction="column" gap="3">
						<Heading size="5">No node found for this wallet</Heading>
						<Text color="gray">
							The connected wallet isn't the commission receiver of any node. Pick a node from the table below, or enter a node ID to try a claim anyway.
						</Text>
						<Flex gap="2" wrap="wrap">
							<TextField.Root
								placeholder="0x… node ID"
								value={manualNodeId}
								onChange={(e) => setManualNodeId(e.target.value)}
								style={{ flex: "1 1 320px" }}
							/>
							<Button disabled={manualNodeId.trim() === ""} loading={claiming} onClick={executeTransaction}>
								Claim commission
							</Button>
						</Flex>
					</Flex>
				)}

				{account && (digest || error) && (
					<Flex direction="column" gap="2" mt="4">
						{digest && !error && (
							<Callout.Root color="green">
								<Callout.Icon><CheckCircledIcon /></Callout.Icon>
								<Callout.Text>
									Commission claimed. <TxLinks digest={digest} />
								</Callout.Text>
							</Callout.Root>
						)}
						{error && (
							<Callout.Root color="red">
								<Callout.Icon><CrossCircledIcon /></Callout.Icon>
								<Callout.Text>
									{error}
									{digest && <> <TxLinks digest={digest} /></>}
								</Callout.Text>
							</Callout.Root>
						)}
					</Flex>
				)}
			</Card>

			<Grid columns={{ initial: "1", md: node ? "2" : "1" }} gap="4" align="start">
				{node && <NodeDetails node={node} walrus={walrus} />}
				{walrus && <EpochInfo state={walrus} />}
			</Grid>

			{Object.keys(allNodes).length !== 0 && (
				<NodesTable nodes={allNodes} account={account} onSelect={selectNode} />
			)}
		</Flex>
	);
}

function TxLinks({ digest }: { digest: string }) {
	return (
		<>
			<Link href={`https://suiscan.xyz/mainnet/tx/${digest}`} target="_blank" rel="noreferrer">
				View <Code variant="ghost">{shortId(digest)}</Code> on Suiscan
			</Link>
		</>
	);
}

const formatRate = (bps: number) => `${bps / 100}%`;

type ClaimPanelProps = {
	node: NodeType;
	walrus: WalrusState | null;
	isManual: boolean;
	claiming: boolean;
	onClaim: () => void;
	onSwitch?: () => void;
};

function ClaimPanel({ node, walrus, isManual, claiming, onClaim, onSwitch }: ClaimPanelProps) {
	const unlock = walrus?.phase === "EpochChangeDone" ? votingEndMs(walrus) : null;

	return (
		<Flex direction="column" gap="4">
			<Flex direction={{ initial: "column", sm: "row" }} justify="between" align={{ sm: "end" }} gap="4">
				<Box>
					<Flex align="center" gap="2" mb="3" wrap="wrap">
						<Heading size="5">{node.name}</Heading>
						<Badge color={node.state === "Active" ? "green" : "gray"}>{node.state}</Badge>
						{onSwitch && (
							<Button size="1" variant="ghost" color="gray" onClick={onSwitch}>
								Change node
							</Button>
						)}
					</Flex>
					<Text as="div" size="2" color="gray">Claimable now</Text>
					<Flex align="baseline" gap="2">
						<Text size="8" weight="bold">{formatWal(node.commission)}</Text>
						<Text size="4" color="gray">WAL</Text>
					</Flex>
					<Flex gap="4" mt="2" wrap="wrap">
						<Text size="2" color="gray">
							Pool <Strong>{formatWal(node.poolCommission)}</Strong> WAL
						</Text>
						{node.lockedCommission > 0 && (
							<Text size="2" color="gray">
								Locked <Strong>{formatWal(node.lockedCommission)}</Strong> WAL
								{unlock ? ` · unlocks ${formatRelative(unlock)} at the earliest` : " · unlocks when voting ends"}
							</Text>
						)}
					</Flex>
				</Box>
				<Button size="4" loading={claiming} disabled={node.commission === 0} onClick={onClaim}>
					Claim {formatWal(node.commission)} WAL
				</Button>
			</Flex>

			{isManual && (
				<Callout.Root color="orange" size="1">
					<Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
					<Callout.Text>This node isn't linked to the connected wallet, so the claim will fail unless you are its commission receiver.</Callout.Text>
				</Callout.Root>
			)}
			{node.type === "StorageNodeCap" && (
				<Callout.Root color="red" size="1">
					<Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
					<Callout.Text>Commission goes to a StorageNodeCap, which this tool can't claim with. Please claim using the CLI.</Callout.Text>
				</Callout.Root>
			)}
			{node.poolCommission === 0 && (
				<Callout.Root color="yellow" size="1">
					<Callout.Icon><InfoCircledIcon /></Callout.Icon>
					<Callout.Text>No commission assigned at this time. Please check again next epoch.</Callout.Text>
				</Callout.Root>
			)}
		</Flex>
	);
}

function NodePicker({ nodes, onSelect }: { nodes: NodeType[]; onSelect: (node: NodeType) => void }) {
	return (
		<Flex direction="column" gap="3">
			<Heading size="5">This wallet receives commission for {nodes.length} nodes</Heading>
			{nodes.map((node) => (
				<Flex key={node.nodeId} justify="between" align="center" gap="3" wrap="wrap">
					<Box>
						<Text as="div" weight="medium">{node.name}</Text>
						<Text as="div" size="1" color="gray">{formatWal(node.commission)} WAL claimable</Text>
					</Box>
					<Button variant="soft" onClick={() => onSelect(node)}>Select</Button>
				</Flex>
			))}
		</Flex>
	);
}

function NodeDetails({ node, walrus }: { node: NodeType; walrus: WalrusState | null }) {
	const shards = walrus?.committee[node.nodeId];

	return (
		<Card size="2">
			<Heading size="4" mb="3">Node details</Heading>
			<DataList.Root size="2">
				<DataList.Item>
					<DataList.Label>Node ID</DataList.Label>
					<DataList.Value>
						<Code variant="ghost" style={{ wordBreak: "break-all" }}>{node.nodeId}</Code>
					</DataList.Value>
				</DataList.Item>
				<DataList.Item>
					<DataList.Label>Committee</DataList.Label>
					<DataList.Value>
						{!walrus ? "…" : shards ? <Badge color="blue">In committee · {shards} shards</Badge> : <Badge color="gray">Not in committee</Badge>}
					</DataList.Value>
				</DataList.Item>
				<DataList.Item>
					<DataList.Label>Staked</DataList.Label>
					<DataList.Value>{formatWal(node.stakedWal)} WAL</DataList.Value>
				</DataList.Item>
				<DataList.Item>
					<DataList.Label>Commission rate</DataList.Label>
					<DataList.Value>
						{formatRate(node.commissionRateBps)}
						{node.pendingCommissionRate && ` → ${formatRate(node.pendingCommissionRate.bps)} from epoch ${node.pendingCommissionRate.epoch}`}
					</DataList.Value>
				</DataList.Item>
				<DataList.Item>
					<DataList.Label>Commission receiver</DataList.Label>
					<DataList.Value style={{ flexDirection: "column", gap: 4 }}>
						<Code variant="ghost" style={{ wordBreak: "break-all" }}>{node.commissionReceiver}</Code>
						{node.type && <Badge color={node.type === "StorageNodeCap" ? "orange" : "gray"} style={{ alignSelf: "start" }}>{node.type}</Badge>}
					</DataList.Value>
				</DataList.Item>
			</DataList.Root>
		</Card>
	);
}

export default ClaimCommission;
