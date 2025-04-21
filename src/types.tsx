export type NodeType = {
	name: string;
	nodeId: string;
	commissionReceiver: string;
	type: string;
	commission: number;
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

export type NodeInfoFieldsOverride = {
	node_info: {
		fields: {
			name: string;
			node_id: string;
			commission: number;
		};
	};
};

export type CommissionReceiverFields = {
	commission_receiver: {
		fields: {
			pos0: string;
		};
	};
};
