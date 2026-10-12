import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { Box, Container, Flex, Heading, Text } from "@radix-ui/themes";
import ClaimCommission from "./ClaimCommission.tsx";
import { useWalrusState } from "./walrus.ts";

function App() {
	const walrus = useWalrusState();

	return (
		<>
			<Flex
				position="sticky"
				top="0"
				px="4"
				py="3"
				justify="between"
				align="center"
				style={{
					zIndex: 1,
					backdropFilter: "blur(12px)",
					background: "color-mix(in srgb, var(--color-background) 80%, transparent)",
					borderBottom: "1px solid var(--gray-a4)",
				}}
			>
				<Box>
					<Heading size="4">Walrus Operator Tools</Heading>
					<Text size="1" color="gray">Commission claims and epoch status</Text>
				</Box>
				<ConnectButton />
			</Flex>
			<Container size="3" px="4" py="5">
				<ClaimCommission walrus={walrus} />
			</Container>
		</>
	);
}

export default App;
