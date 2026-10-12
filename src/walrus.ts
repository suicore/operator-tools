import { useEffect, useState } from "react";
import { useDAppKit } from "@mysten/dapp-kit-react";

import { STAKING_OBJ, WALRUS_SYSTEM_OBJ } from "./constants.ts";

type Client = ReturnType<ReturnType<typeof useDAppKit>["getClient"]>;

export type EpochPhase = "EpochChangeSync" | "EpochChangeDone" | "NextParamsSelected";

export type WalrusState = {
	epoch: number;
	epochDurationMs: number;
	phase: EpochPhase;
	/** Null while the epoch change is still syncing. */
	epochStartMs: number | null;
	nShards: number;
	/** Node ID -> number of shards held this epoch. */
	committee: Record<string, number>;
	usedCapacity: bigint;
	totalCapacity: bigint;
};

type StakingInnerJson = {
	epoch: number;
	epoch_duration: string;
	epoch_state: { "@variant": EpochPhase; pos0: string | number };
	n_shards: number;
	committee: { pos0: { contents: { key: string; value: number[] }[] } };
};

type SystemInnerJson = {
	used_capacity_size: string;
	total_capacity_size: string;
};

// Both objects keep their state in a single versioned dynamic field.
async function readInner<T>(client: Client, parentId: string): Promise<T> {
	const { dynamicFields } = await client.core.listDynamicFields({ parentId, limit: 1 });
	const { object } = await client.core.getObject({ objectId: dynamicFields[0].fieldId, include: { json: true } });
	return (object.json as unknown as { value: T }).value;
}

export async function fetchWalrusState(client: Client): Promise<WalrusState> {
	const [staking, system] = await Promise.all([
		readInner<StakingInnerJson>(client, STAKING_OBJ),
		readInner<SystemInnerJson>(client, WALRUS_SYSTEM_OBJ),
	]);
	const phase = staking.epoch_state["@variant"];

	return {
		epoch: staking.epoch,
		epochDurationMs: Number(staking.epoch_duration),
		phase,
		epochStartMs: phase === "EpochChangeSync" ? null : Number(staking.epoch_state.pos0),
		nShards: staking.n_shards,
		committee: Object.fromEntries(staking.committee.pos0.contents.map(({ key, value }) => [key, value.length])),
		usedCapacity: BigInt(system.used_capacity_size),
		totalCapacity: BigInt(system.total_capacity_size),
	};
}

/** Earliest time `voting_end` can run, which unlocks blocked commission for every pool. */
export function votingEndMs(state: WalrusState): number | null {
	return state.epochStartMs === null ? null : state.epochStartMs + state.epochDurationMs / 2;
}

/** Earliest time the next epoch change can start. */
export function nextEpochMs(state: WalrusState): number | null {
	return state.epochStartMs === null ? null : state.epochStartMs + state.epochDurationMs;
}

export function useWalrusState(): WalrusState | null {
	const dAppKit = useDAppKit();
	const [state, setState] = useState<WalrusState | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetchWalrusState(dAppKit.getClient("mainnet"))
			.then((s) => !cancelled && setState(s))
			.catch(console.error);
		return () => {
			cancelled = true;
		};
	}, [dAppKit]);

	return state;
}

export const formatWal = (wal: number) => wal.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function formatRelative(ms: number): string {
	const diff = ms - Date.now();
	if (Math.abs(diff) < 60_000) return "now";
	const hours = Math.floor(Math.abs(diff) / 3_600_000);
	const rel = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${Math.floor((Math.abs(diff) % 3_600_000) / 60_000)}m`;
	return diff > 0 ? `in ${rel}` : `${rel} ago`;
}

export function formatTime(ms: number): string {
	const date = new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
	return `${date} (${formatRelative(ms)})`;
}

export const shortId = (id: string) => `${id.slice(0, 6)}…${id.slice(-4)}`;
