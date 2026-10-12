import { Badge, Card, DataList, Heading, Progress } from "@radix-ui/themes";

import { formatTime, nextEpochMs, votingEndMs, WalrusState } from "./walrus.ts";

const PHASES = {
	EpochChangeSync: { label: "Epoch change in progress", color: "orange" },
	EpochChangeDone: { label: "Voting open · new commission locked", color: "yellow" },
	NextParamsSelected: { label: "Next committee selected · commission unlocked", color: "green" },
} as const;

export function EpochInfo({ state }: { state: WalrusState }) {
	const phase = PHASES[state.phase];
	const votingEnd = votingEndMs(state);
	const nextEpoch = nextEpochMs(state);
	const usedPct = Number((state.usedCapacity * 10000n) / state.totalCapacity) / 100;

	return (
		<Card size="2">
			<Heading size="4" mb="3">
				Walrus epoch {state.epoch}
			</Heading>
			<DataList.Root size="2">
				<DataList.Item>
					<DataList.Label>Phase</DataList.Label>
					<DataList.Value>
						<Badge color={phase.color}>{phase.label}</Badge>
					</DataList.Value>
				</DataList.Item>
				{state.epochStartMs !== null && (
					<DataList.Item>
						<DataList.Label>Epoch started</DataList.Label>
						<DataList.Value>{formatTime(state.epochStartMs)}</DataList.Value>
					</DataList.Item>
				)}
				{state.phase === "EpochChangeDone" && votingEnd !== null && (
					<DataList.Item>
						<DataList.Label>Commission unlocks</DataList.Label>
						<DataList.Value>{formatTime(votingEnd)} at the earliest, when voting ends</DataList.Value>
					</DataList.Item>
				)}
				{nextEpoch !== null && (
					<DataList.Item>
						<DataList.Label>Next epoch</DataList.Label>
						<DataList.Value>{formatTime(nextEpoch)} at the earliest</DataList.Value>
					</DataList.Item>
				)}
				<DataList.Item>
					<DataList.Label>Epoch length</DataList.Label>
					<DataList.Value>{state.epochDurationMs / 86_400_000} days</DataList.Value>
				</DataList.Item>
				<DataList.Item>
					<DataList.Label>Committee</DataList.Label>
					<DataList.Value>
						{Object.keys(state.committee).length} nodes · {state.nShards} shards
					</DataList.Value>
				</DataList.Item>
				<DataList.Item>
					<DataList.Label>Storage used</DataList.Label>
					<DataList.Value style={{ flexDirection: "column", gap: 4 }}>
						<span>
							{usedPct}% of {Number(state.totalCapacity / 10n ** 12n).toLocaleString()} TB
						</span>
						<Progress value={usedPct} style={{ maxWidth: 240 }} />
					</DataList.Value>
				</DataList.Item>
			</DataList.Root>
		</Card>
	);
}
