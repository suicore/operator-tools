import { useState } from "react";
import { Badge, Button, Card, Code, Flex, Heading, Table, Tabs, Text, TextField } from "@radix-ui/themes";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

import { NodeType } from "./types.tsx";
import { formatWal, shortId } from "./walrus.ts";

type Props = {
	nodes: Record<string, NodeType>;
	account: string | undefined;
	onSelect: (node: NodeType) => void;
};

export function NodesTable({ nodes, account, onSelect }: Props) {
	const [query, setQuery] = useState("");
	const q = query.trim().toLowerCase();
	const rows = Object.values(nodes)
		.filter((n) => !q || n.name.toLowerCase().includes(q) || n.nodeId.includes(q) || n.commissionReceiver.includes(q))
		.sort((a, b) => a.name.localeCompare(b.name));

	const nameCell = (node: NodeType) => (
		<Table.RowHeaderCell>
			<Flex gap="2" align="center">
				{node.name}
				{node.commissionReceiver === account && <Badge size="1">Yours</Badge>}
			</Flex>
		</Table.RowHeaderCell>
	);

	return (
		<Card size="2">
			<Flex justify="between" align="center" gap="3" wrap="wrap" mb="3">
				<Heading size="4">
					All nodes{" "}
					<Text size="2" color="gray" weight="regular">
						{rows.length === Object.keys(nodes).length ? rows.length : `${rows.length} of ${Object.keys(nodes).length}`}
					</Text>
				</Heading>
				<TextField.Root placeholder="Search name, node or wallet" value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 240 }}>
					<TextField.Slot>
						<MagnifyingGlassIcon />
					</TextField.Slot>
				</TextField.Root>
			</Flex>
			<Tabs.Root defaultValue="commission">
				<Tabs.List>
					<Tabs.Trigger value="commission">Commission</Tabs.Trigger>
					<Tabs.Trigger value="receivers">Commission receivers</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="commission">
					<Table.Root size="1" mt="2">
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell>Node ID</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell align="right">Pool</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell align="right">Claimable</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{rows.map((node) => (
								<Table.Row key={node.nodeId} align="center">
									{nameCell(node)}
									<Table.Cell><Code variant="ghost" title={node.nodeId}>{shortId(node.nodeId)}</Code></Table.Cell>
									<Table.Cell align="right">{formatWal(node.poolCommission)}</Table.Cell>
									<Table.Cell align="right">{formatWal(node.commission)}</Table.Cell>
									<Table.Cell align="right">
										<Button size="1" variant="soft" onClick={() => onSelect(node)}>Select</Button>
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table.Root>
				</Tabs.Content>
				<Tabs.Content value="receivers">
					<Table.Root size="1" mt="2">
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell>Commission receiver</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{rows.map((node) => (
								<Table.Row key={node.nodeId} align="center">
									{nameCell(node)}
									<Table.Cell><Code variant="ghost" style={{ wordBreak: "break-all" }}>{node.commissionReceiver}</Code></Table.Cell>
									<Table.Cell>
										<Badge color={node.type === "StorageNodeCap" ? "orange" : "gray"}>{node.type || "…"}</Badge>
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table.Root>
				</Tabs.Content>
			</Tabs.Root>
		</Card>
	);
}
