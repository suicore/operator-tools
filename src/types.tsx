export type NodeType = {
	name: string;
	nodeId: string;
};

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
