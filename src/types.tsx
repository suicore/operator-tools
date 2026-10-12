export type NodeType = {
	name: string;
	nodeId: string;
	commissionReceiver: string;
	type: string;
	/** Claimable now, i.e. the pool's commission minus what is locked. */
	commission: number;
	poolCommission: number;
	lockedCommission: number;
	extraFieldsId: string | null;
	commissionRateBps: number;
	pendingCommissionRate: { epoch: number; bps: number } | null;
	stakedWal: number;
	state: string;
};

export type WalrusScanNode = {
	validatorHash: string;
	validatorName: string;
	commissionRate: number;
	stake: number;
	state: string;
	nodeCapacity: number;
	storagePrice: number;
	writePrice: number;
	poolShare: number;
	weight: number;
	operator: boolean;
}

export type ObjectChangeOverride = {
	digest: string;
	objectId: string;
	objectType?: string;
	sender?: string;
	type?: "published";
	version: string;
};

export type StakingPoolJson = {
	commission: string;
	commission_rate: number;
	pending_commission_rate: { pos0: { contents: { key: number; value: string }[] } };
	wal_balance: string;
	state: { "@variant": string };
	extra_fields: {
		id: string;
		size: string;
	};
	commission_receiver: {
		pos0: string;
	};
	node_info: {
		name: string;
		node_id: string;
	};
};
