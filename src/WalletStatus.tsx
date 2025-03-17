import { useCurrentAccount } from "@mysten/dapp-kit";
import { Container, Flex, Text} from "@radix-ui/themes";
import ClaimCommission from "./ClaimCommission.tsx";

export function WalletStatus() {
  const account = useCurrentAccount();

  return (
    <Container my="2">
      {account ? (
        <Flex direction="column">
          <Text>Wallet connected</Text>
          <Text>Address: {account.address}</Text>
        </Flex>
      ) : (
        <Text>Wallet not connected</Text>
      )}
      {/*<OwnedObjects />*/}
      <ClaimCommission />
    </Container>
  );
}
